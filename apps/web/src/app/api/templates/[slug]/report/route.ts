import { z } from "zod";
import { and, audit, count, eq, getDb, gte, templateReports, templates } from "@mys/db";
import { HttpError, json, parseBody, withUser } from "@/lib/api";
import { REPORT_REASONS } from "@/lib/publications";

const Body = z.object({
  reason: z.enum(Object.keys(REPORT_REASONS) as [keyof typeof REPORT_REASONS, ...Array<keyof typeof REPORT_REASONS>]),
  details: z.string().trim().max(1000).optional(),
});

/** Signaler un template public à l’administration (compte connecté requis, limité). */
export const POST = withUser<{ slug: string }>(async (req, user, { slug }) => {
  const body = await parseBody(req, Body);
  const db = getDb();
  const [t] = await db.select({ id: templates.id }).from(templates).where(and(eq(templates.slug, slug), eq(templates.status, "published")));
  if (!t) throw new HttpError(404, "Template introuvable.");
  const since = new Date(Date.now() - 86_400_000);
  const [{ n }] = (await db.select({ n: count() }).from(templateReports).where(and(eq(templateReports.userId, user.id), gte(templateReports.createdAt, since)))) as [{ n: number }];
  if (Number(n) >= 10) throw new HttpError(429, "Trop de signalements aujourd’hui. Réessayez demain ou contactez-nous.");
  const [dup] = await db.select({ id: templateReports.id }).from(templateReports).where(and(eq(templateReports.userId, user.id), eq(templateReports.templateId, t.id), gte(templateReports.createdAt, since)));
  if (dup) return json({ ok: true, duplicate: true });
  await db.insert(templateReports).values({ templateId: t.id, userId: user.id, reason: body.reason, details: body.details || null });
  await audit({ actorUserId: user.id, actorType: "user", action: "template.report", targetType: "template", targetId: t.id, metadata: { reason: body.reason } });
  return json({ ok: true }, 201);
});
