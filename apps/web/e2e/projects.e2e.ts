import { createHash, randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, closeDb, eq, getDb, inArray, projectInvites, projectMembers, projectRevisions, projects, sessions, templates, users } from "@mys/db";
import { ServerSpecSchema, type ServerSpec } from "@mys/core";
import { OFFICIAL_TEMPLATES } from "@mys/core/templates";

/**
 * Projets : co-gestion (invitations, membres, droits), historique des versions
 * (restauration avec contrôle de version) et mises à jour de template (avis,
 * aperçu, application sans perte, « Ignorer »).
 */
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

async function session(discordId: string, username: string) {
  const db = getDb();
  const [u] = await db.insert(users).values({ discordId, username, globalName: `${username} (affiché)` }).onConflictDoUpdate({ target: users.discordId, set: { username } }).returning();
  const token = randomBytes(24).toString("base64url");
  await db.insert(sessions).values({ tokenHash: sha256(token), userId: u!.id, expiresAt: new Date(Date.now() + 3600_000) });
  return { user: u!, cookie: `mys_session=${token}` };
}

const call = (path: string, init: RequestInit & { cookie?: string } = {}) =>
  fetch(`${BASE}${path}`, {
    ...init,
    redirect: "manual",
    headers: { "Content-Type": "application/json", Origin: BASE, ...(init.cookie ? { Cookie: init.cookie } : {}) },
  });
const body = (v: unknown) => JSON.stringify(v);

let owner: Awaited<ReturnType<typeof session>>;
let friend: Awaited<ReturnType<typeof session>>;
let stranger: Awaited<ReturnType<typeof session>>;
let late: Awaited<ReturnType<typeof session>>;
let projectId = "";
let inviteToken = "";

beforeAll(async () => {
  owner = await session("610000000000000001", "proprio-e2e");
  friend = await session("620000000000000002", "coequipier-e2e");
  stranger = await session("630000000000000003", "inconnu-e2e");
  late = await session("640000000000000004", "retardataire-e2e");
  // Relance sur une base non vidée : on repart de zéro pour ces comptes (quota de projets).
  await getDb().delete(projects).where(inArray(projects.userId, [owner.user.id, friend.user.id, stranger.user.id, late.user.id]));
  const created = await (await call("/api/projects", { method: "POST", cookie: owner.cookie, body: body({ source: "template", slug: "gaming", name: "Projet partagé E2E" }) })).json();
  projectId = created.project.id;
});

afterAll(closeDb);

describe("co-gestion : invitations", () => {
  it("refuse l’accès au projet tant que l’invitation n’est pas acceptée", async () => {
    expect((await call(`/api/projects/${projectId}`, { cookie: friend.cookie })).status).toBe(404);
    expect((await call(`/api/projects/${projectId}/invites`, { method: "POST", cookie: friend.cookie, body: "{}" })).status).toBe(404);
    expect((await call(`/api/projects/${projectId}/members`, { cookie: friend.cookie })).status).toBe(404);
  });

  it("crée un lien à usage unique dont seul le hachage est stocké", async () => {
    const r = await call(`/api/projects/${projectId}/invites`, { method: "POST", cookie: owner.cookie, body: "{}" });
    expect(r.status).toBe(201);
    const data = await r.json();
    expect(data.url).toContain("/invitation/");
    inviteToken = data.path.split("/").pop();
    const rows = await getDb().select().from(projectInvites).where(eq(projectInvites.projectId, projectId));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tokenHash).toBe(sha256(inviteToken));
    expect(rows[0]!.tokenHash).not.toContain(inviteToken);
    const days = (rows[0]!.expiresAt.getTime() - Date.now()) / 86400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThanOrEqual(7);
  });

  it("la page d’invitation exige une connexion", async () => {
    const r = await call(`/invitation/${inviteToken}`);
    expect(r.status).toBe(307);
    expect(r.headers.get("location")).toContain(`/connexion?suivant=${encodeURIComponent(`/invitation/${inviteToken}`)}`);
  });

  it("la page d’invitation présente le projet et la personne qui invite", async () => {
    const html = await (await call(`/invitation/${inviteToken}`, { cookie: friend.cookie })).text();
    expect(html).toContain("Projet partagé E2E");
    expect(html).toContain("proprio-e2e (affiché)");
    expect(html).toContain("Rejoindre");
  });

  it("un lien inconnu affiche un message clair", async () => {
    const html = await (await call(`/invitation/lien-inexistant-1234567890`, { cookie: friend.cookie })).text();
    expect(html).toContain("Lien d’invitation introuvable");
  });

  it("accepter l’invitation donne accès au projet (rôle co-gestionnaire)", async () => {
    const r = await call(`/api/invitations/${inviteToken}/accept`, { method: "POST", cookie: friend.cookie, body: "{}" });
    expect(r.status).toBe(200);
    expect((await r.json()).projectId).toBe(projectId);
    const p = await (await call(`/api/projects/${projectId}`, { cookie: friend.cookie })).json();
    expect(p.role).toBe("editor");
    const [m] = await getDb().select().from(projectMembers).where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, friend.user.id)));
    expect(m!.addedByUserId).toBe(owner.user.id);
  });

  it("le lien ne fonctionne qu’une fois", async () => {
    const r = await call(`/api/invitations/${inviteToken}/accept`, { method: "POST", cookie: late.cookie, body: "{}" });
    expect(r.status).toBe(410);
    expect((await call(`/api/projects/${projectId}`, { cookie: late.cookie })).status).toBe(404);
  });

  it("un lien expiré est refusé", async () => {
    const token = randomBytes(24).toString("base64url");
    await getDb().insert(projectInvites).values({ projectId, tokenHash: sha256(token), createdByUserId: owner.user.id, expiresAt: new Date(Date.now() - 1000) });
    expect((await call(`/api/invitations/${token}/accept`, { method: "POST", cookie: late.cookie, body: "{}" })).status).toBe(410);
    const html = await (await call(`/invitation/${token}`, { cookie: late.cookie })).text();
    expect(html).toContain("Ce lien a expiré");
  });
});

describe("co-gestion : droits", () => {
  it("le co-gestionnaire voit le projet dans sa liste avec le badge « Partagé »", async () => {
    const list = await (await call("/api/projects", { cookie: friend.cookie })).json();
    const p = list.projects.find((x: { id: string }) => x.id === projectId);
    expect(p.role).toBe("editor");
    expect(p.owner.name).toBe("proprio-e2e (affiché)");
    const html = await (await call("/projets", { cookie: friend.cookie })).text();
    expect(html).toContain("Projet partagé E2E");
    expect(html).toContain("Partagé");
    expect(html).toContain("Partagés avec moi");
  });

  it("le co-gestionnaire peut modifier le projet (contrôle de version optimiste)", async () => {
    const { project } = await (await call(`/api/projects/${projectId}`, { cookie: friend.cookie })).json();
    const spec = { ...project.spec, meta: { ...project.spec.meta, name: "Projet partagé E2E modifié" } };
    const r = await call(`/api/projects/${projectId}`, { method: "PUT", cookie: friend.cookie, body: body({ spec, revision: project.revision, note: "Modifié par le co-gestionnaire" }) });
    expect(r.status).toBe(200);
    const stale = await call(`/api/projects/${projectId}`, { method: "PUT", cookie: owner.cookie, body: body({ spec, revision: project.revision }) });
    expect(stale.status).toBe(409);
  });

  it("l’éditeur s’ouvre pour le co-gestionnaire", async () => {
    const r = await call(`/projets/${projectId}`, { cookie: friend.cookie });
    expect(r.status).toBe(200);
    const html = await r.text();
    expect(html).toContain("Historique");
    expect(html).toContain("Partagé par proprio-e2e (affiché)");
  });

  it("seul le propriétaire peut inviter, supprimer le projet ou retirer un autre membre", async () => {
    expect((await call(`/api/projects/${projectId}/invites`, { method: "POST", cookie: friend.cookie, body: "{}" })).status).toBe(403);
    expect((await call(`/api/projects/${projectId}`, { method: "DELETE", cookie: friend.cookie })).status).toBe(403);
    expect((await call(`/api/projects/${projectId}/members`, { method: "DELETE", cookie: friend.cookie, body: body({ userId: owner.user.id }) })).status).toBe(400);
    expect((await call(`/api/projects/${projectId}`, { cookie: stranger.cookie })).status).toBe(404);
  });

  it("liste le propriétaire et les co-gestionnaires", async () => {
    const data = await (await call(`/api/projects/${projectId}/members`, { cookie: owner.cookie })).json();
    expect(data.role).toBe("owner");
    expect(data.owner.id).toBe(owner.user.id);
    expect(data.members.map((m: { id: string }) => m.id)).toEqual([friend.user.id]);
    const asFriend = await (await call(`/api/projects/${projectId}/members`, { cookie: friend.cookie })).json();
    expect(asFriend.invites).toEqual([]);
  });

  it("le projet partagé ne compte pas dans l’offre du co-gestionnaire", async () => {
    const owned = await getDb().select({ id: projects.id }).from(projects).where(eq(projects.userId, friend.user.id));
    expect(owned).toEqual([]);
  });

  it("le co-gestionnaire peut préparer une installation (droits Discord revérifiés)", async () => {
    const guilds = await (await call("/api/guilds", { cookie: friend.cookie })).json();
    const guildId = guilds.guilds?.[0]?.id ?? "100000000000000000";
    const r = await call("/api/installations", { method: "POST", cookie: friend.cookie, body: body({ guildId, projectId, options: { mode: "merge" } }) });
    expect(r.status).toBe(200);
    const prep = await r.json();
    expect(prep.installationId).toBeTruthy();
    await call(`/api/installations/${prep.installationId}/cancel`, { method: "POST", cookie: friend.cookie });
    // Une personne étrangère au projet ne peut pas l’utiliser.
    const denied = await call("/api/installations", { method: "POST", cookie: stranger.cookie, body: body({ guildId, projectId, options: { mode: "merge" } }) });
    expect(denied.status).toBe(404);
  });
});

describe("historique des versions", () => {
  it("liste les versions avec auteur, note et statistiques", async () => {
    const data = await (await call(`/api/projects/${projectId}/revisions`, { cookie: friend.cookie })).json();
    expect(data.revisions.length).toBeGreaterThanOrEqual(2);
    const first = data.revisions.at(-1);
    expect(first.revision).toBe(1);
    expect(first.note).toBe("Création du projet");
    expect(first.stats.channels).toBeGreaterThan(5);
    expect(first.stats.roles).toBeGreaterThan(2);
    expect(data.revisions[0].note).toBe("Modifié par le co-gestionnaire");
  });

  it("refuse une restauration sur une version périmée (409)", async () => {
    const { revisions } = await (await call(`/api/projects/${projectId}/revisions`, { cookie: owner.cookie })).json();
    const first = revisions.at(-1);
    const r = await call(`/api/projects/${projectId}/revisions/${first.id}/restore`, { method: "POST", cookie: owner.cookie, body: body({ revision: 1 }) });
    expect(r.status).toBe(409);
  });

  it("restaure une version en créant une nouvelle révision", async () => {
    const { project } = await (await call(`/api/projects/${projectId}`, { cookie: owner.cookie })).json();
    const { revisions } = await (await call(`/api/projects/${projectId}/revisions`, { cookie: owner.cookie })).json();
    const first = revisions.at(-1);
    const r = await call(`/api/projects/${projectId}/revisions/${first.id}/restore`, { method: "POST", cookie: owner.cookie, body: body({ revision: project.revision }) });
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.revision).toBe(project.revision + 1);
    expect(data.spec.meta.name).toBe("Projet partagé E2E");
    const [last] = await getDb().select().from(projectRevisions).where(eq(projectRevisions.projectId, projectId)).orderBy(projectRevisions.revision).then((rows) => rows.slice(-1));
    expect(last!.note).toBe("Restauration de la version 1");
    expect(last!.author).toBe("restore");
  });

  it("refuse la restauration à une personne étrangère au projet", async () => {
    const { revisions } = await (await call(`/api/projects/${projectId}/revisions`, { cookie: owner.cookie })).json();
    const r = await call(`/api/projects/${projectId}/revisions/${revisions[0].id}/restore`, { method: "POST", cookie: stranger.cookie, body: body({ revision: 1 }) });
    expect(r.status).toBe(404);
    expect((await call(`/api/projects/${projectId}/revisions`, { cookie: stranger.cookie })).status).toBe(404);
  });
});

describe("mises à jour de template", () => {
  let templateId = "";
  let updProjectId = "";
  let baseSpec: ServerSpec;
  // Identifiants propres à chaque exécution : les relances sur la même base restent indépendantes.
  const run = Date.now().toString(36);
  const slug = `e2e-template-ameliore-${run}`;
  const tplName = `Modèle évolutif E2E ${run}`;
  const noticeText = () => `Le template « ${tplName} » a été amélioré`;

  beforeAll(async () => {
    baseSpec = ServerSpecSchema.parse(OFFICIAL_TEMPLATES.find((t) => t.slug === "communaute")!.spec);
    const [t] = await getDb()
      .insert(templates)
      .values({ slug, name: tplName, theme: "communaute", size: "medium", spec: baseSpec, status: "published", publishedAt: new Date() })
      .onConflictDoUpdate({ target: templates.slug, set: { spec: baseSpec, status: "published", specUpdatedAt: null } })
      .returning();
    templateId = t!.id;
    const created = await (await call("/api/projects", { method: "POST", cookie: owner.cookie, body: body({ source: "template", slug, name: "Mon serveur évolutif" }) })).json();
    updProjectId = created.project.id;
  });

  it("aucun avis tant que le template n’a pas changé", async () => {
    const html = await (await call("/tableau-de-bord", { cookie: owner.cookie })).text();
    expect(html).not.toContain(noticeText());
  });

  it("affiche l’avis quand le contenu du template est modifié après la création du projet", async () => {
    const improved = structuredClone(baseSpec);
    improved.roles.push({ id: "e2e-nouveau-role", name: "Rôle ajouté E2E", color: 0x44aa66, hoist: false, mentionable: false, permissions: [], selfAssignable: false, staff: false });
    improved.categories[0]!.channels.push({ id: "e2e-nouveau-salon", name: "salon-ajoute-e2e", type: "text", nsfw: false, slowmode: 0, syncPermissions: true, overwrites: [] });
    await getDb().update(templates).set({ spec: improved, specUpdatedAt: new Date() }).where(eq(templates.id, templateId));
    for (const page of ["/tableau-de-bord", "/projets"]) {
      const html = await (await call(page, { cookie: owner.cookie })).text();
      expect(html).toContain(noticeText());
      expect(html).toContain("Voir les nouveautés");
    }
  });

  it("l’aperçu liste uniquement ce qui manque", async () => {
    const r = await call(`/api/projects/${updProjectId}/template-update`, { cookie: owner.cookie });
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.count).toBe(2);
    expect(data.added.roles.map((x: { id: string }) => x.id)).toEqual(["e2e-nouveau-role"]);
    expect(data.added.channels.map((x: { id: string }) => x.id)).toEqual(["e2e-nouveau-salon"]);
    expect((await call(`/api/projects/${updProjectId}/template-update`, { cookie: stranger.cookie })).status).toBe(404);
  });

  it("applique les nouveautés sans écraser les personnalisations, puis l’avis disparaît", async () => {
    const { project } = await (await call(`/api/projects/${updProjectId}`, { cookie: owner.cookie })).json();
    const custom = structuredClone(project.spec);
    custom.roles[0].name = "Rôle renommé par moi";
    await call(`/api/projects/${updProjectId}`, { method: "PUT", cookie: owner.cookie, body: body({ spec: custom, revision: project.revision }) });

    const r = await call(`/api/projects/${updProjectId}/template-update`, { method: "POST", cookie: owner.cookie, body: "{}" });
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.count).toBe(2);
    const after = await (await call(`/api/projects/${updProjectId}`, { cookie: owner.cookie })).json();
    expect(after.project.spec.roles[0].name).toBe("Rôle renommé par moi");
    expect(after.project.spec.roles.some((x: { id: string }) => x.id === "e2e-nouveau-role")).toBe(true);
    expect(after.validation.errors).toEqual([]);
    const [rev] = await getDb().select().from(projectRevisions).where(eq(projectRevisions.projectId, updProjectId)).orderBy(projectRevisions.revision).then((rows) => rows.slice(-1));
    expect(rev!.note).toContain("Nouveautés du template");
    const html = await (await call("/tableau-de-bord", { cookie: owner.cookie })).text();
    expect(html).not.toContain(noticeText());
  });

  it("pas d’avis si la modification du template n’apporte rien de nouveau au projet", async () => {
    await getDb().update(templates).set({ specUpdatedAt: new Date() }).where(eq(templates.id, templateId));
    const html = await (await call("/projets", { cookie: owner.cookie })).text();
    expect(html).not.toContain(noticeText());
  });

  it("« Ignorer » masque l’avis jusqu’à la prochaine amélioration", async () => {
    const [t] = await getDb().select({ spec: templates.spec }).from(templates).where(eq(templates.id, templateId));
    const spec = structuredClone(t!.spec);
    spec.categories[0]!.channels.push({ id: "e2e-salon-ignore", name: "salon-ignore-e2e", type: "text", nsfw: false, slowmode: 0, syncPermissions: true, overwrites: [] });
    await getDb().update(templates).set({ spec, specUpdatedAt: new Date() }).where(eq(templates.id, templateId));
    let html = await (await call("/projets", { cookie: owner.cookie })).text();
    expect(html).toContain(noticeText());
    const r = await call(`/api/projects/${updProjectId}/template-update`, { method: "DELETE", cookie: owner.cookie });
    expect(r.status).toBe(200);
    html = await (await call("/projets", { cookie: owner.cookie })).text();
    expect(html).not.toContain(noticeText());
  });
});

describe("co-gestion : départ et retrait", () => {
  it("un co-gestionnaire peut quitter le projet", async () => {
    const r = await call(`/api/projects/${projectId}/members`, { method: "DELETE", cookie: friend.cookie, body: body({ userId: friend.user.id }) });
    expect(r.status).toBe(200);
    expect((await call(`/api/projects/${projectId}`, { cookie: friend.cookie })).status).toBe(404);
  });

  it("le propriétaire peut retirer un co-gestionnaire", async () => {
    const { path } = await (await call(`/api/projects/${projectId}/invites`, { method: "POST", cookie: owner.cookie, body: "{}" })).json();
    const token = path.split("/").pop();
    expect((await call(`/api/invitations/${token}/accept`, { method: "POST", cookie: late.cookie, body: "{}" })).status).toBe(200);
    expect((await call(`/api/projects/${projectId}`, { cookie: late.cookie })).status).toBe(200);
    const r = await call(`/api/projects/${projectId}/members`, { method: "DELETE", cookie: owner.cookie, body: body({ userId: late.user.id }) });
    expect(r.status).toBe(200);
    expect((await call(`/api/projects/${projectId}`, { cookie: late.cookie })).status).toBe(404);
  });

  it("le propriétaire peut désactiver les liens encore valables", async () => {
    await call(`/api/projects/${projectId}/invites`, { method: "POST", cookie: owner.cookie, body: "{}" });
    const r = await call(`/api/projects/${projectId}/invites`, { method: "DELETE", cookie: owner.cookie });
    expect((await r.json()).revoked).toBeGreaterThanOrEqual(1);
    const data = await (await call(`/api/projects/${projectId}/members`, { cookie: owner.cookie })).json();
    expect(data.invites).toEqual([]);
  });
});
