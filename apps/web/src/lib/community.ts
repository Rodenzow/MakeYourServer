import "server-only";
import { and, desc, eq, getDb, sql, templates, users } from "@mys/db";
import { discordAvatarUrl, publicAuthor, searchTemplates, type TemplateRow } from "./data";
import { averageRating, creatorBadges } from "./community-rules";

/* ------------------------------ Pages créateurs ----------------------------- */

/**
 * Profil public d’un créateur. Il n’existe que si le membre a au moins un template
 * communautaire PUBLIÉ pour lequel il a accepté d’afficher son pseudo : un auteur
 * resté anonyme n’a jamais de page (et ses templates anonymes n’y figurent pas).
 */
export async function getCreatorProfile(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  const db = getDb();
  const [user] = await db
    .select({ id: users.id, username: users.username, globalName: users.globalName, discordId: users.discordId, avatar: users.avatar, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, id));
  if (!user) return null;
  const list = await searchTemplates({ authorId: id, sort: "popular" });
  if (!list.length) return null;
  const [totals] = await db
    .select({
      views: sql<number>`coalesce(sum(${templates.viewCount}), 0)::int`,
      installs: sql<number>`coalesce(sum(${templates.installCount}), 0)::int`,
      ratingSum: sql<number>`coalesce(sum(${templates.ratingSum}), 0)::int`,
      ratingCount: sql<number>`coalesce(sum(${templates.ratingCount}), 0)::int`,
    })
    .from(templates)
    .where(and(eq(templates.authorUserId, id), eq(templates.status, "published"), eq(templates.official, false), eq(templates.showAuthor, true)));
  const stats = {
    published: list.length,
    views: Number(totals?.views ?? 0),
    installs: Number(totals?.installs ?? 0),
    ratingSum: Number(totals?.ratingSum ?? 0),
    ratingCount: Number(totals?.ratingCount ?? 0),
  };
  return {
    id: user.id,
    name: user.globalName ?? user.username,
    avatarUrl: discordAvatarUrl(user.discordId, user.avatar, 160),
    memberSince: user.createdAt,
    stats: { ...stats, average: averageRating(stats.ratingSum, stats.ratingCount) },
    badges: creatorBadges(stats),
    templates: list,
  };
}

/* --------------------------- Remix avec attribution ------------------------- */

/**
 * Filiation d’un template : celui dont il s’inspire (s’il est toujours publié) et les
 * remixes publiés qui s’en inspirent.
 */
export async function getTemplateLineage(t: Pick<TemplateRow, "id" | "basedOnTemplateId">) {
  const db = getDb();
  const [basedOn, remixes] = await Promise.all([
    t.basedOnTemplateId
      ? db
          .select({ slug: templates.slug, name: templates.name, official: templates.official, showAuthor: templates.showAuthor, author: { id: users.id, username: users.username, globalName: users.globalName, discordId: users.discordId, avatar: users.avatar } })
          .from(templates)
          .leftJoin(users, eq(users.id, templates.authorUserId))
          .where(and(eq(templates.id, t.basedOnTemplateId), eq(templates.status, "published")))
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    db
      .select({ slug: templates.slug, name: templates.name, official: templates.official, showAuthor: templates.showAuthor, author: { id: users.id, username: users.username, globalName: users.globalName, discordId: users.discordId, avatar: users.avatar } })
      .from(templates)
      .leftJoin(users, eq(users.id, templates.authorUserId))
      .where(and(eq(templates.basedOnTemplateId, t.id), eq(templates.status, "published")))
      .orderBy(desc(templates.publishedAt))
      .limit(50),
  ]);
  const shape = (r: NonNullable<typeof basedOn>) => ({ slug: r.slug, name: r.name, official: r.official, author: publicAuthor(r, r.author?.id ? r.author : null) });
  return { basedOn: basedOn ? shape(basedOn) : null, remixes: remixes.map(shape) };
}
