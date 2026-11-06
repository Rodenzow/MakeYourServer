import { z } from "zod";
import { HttpError, json, withUser } from "@/lib/api";
import { applyTemplateUpdate, dismissTemplateUpdate, previewTemplateUpdate } from "@/lib/template-updates";

type P = { id: string };

/** Aperçu des nouveautés du template d’origine (rien n’est modifié). */
export const GET = withUser<P>(async (_req, user, { id }) => json(await previewTemplateUpdate(user.id, id)));

const Apply = z.object({ revision: z.number().int().min(1).optional() }).default({});

/**
 * Ajoute au projet ce qui manque par rapport au template (nouvelle révision),
 * sans rien supprimer ni écraser. Renvoie la liste des éléments ajoutés.
 */
export const POST = withUser<P>(async (req, user, { id }) => {
  // Corps facultatif : { revision } pour le contrôle de version depuis l’éditeur.
  const text = await req.text().catch(() => "");
  let raw: unknown = {};
  try {
    raw = text.trim() ? JSON.parse(text) : {};
  } catch {
    throw new HttpError(400, "Corps de requête invalide (JSON attendu).");
  }
  const parsed = Apply.safeParse(raw);
  if (!parsed.success) throw new HttpError(400, "Données invalides : revision doit être un nombre entier.", "validation");
  const body = parsed.data;
  const res = await applyTemplateUpdate(user.id, id, body.revision);
  return json({ added: res.added, count: res.count, summary: res.summary, revision: res.revision });
});

/** « Ignorer » : masque l’avis jusqu’à la prochaine amélioration du template. */
export const DELETE = withUser<P>(async (_req, user, { id }) => {
  await dismissTemplateUpdate(user.id, id);
  return json({ dismissed: true });
});
