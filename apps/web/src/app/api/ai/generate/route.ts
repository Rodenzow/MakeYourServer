import { json, parseBody, withUser } from "@/lib/api";
import { runCreation } from "@/lib/ai/service";
import { CreateRequestSchema } from "@/lib/ai/schemas";
import { specStats } from "@mys/core";

export const maxDuration = 300;

/** Conception d’un serveur complet par l’IA (Premium). Ne crée pas de projet : l’utilisateur prévisualise d’abord. */
export const POST = withUser(async (req, user) => {
  const body = await parseBody(req, CreateRequestSchema);
  const res = await runCreation(user.id, body);
  return json({
    generationId: res.generationId,
    spec: res.spec,
    stats: specStats(res.spec),
    warnings: res.validation.warnings.map((w) => w.message),
    simulated: res.simulated,
  });
});
