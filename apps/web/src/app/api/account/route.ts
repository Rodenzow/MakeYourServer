import { z } from "zod";
import { and, audit, eq, getDb, gte, inArray, isNull, or, sql, subscriptions, templates, users } from "@mys/db";
import { HttpError, json, parseBody, withUser } from "@/lib/api";
import { SESSION_COOKIE } from "@/lib/session";

const Body = z.object({ confirm: z.literal("SUPPRIMER", { error: "Tapez SUPPRIMER pour confirmer." }) });

/**
 * Suppression du compte et de toutes les données associées (projets, sauvegardes,
 * messages exportés, installations, jetons, publications). Irréversible.
 * Les serveurs Discord eux-mêmes ne sont pas modifiés.
 */
export const DELETE = withUser(async (req, user) => {
  await parseBody(req, Body);
  const db = getDb();
  const [active] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, user.id),
        inArray(subscriptions.status, ["active", "trialing", "past_due"]),
        or(isNull(subscriptions.currentPeriodEnd), gte(subscriptions.currentPeriodEnd, new Date())),
        sql`${subscriptions.cancelAtPeriodEnd} is not true`,
      ),
    );
  if (active) throw new HttpError(409, "Résiliez d’abord votre abonnement Premium (page Abonnement), puis supprimez votre compte.");
  await audit({ actorUserId: null, actorType: "user", action: "account.delete", targetType: "user", targetId: user.id });
  await db.transaction(async (tx) => {
    // Les publications de la communauté sont retirées avec le compte de leur auteur.
    await tx.delete(templates).where(and(eq(templates.authorUserId, user.id), eq(templates.official, false)));
    await tx.delete(users).where(eq(users.id, user.id));
  });
  const res = json({ deleted: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
});
