import { audit, eq, getDb, plans, subscriptions, users, and } from "@mys/db";

/**
 * Abonnements : deux sources possibles, toutes deux vérifiées côté serveur.
 *  - Stripe (paiement sur le site), via webhooks signés ;
 *  - Discord Premium Apps (achat dans Discord), via les entitlements.
 * Les avantages sont liés au COMPTE Make Your Server (identifiant Discord), quel que soit le serveur.
 */

export interface SubscriptionUpsert {
  userId: string;
  planKey: string;
  provider: "stripe" | "discord" | "manual";
  providerRef: string;
  providerCustomerId?: string | null;
  status: string;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
  note?: string;
}

export async function upsertSubscription(s: SubscriptionUpsert) {
  const values = {
    userId: s.userId,
    planKey: s.planKey,
    provider: s.provider,
    providerRef: s.providerRef,
    providerCustomerId: s.providerCustomerId ?? null,
    status: s.status,
    currentPeriodEnd: s.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: s.cancelAtPeriodEnd ?? false,
    note: s.note ?? null,
  };
  const [row] = await getDb()
    .insert(subscriptions)
    .values(values)
    .onConflictDoUpdate({
      target: [subscriptions.provider, subscriptions.providerRef],
      set: { ...values, updatedAt: new Date() },
    })
    .returning();
  return row!;
}

async function ensureUserByDiscordId(discordId: string, username?: string) {
  const db = getDb();
  const [existing] = await db.select().from(users).where(eq(users.discordId, discordId));
  if (existing) return existing;
  const [created] = await db
    .insert(users)
    .values({ discordId, username: username ?? `utilisateur-${discordId.slice(-4)}` })
    .onConflictDoNothing()
    .returning();
  return created ?? (await db.select().from(users).where(eq(users.discordId, discordId)))[0]!;
}

export interface DiscordEntitlementInput {
  id: string;
  userId: string | null;
  skuId: string;
  startsAt: Date | null;
  endsAt: Date | null;
  deleted?: boolean;
  /** Abonnement en cours d’annulation (Discord marque l’entitlement avec une date de fin). */
}

/** Synchronise un entitlement Discord (événement passerelle ou synchronisation périodique). */
export async function syncDiscordEntitlement(e: DiscordEntitlementInput) {
  if (!e.userId) return null; // entitlement de serveur : non utilisé (avantages liés au compte)
  const [plan] = await getDb().select().from(plans).where(eq(plans.discordSkuId, e.skuId));
  if (!plan) return null;
  const user = await ensureUserByDiscordId(e.userId);
  const now = Date.now();
  const status = e.deleted ? "canceled" : e.endsAt && e.endsAt.getTime() < now ? "expired" : "active";
  const row = await upsertSubscription({
    userId: user.id,
    planKey: plan.key,
    provider: "discord",
    providerRef: e.id,
    status,
    currentPeriodEnd: e.endsAt,
    cancelAtPeriodEnd: !!e.endsAt && status === "active",
  });
  await audit({ actorType: "system", action: "subscription.discord.sync", targetType: "subscription", targetId: row.id, metadata: { status, skuId: e.skuId } });
  return row;
}

/** Abonnements Discord actifs inconnus de la synchronisation : marqués expirés. */
export async function expireMissingDiscordEntitlements(activeIds: Set<string>) {
  const db = getDb();
  const rows = await db.select().from(subscriptions).where(and(eq(subscriptions.provider, "discord"), eq(subscriptions.status, "active")));
  for (const r of rows) {
    if (!activeIds.has(r.providerRef)) {
      await db.update(subscriptions).set({ status: "expired", updatedAt: new Date() }).where(eq(subscriptions.id, r.id));
    }
  }
}

export { ensureUserByDiscordId };
