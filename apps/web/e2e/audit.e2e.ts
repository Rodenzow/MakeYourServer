import { createHash, randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, getDb, sessions, users } from "./db";

/**
 * « Santé du serveur » de bout en bout sur le serveur Discord simulé (bac à sable) :
 * analyse, dernière analyse, correctifs transformés en projet puis installés en mode
 * fusion via l’API d’installation habituelle (analyse, sauvegarde de sécurité, confirmation).
 */
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const SANDBOX_GUILD = "100000000000000000";

async function session(discordId: string, username: string) {
  const db = getDb();
  const [u] = await db.insert(users).values({ discordId, username }).onConflictDoUpdate({ target: users.discordId, set: { username } }).returning();
  const token = randomBytes(24).toString("base64url");
  await db.insert(sessions).values({ tokenHash: createHash("sha256").update(token).digest("hex"), userId: u!.id, expiresAt: new Date(Date.now() + 3600_000) });
  return { user: u!, cookie: `mys_session=${token}` };
}

const call = (path: string, init: RequestInit & { cookie?: string; origin?: string | null } = {}) =>
  fetch(`${BASE}${path}`, {
    ...init,
    redirect: "manual",
    headers: {
      "Content-Type": "application/json",
      ...(init.cookie ? { Cookie: init.cookie } : {}),
      ...(init.origin === null ? {} : { Origin: init.origin ?? BASE }),
    },
  });

let me: Awaited<ReturnType<typeof session>>;

beforeAll(async () => {
  me = await session("310000000000000031", "sante-e2e");
});

afterAll(closeDb);

describe("santé du serveur : API", () => {
  it("exige une session", async () => {
    expect((await call(`/api/guilds/${SANDBOX_GUILD}/audit`)).status).toBe(401);
  });

  it("refuse un identifiant de serveur invalide", async () => {
    expect((await call(`/api/guilds/abc/audit`, { method: "POST", cookie: me.cookie })).status).toBe(400);
  });

  it("signale un serveur sans le bot (409)", async () => {
    const r = await call(`/api/guilds/123456789012345678/audit`, { method: "POST", cookie: me.cookie });
    expect(r.status).toBe(409);
    expect((await r.json()).code).toBe("bot_missing");
  });

  it("refuse une analyse depuis une autre origine (CSRF)", async () => {
    const r = await call(`/api/guilds/${SANDBOX_GUILD}/audit`, { method: "POST", cookie: me.cookie, origin: "https://site-malveillant.example" });
    expect(r.status).toBe(403);
  });

  it("analyse le serveur simulé et renvoie la dernière analyse", async () => {
    const r = await call(`/api/guilds/${SANDBOX_GUILD}/audit`, { method: "POST", cookie: me.cookie });
    expect(r.status).toBe(201);
    const { audit } = await r.json();
    expect(audit.score).toBeGreaterThanOrEqual(0);
    expect(audit.score).toBeLessThanOrEqual(100);
    expect(["excellent", "bon", "moyen", "fragile"]).toContain(audit.report.grade);
    expect(Array.isArray(audit.report.issues)).toBe(true);
    const latest = await (await call(`/api/guilds/${SANDBOX_GUILD}/audit`, { cookie: me.cookie })).json();
    expect(latest.audit.id).toBe(audit.id);
  });

  it("valide la liste des correctifs", async () => {
    const r = await call(`/api/guilds/${SANDBOX_GUILD}/audit/fix`, { method: "POST", cookie: me.cookie, body: JSON.stringify({ fixIds: ["pas-un-correctif"] }) });
    expect(r.status).toBe(400);
    const empty = await call(`/api/guilds/${SANDBOX_GUILD}/audit/fix`, { method: "POST", cookie: me.cookie, body: JSON.stringify({ fixIds: [] }) });
    expect(empty.status).toBe(400);
  });

  it("transforme les correctifs en projet installable en mode fusion, sans doublon", async () => {
    const fixIds = ["everyone-permissions", "verification", "content-filter", "notifications"];
    const r = await call(`/api/guilds/${SANDBOX_GUILD}/audit/fix`, { method: "POST", cookie: me.cookie, body: JSON.stringify({ fixIds }) });
    expect(r.status).toBe(201);
    const { projectId } = await r.json();
    const { project, validation } = await (await call(`/api/projects/${projectId}`, { cookie: me.cookie })).json();
    expect(project.name.startsWith("Correctifs — ")).toBe(true);
    expect(validation.errors).toEqual([]);

    const prep = await (await call("/api/installations", { method: "POST", cookie: me.cookie, body: JSON.stringify({ guildId: SANDBOX_GUILD, projectId, options: { mode: "merge" } }) })).json();
    expect(prep.plan.blockers).toEqual([]);
    const kinds: string[] = prep.plan.ops.map((o: { kind: string }) => o.kind);
    expect(kinds).toContain("safety-backup");
    expect(kinds.filter((k) => ["role.create", "category.create", "channel.create"].includes(k))).toEqual([]);
    expect(prep.plan.ops.some((o: { destructive: boolean }) => o.destructive)).toBe(false);

    const conf = await call(`/api/installations/${prep.installationId}/confirm`, { method: "POST", cookie: me.cookie, body: JSON.stringify({}) });
    expect(conf.status).toBe(200);
    let status = "";
    for (let i = 0; i < 90 && !["succeeded", "partial", "failed"].includes(status); i++) {
      await new Promise((res) => setTimeout(res, 1000));
      status = (await (await call(`/api/installations/${prep.installationId}`, { cookie: me.cookie })).json()).installation.status;
    }
    expect(status).toBe("succeeded");

    const after = (await (await call(`/api/guilds/${SANDBOX_GUILD}/audit`, { method: "POST", cookie: me.cookie })).json()).audit;
    const ids = after.report.issues.map((i: { id: string }) => i.id);
    for (const id of ["verification-none", "content-filter-off", "content-filter-partial", "notifications-all", "everyone-dangerous", "everyone-admin", "everyone-mention"]) expect(ids).not.toContain(id);
  }, 120_000);

  it("affiche la page Santé du serveur", async () => {
    const r = await call(`/serveurs/${SANDBOX_GUILD}/sante`, { cookie: me.cookie, origin: null });
    expect(r.status).toBe(200);
    expect(await r.text()).toContain("Santé du serveur");
  });
});
