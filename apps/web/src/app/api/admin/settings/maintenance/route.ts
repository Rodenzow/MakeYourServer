import { z } from "zod";
import { audit, setSetting } from "@mys/db";
import { json, parseBody, withAdmin } from "@/lib/api";

const Body = z.object({ enabled: z.boolean(), blockInstalls: z.boolean(), message: z.string().trim().max(300) });

export const PUT = withAdmin(async (req, admin) => {
  const body = await parseBody(req, Body);
  await setSetting("maintenance", { ...body, message: body.message || "Maintenance en cours, merci de réessayer dans quelques minutes." }, admin.id);
  await audit({ actorUserId: admin.id, actorType: "admin", action: "admin.settings.maintenance", metadata: body });
  return json({ ok: true });
});
