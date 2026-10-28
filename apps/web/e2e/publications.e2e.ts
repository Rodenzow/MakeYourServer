import { createHash, randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, eq, getDb, projects, sessions, templateReports, templates, users, ServerSpecSchema } from "./db";
import { OFFICIAL_TEMPLATES } from "@mys/core/templates";

/**
 * Publication communautaire : proposition par un membre, invisibilité avant relecture,
 * acceptation ou refus par l’administration, vues, auteur, signalements, retrait.
 */
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3100";

async function session(discordId: string, username: string) {
  const db = getDb();
  const [u] = await db.insert(users).values({ discordId, username, globalName: `${username} (affiché)` }).onConflictDoUpdate({ target: users.discordId, set: { username } }).returning();
  const token = randomBytes(24).toString("base64url");
  await db.insert(sessions).values({ tokenHash: createHash("sha256").update(token).digest("hex"), userId: u!.id, expiresAt: new Date(Date.now() + 3600_000) });
  return { user: u!, cookie: `mys_session=${token}` };
}

const call = (path: string, init: RequestInit & { cookie?: string; ua?: string } = {}) =>
  fetch(`${BASE}${path}`, {
    ...init,
    redirect: "manual",
    headers: { "Content-Type": "application/json", Origin: BASE, "User-Agent": init.ua ?? "Mozilla/5.0 e2e", ...(init.cookie ? { Cookie: init.cookie } : {}) },
  });

const submission = (name: string) => ({
  name,
  tagline: "Un serveur prêt à l’emploi pour tester la publication.",
  description: "Description suffisamment longue pour passer la validation de la proposition communautaire.",
  audience: "Les testeurs de bout en bout de Make Your Server.",
  theme: "gaming",
  showAuthor: true,
  consentRules: true,
  consentRights: true,
});

let admin: Awaited<ReturnType<typeof session>>;
let member: Awaited<ReturnType<typeof session>>;
let other: Awaited<ReturnType<typeof session>>;
let projectId = "";
let templateId = "";
let slug = "";

beforeAll(async () => {
  admin = await session("100000000000000001", "admin-e2e");
  member = await session("300000000000000003", "auteur-e2e");
  other = await session("400000000000000004", "visiteur-e2e");
  const spec = ServerSpecSchema.parse(OFFICIAL_TEMPLATES.find((t) => t.slug === "gaming")!.spec);
  const [p] = await getDb().insert(projects).values({ userId: member.user.id, name: "Ma team", sourceType: "template", spec }).returning();
  projectId = p!.id;
});

afterAll(closeDb);

describe("proposition d’un projet", () => {
  it("exige les consentements", async () => {
    const r = await call(`/api/projects/${projectId}/submit`, { method: "POST", cookie: member.cookie, body: JSON.stringify({ ...submission("Team E2E"), consentRights: false }) });
    expect(r.status).toBe(400);
  });
  it("refuse de proposer le projet d’un autre membre", async () => {
    const r = await call(`/api/projects/${projectId}/submit`, { method: "POST", cookie: other.cookie, body: JSON.stringify(submission("Vol")) });
    expect(r.status).toBe(404);
  });
  it("enregistre la proposition en attente de relecture", async () => {
    const r = await call(`/api/projects/${projectId}/submit`, { method: "POST", cookie: member.cookie, body: JSON.stringify(submission("Team E2E publiée")) });
    expect(r.status).toBe(201);
    templateId = (await r.json()).id;
    const [t] = await getDb().select().from(templates).where(eq(templates.id, templateId));
    expect(t!.status).toBe("pending_review");
    expect(t!.authorUserId).toBe(member.user.id);
    slug = t!.slug;
  });
  it("refuse un doublon tant que la première est en attente", async () => {
    const r = await call(`/api/projects/${projectId}/submit`, { method: "POST", cookie: member.cookie, body: JSON.stringify(submission("Team E2E bis")) });
    expect(r.status).toBe(409);
  });
  it("n’apparaît pas publiquement avant l’accord d’un administrateur", async () => {
    // La page « introuvable » est diffusée en streaming (écran de chargement) : on vérifie le contenu.
    const page = await (await call(`/templates/${slug}`)).text();
    expect(page).not.toContain("Team E2E publiée");
    expect(page).toContain("noindex");
    const list = await (await call(`/api/templates?source=community`)).json();
    expect(list.templates.map((t: { slug: string }) => t.slug)).not.toContain(slug);
  });
  it("apparaît dans « Mes publications » de l’auteur", async () => {
    const html = await (await call("/publications", { cookie: member.cookie })).text();
    expect(html).toContain("Team E2E publiée");
    expect(html).toContain("En attente de relecture");
  });
});

describe("modération", () => {
  it("refuse l’acceptation à un membre ordinaire", async () => {
    const r = await call(`/api/admin/templates/${templateId}`, { method: "POST", cookie: member.cookie, body: JSON.stringify({ action: "publish" }) });
    expect(r.status).toBe(403);
  });
  it("affiche la proposition dans la file d’administration", async () => {
    const html = await (await call("/admin/publications", { cookie: admin.cookie })).text();
    expect(html).toContain("Team E2E publiée");
  });
  it("publie après acceptation, avec l’auteur et les statistiques", async () => {
    const r = await call(`/api/admin/templates/${templateId}`, { method: "POST", cookie: admin.cookie, body: JSON.stringify({ action: "publish" }) });
    expect(r.status).toBe(200);
    const [t] = await getDb().select().from(templates).where(eq(templates.id, templateId));
    expect(t!.status).toBe("published");
    expect(t!.reviewedByUserId).toBe(admin.user.id);
    const list = await (await call(`/api/templates?source=community`)).json();
    const card = list.templates.find((x: { slug: string }) => x.slug === slug);
    expect(card.author.name).toBe("auteur-e2e (affiché)");
    expect(card.official).toBe(false);
    const html = await (await call(`/templates/${slug}`)).text();
    expect(html).toContain("auteur-e2e (affiché)");
  });
});

describe("vues", () => {
  it("compte une vue par visiteur et par jour, jamais les robots", async () => {
    const first = await call(`/api/templates/${slug}/view`, { method: "POST" });
    expect((await first.json()).counted).toBe(true);
    const cookie = first.headers.get("set-cookie")!.split(";")[0]!;
    expect((await (await call(`/api/templates/${slug}/view`, { method: "POST", cookie })).json()).counted).toBe(false);
    expect((await (await call(`/api/templates/${slug}/view`, { method: "POST", ua: "Googlebot/2.1" })).json()).counted).toBe(false);
    const [t] = await getDb().select({ v: templates.viewCount }).from(templates).where(eq(templates.id, templateId));
    expect(t!.v).toBe(1);
  });
});

describe("signalements", () => {
  it("exige un compte connecté", async () => {
    expect((await call(`/api/templates/${slug}/report`, { method: "POST", body: JSON.stringify({ reason: "other" }) })).status).toBe(401);
  });
  it("enregistre un signalement et le montre à l’administration", async () => {
    const r = await call(`/api/templates/${slug}/report`, { method: "POST", cookie: other.cookie, body: JSON.stringify({ reason: "copyright", details: "Copie de mon serveur" }) });
    expect(r.status).toBe(201);
    const html = await (await call("/admin/publications?onglet=signalements", { cookie: admin.cookie })).text();
    expect(html).toContain("Copie de mon serveur");
    const [rep] = await getDb().select().from(templateReports).where(eq(templateReports.templateId, templateId));
    const done = await call(`/api/admin/reports/${rep!.id}`, { method: "POST", cookie: admin.cookie });
    expect(done.status).toBe(200);
  });
});

describe("refus et retrait", () => {
  it("transmet le motif du refus à l’auteur", async () => {
    const spec = ServerSpecSchema.parse(OFFICIAL_TEMPLATES.find((t) => t.slug === "communaute")!.spec);
    const [p] = await getDb().insert(projects).values({ userId: member.user.id, name: "Second", sourceType: "template", spec }).returning();
    const r = await call(`/api/projects/${p!.id}/submit`, { method: "POST", cookie: member.cookie, body: JSON.stringify(submission("Proposition refusée")) });
    const { id } = await r.json();
    const rej = await call(`/api/admin/templates/${id}`, { method: "POST", cookie: admin.cookie, body: JSON.stringify({ action: "reject", note: "Nom trompeur, merci de le corriger." }) });
    expect(rej.status).toBe(200);
    const html = await (await call("/publications", { cookie: member.cookie })).text();
    expect(html).toContain("Nom trompeur, merci de le corriger.");
  });
  it("permet à l’auteur seul de retirer son template publié", async () => {
    expect((await call(`/api/publications/${templateId}`, { method: "DELETE", cookie: other.cookie })).status).toBe(404);
    expect((await call(`/api/publications/${templateId}`, { method: "DELETE", cookie: member.cookie })).status).toBe(200);
    expect(await (await call(`/templates/${slug}`)).text()).not.toContain("Team E2E publiée");
    const list = await (await call(`/api/templates?source=community`)).json();
    expect(list.templates.map((t: { slug: string }) => t.slug)).not.toContain(slug);
  });
});
