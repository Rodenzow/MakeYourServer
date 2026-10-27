import { z } from "zod";
import { audit, eq, getDb, projects } from "@mys/db";
import { validateSpec } from "@mys/core";
import { HttpError, json, parseBody, withUser } from "@/lib/api";
import { getOwnedProject, saveProject } from "@/lib/data";

type P = { id: string };

export const GET = withUser<P>(async (_req, user, { id }) => {
  const p = await getOwnedProject(user.id, id);
  if (!p) throw new HttpError(404, "Projet introuvable.");
  return json({ project: p, validation: validateSpec(p.spec) });
});

const Save = z.object({ spec: z.unknown(), revision: z.number().int(), note: z.string().max(200).optional() });

/** Enregistrement du brouillon (contrôle de version optimiste). */
export const PUT = withUser<P>(async (req, user, { id }) => {
  const body = await parseBody(req, Save);
  const { project, validation } = await saveProject(user.id, id, { spec: body.spec, revision: body.revision, note: body.note });
  return json({ revision: project.revision, status: project.status, validation, updatedAt: project.updatedAt });
});

export const DELETE = withUser<P>(async (_req, user, { id }) => {
  const p = await getOwnedProject(user.id, id);
  if (!p) throw new HttpError(404, "Projet introuvable.");
  await getDb().delete(projects).where(eq(projects.id, p.id));
  await audit({ actorUserId: user.id, actorType: "user", action: "project.delete", targetType: "project", targetId: p.id });
  return json({ deleted: true });
});
