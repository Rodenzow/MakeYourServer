import { createHash, randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { backups, closeDb, getDb, projects, sessions, templates, users, ServerSpecSchema } from "./db";
import { OFFICIAL_TEMPLATES } from "@mys/core/templates";

/**
 * Tests de bout en bout via HTTP contre un serveur lancé (scripts/e2e.sh) :
 * contrôles d’accès, isolation des données privées, CSRF, et installation réelle
 * sur le serveur Discord simulé (bac à sable) sans doublon à la relance.
 */
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const ADMIN_ID = "100000000000000001";

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

let admin: Awaited<ReturnType<typeof session>>;
let member: Awaited<ReturnType<typeof session>>;
let adminProjectId = "";
let adminBackupId = "";

beforeAll(async () => {
  admin = await session(ADMIN_ID, "admin-e2e");
  member = await session("200000000000000002", "membre-e2e");
  const spec = ServerSpecSchema.parse(OFFICIAL_TEMPLATES[0]!.spec);
  const [p] = await getDb().insert(projects).values({ userId: admin.user.id, name: "Projet privé admin", sourceType: "template", spec }).returning();
  adminProjectId = p!.id;
  const [b] = await getDb()
    .insert(backups)
    .values({ userId: admin.user.id, guildId: "100000000000000000", guildName: "SECRET-SAUVEGARDE", kind: "manual", version: 1, snapshot: {} as never, summary: {} })
    .returning();
  adminBackupId = b!.id;
  await getDb().insert(templates).values({ slug: "secret-brouillon-e2e", name: "SECRET-BROUILLON", theme: "autre", size: "small", spec, status: "draft" }).onConflictDoNothing();
});

afterAll(closeDb);

describe("authentification", () => {
  it("refuse l’API privée sans session (401)", async () => {
    expect((await call("/api/projects")).status).toBe(401);
  });
  it("redirige les pages privées vers la connexion", async () => {
    const r = await call("/tableau-de-bord", { origin: null });
    expect(r.status).toBe(307);
    expect(r.headers.get("location")).toContain("/connexion");
  });
});

describe("administration", () => {
  it("refuse les routes d’administration à un utilisateur ordinaire (403)", async () => {
    const r = await call("/api/admin/settings/maintenance", { method: "PUT", cookie: member.cookie, body: JSON.stringify({ enabled: true, message: "x", blockInstalls: true }) });
    expect(r.status).toBe(403);
  });
  it("redirige les pages d’administration pour un utilisateur ordinaire", async () => {
    const r = await call("/admin", { cookie: member.cookie, origin: null });
    expect(r.status).toBe(307);
  });
  it("accepte l’administrateur configuré dans ADMIN_DISCORD_IDS", async () => {
    const r = await call("/admin", { cookie: admin.cookie, origin: null });
    expect(r.status).toBe(200);
  });
});

describe("isolation des données privées", () => {
  it("un utilisateur ne peut pas lire le projet d’un autre", async () => {
    expect((await call(`/api/projects/${adminProjectId}`, { cookie: member.cookie })).status).toBe(404);
  });
  it("un utilisateur ne peut pas modifier ni supprimer le projet d’un autre", async () => {
    expect((await call(`/api/projects/${adminProjectId}`, { method: "DELETE", cookie: member.cookie })).status).toBe(404);
    expect((await call(`/api/projects/${adminProjectId}`, { method: "PUT", cookie: member.cookie, body: JSON.stringify({ spec: {}, revision: 1 }) })).status).toBeGreaterThanOrEqual(400);
  });
  it("un utilisateur ne peut pas supprimer la sauvegarde d’un autre", async () => {
    expect((await call(`/api/backups/${adminBackupId}`, { method: "DELETE", cookie: member.cookie })).status).toBe(404);
  });
  it("la recherche publique n’expose ni brouillons ni sauvegardes", async () => {
    const r = await (await call("/api/templates?q=SECRET")).json();
    expect(r.templates).toEqual([]);
  });
});

describe("protection CSRF", () => {
  it("refuse une modification venant d’une autre origine", async () => {
    const r = await call("/api/projects", { method: "POST", cookie: member.cookie, origin: "https://site-malveillant.example", body: JSON.stringify({ source: "blank", name: "x" }) });
    expect(r.status).toBe(403);
  });
});

describe("installation réelle sur le serveur simulé", () => {
  it("installe un template, puis une relance ne crée aucun doublon", async () => {
    const created = await (await call("/api/projects", { method: "POST", cookie: admin.cookie, body: JSON.stringify({ source: "template", slug: "etudes" }) })).json();
    const projectId = created.project.id;
    const guilds = await (await call("/api/guilds", { cookie: admin.cookie })).json();
    const guildId = guilds.guilds[0].id;

    const prep = await (await call("/api/installations", { method: "POST", cookie: admin.cookie, body: JSON.stringify({ guildId, projectId, options: { mode: "merge" } }) })).json();
    expect(prep.plan.blockers).toEqual([]);
    const conf = await call(`/api/installations/${prep.installationId}/confirm`, { method: "POST", cookie: admin.cookie, body: JSON.stringify({}) });
    expect(conf.status).toBe(200);

    let status = "";
    for (let i = 0; i < 90 && !["succeeded", "partial", "failed"].includes(status); i++) {
      await new Promise((r) => setTimeout(r, 1000));
      status = (await (await call(`/api/installations/${prep.installationId}`, { cookie: admin.cookie })).json()).installation.status;
    }
    expect(status).toBe("succeeded");

    const again = await (await call("/api/installations", { method: "POST", cookie: admin.cookie, body: JSON.stringify({ guildId, projectId, options: { mode: "merge" } }) })).json();
    const creates = again.plan.ops.filter((o: { kind: string }) => o.kind.endsWith(".create") || o.kind === "message.send");
    expect(creates).toEqual([]);
  }, 120_000);

  it("refuse une suppression sans confirmation écrite (428)", async () => {
    const created = await (await call("/api/projects", { method: "POST", cookie: admin.cookie, body: JSON.stringify({ source: "template", slug: "gaming" }) })).json();
    const guilds = await (await call("/api/guilds", { cookie: admin.cookie })).json();
    const prep = await (await call("/api/installations", { method: "POST", cookie: admin.cookie, body: JSON.stringify({ guildId: guilds.guilds[0].id, projectId: created.project.id, options: { mode: "merge", existingChannels: "delete" } }) })).json();
    const r = await call(`/api/installations/${prep.installationId}/confirm`, { method: "POST", cookie: admin.cookie, body: JSON.stringify({ confirmationText: "mauvais nom" }) });
    expect(r.status).toBe(428);
    await call(`/api/installations/${prep.installationId}/cancel`, { method: "POST", cookie: admin.cookie });
  });

  it("un membre ne peut pas lancer une installation sur un serveur qu’il ne gère pas", async () => {
    const created = await (await call("/api/projects", { method: "POST", cookie: member.cookie, body: JSON.stringify({ source: "template", slug: "communaute" }) })).json();
    const r = await call("/api/installations", { method: "POST", cookie: member.cookie, body: JSON.stringify({ guildId: "123456789012345678", projectId: created.project.id, options: { mode: "merge" } }) });
    expect([403, 409]).toContain(r.status);
  });
});
