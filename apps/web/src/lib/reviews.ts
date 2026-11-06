import "server-only";
import { z } from "zod";
import { and, audit, count, desc, eq, getDb, isNull, projects, sql, templateReviews, templates, users } from "@mys/db";
import { HttpError } from "./api";
import { discordAvatarUrl, type TemplateRow } from "./data";
import { REVIEWS_PAGE_SIZE, REVIEW_COMMENT_MAX, commentHasLink, ratingDistribution } from "./community-rules";

/**
 * Avis des membres sur les templates publiés. Règles :
 * - un avis par membre et par template (modifiable, supprimable) ;
 * - jamais sur son propre template ;
 * - uniquement après avoir utilisé le template (un projet créé à partir de lui) ;
 * - la note affichée (ratingCount / ratingSum) ne compte que les avis visibles et est
 *   recalculée dans la même transaction que chaque changement.
 */

export const ReviewBody = z.object({
  rating: z.number({ error: "Choisissez une note de 1 à 5 étoiles." }).int().min(1, "Choisissez une note de 1 à 5 étoiles.").max(5, "Choisissez une note de 1 à 5 étoiles."),
  comment: z
    .string()
    .trim()
    .max(REVIEW_COMMENT_MAX, `Votre commentaire ne doit pas dépasser ${REVIEW_COMMENT_MAX} caractères.`)
    .nullish()
    .transform((c) => c || null),
});

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

export type Eligibility =
  | { canReview: true }
  | { canReview: false; reason: "login" | "own" | "not_used"; message: string };

export const ELIGIBILITY_MESSAGES = {
  login: "Connectez-vous avec Discord pour donner votre avis.",
  own: "Vous ne pouvez pas noter votre propre template.",
  not_used: "Seuls les membres qui ont utilisé ce template peuvent le noter. Créez un projet à partir de ce template : vous pourrez ensuite donner votre avis.",
} as const;

export async function reviewEligibility(userId: string | null, t: Pick<TemplateRow, "id" | "authorUserId">): Promise<Eligibility> {
  if (!userId) return { canReview: false, reason: "login", message: ELIGIBILITY_MESSAGES.login };
  if (t.authorUserId === userId) return { canReview: false, reason: "own", message: ELIGIBILITY_MESSAGES.own };
  const [used] = await getDb()
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.userId, userId), eq(projects.sourceTemplateId, t.id)))
    .limit(1);
  if (!used) return { canReview: false, reason: "not_used", message: ELIGIBILITY_MESSAGES.not_used };
  return { canReview: true };
}

/**
 * Recalcule les compteurs dénormalisés à partir des avis visibles. La ligne du template
 * est verrouillée : deux avis simultanés ne peuvent pas laisser un total faux.
 */
export async function recomputeRating(tx: Tx, templateId: string) {
  await tx.select({ id: templates.id }).from(templates).where(eq(templates.id, templateId)).for("update");
  const [agg] = await tx
    .select({ n: sql<number>`count(*)::int`, sum: sql<number>`coalesce(sum(${templateReviews.rating}), 0)::int` })
    .from(templateReviews)
    .where(and(eq(templateReviews.templateId, templateId), isNull(templateReviews.hiddenAt)));
  const ratingCount = Number(agg?.n ?? 0);
  const ratingSum = Number(agg?.sum ?? 0);
  await tx.update(templates).set({ ratingCount, ratingSum }).where(eq(templates.id, templateId));
  return { ratingCount, ratingSum };
}

const reviewColumns = {
  id: templateReviews.id,
  rating: templateReviews.rating,
  comment: templateReviews.comment,
  hiddenAt: templateReviews.hiddenAt,
  createdAt: templateReviews.createdAt,
  updatedAt: templateReviews.updatedAt,
  userId: users.id,
  username: users.username,
  globalName: users.globalName,
  discordId: users.discordId,
  avatar: users.avatar,
};

const reviewQuery = () => getDb().select(reviewColumns).from(templateReviews).innerJoin(users, eq(users.id, templateReviews.userId));
type ReviewRow = Awaited<ReturnType<typeof reviewQuery>>[number];

function toPublicReview(r: ReviewRow) {
  return {
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    hidden: !!r.hiddenAt,
    createdAt: r.createdAt.toISOString(),
    edited: r.updatedAt.getTime() - r.createdAt.getTime() > 60_000,
    userId: r.userId,
    author: { name: r.globalName ?? r.username, avatarUrl: discordAvatarUrl(r.discordId, r.avatar) },
  };
}
export type PublicReview = ReturnType<typeof toPublicReview>;

/** Avis visibles d’un template, du plus récent au plus ancien. */
export async function listReviews(templateId: string, page = 1) {
  const p = Math.max(1, Math.min(500, Math.floor(page) || 1));
  const rows = await reviewQuery()
    .where(and(eq(templateReviews.templateId, templateId), isNull(templateReviews.hiddenAt)))
    .orderBy(desc(templateReviews.createdAt), desc(templateReviews.id))
    .limit(REVIEWS_PAGE_SIZE + 1)
    .offset((p - 1) * REVIEWS_PAGE_SIZE);
  return { page: p, reviews: rows.slice(0, REVIEWS_PAGE_SIZE).map(toPublicReview), hasMore: rows.length > REVIEWS_PAGE_SIZE };
}

export async function getReviewDistribution(templateId: string) {
  const rows = await getDb()
    .select({ rating: templateReviews.rating, n: count() })
    .from(templateReviews)
    .where(and(eq(templateReviews.templateId, templateId), isNull(templateReviews.hiddenAt)))
    .groupBy(templateReviews.rating);
  return ratingDistribution(rows.map((r) => ({ rating: r.rating, n: Number(r.n) })));
}

export async function getUserReview(userId: string, templateId: string) {
  const [r] = await reviewQuery().where(and(eq(templateReviews.templateId, templateId), eq(templateReviews.userId, userId)));
  return r ? toPublicReview(r) : null;
}

/** Résumé affiché : note moyenne et nombre d’avis visibles. */
export const ratingSummary = (t: Pick<TemplateRow, "ratingCount" | "ratingSum">) => ({ count: t.ratingCount, average: t.ratingCount > 0 ? t.ratingSum / t.ratingCount : null });

/** Crée ou modifie l’avis du membre. Un avis masqué par la modération le reste après modification. */
export async function upsertReview(userId: string, t: TemplateRow, body: z.infer<typeof ReviewBody>) {
  if (body.comment && commentHasLink(body.comment)) throw new HttpError(400, "Les liens ne sont pas autorisés dans les avis.", "validation");
  const db = getDb();
  const [existing] = await db
    .select({ id: templateReviews.id })
    .from(templateReviews)
    .where(and(eq(templateReviews.templateId, t.id), eq(templateReviews.userId, userId)));
  if (!existing) {
    // Un membre qui a déjà laissé un avis peut toujours le modifier ; un nouvel avis exige les conditions.
    const e = await reviewEligibility(userId, t);
    if (!e.canReview) throw new HttpError(403, e.message, e.reason);
  }
  const summary = await db.transaction(async (tx) => {
    await tx
      .insert(templateReviews)
      .values({ templateId: t.id, userId, rating: body.rating, comment: body.comment })
      .onConflictDoUpdate({ target: [templateReviews.templateId, templateReviews.userId], set: { rating: body.rating, comment: body.comment, updatedAt: new Date() } });
    return recomputeRating(tx, t.id);
  });
  await audit({ actorUserId: userId, actorType: "user", action: existing ? "review.update" : "review.create", targetType: "template", targetId: t.id, metadata: { rating: body.rating } });
  return { created: !existing, summary, review: await getUserReview(userId, t.id) };
}

export async function deleteReview(userId: string, templateId: string) {
  const summary = await getDb().transaction(async (tx) => {
    const deleted = await tx
      .delete(templateReviews)
      .where(and(eq(templateReviews.templateId, templateId), eq(templateReviews.userId, userId)))
      .returning({ id: templateReviews.id });
    if (!deleted.length) throw new HttpError(404, "Vous n’avez pas encore donné d’avis sur ce template.");
    return recomputeRating(tx, templateId);
  });
  await audit({ actorUserId: userId, actorType: "user", action: "review.delete", targetType: "template", targetId: templateId });
  return summary;
}

/* ------------------------------ Administration ------------------------------ */

/** Avis récents (visibles et masqués) pour la modération. */
export async function listRecentReviews(limit = 100) {
  return getDb()
    .select({
      id: templateReviews.id,
      rating: templateReviews.rating,
      comment: templateReviews.comment,
      hiddenAt: templateReviews.hiddenAt,
      createdAt: templateReviews.createdAt,
      updatedAt: templateReviews.updatedAt,
      templateId: templates.id,
      templateName: templates.name,
      templateSlug: templates.slug,
      userId: users.id,
      username: users.username,
      globalName: users.globalName,
    })
    .from(templateReviews)
    .innerJoin(templates, eq(templates.id, templateReviews.templateId))
    .innerJoin(users, eq(users.id, templateReviews.userId))
    .orderBy(desc(templateReviews.updatedAt))
    .limit(limit);
}

export async function setReviewHidden(adminId: string, reviewId: string, hidden: boolean) {
  if (!/^[0-9a-f-]{36}$/i.test(reviewId)) throw new HttpError(404, "Avis introuvable.");
  const result = await getDb().transaction(async (tx) => {
    const [r] = await tx
      .update(templateReviews)
      .set({ hiddenAt: hidden ? new Date() : null })
      .where(eq(templateReviews.id, reviewId))
      .returning({ templateId: templateReviews.templateId });
    if (!r) throw new HttpError(404, "Avis introuvable.");
    return { templateId: r.templateId, ...(await recomputeRating(tx, r.templateId)) };
  });
  await audit({ actorUserId: adminId, actorType: "admin", action: hidden ? "admin.review.hide" : "admin.review.show", targetType: "review", targetId: reviewId, metadata: { templateId: result.templateId } });
  return result;
}
