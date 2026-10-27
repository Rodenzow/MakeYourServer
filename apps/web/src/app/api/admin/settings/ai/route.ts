import { z } from "zod";
import { audit, getSetting, setSetting } from "@mys/db";
import { json, parseBody, withAdmin } from "@/lib/api";

const Body = z.object({
  enabled: z.boolean(),
  model: z.string().trim().min(3).max(100).regex(/^[a-z0-9][a-z0-9._:-]+$/i, "Nom de modèle invalide."),
  inputMicrosPerMTok: z.number().int().min(0).max(1_000_000_000),
  outputMicrosPerMTok: z.number().int().min(0).max(1_000_000_000),
  maxOutputTokens: z.number().int().min(1000).max(200_000),
  monthlyBudgetMicros: z.number().int().min(0).max(1_000_000_000_000),
});

export const PUT = withAdmin(async (req, admin) => {
  const body = await parseBody(req, Body);
  const before = await getSetting("ai");
  await setSetting("ai", body, admin.id);
  await audit({ actorUserId: admin.id, actorType: "admin", action: "admin.settings.ai", metadata: { before, after: body } });
  return json({ ok: true });
});
