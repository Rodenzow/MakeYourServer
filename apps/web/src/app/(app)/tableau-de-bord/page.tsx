import Link from "next/link";
import { and, desc, eq, getDb, savedTemplates, templates } from "@mys/db";
import { getEntitlement, getUsage, listBackups, listInstallations } from "@mys/engine";
import { QUOTA_LABELS } from "@mys/core";
import { requireUser } from "@/lib/session";
import { listAiGenerations, listProjects } from "@/lib/data";
import { Badge, ButtonLink, EmptyState, PageHeader, Stat, formatDate } from "@/components/ui";
import { InstallStatusBadge } from "@/components/app/status";

export const metadata = { title: "Tableau de bord" };

export default async function Dashboard() {
  const user = await requireUser("/tableau-de-bord");
  const [projects, installs, backups, ent, usage, gens, saved] = await Promise.all([
    listProjects(user.id),
    listInstallations(user.id, 5),
    listBackups(user.id),
    getEntitlement(user.id),
    getUsage(user.id),
    listAiGenerations(user.id, 5),
    getDb()
      .select({ slug: templates.slug, name: templates.name, tagline: templates.tagline })
      .from(savedTemplates)
      .innerJoin(templates, eq(templates.id, savedTemplates.templateId))
      .where(and(eq(savedTemplates.userId, user.id), eq(templates.status, "published")))
      .orderBy(desc(savedTemplates.createdAt)),
  ]);
  return (
    <>
      <PageHeader eyebrow="Mon espace" title={`Bonjour ${user.globalName ?? user.username} 👋`} actions={<ButtonLink href="/templates">Nouveau projet</ButtonLink>}>
        Retrouvez vos projets, installations et sauvegardes.
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Projets" value={`${projects.length} / ${ent.quotas.maxProjects}`} />
        <Stat label="Installations" value={installs.length ? installs.length : 0} hint="5 dernières affichées" />
        <Stat label="Sauvegardes" value={backups.length} />
        <Stat label="Offre" value={ent.planName} hint={ent.planKey === "premium" ? `IA : ${usage.ai_generations}/${ent.quotas.aiGenerationsPerMonth} conceptions ce mois` : "Liée à votre compte"} />
      </div>

      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold">Projets et brouillons</h2>
          <Link href="/projets" className="text-sm font-semibold text-muted hover:text-night">
            Tout voir →
          </Link>
        </div>
        {projects.length === 0 ? (
          <EmptyState title="Aucun projet pour l’instant" action={<ButtonLink href="/templates">Choisir un template</ButtonLink>}>
            Partez d’un template complet, d’un projet vierge ou d’une conception par IA.
          </EmptyState>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {projects.slice(0, 4).map((p) => (
              <li key={p.id}>
                <Link href={`/projets/${p.id}`} className="panel flex items-center gap-4 p-4 transition-colors hover:border-night">
                  <span className="h-10 w-1.5 rounded-full" style={{ background: `#${p.accentColor.toString(16).padStart(6, "0")}` }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{p.name}</span>
                    <span className="text-xs text-muted">
                      {p.stats.channels} salons · {p.stats.roles} rôles · modifié le {formatDate(p.updatedAt)}
                    </span>
                  </span>
                  <Badge tone={p.status === "ready" ? "success" : "warning"}>{p.status === "ready" ? "Prêt" : "Brouillon"}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-bold">Dernières installations</h2>
            <Link href="/installations" className="text-sm font-semibold text-muted hover:text-night">
              Historique →
            </Link>
          </div>
          {installs.length === 0 ? (
            <p className="panel p-4 text-sm text-muted">Aucune installation pour l’instant.</p>
          ) : (
            <ul className="panel divide-y divide-line">
              {installs.map((i) => (
                <li key={i.id}>
                  <Link href={`/installations/${i.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-mist/50">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{i.guildName}</span>
                      <span className="text-xs text-muted">
                        {i.kind === "restore" ? "Restauration" : "Installation"}
                        {i.dryRun && " (simulation)"} · {formatDate(i.createdAt)}
                      </span>
                    </span>
                    <InstallStatusBadge status={i.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-bold">Abonnement et quotas</h2>
            <Link href="/abonnement" className="text-sm font-semibold text-muted hover:text-night">
              Gérer →
            </Link>
          </div>
          <div className="panel p-4 text-sm">
            <p>
              Offre <strong>{ent.planName}</strong>
              {ent.currentPeriodEnd && <> · jusqu’au {formatDate(ent.currentPeriodEnd, false)}</>}
              {ent.source !== "free" && <span className="text-muted"> (via {ent.source === "stripe" ? "le site" : ent.source === "discord" ? "Discord" : "l’équipe"})</span>}
            </p>
            <ul className="mt-3 grid gap-1 sm:grid-cols-2">
              {(["maxProjects", "aiGenerationsPerMonth", "aiEditsPerMonth", "backupsPerGuild", "scheduledBackups", "messageBackupChannels"] as const).map((k) => (
                <li key={k} className="flex justify-between gap-2 rounded-md bg-mist/60 px-2 py-1">
                  <span className="text-muted">{QUOTA_LABELS[k]}</span>
                  <strong>{String(ent.quotas[k])}</strong>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-xl font-bold">Générations IA</h2>
          {gens.length === 0 ? (
            <p className="panel p-4 text-sm text-muted">
              Aucune génération. <Link href="/ia" className="font-semibold text-night underline">Découvrir la conception par IA</Link>
            </p>
          ) : (
            <ul className="panel divide-y divide-line text-sm">
              {gens.map((g) => (
                <li key={g.id}>
                  <Link href={g.kind === "create" ? `/ia/${g.id}` : g.projectId ? `/projets/${g.projectId}` : "/ia"} className="flex items-center gap-3 px-4 py-2.5 hover:bg-mist/50">
                    <span className="min-w-0 flex-1 truncate">{g.prompt}</span>
                    <Badge tone={g.status === "failed" ? "danger" : g.status === "applied" ? "success" : "neutral"}>{g.kind === "create" ? "Conception" : "Modification"}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h2 className="mb-3 text-xl font-bold">Templates enregistrés</h2>
          {saved.length === 0 ? (
            <p className="panel p-4 text-sm text-muted">
              Aucun favori. Ajoutez des templates depuis la <Link href="/templates" className="font-semibold text-night underline">bibliothèque</Link>.
            </p>
          ) : (
            <ul className="panel divide-y divide-line text-sm">
              {saved.map((t) => (
                <li key={t.slug}>
                  <Link href={`/templates/${t.slug}`} className="block px-4 py-2.5 hover:bg-mist/50">
                    <strong>{t.name}</strong> <span className="text-muted">— {t.tagline}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
