import Link from "next/link";
import { THEME_LABELS } from "@mys/core";
import { requireUser } from "@/lib/session";
import { listProjects, type ProjectListItem } from "@/lib/data";
import { listTemplateUpdateNotices } from "@/lib/template-updates";
import { getEntitlement } from "@mys/engine";
import { ActionButton } from "@/components/app/action-button";
import { NewBlankProject } from "@/components/app/new-project";
import { TemplateUpdateNotices } from "@/components/projects/template-update";
import { Badge, ButtonLink, EmptyState, PageHeader, formatDate } from "@/components/ui";

export const metadata = { title: "Projets" };

export default async function ProjectsPage() {
  const user = await requireUser("/projets");
  const [projects, ent, notices] = await Promise.all([listProjects(user.id), getEntitlement(user.id), listTemplateUpdateNotices(user.id)]);
  const mine = projects.filter((p) => p.role === "owner");
  const shared = projects.filter((p) => p.role === "editor");
  return (
    <>
      <PageHeader eyebrow="Mes réalisations" title="Projets" actions={<ButtonLink href="/templates">Partir d’un template</ButtonLink>}>
        Un projet est votre version personnelle d’un serveur : privée, enregistrée sur votre compte, modifiable avant et après installation. {mine.length}/{ent.quotas.maxProjects} projets utilisés
        {shared.length > 0 ? " (les projets partagés avec vous ne comptent pas)" : ""}.
      </PageHeader>

      {notices.length > 0 && (
        <div className="mb-6">
          <TemplateUpdateNotices notices={notices} />
        </div>
      )}

      <div className="mb-6 panel flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-muted">Ou partez de zéro :</p>
        <NewBlankProject />
      </div>

      {mine.length === 0 ? (
        <EmptyState title="Aucun projet" action={<ButtonLink href="/templates">Parcourir les templates</ButtonLink>}>
          Choisissez un template gratuit pour démarrer en quelques secondes.
        </EmptyState>
      ) : (
        <ProjectList items={mine} userId={user.id} />
      )}

      {shared.length > 0 && (
        <section className="mt-10" aria-labelledby="partages-titre">
          <h2 id="partages-titre" className="text-xl font-bold">
            Partagés avec moi
          </h2>
          <p className="mb-3 mt-1 text-sm text-muted">Projets dont vous êtes co-gestionnaire : vous pouvez les modifier et les installer, leur propriétaire garde la main sur les membres.</p>
          <ProjectList items={shared} userId={user.id} />
        </section>
      )}
    </>
  );
}

function ProjectList({ items, userId }: { items: ProjectListItem[]; userId: string }) {
  return (
    <ul className="panel divide-y divide-line">
      {items.map((p) => (
        <li key={p.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
          <span className="h-10 w-1.5 rounded-full" style={{ background: `#${p.accentColor.toString(16).padStart(6, "0")}` }} />
          <Link href={`/projets/${p.id}`} className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate font-semibold hover:underline">{p.name}</span>
              {p.role === "editor" && <Badge tone="blue">Partagé</Badge>}
            </span>
            <span className="text-xs text-muted">
              {p.owner ? `De ${p.owner.name} · ` : ""}
              {THEME_LABELS[p.theme as keyof typeof THEME_LABELS]} · {p.stats.channels} salons · {p.stats.roles} rôles · {p.stats.messages} messages · modifié le {formatDate(p.updatedAt)}
            </span>
          </Link>
          <Badge tone={p.status === "ready" ? "success" : "warning"}>{p.status === "ready" ? "Prêt à installer" : "Brouillon à corriger"}</Badge>
          <div className="flex gap-2">
            <ButtonLink href={`/projets/${p.id}/installer`} size="sm" variant="secondary">
              Installer
            </ButtonLink>
            {p.role === "owner" ? (
              <ActionButton url={`/api/projects/${p.id}`} method="DELETE" variant="ghost" confirm={`Supprimer le projet « ${p.name} » ? Cette action est définitive (rien n’est modifié sur vos serveurs Discord).`}>
                Supprimer
              </ActionButton>
            ) : (
              <ActionButton
                url={`/api/projects/${p.id}/members`}
                method="DELETE"
                body={{ userId }}
                variant="ghost"
                confirm={`Quitter le projet partagé « ${p.name} » ? Vous n’y aurez plus accès ; il n’est pas supprimé et son propriétaire pourra vous réinviter.`}
              >
                Quitter
              </ActionButton>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
