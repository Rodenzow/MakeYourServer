import { createHash, randomBytes } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { closeDb, eq, getDb, projects, sessions, templates, users, ServerSpecSchema } from "./db";
import { OFFICIAL_TEMPLATES } from "@mys/core/templates";

/** Droits sur les données : export, suppression du compte ; consentement avant paiement. */
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3100";

async function session(discordId: string, username: string) {
  const db = getDb();
  const [u] = await db.insert(users).values({ discordId, username }).onConflictDoUpdate({ target: users.discordId, set: { username } }).returning();
  const token = randomBytes(24).toString("base64url");
  await db.insert(sessions).values({ tokenHash: createHash("sha256").update(token).digest("hex"), userId: u!.id, expiresAt: new Date(Date.now() + 3600_000) });
  return { user: u!, cookie: `mys_session=${token}` };
}

const call = (path: string, init: RequestInit & { cookie?: string } = {}) =>
  fetch(`${BASE}${path}`, { ...init, redirect: "manual", headers: { "Content-Type": "application/json", Origin: BASE, ...(init.cookie ? { Cookie: init.cookie } : {}) } });

afterAll(closeDb);

describe("données du compte", () => {
  it("exporte les données de l’utilisateur connecté uniquement", async () => {
    const me = await session("500000000000000005", "export-e2e");
    const spec = ServerSpecSchema.parse(OFFICIAL_TEMPLATES[0]!.spec);
    await getDb().insert(projects).values({ userId: me.user.id, name: "Projet exporté", sourceType: "template", spec });
    expect((await call("/api/account/export")).status).toBe(401);
    const r = await call("/api/account/export", { cookie: me.cookie });
    expect(r.status).toBe(200);
    expect(r.headers.get("content-disposition")).toContain("attachment");
    const data = await r.json();
    expect(data.account.discordId).toBe("500000000000000005");
    expect(data.projects.map((p: { name: string }) => p.name)).toEqual(["Projet exporté"]);
  });

  it("supprime le compte et toutes ses données après confirmation", async () => {
    const me = await session("600000000000000006", "suppression-e2e");
    const spec = ServerSpecSchema.parse(OFFICIAL_TEMPLATES[0]!.spec);
    await getDb().insert(projects).values({ userId: me.user.id, name: "À supprimer", sourceType: "template", spec });
    await getDb().insert(templates).values({ slug: "publication-a-supprimer-e2e", name: "Publication", theme: "autre", size: "small", spec, status: "published", authorUserId: me.user.id });
    expect((await call("/api/account", { method: "DELETE", cookie: me.cookie, body: JSON.stringify({ confirm: "oui" }) })).status).toBe(400);
    const r = await call("/api/account", { method: "DELETE", cookie: me.cookie, body: JSON.stringify({ confirm: "SUPPRIMER" }) });
    expect(r.status).toBe(200);
    expect(await getDb().select().from(users).where(eq(users.id, me.user.id))).toEqual([]);
    expect(await getDb().select().from(projects).where(eq(projects.userId, me.user.id))).toEqual([]);
    expect(await getDb().select().from(templates).where(eq(templates.slug, "publication-a-supprimer-e2e"))).toEqual([]);
    expect((await call("/api/projects", { cookie: me.cookie })).status).toBe(401);
  });
});

describe("paiement", () => {
  it("exige l’acceptation des conditions et la demande d’accès immédiat", async () => {
    const me = await session("700000000000000007", "paiement-e2e");
    const r = await call("/api/billing/checkout", { method: "POST", cookie: me.cookie, body: "{}" });
    expect(r.status).toBe(400);
  });
});

describe("pages d’information", () => {
  it("publie les conditions d’utilisation et les règles de publication", async () => {
    const html = await (await call("/conditions")).text();
    expect(html).toContain("Règles de publication dans la bibliothèque");
    expect(html).toContain("https://discord.com/guidelines");
  });
});
