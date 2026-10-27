import { and, audit, backupSchedules, eq, getDb } from "@mys/db";
import { HttpError, json, withUser } from "@/lib/api";

export const DELETE = withUser<{ id: string }>(async (_req, user, { id }) => {
  const rows = await getDb()
    .delete(backupSchedules)
    .where(and(eq(backupSchedules.id, id), eq(backupSchedules.userId, user.id)))
    .returning();
  if (!rows.length) throw new HttpError(404, "Programmation introuvable.");
  await audit({ actorUserId: user.id, actorType: "user", action: "schedule.delete", targetType: "schedule", targetId: id });
  return json({ deleted: true });
});
