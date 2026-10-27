import Link from "next/link";
import { backupSchedules, eq, getDb } from "@mys/db";
import { BACKUP_SCOPE_NOTE, getEntitlement, listBackups } from "@mys/engine";
import { requireUser } from "@/lib/session";
import { ActionButton } from "@/components/app/action-button";
import { CreateBackupForm, ScheduleForm } from "@/components/app/backup-forms";
import { Badge, EmptyState, Notice, PageHeader, formatDate } from "@/components/ui";

export const metadata = { title: "Sauvegardes" };

const KIND: Record<string, [string, "blue" | "neutral" | "success"]> = {
  safety: ["Sécurité", "blue"],
  manual: ["Manuelle", "neutral"],
  scheduled: ["Programmée", "success"],
};

export default async function BackupsPage({ searchParams }: { searchParams: Promise<{ serveur?: string }> }) {
  const user = await requireUser("/sauvegardes");
  const { serveur } = await searchParams;
  const [list, ent, schedules] = await Promise.all([listBackups(user.id, serveur), getEntitlement(user.id), getDb().select().from(backupSchedules).where(eq(backupSchedules.userId, user.id))]);
  const q = ent.quotas;
  const byGuild = new Map<string, typeof list>();
  for (const b of list) byGuild.set(b.guildId, [...(byGuild.get(b.guildId) ?? []), b]);
  return (
    <>
      <PageHeader eyebrow="Privées et versionnées" title="Sauvegardes">
        Une sauvegarde est un état réellement récupéré depuis un serveur existant. Elle est privée : jamais publiée, jamais envoyée à l’IA, et vous pouvez la supprimer à tout moment.
      </PageHeader>
      <Notice tone="blue" title="Ce que contient une sauvegarde" className="mb-6">
        {BACKUP_SCOPE_NOTE}
      </Notice>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="brick p-5">
          <h2 className="font-display text-lg font-semibold">Nouvelle sauvegarde</h2>
          <p className="mb-4 text-sm text-muted">
            Votre offre conserve {q.backupsPerGuild} sauvegarde(s) manuelles ou programmées par serveur, plus {q.safetyBackupsPerGuild} sauvegardes de sécurité automatiques.
          </p>
          <CreateBackupForm maxMessageChannels={q.messageBackupChannels} initialGuild={serveur} />
        </section>
        <section className="panel p-5">
          <h2 className="font-display text-lg font-semibold">Sauvegardes programmées {q.scheduledBackups === 0 && <Badge tone="blue">Premium</Badge>}</h2>
          {q.scheduledBackups === 0 ? (
            <p className="mt-2 text-sm text-muted">
              Avec le Premium, le bot sauvegarde automatiquement vos serveurs à intervalle régulier et garde plusieurs versions. <Link href="/abonnement" className="font-semibold text-night underline">Voir les offres</Link>
            </p>
          ) : (
            <>
              <ul className="mt-3 space-y-2 text-sm">
                {schedules.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-mist/60 px-3 py-2">
                    <span className="min-w-0 flex-1">
                      <strong>{s.guildName}</strong> · toutes les {s.intervalHours} h · prochaine : {formatDate(s.nextRunAt)}
                      {s.lastError && <span className="block text-xs text-danger">Dernier échec : {s.lastError}</span>}
                    </span>
                    <ActionButton url={`/api/schedules/${s.id}`} method="DELETE" variant="ghost" confirm="Arrêter cette programmation ? Les sauvegardes déjà faites sont conservées.">
                      Arrêter
                    </ActionButton>
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                <ScheduleForm minHours={q.scheduleMinIntervalHours} maxMessageChannels={q.messageBackupChannels} />
              </div>
            </>
          )}
        </section>
      </div>

      <section className="mt-10 space-y-6">
        {list.length === 0 && <EmptyState title="Aucune sauvegarde">Créez votre première sauvegarde ci-dessus, ou installez un projet : une sauvegarde de sécurité est prise automatiquement avant.</EmptyState>}
        {[...byGuild.entries()].map(([guildId, items]) => (
          <div key={guildId}>
            <h2 className="mb-2 text-lg font-bold">{items[0]!.guildName}</h2>
            <ul className="panel divide-y divide-line">
              {items.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="w-10 font-mono text-sm text-muted">n°{b.version}</span>
                  <Link href={`/sauvegardes/${b.id}`} className="min-w-0 flex-1">
                    <span className="block truncate font-medium hover:underline">{b.label}</span>
                    <span className="text-xs text-muted">
                      {formatDate(b.createdAt)} · {b.summary.channels ?? 0} salons · {b.summary.roles ?? 0} rôles
                      {b.messageCount ? ` · ${b.messageCount} messages` : ""}
                      {b.expiresAt ? ` · conservée jusqu’au ${formatDate(b.expiresAt, false)}` : ""}
                    </span>
                  </Link>
                  <Badge tone={KIND[b.kind]?.[1] ?? "neutral"}>{KIND[b.kind]?.[0] ?? b.kind}</Badge>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </>
  );
}
