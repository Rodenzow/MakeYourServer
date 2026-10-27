import { z } from "zod";
import { DEFAULT_QUOTAS, QUOTA_LABELS, type PlanQuotas } from "@mys/core";
import { audit, eq, getDb, plans } from "@mys/db";
import { HttpError, json, parseBody, withAdmin } from "@/lib/api";

const quotaShape = Object.fromEntries(
  Object.keys(QUOTA_LABELS).map((k) => [k, typeof DEFAULT_QUOTAS.free[k as keyof PlanQuotas] === "boolean" ? z.boolean() : z.number().int().min(0).max(1_000_000_000)]),
) as unknown as Record<keyof PlanQuotas, z.ZodType>;

const Body = z.object({
  name: z.string().trim().min(2).max(60),
  priceLabel: z.string().trim().max(80).nullable(),
  description: z.string().max(500),
  purchasable: z.boolean(),
  stripePriceId: z.string().trim().regex(/^price_[A-Za-z0-9]+$/, "L’identifiant Stripe commence par « price_ ».").nullable(),
  discordSkuId: z.string().trim().regex(/^\d{17,20}$/, "Le SKU Discord est un identifiant numérique.").nullable(),
  quotas: z.object(quotaShape),
});

export const PUT = withAdmin<{ key: string }>(async (req, admin, { key }) => {
  const body = await parseBody(req, Body);
  const db = getDb();
  const [plan] = await db.select().from(plans).where(eq(plans.key, key));
  if (!plan) throw new HttpError(404, "Offre introuvable.");
  if (body.purchasable && !body.stripePriceId && !body.discordSkuId) throw new HttpError(400, "Une offre proposée à l’achat doit avoir un prix Stripe ou un SKU Discord.");
  if (key === "free" && body.purchasable) throw new HttpError(400, "L’offre gratuite ne peut pas être mise en vente.");
  await db
    .update(plans)
    .set({ ...body, quotas: body.quotas as unknown as PlanQuotas, updatedAt: new Date() })
    .where(eq(plans.key, key));
  await audit({ actorUserId: admin.id, actorType: "admin", action: "admin.plan.update", targetType: "plan", targetId: key, metadata: { before: plan.quotas, after: body.quotas, purchasable: body.purchasable } });
  return json({ ok: true });
});
