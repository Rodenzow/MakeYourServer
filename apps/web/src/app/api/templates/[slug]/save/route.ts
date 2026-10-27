import { and, eq, getDb, savedTemplates } from "@mys/db";
import { HttpError, json, withUser } from "@/lib/api";
import { getPublishedTemplate } from "@/lib/data";

/** Enregistrer / retirer un template de ses favoris. */
export const POST = withUser<{ slug: string }>(async (_req, user, { slug }) => {
  const t = await getPublishedTemplate(slug);
  if (!t) throw new HttpError(404, "Template introuvable.");
  await getDb().insert(savedTemplates).values({ userId: user.id, templateId: t.id }).onConflictDoNothing();
  return json({ saved: true });
});

export const DELETE = withUser<{ slug: string }>(async (_req, user, { slug }) => {
  const t = await getPublishedTemplate(slug);
  if (!t) throw new HttpError(404, "Template introuvable.");
  await getDb()
    .delete(savedTemplates)
    .where(and(eq(savedTemplates.userId, user.id), eq(savedTemplates.templateId, t.id)));
  return json({ saved: false });
});
