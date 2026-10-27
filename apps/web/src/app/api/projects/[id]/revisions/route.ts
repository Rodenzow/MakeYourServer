import { HttpError, json, withUser } from "@/lib/api";
import { getOwnedProject, projectRevisionsList } from "@/lib/data";

export const GET = withUser<{ id: string }>(async (_req, user, { id }) => {
  const p = await getOwnedProject(user.id, id);
  if (!p) throw new HttpError(404, "Projet introuvable.");
  return json({ revisions: await projectRevisionsList(p.id) });
});
