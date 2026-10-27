import { audit } from "@mys/db";
import { purgeExpiredBackups } from "@mys/engine";
import { json, withAdmin } from "@/lib/api";

export const POST = withAdmin(async (_req, admin) => {
  const removed = await purgeExpiredBackups();
  await audit({ actorUserId: admin.id, actorType: "admin", action: "admin.backup.purge", metadata: { removed } });
  return json({ ok: true, removed });
});
