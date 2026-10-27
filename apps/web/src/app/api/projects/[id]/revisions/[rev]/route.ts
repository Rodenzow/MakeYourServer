import { and, eq, getDb, projectRevisions } from "@mys/db";
import { HttpError, json, withUser } from "@/lib/api";
import { getOwnedProject, saveProject } from "@/lib/data";

/** Revenir à une version précédente : crée une nouvelle révision (rien n’est perdu). */
export const POST = withUser<{ id: string; rev: string }>(async (_req, user, { id, rev }) => {
  const p = await getOwnedProject(user.id, id);
  if (!p) throw new HttpError(404, "Projet introuvable.");
  const [r] = await getDb()
    .select()
    .from(projectRevisions)
    .where(and(eq(projectRevisions.projectId, p.id), eq(projectRevisions.revision, Number(rev))));
  if (!r) throw new HttpError(404, "Version introuvable.");
  const { project } = await saveProject(user.id, p.id, { spec: r.spec, revision: p.revision, note: `Retour à la version ${r.revision}`, author: "user" });
  return json({ revision: project.revision, spec: project.spec });
});
