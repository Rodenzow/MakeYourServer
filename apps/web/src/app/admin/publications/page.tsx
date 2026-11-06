import Link from "next/link";
import { THEME_LABELS } from "@mys/core";
import { ActionButton } from "@/components/admin/action-button";
import { Badge, EmptyState, PageHeader, cx, formatDate } from "@/components/ui";
import { listCommunitySubmissions, listOpenReports, moderationCounts } from "@/lib/admin";
import { REPORT_REASONS } from "@/lib/publications";
import { listRecentReviews } from "@/lib/reviews";
import { formatRating } from "@/lib/community-rules";
import { Stars } from "@/components/templates/stars";

export const metadata = { title: "Publications" };

const TABS = {
  attente: { label: "À relire", status: "pending_review" },
  signalements: { label: "Signalements", status: null },
  publies: { label: "Publiés", status: "published" },
  refuses: { label: "Refusés", status: "rejected" },
  retires: { label: "Retirés", status: "archived" },
  avis: { label: "Avis", status: null },
} as const;
type Tab = keyof typeof TABS;

/**
 * Modération des publications de la communauté : rien n’apparaît dans la bibliothèque
 * sans l’accord explicite d’un administrateur.
 */
export default async function AdminPublications({ searchParams }: { searchParams: Promise<{ onglet?: string }> }) {
  const { onglet } = await searchParams;
  const tab: Tab = onglet && onglet in TABS ? (onglet as Tab) : "attente";
  const counts = await moderationCounts();
  const status = TABS[tab].status;
  const [rows, reports, reviews] = await Promise.all([
    status ? listCommunitySubmissions(status) : Promise.resolve([]),
    tab === "signalements" ? listOpenReports() : Promise.resolve([]),
    tab === "avis" ? listRecentReviews(100) : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader eyebrow="Administration" title="Publications de la communauté">
        Relisez chaque proposition (noms, messages, permissions) avant de l’accepter. Les auteurs voient le statut et le motif de refus dans « Mes publications ».
      </PageHeader>

      <nav className="mb-5 flex flex-wrap gap-2" aria-label="Onglets">
        {(Object.keys(TABS) as Tab[]).map((k) => {
          const n = k === "attente" ? counts.pending : k === "signalements" ? counts.reports : 0;
          return (
            <Link
              key={k}
              href={`/admin/publications?onglet=${k}`}
              className={cx("inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold", tab === k ? "border-edge bg-accent text-on-accent" : "border-line bg-surface text-ink hover:border-edge")}
            >
              {TABS[k].label}
              {n > 0 && <span className={cx("rounded px-1.5 text-[11px]", tab === k ? "bg-night text-light" : "bg-warning-soft text-warning")}>{n}</span>}
            </Link>
          );
        })}
      </nav>

      {tab === "avis" ? (
        reviews.length === 0 ? (
          <EmptyState title="Aucun avis pour le moment">Les avis laissés par les membres sur les templates apparaîtront ici, du plus récent au plus ancien.</EmptyState>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted">
              Masquez un avis injurieux, hors sujet ou contraire aux règles de Discord : il disparaît de la fiche et n’est plus compté dans la note. Vous pouvez le réafficher à tout moment.
            </p>
            <ul className="space-y-3">
              {reviews.map((r) => (
                <li key={r.id} className={cx("panel flex flex-wrap items-start justify-between gap-4 p-4", r.hiddenAt && "opacity-75")}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Stars value={r.rating} size={14} />
                      <span className="sr-only">{formatRating(r.rating)} sur 5</span>
                      <Link href={`/templates/${r.templateSlug}#avis`} className="font-semibold hover:underline">
                        {r.templateName}
                      </Link>
                      {r.hiddenAt ? <Badge tone="danger">Masqué le {formatDate(r.hiddenAt)}</Badge> : <Badge tone="success">Visible</Badge>}
                    </div>
                    {r.comment ? <p className="mt-1 text-sm whitespace-pre-line text-ink">« {r.comment} »</p> : <p className="mt-1 text-sm text-muted italic">Note sans commentaire</p>}
                    <p className="mt-1 text-xs text-muted">
                      Par{" "}
                      <Link href={`/admin/utilisateurs/${r.userId}`} className="underline">
                        {r.globalName ?? r.username}
                      </Link>{" "}
                      (@{r.username}) le {formatDate(r.createdAt)}
                      {r.updatedAt.getTime() - r.createdAt.getTime() > 60_000 && <> · modifié le {formatDate(r.updatedAt)}</>}
                    </p>
                  </div>
                  {r.hiddenAt ? (
                    <ActionButton url={`/api/admin/reviews/${r.id}`} body={{ action: "show" }} label="Réafficher" />
                  ) : (
                    <ActionButton url={`/api/admin/reviews/${r.id}`} body={{ action: "hide" }} label="Masquer" variant="danger" confirm="Masquer cet avis ? Il ne sera plus visible ni compté dans la note du template." />
                  )}
                </li>
              ))}
            </ul>
          </>
        )
      ) : tab === "signalements" ? (
        reports.length === 0 ? (
          <EmptyState title="Aucun signalement en attente">Les signalements des membres sur les templates publics apparaîtront ici.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {reports.map((r) => (
              <li key={r.id} className="panel flex flex-wrap items-start justify-between gap-4 p-4">
                <div className="min-w-0">
                  <Link href={`/admin/templates/${r.templateId}`} className="font-semibold hover:underline">
                    {r.templateName}
                  </Link>{" "}
                  <Badge tone="danger">{REPORT_REASONS[r.reason as keyof typeof REPORT_REASONS] ?? r.reason}</Badge>
                  {r.details && <p className="mt-1 text-sm text-ink">« {r.details} »</p>}
                  <p className="mt-1 text-xs text-muted">
                    Signalé par {r.reporterName ?? "un membre"} le {formatDate(r.createdAt)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {r.templateStatus === "published" && (
                    <ActionButton url={`/api/admin/templates/${r.templateId}`} body={{ action: "archive" }} label="Retirer le template" variant="danger" confirm="Retirer ce template de la bibliothèque publique ?" />
                  )}
                  <ActionButton url={`/api/admin/reports/${r.id}`} label="Marquer comme traité" />
                </div>
              </li>
            ))}
          </ul>
        )
      ) : rows.length === 0 ? (
        <EmptyState title={tab === "attente" ? "Rien à relire pour le moment" : "Aucune publication ici"}>
          {tab === "attente" ? "Les propositions des membres arrivent ici dès leur envoi." : "Changez d’onglet pour voir les autres publications."}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {rows.map((t) => (
            <li key={t.id} className="panel p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/templates/${t.id}`} className="text-lg font-bold hover:underline">
                      {t.name}
                    </Link>
                    <Badge>{THEME_LABELS[t.theme as keyof typeof THEME_LABELS] ?? t.theme}</Badge>
                    <Badge tone="blue">{t.sourceBackupId ? "Depuis une sauvegarde" : "Depuis un projet"}</Badge>
                    {t.basedOnTemplateId && <Badge>Remix</Badge>}
                    {t.featured && <Badge tone="warning">Sélection de l’équipe</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-ink">{t.tagline}</p>
                  <p className="mt-2 text-xs text-muted">
                    Par <strong className="text-fg">{t.authorGlobalName ?? t.authorName ?? "compte supprimé"}</strong>
                    {t.authorName && <> (@{t.authorName}{t.authorId && <> · <Link href={`/admin/utilisateurs/${t.authorId}`} className="underline">fiche</Link></>})</>} · envoyé le{" "}
                    {formatDate(t.submittedAt ?? t.publishedAt)}
                    {t.reviewedAt && <> · relu le {formatDate(t.reviewedAt)}</>}
                  </p>
                  {t.status !== "pending_review" && (
                    <p className="mt-1 font-mono text-xs text-muted">
                      {t.viewCount} vue{t.viewCount > 1 ? "s" : ""} · {t.installCount} installation{t.installCount > 1 ? "s" : ""}
                      {t.ratingCount > 0 && (
                        <>
                          {" "}
                          · ★ {formatRating(t.ratingSum / t.ratingCount)} ({t.ratingCount} avis)
                        </>
                      )}
                    </p>
                  )}
                  {t.reviewNote && <p className="mt-2 rounded-md bg-danger-soft px-2 py-1 text-xs text-danger">Motif : {t.reviewNote}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/admin/templates/${t.id}`} className="inline-flex h-8 items-center rounded-[11px] border border-edge px-3 text-sm font-semibold hover:border-blue">
                    Examiner
                  </Link>
                  {t.status !== "published" && (
                    <ActionButton url={`/api/admin/templates/${t.id}`} body={{ action: "publish" }} label="Accepter et publier" variant="primary" confirm={`Publier « ${t.name} » dans la bibliothèque publique ?`} />
                  )}
                  {t.status === "pending_review" && (
                    <ActionButton url={`/api/admin/templates/${t.id}`} body={{ action: "reject" }} label="Refuser" variant="danger" prompt="Motif du refus (communiqué à l’auteur) :" promptKey="note" promptRequired />
                  )}
                  {t.status === "published" &&
                    (t.featured ? (
                      <ActionButton url={`/api/admin/templates/${t.id}`} body={{ action: "unfeature" }} label="Retirer de la sélection" />
                    ) : (
                      <ActionButton url={`/api/admin/templates/${t.id}`} body={{ action: "feature" }} label="Mettre en avant" />
                    ))}
                  {t.status === "published" && <ActionButton url={`/api/admin/templates/${t.id}`} body={{ action: "archive" }} label="Retirer" confirm="Retirer ce template de la bibliothèque publique ?" />}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
