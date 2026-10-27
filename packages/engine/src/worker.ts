import { randomUUID } from "node:crypto";
import {
  backupSchedules,
  claimJob,
  completeJob,
  enqueueJob,
  eq,
  extendLease,
  failJob,
  getDb,
  installations,
  logError,
  lte,
  and,
  sessions,
  sql,
  workerHeartbeats,
  type JobRow,
} from "@mys/db";
import { FakeGateway } from "./fake-gateway";
import type { GuildGateway } from "./gateway";
import { LeaseLostError, RetryLaterError, runInstallation } from "./executor";
import { createBackup, purgeExpiredBackups, QuotaError } from "./services/backups";
import { JOB_INSTALL } from "./services/installs";

export const JOB_BACKUP = "backup.create";

export interface WorkerOptions {
  gateway: GuildGateway;
  instanceId?: string;
  pollMs?: number;
  leaseMs?: number;
  onInstallationProgress?: (installationId: string) => Promise<void> | void;
  onBackupDone?: (payload: Record<string, unknown>, result: { ok: boolean; message: string }) => Promise<void> | void;
  heartbeat?: () => { guildCount: number; gatewayStatus: string };
  log?: (msg: string) => void;
}

/**
 * Processus persistant qui consomme la file de tâches. Plusieurs instances
 * peuvent tourner en parallèle (verrouillage SKIP LOCKED + bail).
 */
export function startWorker(opts: WorkerOptions) {
  const instanceId = opts.instanceId ?? `worker-${randomUUID().slice(0, 8)}`;
  const leaseMs = opts.leaseMs ?? 60_000;
  const log = opts.log ?? ((m: string) => console.log(`[worker] ${m}`));
  let stopped = false;
  const startedAt = new Date();

  const beat = async () => {
    const hb = opts.heartbeat?.() ?? { guildCount: 0, gatewayStatus: "inconnu" };
    await getDb()
      .insert(workerHeartbeats)
      .values({ instanceId, kind: "bot", startedAt, lastSeenAt: new Date(), guildCount: hb.guildCount, gatewayStatus: hb.gatewayStatus, version: process.env.npm_package_version ?? null })
      .onConflictDoUpdate({ target: workerHeartbeats.instanceId, set: { lastSeenAt: new Date(), guildCount: hb.guildCount, gatewayStatus: hb.gatewayStatus } })
      .catch(() => {});
  };

  const handle = async (job: JobRow) => {
    const keepAlive = () => extendLease(job.id, instanceId, leaseMs);
    if (job.type === JOB_INSTALL) {
      const installationId = String(job.payload.installationId);
      const [inst] = await getDb().select().from(installations).where(eq(installations.id, installationId));
      if (!inst) return;
      let gateway = opts.gateway;
      if (inst.dryRun) {
        // Mode simulation : copie en mémoire du serveur réel, aucune action sur Discord.
        gateway = FakeGateway.fromState(await opts.gateway.fetchState(inst.guildId), opts.gateway.botUserId);
      }
      await runInstallation(installationId, { gateway, keepAlive, onProgress: opts.onInstallationProgress });
      return;
    }
    if (job.type === JOB_BACKUP) {
      const p = job.payload as { userId: string; guildId: string; kind?: "manual" | "scheduled"; label?: string; messageChannelIds?: string[]; scheduleId?: string };
      try {
        const b = await createBackup(opts.gateway, { userId: p.userId, guildId: p.guildId, kind: p.kind ?? "manual", label: p.label, messageChannelIds: p.messageChannelIds });
        if (p.scheduleId) await getDb().update(backupSchedules).set({ lastRunAt: new Date(), lastError: null }).where(eq(backupSchedules.id, p.scheduleId));
        await opts.onBackupDone?.(job.payload, { ok: true, message: `Sauvegarde n°${b.version} enregistrée (${b.summary.channels ?? 0} salons, ${b.summary.roles ?? 0} rôles).` });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (p.scheduleId) await getDb().update(backupSchedules).set({ lastError: message.slice(0, 500) }).where(eq(backupSchedules.id, p.scheduleId));
        await opts.onBackupDone?.(job.payload, { ok: false, message });
        if (e instanceof QuotaError) return;
        throw e;
      }
      return;
    }
    throw new Error(`Type de tâche inconnu : ${job.type}`);
  };

  const loop = async () => {
    while (!stopped) {
      let job: JobRow | null = null;
      try {
        job = await claimJob(instanceId, leaseMs);
      } catch (e) {
        await logError("worker", "Lecture de la file impossible", { error: e });
        await sleep(5_000);
        continue;
      }
      if (!job) {
        await sleep(opts.pollMs ?? 1_000);
        continue;
      }
      log(`tâche ${job.type} ${job.id} (tentative ${job.attempts})`);
      try {
        await handle(job);
        await completeJob(job.id, instanceId);
      } catch (e) {
        if (e instanceof LeaseLostError) continue;
        const message = e instanceof Error ? e.message : String(e);
        await failJob(job, instanceId, message, { retry: true });
        if (!(e instanceof RetryLaterError)) await logError("worker", `Tâche ${job.type} en échec`, { jobId: job.id, error: message });
        if (job.type === JOB_INSTALL && job.attempts >= job.maxAttempts) {
          await getDb()
            .update(installations)
            .set({ status: "failed", error: `Abandon après ${job.attempts} tentatives : ${message}`, finishedAt: new Date() })
            .where(eq(installations.id, String(job.payload.installationId)));
        }
      }
    }
  };

  /** Tâches périodiques : sauvegardes programmées, purge, sessions expirées. */
  const scheduler = async () => {
    try {
      const due = await getDb()
        .select()
        .from(backupSchedules)
        .where(and(eq(backupSchedules.enabled, true), lte(backupSchedules.nextRunAt, new Date())));
      for (const s of due) {
        await enqueueJob(JOB_BACKUP, { userId: s.userId, guildId: s.guildId, kind: "scheduled", messageChannelIds: s.messageChannelIds, scheduleId: s.id }, { dedupeKey: `schedule:${s.id}` });
        await getDb()
          .update(backupSchedules)
          .set({ nextRunAt: new Date(Date.now() + s.intervalHours * 3600_000) })
          .where(eq(backupSchedules.id, s.id));
      }
      await purgeExpiredBackups();
      await getDb().delete(sessions).where(sql`${sessions.expiresAt} < now()`);
    } catch (e) {
      await logError("worker", "Planificateur en échec", { error: e });
    }
  };

  void beat();
  const hbTimer = setInterval(beat, 30_000);
  const schedTimer = setInterval(scheduler, 60_000);
  void scheduler();
  const running = loop();
  log(`démarré (${instanceId})`);

  return {
    instanceId,
    async stop() {
      stopped = true;
      clearInterval(hbTimer);
      clearInterval(schedTimer);
      await running;
    },
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
