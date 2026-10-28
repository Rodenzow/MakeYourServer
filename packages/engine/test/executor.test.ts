import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DISCORD_CHANNEL_TYPE, toBitfield } from "@mys/core";
import { OFFICIAL_TEMPLATES } from "@mys/core/templates";
import { eq, getDb, guildFeatures, installationSteps, installations, resourceMappings, backups } from "@mys/db";
import {
  AccessDeniedError,
  FakeGateway,
  GatewayError,
  RetryLaterError,
  SimulatedCrash,
  cancelInstallation,
  confirmInstallation,
  createBackup,
  prepareInstallation,
  retryInstallation,
  runInstallation,
  InstallError,
} from "../src";
import { createProject, createUser, resetDb, setupDb, teardownDb, templateSpec } from "./helpers";

beforeAll(setupDb);
afterAll(teardownDb);
beforeEach(resetDb);

const nonCategoryNames = (gw: FakeGateway) => gw.state.channels.filter((c) => c.type !== 4).map((c) => `${c.parentId}/${c.name}`);
const dupes = (xs: string[]) => xs.filter((x, i) => xs.indexOf(x) !== i);

async function installTemplate(gw: FakeGateway, slug: string, options: Record<string, unknown> = { mode: "empty" }) {
  const user = await createUser(gw.state.ownerId);
  const project = await createProject(user.id, templateSpec(slug));
  const { installation, plan } = await prepareInstallation(gw, { userId: user.id, guildId: gw.state.id, source: { projectId: project.id }, options: options as never });
  expect(plan.blockers, JSON.stringify(plan.blockers)).toEqual([]);
  await confirmInstallation(gw, { installationId: installation.id, userId: user.id, confirmDestructive: true });
  return { user, project, installationId: installation.id };
}

async function runToEnd(id: string, gw: FakeGateway, maxRuns = 10) {
  for (let i = 0; i < maxRuns; i++) {
    try {
      return await runInstallation(id, { gateway: gw, reconcileSkewMs: 60_000 });
    } catch (e) {
      if (!(e instanceof SimulatedCrash || e instanceof RetryLaterError)) throw e;
    }
  }
  throw new Error("trop de reprises");
}

describe("installation complète des templates officiels", () => {
  for (const t of OFFICIAL_TEMPLATES) {
    it(`installe « ${t.slug} » sur un serveur vide sans erreur ni doublon`, async () => {
      const gw = FakeGateway.emptyGuild();
      const { installationId } = await installTemplate(gw, t.slug);
      const inst = await runToEnd(installationId, gw);
      const steps = await getDb().select().from(installationSteps).where(eq(installationSteps.installationId, installationId));
      const failed = steps.filter((s) => s.status === "failed").map((s) => `${s.key}: ${s.error}`);
      expect(failed).toEqual([]);
      expect(inst.status).toBe("succeeded");
      const spec = templateSpec(t.slug);
      expect(dupes(nonCategoryNames(gw))).toEqual([]);
      for (const r of spec.roles) expect(gw.state.roles.some((x) => x.name === r.name)).toBe(true);
      expect(gw.count("sendMessage")).toBe(spec.messages.length);
      if (spec.settings.community) {
        expect(gw.state.features).toContain("COMMUNITY");
        if (spec.onboarding?.enabled) expect(gw.state.onboarding?.enabled).toBe(true);
      }
      // Les rôles du projet sont placés sous le rôle du bot, dans l’ordre du projet.
      const positions = spec.roles.map((r) => gw.state.roles.find((x) => x.name === r.name)!.position);
      expect([...positions].sort((a, b) => b - a)).toEqual(positions);
      // Une sauvegarde de sécurité a été prise avant toute modification.
      const [b] = await getDb().select().from(backups).where(eq(backups.installationId, installationId));
      expect(b?.kind).toBe("safety");
      const [features] = await getDb().select().from(guildFeatures).where(eq(guildFeatures.guildId, gw.state.id));
      expect(features).toBeTruthy();
    });
  }
});

describe("reprise et absence de doublons", () => {
  it("reprend après un arrêt brutal juste après la création d’un salon, sans le recréer", async () => {
    const gw = FakeGateway.emptyGuild();
    const { installationId } = await installTemplate(gw, "communaute");
    gw.crashAfter = { method: "createChannel", count: 5 };
    await expect(runInstallation(installationId, { gateway: gw, reconcileSkewMs: 60_000 })).rejects.toBeInstanceOf(SimulatedCrash);
    const before = gw.count("createChannel");
    const inst = await runToEnd(installationId, gw);
    expect(inst.status).toBe("succeeded");
    expect(dupes(nonCategoryNames(gw))).toEqual([]);
    const steps = await getDb().select().from(installationSteps).where(eq(installationSteps.installationId, installationId));
    expect(steps.some((s) => /Retrouvée? après interruption/.test(s.detail ?? ""))).toBe(true);
    const spec = templateSpec("communaute");
    const expectedChannels = spec.categories.length + spec.categories.reduce((n, c) => n + c.channels.length, 0) + spec.uncategorized.length;
    expect(before + (gw.count("createChannel") - before)).toBe(expectedChannels);
  });

  it("ne republie pas un message après un arrêt suivant son envoi", async () => {
    const gw = FakeGateway.emptyGuild();
    const { installationId } = await installTemplate(gw, "communaute");
    gw.crashAfter = { method: "sendMessage", count: 2 };
    await runToEnd(installationId, gw);
    const total = [...gw.messages.values()].reduce((n, l) => n + l.length, 0);
    expect(total).toBe(templateSpec("communaute").messages.length);
  });

  it("une erreur temporaire de Discord (500) déclenche une nouvelle tentative sans doublon", async () => {
    const gw = FakeGateway.emptyGuild();
    const { installationId } = await installTemplate(gw, "gaming");
    gw.failures.push({ method: "createRole", error: new GatewayError("Discord indisponible", 500, 500, true), times: 1 });
    await expect(runInstallation(installationId, { gateway: gw })).rejects.toBeInstanceOf(RetryLaterError);
    const inst = await runToEnd(installationId, gw);
    expect(inst.status).toBe("succeeded");
    expect(dupes(gw.state.roles.map((r) => r.name))).toEqual([]);
  });

  it("un échec définitif donne un statut « partiel », puis la relance termine sans doublon", async () => {
    const gw = FakeGateway.emptyGuild();
    const { installationId, user } = await installTemplate(gw, "communaute");
    gw.failures.push({ method: "createChannel", when: (a) => (a[0] as { name: string }).name.includes("faq"), error: new GatewayError("Le bot n’a pas les permissions nécessaires.", 50013, 403, false), times: 1 });
    const inst = await runToEnd(installationId, gw);
    expect(inst.status).toBe("partial");
    const steps = await getDb().select().from(installationSteps).where(eq(installationSteps.installationId, installationId));
    const failed = steps.filter((s) => s.status === "failed");
    expect(failed.length).toBeGreaterThanOrEqual(1);
    // Le message de la FAQ dépend du salon : il échoue lui aussi, honnêtement.
    expect(failed.some((s) => s.key === "message.send:msg-faq")).toBe(true);
    const createdBefore = gw.count("createChannel");
    await retryInstallation(installationId, user.id);
    const again = await runToEnd(installationId, gw);
    expect(again.status).toBe("succeeded");
    expect(gw.count("createChannel") - createdBefore).toBe(1);
    expect(dupes(nonCategoryNames(gw))).toEqual([]);
  });

  it("réinstaller le même projet ne crée aucun doublon (correspondances conservées)", async () => {
    const gw = FakeGateway.emptyGuild();
    const { installationId, user, project } = await installTemplate(gw, "etudes");
    await runToEnd(installationId, gw);
    const channelsBefore = gw.state.channels.length;
    const rolesBefore = gw.state.roles.length;
    const msgsBefore = gw.count("sendMessage");
    const { installation, plan } = await prepareInstallation(gw, { userId: user.id, guildId: gw.state.id, source: { projectId: project.id }, options: { mode: "merge" } });
    expect(plan.ops.filter((o) => o.kind.endsWith(".create"))).toEqual([]);
    await confirmInstallation(gw, { installationId: installation.id, userId: user.id, confirmDestructive: false });
    const second = await runToEnd(installation.id, gw);
    expect(second.status).toBe("succeeded");
    expect(gw.state.channels.length).toBe(channelsBefore);
    expect(gw.state.roles.length).toBe(rolesBefore);
    expect(gw.count("sendMessage")).toBe(msgsBefore);
  });
});

describe("protection du serveur existant", () => {
  it("mode ajout : conserve les salons existants et réutilise les homonymes", async () => {
    const gw = FakeGateway.emptyGuild();
    gw.state.channels.push({ id: "555000000000000001", name: "💬・général", type: 0, parentId: null, position: 5, permissionOverwrites: [] });
    const existingIds = gw.state.channels.map((c) => c.id);
    const user = await createUser(gw.state.ownerId);
    const project = await createProject(user.id, templateSpec("communaute"));
    const { plan, installation } = await prepareInstallation(gw, { userId: user.id, guildId: gw.state.id, source: { projectId: project.id }, options: { mode: "merge" } });
    expect(plan.conflicts.some((c) => c.localId === "general" && c.resolution === "reuse")).toBe(true);
    expect(plan.ops.some((o) => o.destructive)).toBe(false);
    await confirmInstallation(gw, { installationId: installation.id, userId: user.id, confirmDestructive: false });
    await runToEnd(installation.id, gw);
    for (const id of existingIds) expect(gw.state.channels.some((c) => c.id === id)).toBe(true);
    expect(gw.state.channels.filter((c) => c.name === "💬・général").length).toBe(1);
  });

  it("refuse une suppression sans confirmation explicite", async () => {
    const gw = FakeGateway.emptyGuild();
    const user = await createUser(gw.state.ownerId);
    const project = await createProject(user.id, templateSpec("communaute"));
    const { installation, plan } = await prepareInstallation(gw, { userId: user.id, guildId: gw.state.id, source: { projectId: project.id }, options: { mode: "empty", existingChannels: "delete" } });
    expect(plan.requiresConfirmation).toBe(true);
    await expect(confirmInstallation(gw, { installationId: installation.id, userId: user.id, confirmDestructive: false })).rejects.toMatchObject({ status: 428 });
  });

  it("archive au lieu de supprimer : le salon existe toujours, masqué", async () => {
    const gw = FakeGateway.emptyGuild();
    const oldId = gw.state.channels.find((c) => c.name === "général")!.id;
    const { installationId } = await installTemplate(gw, "communaute", { mode: "empty", existingChannels: "archive" });
    const inst = await runToEnd(installationId, gw);
    expect(inst.status).toBe("succeeded");
    const old = gw.state.channels.find((c) => c.id === oldId)!;
    expect(old).toBeTruthy();
    const archive = gw.state.channels.find((c) => c.id === old.parentId)!;
    expect(archive.name).toContain("Archives");
    const everyone = old.permissionOverwrites.find((o) => o.id === gw.state.id)!;
    expect(BigInt(everyone.deny) & toBitfield(["VIEW_CHANNEL"])).not.toBe(0n);
  });
});

describe("droits et accès", () => {
  it("refuse la préparation à un membre sans « Gérer le serveur »", async () => {
    const gw = FakeGateway.emptyGuild();
    gw.members.set("200000000000000002", []);
    const intruder = await createUser("200000000000000002");
    const project = await createProject(intruder.id, templateSpec("communaute"));
    await expect(prepareInstallation(gw, { userId: intruder.id, guildId: gw.state.id, source: { projectId: project.id }, options: { mode: "merge" } })).rejects.toBeInstanceOf(AccessDeniedError);
  });

  it("ne permet pas d’utiliser le projet d’un autre utilisateur", async () => {
    const gw = FakeGateway.emptyGuild();
    const owner = await createUser(gw.state.ownerId);
    const other = await createUser("300000000000000003");
    const project = await createProject(other.id, templateSpec("communaute"));
    await expect(prepareInstallation(gw, { userId: owner.id, guildId: gw.state.id, source: { projectId: project.id }, options: { mode: "merge" } })).rejects.toBeInstanceOf(InstallError);
  });

  it("revérifie les droits au moment de l’exécution", async () => {
    const gw = FakeGateway.emptyGuild();
    const modRole = "777000000000000001";
    gw.state.roles.push({ id: modRole, name: "Gestion", color: 0, hoist: false, mentionable: false, permissions: toBitfield(["MANAGE_GUILD"]).toString(), position: 1, managed: false });
    gw.members.set("400000000000000004", [modRole]);
    const manager = await createUser("400000000000000004");
    // Projet sans Communauté Discord : « Gérer le serveur » suffit pour l’installer.
    const spec = templateSpec("projet-pro");
    spec.settings.community = false;
    spec.onboarding = undefined;
    spec.welcomeScreen = undefined;
    const project = await createProject(manager.id, spec);
    const { installation } = await prepareInstallation(gw, { userId: manager.id, guildId: gw.state.id, source: { projectId: project.id }, options: { mode: "merge" } });
    await confirmInstallation(gw, { installationId: installation.id, userId: manager.id, confirmDestructive: false });
    gw.members.set("400000000000000004", []); // droits retirés entre-temps
    const inst = await runInstallation(installation.id, { gateway: gw });
    expect(inst.status).toBe("failed");
    expect(inst.error).toContain("Gérer le serveur");
    expect(gw.count("createRole")).toBe(0);
  });

  it("signale les permissions que le bot ne peut pas accorder", async () => {
    const gw = FakeGateway.emptyGuild({ botAdmin: false, botPermissions: ["MANAGE_ROLES", "MANAGE_CHANNELS", "VIEW_CHANNEL", "SEND_MESSAGES", "MANAGE_GUILD"] });
    const user = await createUser(gw.state.ownerId);
    const project = await createProject(user.id, templateSpec("communaute"));
    const { plan } = await prepareInstallation(gw, { userId: user.id, guildId: gw.state.id, source: { projectId: project.id }, options: { mode: "merge" } });
    expect(plan.blockers.some((b) => b.code === "bot-missing-permissions")).toBe(true);
    expect(plan.warnings.some((w) => w.code === "community-manual") || plan.manualSteps.some((s) => s.id === "community")).toBe(true);
  });
});

describe("annulation", () => {
  it("annule une installation en cours : les étapes restantes ne sont pas exécutées", async () => {
    const gw = FakeGateway.emptyGuild();
    const { installationId, user } = await installTemplate(gw, "communaute");
    let n = 0;
    await runInstallation(installationId, {
      gateway: gw,
      onProgress: async () => {
        if (++n === 3) await cancelInstallation(installationId, user.id);
      },
    });
    const [inst] = await getDb().select().from(installations).where(eq(installations.id, installationId));
    expect(inst!.status).toBe("cancelled");
    const steps = await getDb().select().from(installationSteps).where(eq(installationSteps.installationId, installationId));
    expect(steps.filter((s) => s.status === "cancelled").length).toBeGreaterThan(0);
  });
});

describe("sauvegarde et restauration", () => {
  it("restaure les éléments supprimés et met à jour ceux qui existent encore", async () => {
    const gw = FakeGateway.emptyGuild();
    const { installationId, user } = await installTemplate(gw, "communaute");
    await runToEnd(installationId, gw);
    const backup = await createBackup(gw, { userId: user.id, guildId: gw.state.id, kind: "manual" });
    expect(backup.summary.channels).toBeGreaterThan(10);

    const deleted = gw.state.channels.find((c) => c.name === "❓・faq")!;
    gw.state.channels = gw.state.channels.filter((c) => c.id !== deleted.id);
    const renamed = gw.state.channels.find((c) => c.name === "💬・général")!;
    renamed.name = "renommé";
    const keptIds = gw.state.channels.map((c) => c.id);

    const { installation, plan } = await prepareInstallation(gw, { userId: user.id, guildId: gw.state.id, source: { backupId: backup.id }, options: { mode: "merge" } });
    expect(plan.blockers).toEqual([]);
    expect(plan.ops.some((o) => o.kind === "channel.create" && o.localId === `c-${deleted.id}`)).toBe(true);
    await confirmInstallation(gw, { installationId: installation.id, userId: user.id, confirmDestructive: false });
    const inst = await runToEnd(installation.id, gw);
    expect(inst.status).toBe("succeeded");
    expect(gw.state.channels.filter((c) => c.name === "❓・faq").length).toBe(1);
    expect(gw.state.channels.find((c) => c.id === renamed.id)!.name).toBe("💬・général");
    for (const id of keptIds) expect(gw.state.channels.some((c) => c.id === id)).toBe(true);
    expect(dupes(nonCategoryNames(gw))).toEqual([]);
  });

  it("la sauvegarde de messages est réservée au Premium", async () => {
    const gw = FakeGateway.emptyGuild();
    const user = await createUser(gw.state.ownerId);
    const channel = gw.state.channels.find((c) => c.type === DISCORD_CHANNEL_TYPE.text)!;
    await expect(createBackup(gw, { userId: user.id, guildId: gw.state.id, kind: "manual", messageChannelIds: [channel.id] })).rejects.toThrow(/Premium/);
  });

  it("applique la limite de sauvegardes manuelles de l’offre gratuite", async () => {
    const gw = FakeGateway.emptyGuild();
    const user = await createUser(gw.state.ownerId);
    await createBackup(gw, { userId: user.id, guildId: gw.state.id, kind: "manual" });
    await createBackup(gw, { userId: user.id, guildId: gw.state.id, kind: "manual" });
    await expect(createBackup(gw, { userId: user.id, guildId: gw.state.id, kind: "manual" })).rejects.toThrow(/Limite atteinte/);
    // Les sauvegardes de sécurité restent toujours possibles (avec rotation).
    for (let i = 0; i < 5; i++) await createBackup(gw, { userId: user.id, guildId: gw.state.id, kind: "safety" });
    const rows = await getDb().select().from(backups).where(eq(backups.userId, user.id));
    expect(rows.filter((b) => b.kind === "safety").length).toBe(3);
  });
});

describe("mode simulation", () => {
  it("n’écrit aucune correspondance réelle", async () => {
    const real = FakeGateway.emptyGuild();
    const user = await createUser(real.state.ownerId);
    const project = await createProject(user.id, templateSpec("communaute"));
    const { installation } = await prepareInstallation(real, { userId: user.id, guildId: real.state.id, source: { projectId: project.id }, options: { mode: "empty" }, dryRun: true });
    await confirmInstallation(real, { installationId: installation.id, userId: user.id, confirmDestructive: true });
    const sim = FakeGateway.fromState(await real.fetchState(real.state.id), real.botUserId);
    sim.members.set(real.state.ownerId, []);
    const inst = await runToEnd(installation.id, sim);
    expect(inst.status).toBe("succeeded");
    expect(real.count("createRole")).toBe(0);
    const realMappings = await getDb().select().from(resourceMappings).where(eq(resourceMappings.scopeId, `project:${project.id}`));
    expect(realMappings).toEqual([]);
  });
});
