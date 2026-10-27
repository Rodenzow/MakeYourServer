import Link from "next/link";
import { THEME_LABELS } from "@mys/core";
import { requireUser } from "@/lib/session";
import { listProjects } from "@/lib/data";
import { getEntitlement } from "@mys/engine";
import { ActionButton } from "@/components/app/action-button";
import { NewBlankProject } from "@/components/app/new-project";
import { Badge, ButtonLink, EmptyState, PageHeader, formatDate } from "@/components/ui";

export const metadata = { title: "Projets" };

export default async function ProjectsPage() {
  const user = await requireUser("/projets");
  const [projects, ent] = await Promise.all([listProjects(user.id), getEntitlement(user.id)]);
  return (
    <>
      <PageHeader eyebrow="Mes réalisations" title="Projets" actions={<ButtonLink href="/templates">Partir d’un template</ButtonLink>}>
        Un projet est votre version personnelle d’un serveur : privée, enregistrée sur votre compte, modifiable avant et après installation. {projects.length}/{ent.quotas.maxProjects} projets utilisés.
      </PageHeader>
      <div className="mb-6 panel flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-muted">Ou partez de zéro :</p>
        <NewBlankProject />
      </div>
      {projects.length === 0 ? (
        <EmptyState title="Aucun projet" action={<ButtonLink href="/templates">Parcourir les templates</ButtonLink>}>
          Choisissez un template gratuit pour démarrer en quelques secondes.
        </EmptyState>
      ) : (
        <ul className="panel divide-y divide-line">
          {projects.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
              <span className="h-10 w-1.5 rounded-full" style={{ background: `#${p.accentColor.toString(16).padStart(6, "0")}` }} />
              <Link href={`/projets/${p.id}`} className="min-w-0 flex-1">
                <span className="block truncate font-semibold hover:underline">{p.name}</span>
                <span className="text-xs text-muted">
                  {THEME_LABELS[p.theme as keyof typeof THEME_LABELS]} · {p.stats.channels} salons · {p.stats.roles} rôles · {p.stats.messages} messages · modifié le {formatDate(p.updatedAt)}
                </span>
              </Link>
              <Badge tone={p.status === "ready" ? "success" : "warning"}>{p.status === "ready" ? "Prêt à installer" : "Brouillon à corriger"}</Badge>
              <div className="flex gap-2">
                <ButtonLink href={`/projets/${p.id}/installer`} size="sm" variant="secondary">
                  Installer
                </ButtonLink>
                <ActionButton url={`/api/projects/${p.id}`} method="DELETE" variant="ghost" confirm={`Supprimer le projet « ${p.name} » ? Cette action est définitive (rien n’est modifié sur vos serveurs Discord).`}>
                  Supprimer
                </ActionButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
