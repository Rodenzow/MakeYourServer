import { z } from "zod";
import { and, audit, backups, eq, getDb } from "@mys/db";
import { deleteBackup, getOwnedBackup } from "@mys/engine";
import { HttpError, json, parseBody, withUser } from "@/lib/api";

export const DELETE = withUser<{ id: string }>(async (_req, user, { id }) => {
  const ok = await deleteBackup(user.id, id);
  if (!ok) throw new HttpError(404, "Sauvegarde introuvable.");
  return json({ deleted: true });
});

export const PATCH = withUser<{ id: string }>(async (req, user, { id }) => {
  const body = await parseBody(req, z.object({ label: z.string().min(1).max(80) }));
  const b = await getOwnedBackup(user.id, id);
  if (!b) throw new HttpError(404, "Sauvegarde introuvable.");
  await getDb().update(backups).set({ label: body.label }).where(and(eq(backups.id, id), eq(backups.userId, user.id)));
  await audit({ actorUserId: user.id, actorType: "user", action: "backup.rename", targetType: "backup", targetId: id });
  return json({ ok: true });
});
