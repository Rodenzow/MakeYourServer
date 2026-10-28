import { audit, eq, getDb, templateReports } from "@mys/db";
import { HttpError, json, withAdmin } from "@/lib/api";

/** Marquer un signalement comme traité. */
export const POST = withAdmin<{ id: string }>(async (_req, admin, { id }) => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, "Signalement introuvable.");
  const rows = await getDb()
    .update(templateReports)
    .set({ resolvedAt: new Date(), resolvedByUserId: admin.id })
    .where(eq(templateReports.id, id))
    .returning({ templateId: templateReports.templateId });
  if (!rows[0]) throw new HttpError(404, "Signalement introuvable.");
  await audit({ actorUserId: admin.id, actorType: "admin", action: "admin.report.resolve", targetType: "template", targetId: rows[0].templateId });
  return json({ ok: true });
});
