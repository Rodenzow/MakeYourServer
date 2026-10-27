import { HttpError, json, withUser } from "@/lib/api";
import { getOwnedGeneration } from "@/lib/ai/service";

export const GET = withUser<{ id: string }>(async (_req, user, { id }) => {
  const gen = await getOwnedGeneration(user.id, id);
  if (!gen) throw new HttpError(404, "Génération introuvable.");
  return json({ generation: gen });
});
