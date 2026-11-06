import { json, parseBody, withUser } from "@/lib/api";
import { requireProjectAccess } from "@/lib/project-access";
import { SubmissionBody, submitPublication } from "@/lib/publications";

/**
 * Proposer un projet comme template public : action distincte, volontaire, et
 * soumise à relecture par l’administration avant toute publication. Ouverte au
 * propriétaire et aux co-gestionnaires du projet.
 */
export const POST = withUser<{ id: string }>(async (req, user, { id }) => {
  const body = await parseBody(req, SubmissionBody);
  const { project: p } = await requireProjectAccess(user.id, id);
  const t = await submitPublication(user, { spec: p.spec, projectId: p.id }, body);
  return json({ submitted: true, id: t.id }, 201);
});
