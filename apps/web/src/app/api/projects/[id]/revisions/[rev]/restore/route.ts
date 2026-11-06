import { z } from "zod";
import { audit } from "@mys/db";
import { json, parseBody, withUser } from "@/lib/api";
import { restoreProjectRevision } from "@/lib/data";
import { requireProjectAccess } from "@/lib/project-access";

const Body = z.object({ revision: z.number().int().min(1) });

/**
 * Restaure une version (identifiant ou numéro) : crée une nouvelle révision
 * « Restauration de la version N ». `revision` est la version actuellement
 * affichée dans l’éditeur (409 si le projet a changé entre-temps).
 */
export const POST = withUser<{ id: string; rev: string }>(async (req, user, { id, rev }) => {
  const body = await parseBody(req, Body);
  const { project: p } = await requireProjectAccess(user.id, id);
  const { project, validation } = await restoreProjectRevision(user.id, p.id, rev, body.revision);
  await audit({ actorUserId: user.id, actorType: "user", action: "project.revision.restore", targetType: "project", targetId: p.id, metadata: { from: rev, revision: project.revision } });
  return json({ revision: project.revision, spec: project.spec, validation });
});
