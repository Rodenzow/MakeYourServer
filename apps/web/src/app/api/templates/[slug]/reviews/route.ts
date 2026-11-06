import { HttpError, json, parseBody, withPublic, withUser } from "@/lib/api";
import { getPublishedTemplate } from "@/lib/data";
import { ReviewBody, deleteReview, listReviews, ratingSummary, upsertReview } from "@/lib/reviews";

async function load(slug: string) {
  const t = await getPublishedTemplate(slug);
  if (!t) throw new HttpError(404, "Template introuvable.");
  return t;
}

/** Avis visibles, paginés (10 par page) : ?page=2 */
export const GET = withPublic<{ slug: string }>(async (req, _user, { slug }) => {
  const t = await load(slug);
  const page = Number.parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10);
  const result = await listReviews(t.id, page);
  return json({ ...result, summary: ratingSummary(t) });
});

/** Créer ou modifier son avis (note de 1 à 5, commentaire facultatif). */
export const POST = withUser<{ slug: string }>(async (req, user, { slug }) => {
  const body = await parseBody(req, ReviewBody);
  const t = await load(slug);
  const { created, summary, review } = await upsertReview(user.id, t, body);
  return json({ review, summary: ratingSummary(summary) }, created ? 201 : 200);
});

/** Supprimer son avis. */
export const DELETE = withUser<{ slug: string }>(async (_req, user, { slug }) => {
  const t = await load(slug);
  const summary = await deleteReview(user.id, t.id);
  return json({ deleted: true, summary: ratingSummary(summary) });
});
