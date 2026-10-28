import Link from "next/link";
import { THEME_LABELS } from "@mys/core";
import { requireUser } from "@/lib/session";
import { STATUS_LABELS, listUserPublications } from "@/lib/publications";
import { ActionButton } from "@/components/app/action-button";
import { Badge, ButtonLink, EmptyState, PageHeader, colorHex, formatDate } from "@/components/ui";

export const metadata = { title: "Mes publications" };

const TONE: Record<string, "neutral" | "blue" | "success" | "warning" | "danger"> = { pending_review: "warning", published: "success", rejected: "danger", archived: "neutral" };

export default async function MyPublications() {
  const user = await requireUser("/publications");
  const rows = await listUserPublications(user.id);
  const published = rows.filter((r) => r.status === "published");
  const views = published.reduce((n, r) => n + r.viewCount, 0);
  const installs = published.reduce((n, r) => n + r.installCount, 0);

  return (
    <>
      <PageHeader eyebrow="Communauté" title="Mes publications">
        Partagez vos projets et sauvegardes avec tout le monde. Chaque proposition est relue par l’équipe avant d’apparaître dans la bibliothèque.
      </PageHeader>

      {rows.length === 0 ? (
        <EmptyState
          title="Vous n’avez encore rien publié"
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink href="/projets" size="sm">
                Publier un projet
              </ButtonLink>
              <ButtonLink href="/sauvegardes" size="sm" variant="secondary">
                Publier une sauvegarde
              </ButtonLink>
            </div>
          }
        >
          Ouvrez un projet (bouton « Publier » dans l’éditeur) ou une sauvegarde (« Publier comme template »).
        </EmptyState>
      ) : (
        <>
          <dl className="mb-6 grid grid-cols-3 gap-3">
            {[
              ["Publiés", published.length],
              ["Vues", views],
              ["Installations", installs],
            ].map(([k, v]) => (
              <div key={k} className="panel px-4 py-3">
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="font-display text-2xl font-bold text-light">{v}</dd>
              </div>
            ))}
          </dl>
          <ul className="space-y-3">
            {rows.map((p) => (
                <li key={p.id} className="panel relative overflow-hidden p-4 pl-5">
                  <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: colorHex(p.accentColor) }} />
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {p.status === "published" ? (
                          <Link href={`/templates/${p.slug}`} className="text-lg font-bold hover:underline">
                            {p.name}
                          </Link>
                        ) : (
                          <span className="text-lg font-bold">{p.name}</span>
                        )}
                        <Badge tone={TONE[p.status]}>{STATUS_LABELS[p.status] ?? p.status}</Badge>
                        <Badge>{THEME_LABELS[p.theme as keyof typeof THEME_LABELS] ?? p.theme}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-ink">{p.tagline}</p>
                      <p className="mt-2 font-mono text-xs text-muted">
                        {p.viewCount} vue{p.viewCount > 1 ? "s" : ""} · {p.installCount} installation{p.installCount > 1 ? "s" : ""} · envoyé le {formatDate(p.submittedAt, false)}
                        {p.publishedAt ? ` · publié le ${formatDate(p.publishedAt, false)}` : ""}
                      </p>
                      {p.status === "rejected" && p.reviewNote && (
                        <p className="mt-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
                          <strong>Motif du refus :</strong> {p.reviewNote} Vous pouvez corriger le projet puis le proposer à nouveau.
                        </p>
                      )}
                      {p.status === "pending_review" && <p className="mt-2 text-sm text-muted">L’équipe relit votre proposition. Vous la verrez ici dès qu’elle sera acceptée.</p>}
                    </div>
                    <ActionButton
                      url={`/api/publications/${p.id}`}
                      method="DELETE"
                      variant="ghost"
                      confirm={p.status === "published" ? "Retirer ce template de la bibliothèque publique ?" : "Supprimer cette proposition ?"}
                    >
                      {p.status === "published" ? "Retirer" : p.status === "archived" ? "Supprimer" : "Annuler la proposition"}
                    </ActionButton>
                  </div>
                </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
