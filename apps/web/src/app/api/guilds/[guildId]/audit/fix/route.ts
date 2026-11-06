import { z } from "zod";
import { AUDIT_FIX_IDS } from "@mys/core";
import { AuditFixError, prepareAuditFixes, saveAuditFixMapping } from "@mys/engine";
import { HttpError, json, parseBody, withUser } from "@/lib/api";
import { createProject } from "@/lib/data";
import { getGateway } from "@/lib/gateway";

const Body = z.object({
  fixIds: z.array(z.enum(AUDIT_FIX_IDS)).min(1, "Sélectionnez au moins un correctif.").max(AUDIT_FIX_IDS.length),
});

/**
 * Prépare les correctifs choisis sous forme de projet « Correctifs — <serveur> ».
 * Rien n’est modifié sur Discord ici : l’utilisateur installe ensuite ce projet
 * en mode fusion via l’assistant (analyse, sauvegarde de sécurité, confirmation).
 */
export const POST = withUser<{ guildId: string }>(async (req, user, { guildId }) => {
  if (!/^\d{17,20}$/.test(guildId)) throw new HttpError(400, "Identifiant de serveur invalide.");
  const body = await parseBody(req, Body);
  let prepared;
  try {
    prepared = await prepareAuditFixes(getGateway(user.discordId), { userId: user.id, guildId, fixIds: body.fixIds });
  } catch (e) {
    if (e instanceof AuditFixError) throw new HttpError(422, e.message, "audit_fix");
    throw e;
  }
  const name = `Correctifs — ${prepared.state.name}`.slice(0, 100);
  const project = await createProject(user.id, { name, spec: prepared.spec, sourceType: "audit" });
  await saveAuditFixMapping(guildId, project.id, prepared.mapping);
  return json({ projectId: project.id, applied: prepared.applied }, 201);
});
