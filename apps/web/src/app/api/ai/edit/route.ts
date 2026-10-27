import { json, parseBody, withUser } from "@/lib/api";
import { runEdit } from "@/lib/ai/service";
import { EditRequestSchema } from "@/lib/ai/schemas";

export const maxDuration = 300;

/** Propose des modifications ciblées d’un projet. Rien n’est appliqué tant que l’utilisateur n’accepte pas. */
export const POST = withUser(async (req, user) => {
  const body = await parseBody(req, EditRequestSchema);
  return json(await runEdit(user.id, body));
});
