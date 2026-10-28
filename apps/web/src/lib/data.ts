import "server-only";
import { ServerSpecSchema, specStats, validateSpec, type ServerSpec } from "@mys/core";
import { detectFeatures } from "@mys/core/templates";
import {
  aiGenerations,
  and,
  asc,
  desc,
  eq,
  getDb,
  getTableColumns,
  ilike,
  or,
  projectRevisions,
  projects,
  savedTemplates,
  sql,
  templates,
  users,
  type schema,
} from "@mys/db";
import { getEntitlement } from "@mys/engine";
import { HttpError } from "./api";

export type TemplateRow = typeof schema.templates.$inferSelect;
export type ProjectRow = typeof schema.projects.$inferSelect;

/* -------------------------------- Templates -------------------------------- */

export interface TemplateQuery {
  q?: string;
  theme?: string;
  size?: string;
  features?: string[];
  /** official : templates officiels · community : publiés par les membres */
  source?: "official" | "community";
  sort?: "popular" | "recent" | "views" | "name";
}

/** Recherche dans les templates PUBLIÉS uniquement (jamais les projets ni les sauvegardes). */
export async function searchTemplates(query: TemplateQuery) {
  const conds = [eq(templates.status, "published")];
  if (query.q) {
    const like = `%${query.q.replace(/[%_]/g, "")}%`;
    conds.push(or(ilike(templates.name, like), ilike(templates.description, like), ilike(templates.tagline, like), ilike(templates.audience, like))!);
  }
  if (query.theme) conds.push(eq(templates.theme, query.theme));
  if (query.size) conds.push(eq(templates.size, query.size));
  for (const f of query.features ?? []) conds.push(sql`${templates.features} ? ${f}`);
  if (query.source) conds.push(eq(templates.official, query.source === "official"));
  const order =
    query.sort === "recent"
      ? [desc(templates.publishedAt)]
      : query.sort === "name"
        ? [asc(templates.name)]
        : query.sort === "views"
          ? [desc(templates.viewCount)]
          : [desc(sql`${templates.popularity} + ${templates.installCount} * 2 + ${templates.viewCount} / 20`)];
  // Les cartes n’ont pas besoin du contenu des messages ni de l’AutoMod : on ne
  // transfère qu’une version allégée de la spécification (bien plus rapide).
  const { spec: _spec, ...columns } = getTableColumns(templates);
  const rows = await getDb()
    .select({
      t: columns,
      spec: sql<CardSpec>`${templates.spec} - 'messages' - 'automod' - 'serverGuide' - 'welcomeScreen' - 'features'`,
      messageCount: sql<number>`jsonb_array_length(coalesce(${templates.spec}->'messages', '[]'::jsonb))`,
      author: { username: users.username, globalName: users.globalName, discordId: users.discordId, avatar: users.avatar },
    })
    .from(templates)
    .leftJoin(users, eq(users.id, templates.authorUserId))
    .where(and(...conds))
    .orderBy(...order);
  return rows.map((r) => templateCard({ ...r.t, spec: r.spec }, r.author, Number(r.messageCount)));
}

/** Spécification allégée utilisée par les cartes de la bibliothèque. */
type CardSpec = Pick<ServerSpec, "meta" | "roles" | "categories" | "uncategorized" | "onboarding">;

type AuthorRow = { username: string; globalName: string | null; discordId: string; avatar: string | null } | null;

/** Auteur affiché publiquement : uniquement pour un template communautaire dont l’auteur l’a accepté. */
export function publicAuthor(t: Pick<TemplateRow, "official" | "showAuthor">, a: AuthorRow) {
  if (t.official || !t.showAuthor || !a) return null;
  return { name: a.globalName ?? a.username, avatarUrl: a.avatar ? `https://cdn.discordapp.com/avatars/${a.discordId}/${a.avatar}.png?size=64` : null };
}

export async function getTemplateAuthor(t: TemplateRow) {
  if (t.official || !t.showAuthor || !t.authorUserId) return null;
  const [a] = await getDb()
    .select({ username: users.username, globalName: users.globalName, discordId: users.discordId, avatar: users.avatar })
    .from(users)
    .where(eq(users.id, t.authorUserId));
  return publicAuthor(t, a ?? null);
}

export function templateCard(t: Omit<TemplateRow, "spec"> & { spec: CardSpec }, author: AuthorRow = null, messageCount = 0) {
  const channels = t.spec.categories.reduce((n, c) => n + c.channels.length, 0) + (t.spec.uncategorized?.length ?? 0);
  return {
    id: t.id,
    slug: t.slug,
    name: t.name,
    tagline: t.tagline,
    theme: t.theme,
    size: t.size,
    features: t.features,
    official: t.official,
    popularity: t.popularity + t.installCount * 2,
    installCount: t.installCount,
    viewCount: t.viewCount,
    author: publicAuthor(t, author),
    stats: { channels, roles: t.spec.roles.length, messages: messageCount },
    accentColor: t.spec.meta.accentColor ?? 0x83a8f3,
    preview: {
      categories: t.spec.categories.slice(0, 4).map((c) => ({ name: c.name, channels: c.channels.slice(0, 4).map((ch) => ({ name: ch.name, type: ch.type })) })),
      roles: t.spec.roles.slice(0, 6).map((r) => ({ name: r.name, color: r.color })),
      onboarding: t.spec.onboarding?.enabled ? { count: t.spec.onboarding.prompts.length, first: t.spec.onboarding.prompts[0]?.title ?? null } : null,
    },
  };
}
export type TemplateCard = ReturnType<typeof templateCard>;

export async function getPublishedTemplate(slug: string) {
  const [t] = await getDb()
    .select()
    .from(templates)
    .where(and(eq(templates.slug, slug), eq(templates.status, "published")));
  return t ?? null;
}

export async function listSavedTemplateIds(userId: string) {
  const rows = await getDb().select({ id: savedTemplates.templateId }).from(savedTemplates).where(eq(savedTemplates.userId, userId));
  return new Set(rows.map((r) => r.id));
}

/* --------------------------------- Projets --------------------------------- */

export async function listProjects(userId: string) {
  const rows = await getDb().select().from(projects).where(eq(projects.userId, userId)).orderBy(desc(projects.updatedAt));
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    sourceType: p.sourceType,
    updatedAt: p.updatedAt,
    stats: specStats(p.spec),
    theme: p.spec.meta.theme,
    accentColor: p.spec.meta.accentColor ?? 0x83a8f3,
  }));
}

/** Un projet n’est accessible qu’à son propriétaire. */
export async function getOwnedProject(userId: string, projectId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) return null;
  const [p] = await getDb()
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
  return p ?? null;
}

export async function assertProjectQuota(userId: string) {
  const ent = await getEntitlement(userId);
  const [{ n }] = (await getDb().select({ n: sql<number>`count(*)::int` }).from(projects).where(eq(projects.userId, userId))) as [{ n: number }];
  if (n >= ent.quotas.maxProjects) {
    throw new HttpError(402, `Votre offre permet ${ent.quotas.maxProjects} projets. Supprimez un projet ou passez au Premium.`, "quota");
  }
}

export async function createProject(userId: string, input: { name: string; spec: ServerSpec; sourceType: string; sourceTemplateId?: string | null; sourceBackupId?: string | null }) {
  await assertProjectQuota(userId);
  const spec = ServerSpecSchema.parse({ ...input.spec, meta: { ...input.spec.meta, name: input.name } });
  const db = getDb();
  return db.transaction(async (tx) => {
    const [p] = await tx
      .insert(projects)
      .values({ userId, name: input.name, spec, sourceType: input.sourceType, sourceTemplateId: input.sourceTemplateId ?? null, sourceBackupId: input.sourceBackupId ?? null })
      .returning();
    await tx.insert(projectRevisions).values({ projectId: p!.id, revision: 1, spec, author: "user", note: "Création du projet" });
    return p!;
  });
}

/**
 * Enregistrement d’un projet avec contrôle de version optimiste : si le projet a été
 * modifié ailleurs entre-temps (autre onglet, IA), l’enregistrement est refusé.
 */
export async function saveProject(userId: string, projectId: string, input: { spec: unknown; revision: number; note?: string; author?: "user" | "ai" }) {
  const parsed = ServerSpecSchema.safeParse(input.spec);
  if (!parsed.success) throw new HttpError(400, `Projet invalide : ${parsed.error.issues[0]?.path.join(".")} — ${parsed.error.issues[0]?.message}`, "validation");
  const spec = parsed.data;
  const db = getDb();
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .for("update");
    if (!current) throw new HttpError(404, "Projet introuvable.");
    if (current.revision !== input.revision) throw new HttpError(409, "Ce projet a été modifié ailleurs. Rechargez la page pour récupérer la dernière version.", "conflict");
    const validation = validateSpec(spec);
    const revision = current.revision + 1;
    const [p] = await tx
      .update(projects)
      .set({ spec, name: spec.meta.name, revision, status: validation.ok ? "ready" : "draft", updatedAt: new Date() })
      .where(eq(projects.id, projectId))
      .returning();
    // Historique : on garde une révision par minute au plus, et toujours celles de l’IA.
    const [last] = await tx.select().from(projectRevisions).where(eq(projectRevisions.projectId, projectId)).orderBy(desc(projectRevisions.revision)).limit(1);
    if (!last || input.author === "ai" || Date.now() - last.createdAt.getTime() > 60_000) {
      await tx.insert(projectRevisions).values({ projectId, revision, spec, author: input.author ?? "user", note: input.note ?? null });
    }
    return { project: p!, validation };
  });
}

export async function projectRevisionsList(projectId: string) {
  return getDb()
    .select({ id: projectRevisions.id, revision: projectRevisions.revision, author: projectRevisions.author, note: projectRevisions.note, createdAt: projectRevisions.createdAt })
    .from(projectRevisions)
    .where(eq(projectRevisions.projectId, projectId))
    .orderBy(desc(projectRevisions.revision))
    .limit(50);
}

export async function listAiGenerations(userId: string, limit = 30) {
  return getDb()
    .select({
      id: aiGenerations.id,
      kind: aiGenerations.kind,
      prompt: aiGenerations.prompt,
      status: aiGenerations.status,
      projectId: aiGenerations.projectId,
      createdAt: aiGenerations.createdAt,
      costMicros: aiGenerations.costMicros,
      error: aiGenerations.error,
    })
    .from(aiGenerations)
    .where(eq(aiGenerations.userId, userId))
    .orderBy(desc(aiGenerations.createdAt))
    .limit(limit);
}

export { detectFeatures };
