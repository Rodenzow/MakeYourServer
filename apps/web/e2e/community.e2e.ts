import { createHash, randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, eq, getDb, sessions, templateReviews, templates, users } from "@mys/db";

/**
 * Communauté : avis et notes (conditions, recalcul des compteurs, modération),
 * sélection de l’équipe, pages créateurs et remix avec attribution.
 */
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3100";

async function session(discordId: string, username: string) {
  const db = getDb();
  const [u] = await db.insert(users).values({ discordId, username, globalName: `${username} (affiché)` }).onConflictDoUpdate({ target: users.discordId, set: { username } }).returning();
  const token = randomBytes(24).toString("base64url");
  await db.insert(sessions).values({ tokenHash: createHash("sha256").update(token).digest("hex"), userId: u!.id, expiresAt: new Date(Date.now() + 3600_000) });
  return { user: u!, cookie: `mys_session=${token}` };
}

const call = (path: string, init: RequestInit & { cookie?: string } = {}) =>
  fetch(`${BASE}${path}`, {
    ...init,
    redirect: "manual",
    headers: { "Content-Type": "application/json", Origin: BASE, "User-Agent": "Mozilla/5.0 e2e", ...(init.cookie ? { Cookie: init.cookie } : {}) },
  });

const post = (path: string, cookie: string | undefined, body?: unknown) => call(path, { method: "POST", cookie, body: body === undefined ? undefined : JSON.stringify(body) });

const submission = (name: string) => ({
  name,
  tagline: "Une version remixée du template gaming pour les tests.",
  description: "Description suffisamment longue pour passer la validation de la proposition communautaire.",
  audience: "Les testeurs de bout en bout de Make Your Server.",
  theme: "gaming",
  showAuthor: true,
  consentRules: true,
  consentRights: true,
});

/** Crée un projet à partir d’un template publié (c’est ce qui rend un membre « utilisateur » du template). */
async function useTemplate(cookie: string, slug: string) {
  const r = await post("/api/projects", cookie, { source: "template", slug });
  expect(r.status).toBe(201);
  return (await r.json()).project.id as string;
}

async function counters(id: string) {
  const [t] = await getDb().select({ count: templates.ratingCount, sum: templates.ratingSum, featured: templates.featured }).from(templates).where(eq(templates.id, id));
  return t!;
}

let admin: Awaited<ReturnType<typeof session>>;
let author: Awaited<ReturnType<typeof session>>;
let alice: Awaited<ReturnType<typeof session>>;
let bruno: Awaited<ReturnType<typeof session>>;
let officialId = "";
let templateId = "";
let slug = "";

beforeAll(async () => {
  admin = await session("100000000000000001", "admin-e2e");
  author = await session("510000000000000051", "createur-e2e");
  alice = await session("520000000000000052", "alice-e2e");
  bruno = await session("530000000000000053", "bruno-e2e");
  const [official] = await getDb().select({ id: templates.id }).from(templates).where(eq(templates.slug, "gaming"));
  officialId = official!.id;

  // Le créateur part du template officiel « gaming », le propose, l’administration le publie.
  const projectId = await useTemplate(author.cookie, "gaming");
  const r = await post(`/api/projects/${projectId}/submit`, author.cookie, submission("Arène remixée E2E"));
  expect(r.status).toBe(201);
  templateId = (await r.json()).id;
  expect((await post(`/api/admin/templates/${templateId}`, admin.cookie, { action: "publish" })).status).toBe(200);
  const [t] = await getDb().select().from(templates).where(eq(templates.id, templateId));
  slug = t!.slug;
});

afterAll(closeDb);

describe("remix avec attribution", () => {
  it("relie la proposition au template officiel dont elle est issue", async () => {
    const [t] = await getDb().select({ basedOn: templates.basedOnTemplateId }).from(templates).where(eq(templates.id, templateId));
    expect(t!.basedOn).toBe(officialId);
  });
  it("affiche « Inspiré de » sur la fiche et « Remixé N fois » sur l’original", async () => {
    const page = await (await call(`/templates/${slug}`)).text();
    expect(page).toContain("Inspiré de");
    expect(page).toContain("/templates/gaming");
    const original = await (await call(`/templates/gaming`)).text();
    expect(original).toMatch(/Remixé\s*(<!-- -->)?\s*\d+\s*(<!-- -->)?\s*fois/);
    expect(original).toContain("Arène remixée E2E");
  });
  it("ne crée pas d’attribution quand l’auteur repart de son propre template", async () => {
    const projectId = await useTemplate(author.cookie, slug);
    const r = await post(`/api/projects/${projectId}/submit`, author.cookie, submission("Arène version 2 E2E"));
    expect(r.status).toBe(201);
    const { id } = await r.json();
    const [t] = await getDb().select({ basedOn: templates.basedOnTemplateId }).from(templates).where(eq(templates.id, id));
    expect(t!.basedOn).toBeNull();
    await call(`/api/publications/${id}`, { method: "DELETE", cookie: author.cookie });
  });
});

describe("avis : conditions", () => {
  it("liste publique vide au départ", async () => {
    const r = await call(`/api/templates/${slug}/reviews`);
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.reviews).toEqual([]);
    expect(data.summary.count).toBe(0);
  });
  it("exige un compte connecté", async () => {
    expect((await post(`/api/templates/${slug}/reviews`, undefined, { rating: 5 })).status).toBe(401);
  });
  it("refuse à l’auteur de noter son propre template", async () => {
    const r = await post(`/api/templates/${slug}/reviews`, author.cookie, { rating: 5 });
    expect(r.status).toBe(403);
    expect((await r.json()).error).toContain("propre template");
  });
  it("refuse un membre qui n’a pas utilisé le template, avec un message clair", async () => {
    const r = await post(`/api/templates/${slug}/reviews`, alice.cookie, { rating: 5 });
    expect(r.status).toBe(403);
    expect((await r.json()).error).toContain("utilisé ce template");
    const html = await (await call(`/templates/${slug}`, { cookie: alice.cookie })).text();
    expect(html).toContain("Créez un projet à partir de ce template");
  });
  it("valide la note et le commentaire", async () => {
    await useTemplate(alice.cookie, slug);
    expect((await post(`/api/templates/${slug}/reviews`, alice.cookie, { rating: 6 })).status).toBe(400);
    expect((await post(`/api/templates/${slug}/reviews`, alice.cookie, { rating: 0 })).status).toBe(400);
    expect((await post(`/api/templates/${slug}/reviews`, alice.cookie, { rating: 4, comment: "x".repeat(501) })).status).toBe(400);
    const link = await post(`/api/templates/${slug}/reviews`, alice.cookie, { rating: 4, comment: "Venez sur discord.gg/spam" });
    expect(link.status).toBe(400);
    expect((await link.json()).error).toContain("liens");
  });
});

describe("avis : création, modification, compteurs", () => {
  it("publie l’avis d’un membre qui a utilisé le template", async () => {
    const r = await post(`/api/templates/${slug}/reviews`, alice.cookie, { rating: 5, comment: "Accueil très clair, rôles bien pensés." });
    expect(r.status).toBe(201);
    expect(await counters(templateId)).toMatchObject({ count: 1, sum: 5 });
  });
  it("modifie l’avis existant (un seul avis par membre)", async () => {
    const r = await post(`/api/templates/${slug}/reviews`, alice.cookie, { rating: 4, comment: "Accueil très clair, rôles bien pensés. Un peu long à personnaliser." });
    expect(r.status).toBe(200);
    expect(await counters(templateId)).toMatchObject({ count: 1, sum: 4 });
    const rows = await getDb().select().from(templateReviews).where(eq(templateReviews.templateId, templateId));
    expect(rows).toHaveLength(1);
  });
  it("additionne les avis de plusieurs membres", async () => {
    await useTemplate(bruno.cookie, slug);
    expect((await post(`/api/templates/${slug}/reviews`, bruno.cookie, { rating: 2, comment: "Trop de salons pour moi." })).status).toBe(201);
    expect(await counters(templateId)).toMatchObject({ count: 2, sum: 6 });
  });
  it("affiche les avis (pseudo, commentaire) et la note sur la fiche et la carte", async () => {
    const data = await (await call(`/api/templates/${slug}/reviews`)).json();
    expect(data.reviews).toHaveLength(2);
    expect(data.reviews.map((r: { author: { name: string } }) => r.author.name)).toContain("alice-e2e (affiché)");
    expect(data.summary).toEqual({ count: 2, average: 3 });
    const html = await (await call(`/templates/${slug}`)).text();
    expect(html).toContain("Avis des membres");
    expect(html).toContain("Un peu long à personnaliser.");
    const list = await (await call(`/api/templates?source=community`)).json();
    const card = list.templates.find((x: { slug: string }) => x.slug === slug);
    expect(card.rating).toEqual({ average: 3, count: 2 });
  });
  it("trie la bibliothèque par note (« Mieux notés »)", async () => {
    const r = await call(`/api/templates?tri=rating`);
    expect(r.status).toBe(200);
    const { templates: list } = await r.json();
    expect(list.map((x: { slug: string }) => x.slug)).toContain(slug);
  });
});

describe("avis : modération et suppression", () => {
  let brunoReviewId = "";
  it("refuse la modération à un membre ordinaire", async () => {
    const [r] = await getDb().select().from(templateReviews).where(eq(templateReviews.userId, bruno.user.id));
    brunoReviewId = r!.id;
    expect((await post(`/api/admin/reviews/${brunoReviewId}`, alice.cookie, { action: "hide" })).status).toBe(403);
  });
  it("affiche les avis récents dans l’onglet « Avis » de l’administration", async () => {
    const html = await (await call("/admin/publications?onglet=avis", { cookie: admin.cookie })).text();
    expect(html).toContain("Trop de salons pour moi.");
  });
  it("masque un avis : il disparaît de la fiche et n’est plus compté", async () => {
    expect((await post(`/api/admin/reviews/${brunoReviewId}`, admin.cookie, { action: "hide" })).status).toBe(200);
    expect(await counters(templateId)).toMatchObject({ count: 1, sum: 4 });
    const data = await (await call(`/api/templates/${slug}/reviews`)).json();
    expect(data.reviews).toHaveLength(1);
    // Modifier un avis masqué ne le fait pas réapparaître.
    expect((await post(`/api/templates/${slug}/reviews`, bruno.cookie, { rating: 1 })).status).toBe(200);
    expect(await counters(templateId)).toMatchObject({ count: 1, sum: 4 });
  });
  it("réaffiche un avis masqué", async () => {
    expect((await post(`/api/admin/reviews/${brunoReviewId}`, admin.cookie, { action: "show" })).status).toBe(200);
    expect(await counters(templateId)).toMatchObject({ count: 2, sum: 5 });
  });
  it("permet à un membre de supprimer son avis", async () => {
    expect((await call(`/api/templates/${slug}/reviews`, { method: "DELETE", cookie: bruno.cookie })).status).toBe(200);
    expect(await counters(templateId)).toMatchObject({ count: 1, sum: 4 });
    expect((await call(`/api/templates/${slug}/reviews`, { method: "DELETE", cookie: bruno.cookie })).status).toBe(404);
  });
});

describe("sélection de l’équipe", () => {
  it("refuse la mise en avant à un membre ordinaire", async () => {
    expect((await post(`/api/admin/templates/${templateId}`, author.cookie, { action: "feature" })).status).toBe(403);
  });
  it("met en avant un template publié, visible dans la bibliothèque", async () => {
    expect((await post(`/api/admin/templates/${templateId}`, admin.cookie, { action: "feature" })).status).toBe(200);
    expect((await counters(templateId)).featured).toBe(true);
    const sel = await (await call(`/api/templates?selection=1`)).json();
    const card = sel.templates.find((x: { slug: string }) => x.slug === slug);
    expect(card.featured).toBe(true);
    expect(sel.templates.every((x: { featured: boolean }) => x.featured)).toBe(true);
    const html = await (await call("/templates")).text();
    expect(html).toContain("Sélection de l’équipe");
  });
  it("refuse de mettre en avant un template non publié", async () => {
    const projectId = await useTemplate(alice.cookie, "communaute");
    const r = await post(`/api/projects/${projectId}/submit`, alice.cookie, submission("Proposition en attente E2E"));
    const { id } = await r.json();
    expect((await post(`/api/admin/templates/${id}`, admin.cookie, { action: "feature" })).status).toBe(409);
  });
  it("retire un template de la sélection", async () => {
    expect((await post(`/api/admin/templates/${templateId}`, admin.cookie, { action: "unfeature" })).status).toBe(200);
    const sel = await (await call(`/api/templates?selection=1`)).json();
    expect(sel.templates.map((x: { slug: string }) => x.slug)).not.toContain(slug);
  });
});

describe("pages créateurs", () => {
  it("présente le créateur, ses badges et ses templates", async () => {
    const r = await call(`/createurs/${author.user.id}`);
    expect(r.status).toBe(200);
    const html = await r.text();
    expect(html).toContain("createur-e2e (affiché)");
    expect(html).toContain("Créateur vérifié");
    expect(html).toContain("Arène remixée E2E");
  });
  it("le nom de l’auteur sur la fiche mène à sa page", async () => {
    const html = await (await call(`/templates/${slug}`)).text();
    expect(html).toContain(`/createurs/${author.user.id}`);
  });
  it("n’existe pas pour un membre sans template publié", async () => {
    const html = await (await call(`/createurs/${bruno.user.id}`)).text();
    expect(html).not.toContain("bruno-e2e (affiché)");
    expect(html).toContain("noindex");
  });
  it("n’existe pas pour un auteur qui a masqué son pseudo", async () => {
    await getDb().update(templates).set({ showAuthor: false }).where(eq(templates.authorUserId, author.user.id));
    const html = await (await call(`/createurs/${author.user.id}`)).text();
    expect(html).not.toContain("createur-e2e (affiché)");
    await getDb().update(templates).set({ showAuthor: true }).where(eq(templates.authorUserId, author.user.id));
  });
});

describe("suppression de compte", () => {
  it("retire les avis du membre et recalcule la note des templates", async () => {
    expect(await counters(templateId)).toMatchObject({ count: 1, sum: 4 });
    const r = await call("/api/account", { method: "DELETE", cookie: alice.cookie, body: JSON.stringify({ confirm: "SUPPRIMER" }) });
    expect(r.status).toBe(200);
    expect(await counters(templateId)).toMatchObject({ count: 0, sum: 0 });
  });
});
