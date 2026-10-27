import { DEFAULT_QUOTAS, type PlanKey, type PlanQuotas } from "@mys/core";
import { and, eq, getDb, inArray, plans, sql, subscriptions, usageCounters } from "@mys/db";

export interface Entitlement {
  planKey: PlanKey;
  planName: string;
  quotas: PlanQuotas;
  /** Source de l’avantage : les avantages Premium sont liés au COMPTE, pas à un serveur. */
  source: "free" | "stripe" | "discord" | "manual";
  subscriptionId?: string;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
}

const ACTIVE = ["active", "trialing", "past_due"];

export async function getEntitlement(userId: string): Promise<Entitlement> {
  const db = getDb();
  const subs = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), inArray(subscriptions.status, ACTIVE)));
  const now = Date.now();
  const active = subs.find((s) => !s.currentPeriodEnd || s.currentPeriodEnd.getTime() > now);
  const key: PlanKey = active ? (active.planKey as PlanKey) : "free";
  const [plan] = await db.select().from(plans).where(eq(plans.key, key));
  return {
    planKey: key,
    planName: plan?.name ?? (key === "premium" ? "Premium" : "Gratuit"),
    quotas: { ...DEFAULT_QUOTAS[key], ...(plan?.quotas ?? {}) },
    source: active ? (active.provider as Entitlement["source"]) : "free",
    subscriptionId: active?.id,
    currentPeriodEnd: active?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: active?.cancelAtPeriodEnd ?? false,
  };
}

export function currentPeriod(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type UsageMetric = "ai_generations" | "ai_edits" | "ai_cost_micros" | "ai_input_tokens" | "ai_output_tokens";

export async function getUsage(userId: string, period = currentPeriod()): Promise<Record<UsageMetric, number>> {
  const rows = await getDb().select().from(usageCounters).where(and(eq(usageCounters.userId, userId), eq(usageCounters.period, period)));
  const out = { ai_generations: 0, ai_edits: 0, ai_cost_micros: 0, ai_input_tokens: 0, ai_output_tokens: 0 } as Record<UsageMetric, number>;
  for (const r of rows) out[r.metric as UsageMetric] = Number(r.value);
  return out;
}

export async function incrementUsage(userId: string, metric: UsageMetric, by: number, period = currentPeriod()) {
  if (!by) return;
  await getDb()
    .insert(usageCounters)
    .values({ userId, period, metric, value: by })
    .onConflictDoUpdate({
      target: [usageCounters.userId, usageCounters.period, usageCounters.metric],
      set: { value: sql`${usageCounters.value} + ${by}` },
    });
}

/** Consommation totale de la plateforme sur la période (pour le budget global IA). */
export async function platformUsage(metric: UsageMetric, period = currentPeriod()): Promise<number> {
  const rows = await getDb().execute<{ total: string | null }>(
    sql`select sum(value)::bigint as total from usage_counters where period = ${period} and metric = ${metric}`,
  );
  return Number(rows[0]?.total ?? 0);
}
