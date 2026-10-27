import Link from "next/link";
import { getSetting } from "@mys/db";
import { Badge, Notice, PageHeader, Stat, formatDate } from "@/components/ui";
import { INSTALL_STATUS_LABELS, formatUsd, isOnline, overviewStats } from "@/lib/admin";

export const metadata = { title: "Vue d’ensemble" };

export default async function AdminHome() {
  const [s, ai, maintenance] = await Promise.all([overviewStats(), getSetting("ai"), getSetting("maintenance")]);
  const online = s.heartbeats.filter((h) => isOnline(h.lastSeenAt));
  const installs30 = Object.values(s.installsByStatus).reduce((a, b) => a + b, 0);
  const budgetPct = ai.monthlyBudgetMicros > 0 ? Math.min(100, Math.round((s.aiCostMicros / ai.monthlyBudgetMicros) * 100)) : 100;
  return (
    <>
      <PageHeader eyebrow="Administration" title="Vue d’ensemble">
        État de la plateforme, du bot et de la consommation.
      </PageHeader>

      {maintenance.enabled && (
        <Notice tone="warning" title="Mode maintenance actif" className="mb-4">
          {maintenance.blockInstalls ? "Les nouvelles installations sont bloquées. " : ""}
          <Link href="/admin/maintenance" className="font-semibold underline">Gérer</Link>
        </Notice>
      )}
      {online.length === 0 && (
        <Notice tone="danger" title="Aucun processus bot en ligne" className="mb-4">
          Aucun battement de cœur depuis 90 secondes : les installations et sauvegardes en file ne sont pas traitées. Vérifiez le processus <code>pnpm start:bot</code>.
        </Notice>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Utilisateurs" value={s.users} hint={`+${s.newUsers7d} sur 7 jours`} />
        <Stat label="Projets" value={s.projects} />
        <Stat label="Sauvegardes" value={s.backups} />
        <Stat label="Comptes Premium actifs" value={s.premiumUsers} />
        <Stat label="Installations (30 j)" value={installs30} hint={`${s.installsByStatus.succeeded ?? 0} réussies · ${s.installsByStatus.partial ?? 0} partielles · ${s.installsByStatus.failed ?? 0} échouées`} />
        <Stat label="Coût IA du mois" value={formatUsd(s.aiCostMicros)} hint={`${budgetPct} % du budget (${formatUsd(ai.monthlyBudgetMicros)})`} />
        <Stat label="Bot" value={online.length ? "En ligne" : "Hors ligne"} hint={`${online.length} processus actif(s)`} />
        <Stat label="IA" value={ai.enabled ? "Activée" : "Désactivée"} hint={ai.model} />
      </div>

      <h2 className="mt-10 mb-3 text-xl font-bold">Installations des 30 derniers jours</h2>
      <div className="flex flex-wrap gap-2">
        {Object.entries(INSTALL_STATUS_LABELS).map(([k, label]) => (
          <Link key={k} href={`/admin/installations?status=${k}`} className="panel px-3 py-2 text-sm hover:border-edge">
            {label} : <strong>{s.installsByStatus[k] ?? 0}</strong>
          </Link>
        ))}
      </div>

      <h2 className="mt-10 mb-3 text-xl font-bold">Processus du bot</h2>
      {s.heartbeats.length === 0 ? (
        <p className="text-sm text-muted">Aucun processus n’a encore signalé sa présence.</p>
      ) : (
        <ul className="space-y-2">
          {s.heartbeats.slice(0, 6).map((h) => (
            <li key={h.instanceId} className="panel flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
              <span className="font-mono">{h.instanceId}</span>
              <span className="text-muted">
                {h.guildCount} serveur(s) · passerelle : {h.gatewayStatus ?? "—"} · vu {formatDate(h.lastSeenAt)}
              </span>
              <Badge tone={isOnline(h.lastSeenAt) ? "success" : "danger"}>{isOnline(h.lastSeenAt) ? "en ligne" : "silencieux"}</Badge>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
