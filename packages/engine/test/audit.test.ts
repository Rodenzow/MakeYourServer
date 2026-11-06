import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { fromBitfield, toBitfield, DEFAULT_EVERYONE_PERMISSIONS } from "@mys/core";
import { eq, getDb, projects, serverAudits } from "@mys/db";
import {
  AccessDeniedError,
  AuditFixError,
  BotMissingError,
  FakeGateway,
  GatewayError,
  confirmInstallation,
  latestServerAudit,
  latestServerScores,
  prepareAuditFixes,
  prepareInstallation,
  runInstallation,
  runServerAudit,
  saveAuditFixMapping,
} from "../src";
import { createUser, resetDb, setupDb, teardownDb } from "./helpers";

beforeAll(setupDb);
afterAll(teardownDb);
beforeEach(resetDb);

function fragileGuild() {
  const gw = FakeGateway.emptyGuild({ name: "Serveur fragile" });
  const everyone = gw.state.roles.find((r) => r.id === gw.state.id)!;
  everyone.permissions = toBitfield([...DEFAULT_EVERYONE_PERMISSIONS, "MENTION_EVERYONE", "KICK_MEMBERS"]).toString();
  const cat = gw.state.channels.find((c) => c.type === 4)!;
  gw.state.channels.push({ id: "700000000000000001", name: "annonces", type: 0, parentId: cat.id, position: 5, permissionOverwrites: [] });
  return gw;
}

describe("runServerAudit", () => {
  it("analyse le serveur, enregistre le rapport et renvoie la dernière analyse", async () => {
    const gw = fragileGuild();
    const user = await createUser(gw.state.ownerId);
    const result = await runServerAudit(gw, { userId: user.id, guildId: gw.state.id });
    expect(result.guildName).toBe("Serveur fragile");
    expect(result.report.issues.some((i) => i.id === "everyone-dangerous")).toBe(true);
    expect(result.score).toBeLessThanOrEqual(69);
    const rows = await getDb().select().from(serverAudits).where(eq(serverAudits.userId, user.id));
    expect(rows).toHaveLength(1);
    const latest = await latestServerAudit(user.id, gw.state.id);
    expect(latest?.id).toBe(result.id);
    expect(latest?.report.score).toBe(result.score);
    expect((await latestServerScores(user.id)).get(gw.state.id)?.score).toBe(result.score);
    expect(await latestServerAudit(user.id, "123456789012345678")).toBeNull();
    // Aucune modification n’a été envoyée à Discord.
    expect(gw.calls.filter((c) => !["fetchState"].includes(c.method))).toEqual([]);
  });

  it("refuse un membre sans « Gérer le serveur »", async () => {
    const gw = fragileGuild();
    const user = await createUser("100000000000000777");
    gw.members.set(user.discordId, []);
    await expect(runServerAudit(gw, { userId: user.id, guildId: gw.state.id })).rejects.toBeInstanceOf(AccessDeniedError);
    const outsider = await createUser("100000000000000778");
    await expect(runServerAudit(gw, { userId: outsider.id, guildId: gw.state.id })).rejects.toBeInstanceOf(AccessDeniedError);
  });

  it("signale un bot absent du serveur", async () => {
    const gw = fragileGuild();
    const user = await createUser(gw.state.ownerId);
    gw.failures.push({ method: "fetchState", error: new GatewayError("Serveur introuvable ou bot retiré du serveur.", 10004, 404, false) });
    await expect(runServerAudit(gw, { userId: user.id, guildId: gw.state.id })).rejects.toBeInstanceOf(BotMissingError);
  });
});

describe("correctifs de l’analyse", () => {
  it("installe les correctifs en mode fusion sans doublon et améliore le score", async () => {
    const gw = fragileGuild();
    const user = await createUser(gw.state.ownerId);
    const before = await runServerAudit(gw, { userId: user.id, guildId: gw.state.id });
    const fixIds = [...new Set(before.report.issues.map((i) => i.fix).filter((f): f is NonNullable<typeof f> => !!f))];
    expect(fixIds).toEqual(expect.arrayContaining(["everyone-permissions", "verification", "content-filter", "notifications", "automod-basics", "announcements-readonly"]));

    const prepared = await prepareAuditFixes(gw, { userId: user.id, guildId: gw.state.id, fixIds });
    const [project] = await getDb().insert(projects).values({ userId: user.id, name: "Correctifs", sourceType: "audit", spec: prepared.spec }).returning();
    await saveAuditFixMapping(gw.state.id, project!.id, prepared.mapping);

    const channelsBefore = gw.state.channels.length;
    const rolesBefore = gw.state.roles.length;
    const { installation, plan } = await prepareInstallation(gw, { userId: user.id, guildId: gw.state.id, source: { projectId: project!.id }, options: { mode: "merge" } as never });
    expect(plan.blockers).toEqual([]);
    expect(plan.ops.some((o) => o.destructive)).toBe(false);
    await confirmInstallation(gw, { installationId: installation.id, userId: user.id, confirmDestructive: false });
    const inst = await runInstallation(installation.id, { gateway: gw, reconcileSkewMs: 60_000 });
    expect(inst.status).toBe("succeeded");

    expect(gw.state.channels.length).toBe(channelsBefore);
    expect(gw.state.roles.length).toBe(rolesBefore);
    const everyone = fromBitfield(gw.state.roles.find((r) => r.id === gw.state.id)!.permissions);
    expect(everyone).not.toContain("KICK_MEMBERS");
    expect(everyone).not.toContain("MENTION_EVERYONE");
    expect(everyone).toContain("SEND_MESSAGES");
    expect(gw.state.verificationLevel).toBe(2);
    expect(gw.state.explicitContentFilter).toBe(2);
    expect(gw.state.defaultMessageNotifications).toBe(1);
    expect(gw.state.automodRules?.length).toBe(3);

    const after = await runServerAudit(gw, { userId: user.id, guildId: gw.state.id });
    expect(after.report.counts.critical).toBe(0);
    expect(after.score).toBeGreaterThan(before.score);
    expect(after.report.issues.map((i) => i.fix).filter(Boolean)).toEqual([]);
  });

  it("refuse une sélection vide ou qui laisserait le projet invalide", async () => {
    const gw = fragileGuild();
    const user = await createUser(gw.state.ownerId);
    await expect(prepareAuditFixes(gw, { userId: user.id, guildId: gw.state.id, fixIds: [] })).rejects.toBeInstanceOf(AuditFixError);
    await expect(prepareAuditFixes(gw, { userId: user.id, guildId: gw.state.id, fixIds: ["verification"] })).rejects.toThrow(/@everyone/);
  });
});
