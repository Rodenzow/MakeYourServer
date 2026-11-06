import { json, withUser } from "@/lib/api";
import { projectRevisionsList } from "@/lib/data";
import { requireProjectAccess } from "@/lib/project-access";

/** Historique des versions (50 dernières), avec un aperçu chiffré de chacune. */
export const GET = withUser<{ id: string }>(async (_req, user, { id }) => {
  const { project } = await requireProjectAccess(user.id, id);
  return json({ revisions: await projectRevisionsList(project.id), current: project.revision });
});
