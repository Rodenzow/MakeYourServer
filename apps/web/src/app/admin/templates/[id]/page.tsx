import Link from "next/link";
import { notFound } from "next/navigation";
import { specStats, validateSpec } from "@mys/core";
import { ActionButton } from "@/components/admin/action-button";
import { TemplateEditor } from "@/components/admin/template-editor";
import { Badge, Notice, PageHeader, formatDate } from "@/components/ui";
import { and, eq, getDb, isNull, templateReports, users } from "@mys/db";
import { TEMPLATE_STATUS_LABELS, getTemplateById } from "@/lib/admin";
import { REPORT_REASONS } from "@/lib/publications";
import { sizeOptions, themeOptions } from "../options";

export const metadata = { title: "Modifier un template" };

export default async function EditTemplate({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTemplateById(id);
  if (!t) notFound();
  const v = validateSpec(t.spec);
  const s = specStats(t.spec);
  const db = getDb();
  const [[author], reports] = await Promise.all([
    t.authorUserId ? db.select({ id: users.id, username: users.username, globalName: users.globalName, discordId: users.discordId }).from(users).where(eq(users.id, t.authorUserId)) : Promise.resolve([undefined]),
    db.select().from(templateReports).where(and(eq(templateReports.templateId, t.id), isNull(templateReports.resolvedAt))),
  ]);
  return (
    <>
      <PageHeader
        eyebrow="Templates"
        title={t.name}
        actions={
          <div className="flex flex-wrap items-start gap-2">
            {t.status !== "published" && (
              <ActionButton url={`/api/admin/templates/${t.id}`} body={{ action: "publish" }} label={t.status === "pending_review" ? "Accepter et publier" : "Publier"} variant="primary" confirm={`Publier « ${t.name} » dans la bibliothèque publique ?`} />
            )}
            {t.status === "published" && <ActionButton url={`/api/admin/templates/${t.id}`} body={{ action: "archive" }} label="Retirer de la bibliothèque" confirm="Retirer ce template de la bibliothèque publique ?" />}
            {t.status === "pending_review" && (
              <ActionButton url={`/api/admin/templates/${t.id}`} body={{ action: "reject" }} label="Refuser" variant="danger" prompt="Motif du refus (communiqué à l’auteur) :" promptKey="note" promptRequired />
            )}
            {!t.official && <ActionButton url={`/api/admin/templates/${t.id}`} method="DELETE" label="Supprimer" variant="ghost" confirm="Supprimer définitivement ce template ?" redirectTo="/admin/templates" />}
          </div>
        }
      >
        <span className="font-mono text-xs">{t.slug}</span> · <Badge>{TEMPLATE_STATUS_LABELS[t.status] ?? t.status}</Badge> {t.official && <Badge tone="night">Officiel</Badge>}
        <p className="mt-1 text-xs">
          {s.channels} salons · {s.roles} rôles · {s.messages} messages · {t.viewCount} vue(s) · {t.installCount} installation(s) · modifié le {formatDate(t.updatedAt)}
          {t.publishedAt ? ` · publié le ${formatDate(t.publishedAt, false)}` : ""}
        </p>
        <Link href="/admin/templates" className="mt-1 inline-block text-sm text-muted hover:text-fg">← Tous les templates</Link>
      </PageHeader>

      {!t.official && (
        <div className="panel mb-4 grid gap-1 p-4 text-sm sm:grid-cols-2">
          <p>
            <span className="text-muted">Auteur : </span>
            {author ? (
              <Link href={`/admin/utilisateurs/${author.id}`} className="font-semibold hover:underline">
                {author.globalName ?? author.username} (@{author.username})
              </Link>
            ) : (
              "compte supprimé"
            )}
            {!t.showAuthor && <span className="text-muted"> · pseudo masqué sur la fiche publique</span>}
          </p>
          <p>
            <span className="text-muted">Origine : </span>
            {t.sourceBackupId ? "structure d’une sauvegarde (messages exportés exclus)" : t.sourceProjectId ? "projet de l’auteur" : "—"}
          </p>
          <p>
            <span className="text-muted">Envoyé le : </span>
            {formatDate(t.submittedAt ?? t.createdAt)}
          </p>
          {t.reviewedAt && (
            <p>
              <span className="text-muted">Relu le : </span>
              {formatDate(t.reviewedAt)}
            </p>
          )}
        </div>
      )}
      {reports.length > 0 && (
        <Notice tone="danger" title={`${reports.length} signalement(s) en attente`} className="mb-4">
          <ul className="list-disc pl-5">
            {reports.map((r) => (
              <li key={r.id}>
                {REPORT_REASONS[r.reason as keyof typeof REPORT_REASONS] ?? r.reason}
                {r.details ? ` — « ${r.details} »` : ""} ({formatDate(r.createdAt)})
              </li>
            ))}
          </ul>
          <Link href="/admin/publications?onglet=signalements" className="mt-2 inline-block font-semibold underline">
            Traiter les signalements
          </Link>
        </Notice>
      )}
      {t.status === "pending_review" && (
        <Notice tone="warning" title="Proposition de la communauté" className="mb-4">
          Vérifiez le contenu (messages, noms, permissions) avant toute publication. La publication rend ce template visible par tous.
        </Notice>
      )}
      {t.reviewNote && (
        <Notice tone="neutral" title="Note de revue" className="mb-4">
          {t.reviewNote}
        </Notice>
      )}
      {!v.ok && (
        <Notice tone="danger" title="Ce template contient des erreurs : il ne peut pas être publié" className="mb-4">
          <ul className="list-disc pl-5">
            {v.errors.slice(0, 10).map((e, i) => (
              <li key={i}>{e.message}</li>
            ))}
          </ul>
        </Notice>
      )}

      <TemplateEditor
        templateId={t.id}
        initial={{ name: t.name, slug: t.slug, tagline: t.tagline, description: t.description, audience: t.audience, highlights: t.highlights, theme: t.theme, size: t.size, popularity: t.popularity, official: t.official, spec: t.spec }}
        themes={themeOptions}
        sizes={sizeOptions}
      />
    </>
  );
}
