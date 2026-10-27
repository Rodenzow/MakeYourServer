import { audit, backups, eq, getDb } from "@mys/db";
import { HttpError, json, withAdmin } from "@/lib/api";

/** Suppression d’une sauvegarde par l’administration (abus, demande de l’utilisateur). */
export const DELETE = withAdmin<{ id: string }>(async (_req, admin, { id }) => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, "Sauvegarde introuvable.");
  const rows = await getDb().delete(backups).where(eq(backups.id, id)).returning({ guildId: backups.guildId, userId: backups.userId });
  if (!rows[0]) throw new HttpError(404, "Sauvegarde introuvable.");
  await audit({ actorUserId: admin.id, actorType: "admin", action: "admin.backup.delete", targetType: "backup", targetId: id, guildId: rows[0].guildId, metadata: { owner: rows[0].userId } });
  return json({ ok: true });
});
