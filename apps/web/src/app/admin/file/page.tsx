import Link from "next/link";
import { desc, getDb, queueStats, workerHeartbeats } from "@mys/db";
import { ActionButton } from "@/components/admin/action-button";
import { Badge, PageHeader, cx, formatDate } from "@/components/ui";
import { isOnline, listJobs, pageOf, truncate } from "@/lib/admin";
import { Pager, Table, Td } from "../table";

export const metadata = { title: "File & bot" };

const STATUS = ["queued", "running", "succeeded", "failed", "cancelled"] as const;
const LABEL: Record<string, string> = { queued: "En attente", running: "En cours", succeeded: "Terminée", failed: "Échouée", cancelled: "Annulée" };
const TONE: Record<string, "neutral" | "blue" | "success" | "danger"> = { queued: "blue", running: "blue", succeeded: "success", failed: "danger", cancelled: "neutral" };
const TYPE: Record<string, string> = { "installation.run": "Installation", "backup.create": "Sauvegarde" };

export default async function QueuePage({ searchParams }: { searchParams: Promise<{ statut?: string; page?: string }> }) {
  const sp = await searchParams;
  const page = pageOf(sp.page);
  const [stats, { rows, hasMore }, beats] = await Promise.all([
    queueStats(),
    listJobs(STATUS.includes(sp.statut as never) ? sp.statut : undefined, page),
    getDb().select().from(workerHeartbeats).orderBy(desc(workerHeartbeats.lastSeenAt)),
  ]);
  return (
    <>
      <PageHeader eyebrow="Administration" title="File de tâches & bot">
        File persistante en base : une tâche dont le processus s’arrête est reprise automatiquement à l’expiration de son bail.
      </PageHeader>

      <h2 className="mb-3 text-xl font-bold">Processus</h2>
      <Table head={["Instance", "Type", "Démarré", "Dernier signal", "Serveurs", "Passerelle", "État"]} empty={beats.length === 0}>
        {beats.map((h) => (
          <tr key={h.instanceId}>
            <Td className="font-mono text-xs">{h.instanceId}</Td>
            <Td>{h.kind}</Td>
            <Td className="text-xs">{formatDate(h.startedAt)}</Td>
            <Td className="text-xs">{formatDate(h.lastSeenAt)}</Td>
            <Td>{h.guildCount}</Td>
            <Td className="text-xs">{h.gatewayStatus ?? "—"}</Td>
            <Td><Badge tone={isOnline(h.lastSeenAt) ? "success" : "danger"}>{isOnline(h.lastSeenAt) ? "en ligne" : "silencieux"}</Badge></Td>
          </tr>
        ))}
      </Table>

      <h2 className="mt-10 mb-3 text-xl font-bold">Volume (7 derniers jours et tâches actives)</h2>
      <Table head={["Type", "Statut", "Nombre"]} empty={stats.length === 0}>
        {stats.map((s) => (
          <tr key={`${s.type}-${s.status}`}>
            <Td>{TYPE[s.type] ?? s.type}</Td>
            <Td><Badge tone={TONE[s.status] ?? "neutral"}>{LABEL[s.status] ?? s.status}</Badge></Td>
            <Td>{s.count}</Td>
          </tr>
        ))}
      </Table>

      <h2 className="mt-10 mb-3 text-xl font-bold">Tâches récentes</h2>
      <nav className="mb-3 flex flex-wrap gap-2" aria-label="Filtrer par statut">
        {[undefined, ...STATUS].map((s) => (
          <Link key={s ?? "all"} href={s ? `/admin/file?statut=${s}` : "/admin/file"} className={cx("rounded-lg border px-3 py-1.5 text-sm font-semibold", sp.statut === s || (!sp.statut && !s) ? "border-edge bg-accent text-on-accent" : "border-line bg-surface text-ink hover:border-edge")}>
            {s ? LABEL[s] : "Toutes"}
          </Link>
        ))}
      </nav>
      <Table head={["Type", "Statut", "Tentatives", "Prochaine exécution", "Dernière erreur", ""]} empty={rows.length === 0}>
        {rows.map((j) => (
          <tr key={j.id}>
            <Td>
              {TYPE[j.type] ?? j.type}
              <div className="font-mono text-[11px] text-muted">{j.id.slice(0, 8)}{j.lockedBy ? ` · ${j.lockedBy}` : ""}</div>
            </Td>
            <Td><Badge tone={TONE[j.status] ?? "neutral"}>{LABEL[j.status] ?? j.status}</Badge></Td>
            <Td>{j.attempts}/{j.maxAttempts}</Td>
            <Td className="text-xs">{formatDate(j.runAt)}</Td>
            <Td className="max-w-72 text-xs text-danger">{truncate(j.lastError, 160)}</Td>
            <Td>
              {(j.status === "failed" || j.status === "cancelled") && <ActionButton url={`/api/admin/jobs/${j.id}`} body={{ action: "requeue" }} label="Remettre en file" confirm="Remettre cette tâche en file maintenant ?" />}
              {j.status === "queued" && <ActionButton url={`/api/admin/jobs/${j.id}`} body={{ action: "cancel" }} label="Annuler" variant="ghost" confirm="Annuler cette tâche en attente ?" />}
            </Td>
          </tr>
        ))}
      </Table>
      <Pager page={page} hasMore={hasMore} base="/admin/file" params={{ statut: sp.statut }} />
    </>
  );
}
