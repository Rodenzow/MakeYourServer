import { specStats } from "@mys/core";
import { HttpError, json, withUser } from "@/lib/api";
import { getProjectRevision, restoreProjectRevision } from "@/lib/data";
import { requireProjectAccess } from "@/lib/project-access";

type P = { id: string; rev: string };

/** Détail d’une version (identifiant ou numéro) : contenu et statistiques. */
export const GET = withUser<P>(async (_req, user, { id, rev }) => {
  const { project } = await requireProjectAccess(user.id, id);
  const r = await getProjectRevision(project.id, rev);
  if (!r) throw new HttpError(404, "Cette version est introuvable.");
  return json({ revision: { id: r.id, revision: r.revision, author: r.author, note: r.note, createdAt: r.createdAt, stats: specStats(r.spec), spec: r.spec } });
});

/**
 * Revenir à une version précédente (ancien point d’entrée, conservé) : crée une
 * nouvelle révision (rien n’est perdu). Préférez …/restore, qui exige la version affichée.
 */
export const POST = withUser<P>(async (_req, user, { id, rev }) => {
  const { project: p } = await requireProjectAccess(user.id, id);
  const { project } = await restoreProjectRevision(user.id, p.id, rev, p.revision);
  return json({ revision: project.revision, spec: project.spec });
});
