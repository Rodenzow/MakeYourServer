import Link from "next/link";
import { and, desc, eq, getDb, savedTemplates, templates } from "@mys/db";
import { getEntitlement, getUsage, listBackups, listInstallations } from "@mys/engine";
import { requireUser } from "@/lib/session";
import { listAiGenerations, listProjects } from "@/lib/data";
import { Badge, ButtonLink, formatDate } from "@/components/ui";
import { InstallStatusBadge } from "@/components/app/status";
import { QuotaBar } from "@/components/app/quota-bar";
import { AnimatedNumber, Reveal, Stagger, StaggerItem, Tilt } from "@/components/motion";
import { CubeMark } from "@/components/cube-mark";
import { IconArrowRight, IconCube, IconSave, IconSparkle } from "@/components/icons";

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

  // Prochaine étape suggérée, selon l’état réel du compte.
  const lastInstall = installs[0];
  const readyProject = projects.find((p) => p.status === "ready");
  const next =
    lastInstall && (lastInstall.status === "partial" || lastInstall.status === "failed")
      ? { title: `Terminer l’installation sur « ${lastInstall.guildName} »`, text: "Certaines étapes ont échoué. Corrigez la cause indiquée puis relancez : seules les étapes manquantes seront rejouées.", href: `/installations/${lastInstall.id}`, cta: "Voir et relancer" }
      : lastInstall && (lastInstall.status === "running" || lastInstall.status === "queued")
        ? { title: `Installation en cours sur « ${lastInstall.guildName} »`, text: "Le bot travaille : suivez chaque étape en direct.", href: `/installations/${lastInstall.id}`, cta: "Suivre l’installation" }
        : projects.length === 0
          ? { title: "Créez votre premier serveur", text: "Choisissez un template complet : vous pourrez tout personnaliser avant d’installer.", href: "/templates", cta: "Choisir un template" }
          : !installs.length && readyProject
            ? { title: `Installer « ${readyProject.name} »`, text: "Votre projet est prêt. Choisissez un serveur Discord, le site analyse l’existant avant toute modification.", href: `/projets/${readyProject.id}/installer`, cta: "Installer maintenant" }
            : !backups.length
              ? { title: "Protégez votre serveur", text: "Une sauvegarde de la configuration vous permet de revenir en arrière en cas de souci.", href: "/sauvegardes", cta: "Faire une sauvegarde" }
              : { title: `Continuer « ${projects[0]!.name} »`, text: "Reprenez votre projet là où vous l’avez laissé.", href: `/projets/${projects[0]!.id}`, cta: "Ouvrir l’éditeur" };

  return (
    <>
      <Reveal>
        <p className="eyebrow">Mon espace</p>
        <h1 className="mt-2 text-3xl font-bold md:text-4xl">Bonjour {user.globalName ?? user.username} 👋</h1>
      </Reveal>

      {/* Prochaine étape */}
      <Reveal delay={0.1}>
        <section className="halo relative mt-8 overflow-hidden rounded-[22px] border border-edge bg-surface p-6 md:p-8">
          <div className="blueprint blueprint-fade pointer-events-none absolute inset-0" aria-hidden />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
            <CubeMark size={72} />
            <div className="flex-1">
              <p className="eyebrow">Prochaine étape</p>
              <h2 className="mt-1 text-2xl font-bold">{next.title}</h2>
              <p className="mt-1 max-w-2xl text-ink">{next.text}</p>
            </div>
            <ButtonLink href={next.href} size="lg">
              {next.cta} <IconArrowRight size={18} />
            </ButtonLink>
          </div>
        </section>
      </Reveal>

      {/* Actions rapides */}
      <Stagger className="mt-6 grid gap-4 md:grid-cols-3">
        {[
          { href: "/templates", icon: <IconCube size={20} />, title: "Nouveau serveur", text: "À partir d’un template" },
          { href: "/ia", icon: <IconSparkle size={20} />, title: "Concevoir avec l’IA", text: ent.planKey === "premium" ? `${usage.ai_generations}/${ent.quotas.aiGenerationsPerMonth} ce mois` : "Premium" },
          { href: "/sauvegardes", icon: <IconSave size={20} />, title: "Sauvegarder", text: `${backups.length} sauvegarde${backups.length > 1 ? "s" : ""}` },
        ].map((a) => (
          <StaggerItem key={a.href}>
            <Tilt className="group">
              <Link href={a.href} className="panel flex items-center gap-4 p-4 transition-colors hover:border-blue">
                <span className="flex size-11 items-center justify-center rounded-xl bg-mist text-light transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110">{a.icon}</span>
                <span className="flex-1">
                  <span className="block font-semibold">{a.title}</span>
                  <span className="text-sm text-muted">{a.text}</span>
                </span>
                <IconArrowRight size={16} className="text-muted transition-transform duration-300 group-hover:translate-x-1 group-hover:text-light" />
              </Link>
            </Tilt>
          </StaggerItem>
        ))}
      </Stagger>

      <div className="mt-10 grid gap-8 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-10">
          <Reveal>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-bold">Mes projets</h2>
              <Link href="/projets" className="link text-sm font-semibold">
                Tout voir
              </Link>
            </div>
            {projects.length === 0 ? (
              <p className="panel p-5 text-sm text-muted">Aucun projet pour l’instant : commencez par un template.</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {projects.slice(0, 4).map((p) => (
                  <li key={p.id}>
                    <Link href={`/projets/${p.id}`} className="panel group flex items-center gap-4 p-4 transition-all hover:-translate-y-0.5 hover:border-blue">
                      <span className="h-11 w-1.5 rounded-full" style={{ background: `#${p.accentColor.toString(16).padStart(6, "0")}` }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{p.name}</span>
                        <span className="text-xs text-muted">
                          {p.stats.channels} salons · {p.stats.roles} rôles · {formatDate(p.updatedAt, false)}
                        </span>
                      </span>
                      <Badge tone={p.status === "ready" ? "success" : "warning"}>{p.status === "ready" ? "Prêt" : "Brouillon"}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Reveal>

          <Reveal>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-bold">Dernières installations</h2>
              <Link href="/installations" className="link text-sm font-semibold">
                Historique
              </Link>
            </div>
            {installs.length === 0 ? (
              <p className="panel p-5 text-sm text-muted">Aucune installation pour l’instant.</p>
            ) : (
              <ul className="panel divide-y divide-line">
                {installs.map((i) => (
                  <li key={i.id}>
                    <Link href={`/installations/${i.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-mist/60">
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
          </Reveal>
        </div>

        <div className="space-y-10">
          <Reveal>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-bold">Offre {ent.planName}</h2>
              <Link href="/abonnement" className="link text-sm font-semibold">
                Gérer
              </Link>
            </div>
            <div className="panel space-y-4 p-5">
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  [projects.length, "projets"],
                  [installs.length, "installations"],
                  [backups.length, "sauvegardes"],
                ].map(([n, l]) => (
                  <div key={l as string} className="rounded-xl bg-night p-3">
                    <p className="font-display text-2xl font-bold text-light">
                      <AnimatedNumber value={n as number} />
                    </p>
                    <p className="text-xs text-muted">{l}</p>
                  </div>
                ))}
              </div>
              <QuotaBar label="Projets" used={projects.length} max={ent.quotas.maxProjects} />
              <QuotaBar label="Conceptions IA ce mois" used={usage.ai_generations} max={ent.quotas.aiGenerationsPerMonth} />
              <QuotaBar label="Modifications IA ce mois" used={usage.ai_edits} max={ent.quotas.aiEditsPerMonth} />
              <p className="text-xs text-muted">Les avantages sont liés à votre compte, sur tous vos serveurs.{ent.currentPeriodEnd ? ` Jusqu’au ${formatDate(ent.currentPeriodEnd, false)}.` : ""}</p>
            </div>
          </Reveal>

          <Reveal>
            <h2 className="mb-3 text-xl font-bold">Générations IA</h2>
            {gens.length === 0 ? (
              <p className="panel p-5 text-sm text-muted">
                Aucune génération. <Link href="/ia" className="link font-semibold">Découvrir la conception par IA</Link>
              </p>
            ) : (
              <ul className="panel divide-y divide-line text-sm">
                {gens.map((g) => (
                  <li key={g.id}>
                    <Link href={g.kind === "create" ? `/ia/${g.id}` : g.projectId ? `/projets/${g.projectId}` : "/ia"} className="flex items-center gap-3 px-4 py-2.5 hover:bg-mist/60">
                      <span className="min-w-0 flex-1 truncate">{g.prompt}</span>
                      <Badge tone={g.status === "failed" ? "danger" : g.status === "applied" ? "success" : "neutral"}>{g.kind === "create" ? "Conception" : "Modification"}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Reveal>

          {saved.length > 0 && (
            <Reveal>
              <h2 className="mb-3 text-xl font-bold">Templates favoris</h2>
              <ul className="panel divide-y divide-line text-sm">
                {saved.map((t) => (
                  <li key={t.slug}>
                    <Link href={`/templates/${t.slug}`} className="block px-4 py-2.5 hover:bg-mist/60">
                      <strong>{t.name}</strong> <span className="text-muted">— {t.tagline}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Reveal>
          )}
        </div>
      </div>
    </>
  );
}
