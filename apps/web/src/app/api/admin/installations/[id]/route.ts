import { audit, eq, getDb, installations } from "@mys/db";
import { retryInstallation } from "@mys/engine";
import { HttpError, json, withAdmin } from "@/lib/api";

/** Relance d’une installation partielle ou échouée (seules les étapes en échec sont rejouées). */
export const POST = withAdmin<{ id: string }>(async (_req, admin, { id }) => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, "Installation introuvable.");
  const [inst] = await getDb().select({ userId: installations.userId, guildId: installations.guildId }).from(installations).where(eq(installations.id, id));
  if (!inst) throw new HttpError(404, "Installation introuvable.");
  await retryInstallation(id, inst.userId);
  await audit({ actorUserId: admin.id, actorType: "admin", action: "admin.installation.retry", targetType: "installation", targetId: id, guildId: inst.guildId });
  return json({ ok: true });
});
