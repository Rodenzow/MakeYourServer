import "server-only";
import Stripe from "stripe";
import { and, audit, desc, eq, getDb, isNotNull, plans, subscriptions } from "@mys/db";
import { upsertSubscription } from "@mys/engine";
import { HttpError } from "./api";
import { env } from "./env";

/**
 * Paiement sur le site (Stripe). Les abonnements sont toujours vérifiés côté
 * serveur à partir des webhooks signés : la page de retour ne fait que l’affichage.
 * Achat dans Discord : voir packages/engine/src/services/billing.ts (entitlements).
 */
let client: Stripe | null = null;

export const stripeEnabled = () => !!env.stripeSecretKey;

export function getStripe(): Stripe {
  if (!env.stripeSecretKey) throw new HttpError(503, "Le paiement par carte n’est pas encore configuré sur cette instance (STRIPE_SECRET_KEY).", "billing_disabled");
  client ??= new Stripe(env.stripeSecretKey, { maxNetworkRetries: 2, timeout: 20_000, httpClient: Stripe.createFetchHttpClient() });
  return client;
}

export function discordStoreUrl(skuId: string | null | undefined): string | null {
  if (!skuId || !env.discordClientId) return null;
  return `https://discord.com/application-directory/${env.discordClientId}/store/${skuId}`;
}

async function stripeCustomerFor(userId: string): Promise<string | null> {
  const [row] = await getDb()
    .select({ customer: subscriptions.providerCustomerId })
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.provider, "stripe"), isNotNull(subscriptions.providerCustomerId)))
    .orderBy(desc(subscriptions.updatedAt))
    .limit(1);
  return row?.customer ?? null;
}

export async function createCheckout(user: { id: string; discordId: string }, planKey = "premium") {
  const stripe = getStripe();
  const [plan] = await getDb().select().from(plans).where(eq(plans.key, planKey));
  if (!plan || !plan.purchasable || !plan.stripePriceId) throw new HttpError(409, "Cette offre n’est pas encore proposée à l’achat par carte.", "not_purchasable");
  const customer = await stripeCustomerFor(user.id);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    client_reference_id: user.id,
    ...(customer ? { customer } : {}),
    metadata: { userId: user.id, planKey },
    subscription_data: { metadata: { userId: user.id, planKey, discordId: user.discordId } },
    allow_promotion_codes: true,
    locale: "fr",
    custom_text: {
      submit: {
        message: "En vous abonnant, vous demandez l’accès immédiat au Premium et renoncez à votre droit de rétractation de 14 jours. Résiliable à tout moment depuis votre espace.",
      },
    },
    success_url: `${env.appUrl}/abonnement?statut=succes`,
    cancel_url: `${env.appUrl}/abonnement?statut=annule`,
  });
  if (!session.url) throw new HttpError(502, "Stripe n’a pas renvoyé de page de paiement.");
  await audit({ actorUserId: user.id, actorType: "user", action: "billing.checkout", metadata: { planKey, termsAccepted: true, withdrawalWaived: true } });
  return session.url;
}

export async function createPortal(userId: string) {
  const stripe = getStripe();
  const customer = await stripeCustomerFor(userId);
  if (!customer) throw new HttpError(404, "Aucun abonnement par carte n’est associé à votre compte.");
  const session = await stripe.billingPortal.sessions.create({ customer, return_url: `${env.appUrl}/abonnement`, locale: "fr" });
  return session.url;
}

/* -------------------------------- Webhooks -------------------------------- */

const STATUS_MAP: Record<string, string> = {
  active: "active",
  trialing: "trialing",
  past_due: "past_due",
  unpaid: "expired",
  canceled: "canceled",
  incomplete: "incomplete",
  incomplete_expired: "expired",
  paused: "expired",
};

/** Fin de période : sur les éléments d’abonnement (API récentes) ou sur l’abonnement (anciennes versions). */
function periodEnd(sub: Stripe.Subscription): Date | null {
  const fromItem = sub.items?.data?.[0]?.current_period_end;
  const legacy = (sub as unknown as { current_period_end?: number }).current_period_end;
  const ts = fromItem ?? legacy;
  return ts ? new Date(ts * 1000) : null;
}

async function resolvePlanKey(sub: Stripe.Subscription): Promise<string> {
  if (sub.metadata?.planKey) return sub.metadata.planKey;
  const priceId = sub.items?.data?.[0]?.price?.id;
  if (priceId) {
    const [p] = await getDb().select({ key: plans.key }).from(plans).where(eq(plans.stripePriceId, priceId));
    if (p) return p.key;
  }
  return "premium";
}

async function resolveUserId(sub: Stripe.Subscription, fallback?: string | null): Promise<string | null> {
  if (sub.metadata?.userId) return sub.metadata.userId;
  if (fallback) return fallback;
  const [row] = await getDb()
    .select({ userId: subscriptions.userId })
    .from(subscriptions)
    .where(and(eq(subscriptions.provider, "stripe"), eq(subscriptions.providerRef, sub.id)));
  return row?.userId ?? null;
}

export async function syncStripeSubscription(sub: Stripe.Subscription, userHint?: string | null) {
  const userId = await resolveUserId(sub, userHint);
  if (!userId) throw new Error(`Abonnement Stripe ${sub.id} sans utilisateur associé`);
  const row = await upsertSubscription({
    userId,
    planKey: await resolvePlanKey(sub),
    provider: "stripe",
    providerRef: sub.id,
    providerCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
    status: STATUS_MAP[sub.status] ?? "expired",
    currentPeriodEnd: periodEnd(sub),
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
  });
  await audit({ actorType: "system", action: "subscription.stripe.sync", targetType: "subscription", targetId: row.id, metadata: { status: row.status } });
  return row;
}

function subscriptionIdOf(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && "id" in (value as object)) return String((value as { id: string }).id);
  return null;
}

/** Traite un événement Stripe déjà vérifié (signature contrôlée par la route). */
export async function handleStripeEvent(event: Stripe.Event) {
  const stripe = getStripe();
  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object;
      const subId = subscriptionIdOf(s.subscription);
      if (s.mode !== "subscription" || !subId) return;
      const sub = await stripe.subscriptions.retrieve(subId);
      await syncStripeSubscription(sub, s.client_reference_id ?? s.metadata?.userId ?? null);
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncStripeSubscription(event.data.object);
      return;
    case "invoice.payment_failed": {
      const inv = event.data.object as unknown as { subscription?: unknown; parent?: { subscription_details?: { subscription?: unknown } } };
      const subId = subscriptionIdOf(inv.parent?.subscription_details?.subscription) ?? subscriptionIdOf(inv.subscription);
      if (!subId) return;
      // L’abonnement Stripe fait foi : on relit son statut réel.
      await syncStripeSubscription(await stripe.subscriptions.retrieve(subId));
      return;
    }
    default:
      return;
  }
}
