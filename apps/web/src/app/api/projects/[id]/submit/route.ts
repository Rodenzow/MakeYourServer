import { HttpError, json, parseBody, withUser } from "@/lib/api";
import { getOwnedProject } from "@/lib/data";
import { SubmissionBody, submitPublication } from "@/lib/publications";

/**
 * Proposer un projet comme template public : action distincte, volontaire, et
 * soumise à relecture par l’administration avant toute publication.
 */
export const POST = withUser<{ id: string }>(async (req, user, { id }) => {
  const body = await parseBody(req, SubmissionBody);
  const p = await getOwnedProject(user.id, id);
  if (!p) throw new HttpError(404, "Projet introuvable.");
  const t = await submitPublication(user, { spec: p.spec, projectId: p.id }, body);
  return json({ submitted: true, id: t.id }, 201);
});
