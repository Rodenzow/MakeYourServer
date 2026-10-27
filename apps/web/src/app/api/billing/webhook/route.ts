import { NextResponse, type NextRequest } from "next/server";
import { and, eq, getDb, logError, webhookEvents } from "@mys/db";
import { getStripe, handleStripeEvent } from "@/lib/billing";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Webhook Stripe : pas de session ni de contrôle d’origine, la signature fait foi.
 * Chaque événement n’est traité qu’une fois (table webhook_events).
 */
export async function POST(req: NextRequest) {
  if (!env.stripeSecretKey || !env.stripeWebhookSecret) return NextResponse.json({ error: "Paiement non configuré." }, { status: 503 });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Signature manquante." }, { status: 400 });
  const raw = await req.text();
  let event;
  try {
    event = getStripe().webhooks.constructEvent(raw, signature, env.stripeWebhookSecret);
  } catch {
    return NextResponse.json({ error: "Signature invalide." }, { status: 400 });
  }

  const db = getDb();
  const inserted = await db
    .insert(webhookEvents)
    .values({ provider: "stripe", eventId: event.id, type: event.type })
    .onConflictDoNothing()
    .returning({ id: webhookEvents.id });
  if (!inserted.length) {
    const [existing] = await db.select().from(webhookEvents).where(and(eq(webhookEvents.provider, "stripe"), eq(webhookEvents.eventId, event.id)));
    if (existing?.processedAt) return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    await handleStripeEvent(event);
    await db
      .update(webhookEvents)
      .set({ processedAt: new Date(), error: null })
      .where(and(eq(webhookEvents.provider, "stripe"), eq(webhookEvents.eventId, event.id)));
    return NextResponse.json({ received: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur inconnue";
    await db
      .update(webhookEvents)
      .set({ error: message.slice(0, 500) })
      .where(and(eq(webhookEvents.provider, "stripe"), eq(webhookEvents.eventId, event.id)));
    await logError("web", "Webhook Stripe en échec", { eventId: event.id, type: event.type, error: message });
    // 500 : Stripe renverra l’événement plus tard.
    return NextResponse.json({ error: "Traitement impossible pour le moment." }, { status: 500 });
  }
}
