import Link from "next/link";
import { notFound } from "next/navigation";
import { specStats, validateSpec } from "@mys/core";
import { ActionButton } from "@/components/admin/action-button";
import { TemplateEditor } from "@/components/admin/template-editor";
import { Badge, Notice, PageHeader, formatDate } from "@/components/ui";
import { TEMPLATE_STATUS_LABELS, getTemplateById } from "@/lib/admin";
import { sizeOptions, themeOptions } from "../options";

export const metadata = { title: "Modifier un template" };

export default async function EditTemplate({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTemplateById(id);
  if (!t) notFound();
  const v = validateSpec(t.spec);
  const s = specStats(t.spec);
  return (
    <>
      <PageHeader
        eyebrow="Templates"
        title={t.name}
        actions={
          <div className="flex flex-wrap items-start gap-2">
            {t.status !== "published" && (
              <ActionButton url={`/api/admin/templates/${t.id}`} body={{ action: "publish" }} label="Publier" variant="primary" confirm={`Publier « ${t.name} » dans la bibliothèque publique ?`} />
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
          {s.channels} salons · {s.roles} rôles · {s.messages} messages · {t.installCount} installation(s) · modifié le {formatDate(t.updatedAt)}
          {t.publishedAt ? ` · publié le ${formatDate(t.publishedAt, false)}` : ""}
        </p>
        <Link href="/admin/templates" className="mt-1 inline-block text-sm text-muted hover:text-fg">← Tous les templates</Link>
      </PageHeader>

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
