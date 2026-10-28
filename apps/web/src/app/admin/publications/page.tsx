import Link from "next/link";
import { THEME_LABELS } from "@mys/core";
import { ActionButton } from "@/components/admin/action-button";
import { Badge, EmptyState, PageHeader, cx, formatDate } from "@/components/ui";
import { listCommunitySubmissions, listOpenReports, moderationCounts } from "@/lib/admin";
import { REPORT_REASONS } from "@/lib/publications";

export const metadata = { title: "Publications" };

const TABS = {
  attente: { label: "À relire", status: "pending_review" },
  signalements: { label: "Signalements", status: null },
  publies: { label: "Publiés", status: "published" },
  refuses: { label: "Refusés", status: "rejected" },
  retires: { label: "Retirés", status: "archived" },
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
  const [rows, reports] = await Promise.all([status ? listCommunitySubmissions(status) : Promise.resolve([]), tab === "signalements" ? listOpenReports() : Promise.resolve([])]);

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

      {tab === "signalements" ? (
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
