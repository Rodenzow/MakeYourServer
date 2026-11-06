/**
 * Règles de la communauté (avis, badges de créateurs) : fonctions pures, sans accès
 * à la base, utilisables côté serveur comme côté client, et testées unitairement.
 */

/** Longueur maximale d’un commentaire d’avis. */
export const REVIEW_COMMENT_MAX = 500;
/** Avis affichés par page sur la fiche d’un template. */
export const REVIEWS_PAGE_SIZE = 10;

/**
 * Moyenne bayésienne (tri « Mieux notés ») : chaque template part de RATING_PRIOR_WEIGHT
 * avis fictifs à RATING_PRIOR_MEAN. Un seul avis à 5 ne fait donc pas passer un template
 * devant un autre noté 4,8 par cinquante membres.
 */
export const RATING_PRIOR_MEAN = 3.5;
export const RATING_PRIOR_WEIGHT = 5;

export function bayesianScore(ratingSum: number, ratingCount: number, prior = RATING_PRIOR_MEAN, weight = RATING_PRIOR_WEIGHT) {
  return (ratingSum + prior * weight) / (ratingCount + weight);
}

export function averageRating(ratingSum: number, ratingCount: number): number | null {
  return ratingCount > 0 ? ratingSum / ratingCount : null;
}

/** 4.56 → « 4,6 » (une décimale, virgule française). */
export function formatRating(avg: number) {
  return (Math.round(avg * 10) / 10).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export const RATING_LABELS: Record<number, string> = {
  1: "Décevant",
  2: "Moyen",
  3: "Correct",
  4: "Très bien",
  5: "Excellent",
};

/** Répartition des notes 5 → 1 (toutes les notes présentes, même à zéro). */
export function ratingDistribution(rows: Array<{ rating: number; n: number }>) {
  const total = rows.reduce((s, r) => s + Number(r.n), 0);
  return [5, 4, 3, 2, 1].map((rating) => {
    const n = Number(rows.find((r) => r.rating === rating)?.n ?? 0);
    return { rating, n, percent: total ? Math.round((n / total) * 100) : 0 };
  });
}

/** Les liens sont refusés dans les avis (spam, invitations vers d’autres serveurs). */
export function commentHasLink(comment: string) {
  return /(https?:\/\/|www\.|discord\.(gg|com\/invite)|\b[a-z0-9-]+\.(com|fr|net|org|gg|io|xyz)\b)/i.test(comment);
}

export interface CreatorTotals {
  published: number;
  installs: number;
  ratingSum: number;
  ratingCount: number;
}

export interface CreatorBadge {
  key: "verified" | "confirmed" | "installs100" | "topRated";
  label: string;
  description: string;
}

/** Badges calculés à partir des templates publiés du créateur (rien n’est attribué à la main). */
export function creatorBadges(t: CreatorTotals): CreatorBadge[] {
  const badges: CreatorBadge[] = [];
  if (t.published >= 1) badges.push({ key: "verified", label: "Créateur vérifié", description: "Au moins un template relu et publié par l’équipe." });
  if (t.published >= 3) badges.push({ key: "confirmed", label: "Créateur confirmé", description: "Au moins trois templates publiés." });
  if (t.installs >= 100) badges.push({ key: "installs100", label: "100 installations", description: "Ses templates ont été installés au moins 100 fois." });
  const avg = averageRating(t.ratingSum, t.ratingCount);
  if (avg !== null && avg >= 4.5 && t.ratingCount >= 5) badges.push({ key: "topRated", label: "Très bien noté", description: "Note moyenne d’au moins 4,5 sur 5, avec au moins 5 avis." });
  return badges;
}
