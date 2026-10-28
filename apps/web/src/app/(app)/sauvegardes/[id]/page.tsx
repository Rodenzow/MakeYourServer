import { notFound } from "next/navigation";
import { backupToSpec } from "@mys/core";
import { backupMessages, eq, getDb, sql } from "@mys/db";
import { BACKUP_SCOPE_NOTE, getEntitlement, getOwnedBackup } from "@mys/engine";
import { requireUser } from "@/lib/session";
import { ActionButton } from "@/components/app/action-button";
import { RenameBackup } from "@/components/app/backup-forms";
import { BackupTree } from "@/components/app/backup-tree";
import { PublishDialog } from "@/components/app/publish-dialog";
import { InstallWizard } from "@/components/install/install-wizard";
import { Badge, Notice, PageHeader, formatDate } from "@/components/ui";

export const metadata = { title: "Sauvegarde" };

export default async function BackupPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ restaurer?: string }> }) {
  const { id } = await params;
  const { restaurer } = await searchParams;
  const user = await requireUser(`/sauvegardes/${id}`);
  const b = await getOwnedBackup(user.id, id);
  if (!b) notFound();
  const ent = await getEntitlement(user.id);
  const { spec, skipped } = backupToSpec(b.snapshot);
  const counts = await getDb()
    .select({ channelId: backupMessages.channelId, n: sql<number>`count(*)::int` })
    .from(backupMessages)
    .where(eq(backupMessages.backupId, b.id))
    .groupBy(backupMessages.channelId);
  const messageChannels = counts.map((c) => ({ id: c.channelId, count: c.n, name: b.snapshot.channels.find((x) => x.id === c.channelId)?.name ?? c.channelId }));

  if (restaurer) {
    return (
      <InstallWizard
        source={{ kind: "backup", id: b.id, name: b.label ?? `Sauvegarde n°${b.version}`, guildId: b.guildId, guildName: b.guildName, messageChannels, premium: ent.planKey === "premium" }}
      />
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={`${b.guildName} · version ${b.version}`}
        title={b.label ?? `Sauvegarde n°${b.version}`}
        actions={
          <>
            <a href={`/sauvegardes/${b.id}?restaurer=1`} className="inline-flex h-10 items-center rounded-[10px] border-2 border-edge bg-night px-4 font-semibold text-white shadow-[3px_3px_0_0_var(--color-blue)]">
              Restaurer…
            </a>
            <ActionButton url="/api/projects" body={{ source: "backup", backupId: b.id }} redirectFromResponse={(d) => `/projets/${(d.project as { id: string }).id}`}>
              Créer un projet à partir de cette sauvegarde
            </ActionButton>
            <PublishDialog kind="backup" id={b.id} defaultName={b.guildName} defaultTheme={spec.meta.theme} label="Publier comme template" />
            <ActionButton url={`/api/backups/${b.id}`} method="DELETE" variant="ghost" confirm="Supprimer définitivement cette sauvegarde (et les messages exportés) ?" redirectTo="/sauvegardes">
              Supprimer
            </ActionButton>
          </>
        }
      >
        Prise le {formatDate(b.createdAt)} · <Badge>{b.kind === "safety" ? "Sécurité" : b.kind === "scheduled" ? "Programmée" : "Manuelle"}</Badge>
      </PageHeader>

      <Notice tone="blue" className="mb-6">
        {BACKUP_SCOPE_NOTE}
      </Notice>
      {(b.summary.messagesHidden ?? 0) > 0 && (
        <Notice tone="warning" title={`${b.summary.messagesHidden} message(s) non exporté(s)`} className="mb-6">
          Discord a masqué leur contenu : l’application n’a pas l’intention privilégiée « Message Content ». Activez-la dans le portail développeur (Bot → Privileged Gateway Intents), puis refaites la
          sauvegarde. Au-delà de 100 serveurs, Discord doit d’abord approuver cette intention.
        </Notice>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section>
          <h2 className="mb-3 text-lg font-bold">Structure sauvegardée</h2>
          <BackupTree spec={spec} />
        </section>
        <section className="space-y-5">
          <div className="panel p-4">
            <h2 className="font-semibold">Contenu</h2>
            <ul className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <li>{b.summary.categories ?? 0} catégories</li>
              <li>{b.summary.channels ?? 0} salons</li>
              <li>{b.summary.roles ?? 0} rôles</li>
              <li>{b.summary.automod ?? 0} règles AutoMod</li>
              <li>{b.summary.onboardingPrompts ?? 0} questions d’onboarding</li>
              <li>{b.messageCount} messages exportés</li>
            </ul>
          </div>
          {messageChannels.length > 0 && (
            <div className="panel p-4 text-sm">
              <h2 className="font-semibold">Messages exportés</h2>
              <ul className="mt-2 space-y-1">
                {messageChannels.map((c) => (
                  <li key={c.id}>
                    #{c.name} : {c.count} message(s)
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted">À la restauration, ces messages peuvent être republiés (avec mention de leur date d’origine). Les identifiants, dates réelles et réactions d’origine ne peuvent pas être restaurés.</p>
            </div>
          )}
          {skipped.length > 0 && (
            <div className="panel p-4 text-sm">
              <h2 className="font-semibold">Non restaurable automatiquement</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
                {skipped.slice(0, 12).map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="panel p-4">
            <h2 className="mb-2 font-semibold">Renommer</h2>
            <RenameBackup id={b.id} label={b.label ?? ""} />
          </div>
        </section>
      </div>
    </>
  );
}
