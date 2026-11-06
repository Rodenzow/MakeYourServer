import { z } from "zod";
import { audit, eq, getDb, projects } from "@mys/db";
import { validateSpec } from "@mys/core";
import { json, parseBody, withUser } from "@/lib/api";
import { saveProject } from "@/lib/data";
import { requireProjectAccess } from "@/lib/project-access";

type P = { id: string };

export const GET = withUser<P>(async (_req, user, { id }) => {
  const { project, role } = await requireProjectAccess(user.id, id);
  return json({ project, role, validation: validateSpec(project.spec) });
});

const Save = z.object({ spec: z.unknown(), revision: z.number().int(), note: z.string().max(200).optional() });

/** Enregistrement du brouillon (contrôle de version optimiste) : propriétaire ou co-gestionnaire. */
export const PUT = withUser<P>(async (req, user, { id }) => {
  const body = await parseBody(req, Save);
  const { project, validation } = await saveProject(user.id, id, { spec: body.spec, revision: body.revision, note: body.note });
  return json({ revision: project.revision, status: project.status, validation, updatedAt: project.updatedAt });
});

/** Suppression : réservée au propriétaire. */
export const DELETE = withUser<P>(async (_req, user, { id }) => {
  const { project } = await requireProjectAccess(user.id, id, { ownerOnly: true });
  await getDb().delete(projects).where(eq(projects.id, project.id));
  await audit({ actorUserId: user.id, actorType: "user", action: "project.delete", targetType: "project", targetId: project.id });
  return json({ deleted: true });
});
