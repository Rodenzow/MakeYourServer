import "server-only";
import {
  aiGenerations,
  and,
  auditLogs,
  backups,
  count,
  desc,
  eq,
  errorLogs,
  getDb,
  gte,
  ilike,
  inArray,
  installations,
  jobs,
  lte,
  or,
  projects,
  sql,
  subscriptions,
  templates,
  usageCounters,
  users,
  workerHeartbeats,
} from "@mys/db";
import { currentPeriod } from "@mys/engine";

/**
 * Requêtes de l’administration. Elles ne renvoient jamais de jetons, de secrets,
 * ni le contenu des sauvegardes ou des projets : uniquement des métadonnées.
 */

export const PAGE_SIZE = 50;

export const pageOf = (raw: string | undefined) => Math.max(1, Number.parseInt(raw ?? "1", 10) || 1);

export function formatUsd(micros: number | null | undefined) {
  const v = Number(micros ?? 0) / 1_000_000;
  return `${v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: v < 1 ? 4 : 2 })} $ US`;
}

export function formatBytes(n: number | null | undefined) {
  const v = Number(n ?? 0);
  if (v < 1024) return `${v} o`;
  if (v < 1024 ** 2) return `${(v / 1024).toFixed(1)} Ko`;
  return `${(v / 1024 ** 2).toFixed(1)} Mo`;
}

export const truncate = (s: string | null | undefined, n = 200) => (!s ? "" : s.length > n ? `${s.slice(0, n)}…` : s);

/* ------------------------------ Vue d’ensemble ------------------------------ */

export async function overviewStats() {
  const db = getDb();
  const since7 = new Date(Date.now() - 7 * 86400_000);
  const since30 = new Date(Date.now() - 30 * 86400_000);
  const [[u], [u7], [p], [b], [premium]] = await Promise.all([
    db.select({ n: count() }).from(users),
    db.select({ n: count() }).from(users).where(gte(users.createdAt, since7)),
    db.select({ n: count() }).from(projects),
    db.select({ n: count() }).from(backups),
    db
      .select({ n: sql<number>`count(distinct ${subscriptions.userId})::int` })
      .from(subscriptions)
      .where(and(inArray(subscriptions.status, ["active", "trialing", "past_due"]), or(sql`${subscriptions.currentPeriodEnd} is null`, gte(subscriptions.currentPeriodEnd, new Date())))),
  ]);
  const installsByStatus = await db
    .select({ status: installations.status, n: count() })
    .from(installations)
    .where(gte(installations.createdAt, since30))
    .groupBy(installations.status);
  const [cost] = await db
    .select({ total: sql<number>`coalesce(sum(${usageCounters.value}), 0)::bigint` })
    .from(usageCounters)
    .where(and(eq(usageCounters.period, currentPeriod()), eq(usageCounters.metric, "ai_cost_micros")));
  const heartbeats = await db.select().from(workerHeartbeats).orderBy(desc(workerHeartbeats.lastSeenAt));
  return {
    users: Number(u?.n ?? 0),
    newUsers7d: Number(u7?.n ?? 0),
    projects: Number(p?.n ?? 0),
    backups: Number(b?.n ?? 0),
    premiumUsers: Number(premium?.n ?? 0),
    installsByStatus: Object.fromEntries(installsByStatus.map((r) => [r.status, Number(r.n)])) as Record<string, number>,
    aiCostMicros: Number(cost?.total ?? 0),
    heartbeats,
  };
}

export const isOnline = (lastSeenAt: Date) => Date.now() - new Date(lastSeenAt).getTime() < 90_000;

/* -------------------------------- Utilisateurs ------------------------------ */

export async function listUsers(q: string | undefined, page: number) {
  const db = getDb();
  const where = q ? or(ilike(users.username, `%${q.replace(/[%_]/g, "")}%`), ilike(users.globalName, `%${q.replace(/[%_]/g, "")}%`), eq(users.discordId, q.trim())) : undefined;
  const rows = await db
    .select({
      id: users.id,
      discordId: users.discordId,
      username: users.username,
      globalName: users.globalName,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
      suspendedAt: users.suspendedAt,
      projects: sql<number>`(select count(*)::int from projects p where p.user_id = ${users.id})`,
      premium: sql<boolean>`exists(select 1 from subscriptions s where s.user_id = ${users.id} and s.status in ('active','trialing','past_due') and (s.current_period_end is null or s.current_period_end > now()))`,
    })
    .from(users)
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(PAGE_SIZE + 1)
    .offset((page - 1) * PAGE_SIZE);
  return { rows: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE };
}

export async function userDetail(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, id));
  if (!user) return null;
  const [subs, [counts], recentInstalls, recentAi] = await Promise.all([
    db.select().from(subscriptions).where(eq(subscriptions.userId, id)).orderBy(desc(subscriptions.updatedAt)),
    db
      .select({
        projects: sql<number>`(select count(*)::int from projects where user_id = ${id})`,
        backups: sql<number>`(select count(*)::int from backups where user_id = ${id})`,
        installations: sql<number>`(select count(*)::int from installations where user_id = ${id})`,
        ai: sql<number>`(select count(*)::int from ai_generations where user_id = ${id})`,
      })
      .from(sql`(select 1) x`),
    db
      .select({ id: installations.id, guildName: installations.guildName, kind: installations.kind, status: installations.status, createdAt: installations.createdAt, dryRun: installations.dryRun })
      .from(installations)
      .where(eq(installations.userId, id))
      .orderBy(desc(installations.createdAt))
      .limit(10),
    db
      .select({ period: usageCounters.period, metric: usageCounters.metric, value: usageCounters.value })
      .from(usageCounters)
      .where(and(eq(usageCounters.userId, id), eq(usageCounters.period, currentPeriod()))),
  ]);
  return { user, subscriptions: subs, counts: counts!, recentInstalls, usage: Object.fromEntries(recentAi.map((r) => [r.metric, Number(r.value)])) as Record<string, number> };
}

/* --------------------------------- Templates -------------------------------- */

export const TEMPLATE_STATUSES = ["draft", "pending_review", "published", "rejected", "archived"] as const;
export const TEMPLATE_STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  pending_review: "À examiner",
  published: "Publié",
  rejected: "Refusé",
  archived: "Archivé",
};

export async function listAdminTemplates(status?: string) {
  const db = getDb();
  return db
    .select({
      id: templates.id,
      slug: templates.slug,
      name: templates.name,
      theme: templates.theme,
      status: templates.status,
      official: templates.official,
      popularity: templates.popularity,
      installCount: templates.installCount,
      authorUserId: templates.authorUserId,
      authorName: users.username,
      updatedAt: templates.updatedAt,
    })
    .from(templates)
    .leftJoin(users, eq(users.id, templates.authorUserId))
    .where(status && (TEMPLATE_STATUSES as readonly string[]).includes(status) ? eq(templates.status, status) : undefined)
    .orderBy(desc(templates.updatedAt));
}

export async function getTemplateById(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [t] = await getDb().select().from(templates).where(eq(templates.id, id));
  return t ?? null;
}

/* ------------------------------- Installations ------------------------------ */

export const INSTALL_STATUSES = ["planned", "queued", "running", "succeeded", "partial", "failed", "cancelled"] as const;

export async function listAdminInstallations(f: { status?: string; guild?: string; user?: string }, page: number) {
  const conds = [];
  if (f.status && (INSTALL_STATUSES as readonly string[]).includes(f.status)) conds.push(eq(installations.status, f.status));
  if (f.guild) conds.push(eq(installations.guildId, f.guild.trim()));
  if (f.user) conds.push(or(eq(users.discordId, f.user.trim()), ilike(users.username, `%${f.user.replace(/[%_]/g, "")}%`))!);
  const rows = await getDb()
    .select({
      id: installations.id,
      guildId: installations.guildId,
      guildName: installations.guildName,
      kind: installations.kind,
      status: installations.status,
      dryRun: installations.dryRun,
      origin: installations.origin,
      error: installations.error,
      createdAt: installations.createdAt,
      finishedAt: installations.finishedAt,
      userId: installations.userId,
      username: users.username,
    })
    .from(installations)
    .innerJoin(users, eq(users.id, installations.userId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(installations.createdAt))
    .limit(PAGE_SIZE + 1)
    .offset((page - 1) * PAGE_SIZE);
  return { rows: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE };
}

/* -------------------------------- Sauvegardes ------------------------------- */

export async function listAdminBackups(page: number, guild?: string) {
  const rows = await getDb()
    .select({
      id: backups.id,
      guildId: backups.guildId,
      guildName: backups.guildName,
      kind: backups.kind,
      version: backups.version,
      summary: backups.summary,
      messageCount: backups.messageCount,
      sizeBytes: backups.sizeBytes,
      createdAt: backups.createdAt,
      expiresAt: backups.expiresAt,
      username: users.username,
      userId: backups.userId,
    })
    .from(backups)
    .innerJoin(users, eq(users.id, backups.userId))
    .where(guild ? eq(backups.guildId, guild.trim()) : undefined)
    .orderBy(desc(backups.createdAt))
    .limit(PAGE_SIZE + 1)
    .offset((page - 1) * PAGE_SIZE);
  return { rows: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE };
}

/* ------------------------------------ File ---------------------------------- */

export async function listJobs(status?: string, page = 1) {
  const rows = await getDb()
    .select({
      id: jobs.id,
      type: jobs.type,
      status: jobs.status,
      attempts: jobs.attempts,
      maxAttempts: jobs.maxAttempts,
      lastError: jobs.lastError,
      runAt: jobs.runAt,
      lockedBy: jobs.lockedBy,
      createdAt: jobs.createdAt,
      finishedAt: jobs.finishedAt,
    })
    .from(jobs)
    .where(status ? eq(jobs.status, status) : undefined)
    .orderBy(desc(jobs.createdAt))
    .limit(PAGE_SIZE + 1)
    .offset((page - 1) * PAGE_SIZE);
  return { rows: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE };
}

/* -------------------------------------- IA ---------------------------------- */

export async function aiUsageThisMonth() {
  const db = getDb();
  const period = currentPeriod();
  const totals = await db
    .select({ metric: usageCounters.metric, total: sql<number>`sum(${usageCounters.value})::bigint` })
    .from(usageCounters)
    .where(eq(usageCounters.period, period))
    .groupBy(usageCounters.metric);
  const top = await db
    .select({
      userId: usageCounters.userId,
      username: users.username,
      discordId: users.discordId,
      cost: usageCounters.value,
    })
    .from(usageCounters)
    .innerJoin(users, eq(users.id, usageCounters.userId))
    .where(and(eq(usageCounters.period, period), eq(usageCounters.metric, "ai_cost_micros")))
    .orderBy(desc(usageCounters.value))
    .limit(10);
  const recent = await db
    .select({
      id: aiGenerations.id,
      kind: aiGenerations.kind,
      status: aiGenerations.status,
      model: aiGenerations.model,
      inputTokens: aiGenerations.inputTokens,
      outputTokens: aiGenerations.outputTokens,
      costMicros: aiGenerations.costMicros,
      prompt: aiGenerations.prompt,
      error: aiGenerations.error,
      createdAt: aiGenerations.createdAt,
      username: users.username,
    })
    .from(aiGenerations)
    .innerJoin(users, eq(users.id, aiGenerations.userId))
    .orderBy(desc(aiGenerations.createdAt))
    .limit(30);
  return {
    period,
    totals: Object.fromEntries(totals.map((t) => [t.metric, Number(t.total)])) as Record<string, number>,
    top: top.map((t) => ({ ...t, cost: Number(t.cost) })),
    recent: recent.map((r) => ({ ...r, prompt: truncate(r.prompt, 200), error: truncate(r.error, 200) })),
  };
}

/* ---------------------------------- Journaux -------------------------------- */

export interface LogFilters {
  q?: string;
  source?: string;
  level?: string;
  action?: string;
  from?: string;
  to?: string;
}

function dateRange(col: typeof errorLogs.createdAt | typeof auditLogs.createdAt, f: LogFilters) {
  const conds = [];
  if (f.from && !Number.isNaN(Date.parse(f.from))) conds.push(gte(col, new Date(f.from)));
  if (f.to && !Number.isNaN(Date.parse(f.to))) conds.push(lte(col, new Date(new Date(f.to).getTime() + 86400_000 - 1)));
  return conds;
}

export async function listErrorLogs(f: LogFilters, page: number) {
  const conds = [...dateRange(errorLogs.createdAt, f)];
  if (f.source) conds.push(eq(errorLogs.source, f.source));
  if (f.level) conds.push(eq(errorLogs.level, f.level));
  if (f.q) conds.push(ilike(errorLogs.message, `%${f.q.replace(/[%_]/g, "")}%`));
  const rows = await getDb()
    .select()
    .from(errorLogs)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(errorLogs.createdAt))
    .limit(PAGE_SIZE + 1)
    .offset((page - 1) * PAGE_SIZE);
  return { rows: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE };
}

export async function listAuditLogs(f: LogFilters, page: number) {
  const conds = [...dateRange(auditLogs.createdAt, f)];
  if (f.action) conds.push(ilike(auditLogs.action, `${f.action.replace(/[%_]/g, "")}%`));
  if (f.q) conds.push(or(eq(auditLogs.targetId, f.q.trim()), eq(auditLogs.guildId, f.q.trim()), ilike(users.username, `%${f.q.replace(/[%_]/g, "")}%`))!);
  const rows = await getDb()
    .select({
      id: auditLogs.id,
      actorType: auditLogs.actorType,
      action: auditLogs.action,
      targetType: auditLogs.targetType,
      targetId: auditLogs.targetId,
      guildId: auditLogs.guildId,
      metadata: auditLogs.metadata,
      createdAt: auditLogs.createdAt,
      username: users.username,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorUserId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(PAGE_SIZE + 1)
    .offset((page - 1) * PAGE_SIZE);
  return { rows: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE };
}

export const INSTALL_STATUS_LABELS: Record<string, string> = {
  planned: "En attente de confirmation",
  queued: "En file",
  running: "En cours",
  succeeded: "Réussie",
  partial: "Partielle",
  failed: "Échouée",
  cancelled: "Annulée",
};

export const INSTALL_STATUS_TONE: Record<string, "neutral" | "blue" | "success" | "warning" | "danger" | "night"> = {
  planned: "neutral",
  queued: "blue",
  running: "blue",
  succeeded: "success",
  partial: "warning",
  failed: "danger",
  cancelled: "neutral",
};
