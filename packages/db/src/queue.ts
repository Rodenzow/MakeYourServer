import { and, eq, sql } from "drizzle-orm";
import { getDb } from "./client";
import { jobs } from "./schema";

export type JobRow = typeof jobs.$inferSelect;

export interface EnqueueOptions {
  runAt?: Date;
  dedupeKey?: string;
  maxAttempts?: number;
}

/**
 * Ajoute une tâche à la file. Avec `dedupeKey`, une tâche identique déjà en
 * attente ou en cours n’est pas dupliquée (la tâche existante est renvoyée).
 */
export async function enqueueJob(type: string, payload: Record<string, unknown>, opts: EnqueueOptions = {}): Promise<{ id: string; created: boolean }> {
  const db = getDb();
  const rows = await db.execute<{ id: string }>(sql`
    insert into jobs (type, payload, run_at, dedupe_key, max_attempts)
    values (${type}, ${JSON.stringify(payload)}::jsonb, ${(opts.runAt ?? new Date()).toISOString()}, ${opts.dedupeKey ?? null}, ${opts.maxAttempts ?? 5})
    on conflict (dedupe_key) where dedupe_key is not null and status in ('queued','running') do nothing
    returning id`);
  if (rows[0]) return { id: rows[0].id, created: true };
  const existing = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.dedupeKey, opts.dedupeKey!), sql`${jobs.status} in ('queued','running')`))
    .limit(1);
  return { id: existing[0]!.id, created: false };
}

/**
 * Réserve la prochaine tâche prête. Une tâche « running » dont le bail a expiré
 * (processus arrêté brutalement) est reprise : c’est ce qui permet la reprise
 * après interruption.
 */
export async function claimJob(workerId: string, leaseMs = 60_000, types?: string[]): Promise<JobRow | null> {
  const db = getDb();
  const typeFilter = types?.length ? sql`and type in ${types}` : sql``;
  const rows = await db.execute<Record<string, unknown>>(sql`
    update jobs set
      status = 'running',
      locked_by = ${workerId},
      locked_until = now() + (${leaseMs} * interval '1 millisecond'),
      attempts = attempts + 1,
      updated_at = now()
    where id = (
      select id from jobs
      where ((status = 'queued' and run_at <= now()) or (status = 'running' and locked_until < now()))
      ${typeFilter}
      order by run_at
      for update skip locked
      limit 1
    )
    returning id`);
  if (!rows[0]) return null;
  const [job] = await db.select().from(jobs).where(eq(jobs.id, rows[0].id as string));
  return job ?? null;
}

/** Prolonge le bail d’une tâche en cours. Renvoie false si la tâche a été reprise par un autre processus. */
export async function extendLease(jobId: string, workerId: string, leaseMs = 60_000): Promise<boolean> {
  const db = getDb();
  const rows = await db.execute(sql`
    update jobs set locked_until = now() + (${leaseMs} * interval '1 millisecond'), updated_at = now()
    where id = ${jobId} and locked_by = ${workerId} and status = 'running' returning id`);
  return rows.length > 0;
}

export async function completeJob(jobId: string, workerId: string) {
  await getDb()
    .update(jobs)
    .set({ status: "succeeded", lockedBy: null, lockedUntil: null, finishedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(jobs.id, jobId), eq(jobs.lockedBy, workerId)));
}

/** Échec : nouvelle tentative avec délai exponentiel, ou échec définitif. */
export async function failJob(job: JobRow, workerId: string, error: string, opts: { retry?: boolean } = {}) {
  const retry = (opts.retry ?? true) && job.attempts < job.maxAttempts;
  const delayMs = Math.min(15 * 60_000, 2 ** job.attempts * 5_000);
  await getDb()
    .update(jobs)
    .set({
      status: retry ? "queued" : "failed",
      runAt: retry ? new Date(Date.now() + delayMs) : job.runAt,
      lastError: error.slice(0, 2000),
      lockedBy: null,
      lockedUntil: null,
      finishedAt: retry ? null : new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(jobs.id, job.id), eq(jobs.lockedBy, workerId)));
}

export async function cancelJobsByDedupe(dedupeKey: string) {
  await getDb()
    .update(jobs)
    .set({ status: "cancelled", finishedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(jobs.dedupeKey, dedupeKey), eq(jobs.status, "queued")));
}

export async function queueStats() {
  const rows = await getDb().execute<{ status: string; type: string; count: number }>(sql`
    select status, type, count(*)::int as count from jobs
    where created_at > now() - interval '7 days' or status in ('queued','running')
    group by status, type order by type, status`);
  return [...rows];
}
