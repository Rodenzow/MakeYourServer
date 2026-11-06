"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Eligibility, PublicReview } from "@/lib/reviews";
import { RATING_LABELS, REVIEW_COMMENT_MAX, formatRating } from "@/lib/community-rules";
import { Badge, Button, ButtonLink, Notice, cx } from "../ui";
import { StarIcon, Stars } from "./stars";

const EASE = [0.2, 0.9, 0.25, 1] as const;

const formatDay = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });

export interface ReviewsProps {
  slug: string;
  summary: { count: number; average: number | null };
  distribution: Array<{ rating: number; n: number; percent: number }>;
  initial: { reviews: PublicReview[]; hasMore: boolean };
  mine: PublicReview | null;
  eligibility: Eligibility;
  currentUserId: string | null;
}

/**
 * Avis des membres sur la fiche d’un template : résumé (moyenne, répartition), avis
 * de l’utilisateur (création, modification, suppression) et liste paginée.
 * Tout passe par l’API puis rafraîchit la page : les pages publiques sont mises en
 * cache quelques secondes pour les visiteurs non connectés.
 */
export function Reviews({ slug, summary, distribution, initial, mine, eligibility, currentUserId }: ReviewsProps) {
  const [extra, setExtra] = useState<PublicReview[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Après un rafraîchissement (avis publié, modifié…), on repart de la première page.
  useEffect(() => {
    setExtra([]);
    setPage(1);
    setHasMore(initial.hasMore);
  }, [initial]);

  const seen = new Set(initial.reviews.map((r) => r.id));
  const list = [...initial.reviews, ...extra.filter((r) => !seen.has(r.id))];

  async function loadMore() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/templates/${slug}/reviews?page=${page + 1}`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { reviews: PublicReview[]; hasMore: boolean };
      setExtra((xs) => [...xs, ...data.reviews]);
      setPage((p) => p + 1);
      setHasMore(data.hasMore);
    } catch {
      setLoadError("Les avis suivants n’ont pas pu être chargés. Réessayez dans un instant.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="avis" aria-labelledby="avis-titre" className="mt-12 scroll-mt-24">
      <h2 id="avis-titre" className="text-2xl font-bold">
        Avis des membres
      </h2>
      <p className="mt-1 text-muted">Les notes viennent uniquement de membres qui ont utilisé ce template pour créer leur serveur.</p>

      <div className="mt-6 grid gap-8 lg:grid-cols-[340px_1fr] lg:items-start">
        <div className="space-y-5 lg:sticky lg:top-24">
          <Summary summary={summary} distribution={distribution} />
          <MyReview slug={slug} mine={mine} eligibility={eligibility} />
        </div>

        <div>
          {list.length === 0 ? (
            <div className="panel blueprint px-6 py-10 text-center">
              <p className="font-display text-lg font-semibold">Aucun avis pour le moment</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted">Les membres qui utilisent ce template pourront partager leur expérience ici.</p>
            </div>
          ) : (
            <ul className="space-y-3" aria-label="Avis publiés">
              <AnimatePresence initial={false}>
                {list.map((r) => (
                  <ReviewItem key={r.id} r={r} isMine={r.userId === currentUserId} />
                ))}
              </AnimatePresence>
            </ul>
          )}
          {loadError && (
            <Notice tone="danger" className="mt-3">
              {loadError}
            </Notice>
          )}
          {hasMore && (
            <div className="mt-4 text-center">
              <Button variant="secondary" onClick={loadMore} disabled={loading}>
                {loading ? "Chargement…" : "Afficher plus d’avis"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Summary({ summary, distribution }: { summary: ReviewsProps["summary"]; distribution: ReviewsProps["distribution"] }) {
  const reduce = useReducedMotion();
  return (
    <div className="brick p-5">
      {summary.average === null ? (
        <div className="flex items-center gap-3">
          <Stars value={0} size={22} />
          <p className="text-sm text-muted">Pas encore de note</p>
        </div>
      ) : (
        <div className="flex items-end gap-4">
          <p className="font-display text-5xl leading-none font-bold text-fg">
            {formatRating(summary.average)}
            <span className="sr-only"> sur 5</span>
          </p>
          <div className="pb-1">
            <Stars value={summary.average} size={20} />
            <p className="mt-1 text-sm text-muted">
              {summary.count} avis
            </p>
          </div>
        </div>
      )}
      <ul className="mt-5 space-y-1.5" aria-label="Répartition des notes">
        {distribution.map((d) => (
          <li key={d.rating} className="grid grid-cols-[2.75rem_1fr_2rem] items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1 font-mono text-xs text-ink">
              {d.rating} <StarIcon size={12} className="text-warning" />
            </span>
            <span className="relative h-2 overflow-hidden rounded-full bg-night" aria-hidden>
              <motion.span
                className="absolute inset-y-0 left-0 rounded-full bg-warning"
                initial={reduce ? false : { width: 0 }}
                whileInView={{ width: `${d.percent}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: (5 - d.rating) * 0.06, ease: EASE }}
                style={reduce ? { width: `${d.percent}%` } : undefined}
              />
            </span>
            <span className="text-right font-mono text-xs text-muted">
              {d.n}
              <span className="sr-only">
                {" "}
                avis à {d.rating} étoile{d.rating > 1 ? "s" : ""}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Avatar({ url, name, size = 36 }: { url: string | null; name: string; size?: number }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" width={size} height={size} loading="lazy" className="shrink-0 rounded-full" style={{ width: size, height: size }} />
  ) : (
    <span aria-hidden className="grid shrink-0 place-items-center rounded-full bg-mist font-display text-sm font-bold text-ink" style={{ width: size, height: size }}>
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

function ReviewItem({ r, isMine }: { r: PublicReview; isMine: boolean }) {
  const reduce = useReducedMotion();
  return (
    <motion.li
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.3, ease: EASE }}
      className={cx("panel p-4", isMine && "border-edge")}
    >
      <article aria-label={`Avis de ${r.author.name}`}>
        <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Avatar url={r.author.avatarUrl} name={r.author.name} />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 font-semibold">
              <span className="truncate">{r.author.name}</span>
              {isMine && <Badge tone="blue">Vous</Badge>}
            </p>
            <p className="text-xs text-muted">
              <time dateTime={r.createdAt}>Le {formatDay(r.createdAt)}</time>
              {r.edited && " · modifié"}
            </p>
          </div>
          <Stars value={r.rating} size={15} />
        </header>
        {r.comment && <p className="mt-3 text-sm whitespace-pre-line text-ink">{r.comment}</p>}
      </article>
    </motion.li>
  );
}

/* --------------------------------- Mon avis --------------------------------- */

function MyReview({ slug, mine, eligibility }: { slug: string; mine: PublicReview | null; eligibility: Eligibility }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => setEditing(false), [mine]);

  if (!mine && !eligibility.canReview) {
    return (
      <div className="panel p-5 text-sm">
        <p className="font-semibold">Donner votre avis</p>
        <p className="mt-1 text-muted">{eligibility.message}</p>
        {eligibility.reason === "login" && (
          <ButtonLink href={`/connexion?suivant=${encodeURIComponent(`/templates/${slug}#avis`)}`} variant="secondary" size="sm" className="mt-3">
            Se connecter avec Discord
          </ButtonLink>
        )}
        {eligibility.reason === "not_used" && (
          <a href="#cta-principal" className="link mt-3 inline-block font-semibold">
            Utiliser ce template
          </a>
        )}
      </div>
    );
  }

  async function remove() {
    if (!window.confirm("Supprimer définitivement votre avis ?")) return;
    setError(null);
    start(async () => {
      try {
        const res = await fetch(`/api/templates/${slug}/reviews`, { method: "DELETE" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "La suppression n’a pas abouti.");
        setStatus("Votre avis a été supprimé.");
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  if (mine && !editing) {
    return (
      <div className="panel border-edge p-5 text-sm">
        <p className="font-semibold">Votre avis</p>
        {mine.hidden && (
          <Notice tone="warning" className="mt-2">
            Votre avis a été masqué par l’équipe de modération : il n’est plus visible publiquement ni compté dans la note.
          </Notice>
        )}
        <div className="mt-2 flex items-center gap-2">
          <Stars value={mine.rating} size={18} />
          <span className="text-muted">{RATING_LABELS[mine.rating]}</span>
        </div>
        {mine.comment && <p className="mt-2 whitespace-pre-line text-ink">{mine.comment}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)} disabled={pending}>
            Modifier
          </Button>
          <Button size="sm" variant="ghost" onClick={remove} disabled={pending}>
            {pending ? "Suppression…" : "Supprimer"}
          </Button>
        </div>
        {error && (
          <p role="alert" className="mt-2 text-xs text-danger">
            {error}
          </p>
        )}
        <p aria-live="polite" className="sr-only">
          {status}
        </p>
      </div>
    );
  }

  return <ReviewForm slug={slug} mine={mine} onCancel={mine ? () => setEditing(false) : undefined} />;
}

function ReviewForm({ slug, mine, onCancel }: { slug: string; mine: PublicReview | null; onCancel?: () => void }) {
  const router = useRouter();
  const [rating, setRating] = useState(mine?.rating ?? 0);
  const [comment, setComment] = useState(mine?.comment ?? "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const commentId = useId();
  const hintId = useId();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(null);
    if (!rating) return setError("Choisissez une note de 1 à 5 étoiles.");
    start(async () => {
      try {
        const res = await fetch(`/api/templates/${slug}/reviews`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating, comment: comment.trim() || null }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Votre avis n’a pas pu être enregistré.");
        setDone(mine ? "Votre avis a été modifié. Merci !" : "Merci ! Votre avis est publié.");
        router.refresh();
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  return (
    <form onSubmit={submit} className="panel border-edge p-5" noValidate>
      <p className="font-semibold">{mine ? "Modifier votre avis" : "Donner votre avis"}</p>
      <StarInput value={rating} onChange={setRating} />
      <label htmlFor={commentId} className="label mt-4">
        Votre commentaire <span className="font-normal text-muted">(facultatif)</span>
      </label>
      <textarea
        id={commentId}
        className="field min-h-24 text-sm"
        maxLength={REVIEW_COMMENT_MAX}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Qu’avez-vous aimé ? Qu’est-ce qui pourrait être amélioré ?"
        aria-describedby={hintId}
      />
      <div id={hintId} className="mt-1 flex justify-between gap-3 text-xs text-muted">
        <span>Votre pseudo et votre avatar Discord seront affichés. Restez courtois, sans lien.</span>
        <span className="shrink-0 font-mono" aria-label={`${comment.length} caractères sur ${REVIEW_COMMENT_MAX}`}>
          {comment.length}/{REVIEW_COMMENT_MAX}
        </span>
      </div>
      {error && (
        <Notice tone="danger" className="mt-3">
          {error}
        </Notice>
      )}
      <p aria-live="polite" className={cx("text-sm text-success", done ? "mt-3" : "sr-only")}>
        {done}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Enregistrement…" : mine ? "Enregistrer" : "Publier mon avis"}
        </Button>
        {onCancel && (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
            Annuler
          </Button>
        )}
      </div>
    </form>
  );
}

/**
 * Choix de la note : de vrais boutons radio (flèches du clavier, lecteurs d’écran),
 * habillés en étoiles qui s’illuminent au survol et rebondissent à la sélection.
 */
function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const reduce = useReducedMotion();
  const name = useId();
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <fieldset className="mt-3">
      <legend className="label">Votre note</legend>
      <div className="flex items-center gap-3">
        <div className="flex" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label
              key={n}
              className="relative cursor-pointer rounded-md p-0.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-light"
              onMouseEnter={() => setHover(n)}
            >
              <input type="radio" name={name} value={n} checked={value === n} onChange={() => onChange(n)} className="sr-only" />
              <span className="sr-only">
                {n} étoile{n > 1 ? "s" : ""} : {RATING_LABELS[n]}
              </span>
              <motion.span
                className={cx("block transition-colors duration-150", n <= shown ? "text-warning" : "text-edge")}
                animate={reduce ? undefined : { scale: value === n ? [1, 1.3, 1] : n <= hover ? 1.12 : 1 }}
                transition={{ duration: 0.3, ease: EASE }}
                whileTap={reduce ? undefined : { scale: 0.85 }}
              >
                <StarIcon size={28} filled={n <= shown} />
              </motion.span>
            </label>
          ))}
        </div>
        <span className="min-w-20 text-sm font-semibold text-ink" aria-hidden>
          {shown ? RATING_LABELS[shown] : ""}
        </span>
      </div>
    </fieldset>
  );
}
