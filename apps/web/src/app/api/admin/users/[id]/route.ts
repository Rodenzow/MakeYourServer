import { z } from "zod";
import { audit, eq, getDb, sessions, subscriptions, and, users } from "@mys/db";
import { upsertSubscription } from "@mys/engine";
import { HttpError, json, parseBody, withAdmin } from "@/lib/api";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("suspend"), reason: z.string().trim().min(3, "Indiquez un motif (3 caractères minimum).").max(300) }),
  z.object({ action: z.literal("unsuspend") }),
  z.object({ action: z.literal("grant-premium"), until: z.string().nullable().optional(), note: z.string().max(200).optional() }),
  z.object({ action: z.literal("revoke-premium") }),
]);

/** Actions d’administration sur un compte (suspension, Premium manuel). Jamais d’attribution du rôle administrateur. */
export const POST = withAdmin<{ id: string }>(async (req, admin, { id }) => {
  const body = await parseBody(req, Body);
  const db = getDb();
  const [target] = await db.select().from(users).where(eq(users.id, id));
  if (!target) throw new HttpError(404, "Utilisateur introuvable.");

  switch (body.action) {
    case "suspend": {
      if (target.id === admin.id) throw new HttpError(400, "Vous ne pouvez pas suspendre votre propre compte.");
      await db.update(users).set({ suspendedAt: new Date(), suspensionReason: body.reason }).where(eq(users.id, id));
      // Déconnexion immédiate sur tous les appareils.
      await db.delete(sessions).where(eq(sessions.userId, id));
      await audit({ actorUserId: admin.id, actorType: "admin", action: "admin.user.suspend", targetType: "user", targetId: id, metadata: { reason: body.reason } });
      break;
    }
    case "unsuspend":
      await db.update(users).set({ suspendedAt: null, suspensionReason: null }).where(eq(users.id, id));
      await audit({ actorUserId: admin.id, actorType: "admin", action: "admin.user.unsuspend", targetType: "user", targetId: id });
      break;
    case "grant-premium": {
      let end: Date | null = null;
      if (body.until) {
        end = new Date(`${body.until}T23:59:59Z`);
        if (Number.isNaN(end.getTime()) || end.getTime() < Date.now()) throw new HttpError(400, "La date de fin doit être une date future valide.");
      }
      await upsertSubscription({ userId: id, planKey: "premium", provider: "manual", providerRef: `manual:${id}`, status: "active", currentPeriodEnd: end, note: body.note ?? `Accordé par ${admin.username}` });
      await audit({ actorUserId: admin.id, actorType: "admin", action: "admin.premium.grant", targetType: "user", targetId: id, metadata: { until: body.until ?? null } });
      break;
    }
    case "revoke-premium": {
      const rows = await db
        .update(subscriptions)
        .set({ status: "canceled", updatedAt: new Date() })
        .where(and(eq(subscriptions.userId, id), eq(subscriptions.provider, "manual")))
        .returning({ id: subscriptions.id });
      if (!rows.length) throw new HttpError(404, "Aucun Premium manuel à retirer (les abonnements Stripe ou Discord se gèrent chez le fournisseur).");
      await audit({ actorUserId: admin.id, actorType: "admin", action: "admin.premium.revoke", targetType: "user", targetId: id });
      break;
    }
  }
  return json({ ok: true });
});
