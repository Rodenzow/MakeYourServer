import { z } from "zod";
import { audit, eq, getDb, templates } from "@mys/db";
import { HttpError, json, parseBody, withAdmin } from "@/lib/api";
import { checkTemplateSpec, TemplateBody } from "./shared";

const Body = z.union([z.object({ duplicateOf: z.string().uuid() }), TemplateBody]);

/** Création d’un template (toujours en brouillon) ou duplication d’un template existant. */
export const POST = withAdmin(async (req, admin) => {
  const body = await parseBody(req, Body);
  const db = getDb();
  if ("duplicateOf" in body) {
    const [src] = await db.select().from(templates).where(eq(templates.id, body.duplicateOf));
    if (!src) throw new HttpError(404, "Template source introuvable.");
    let slug = `${src.slug}-copie`.slice(0, 60);
    for (let i = 2; (await db.select({ id: templates.id }).from(templates).where(eq(templates.slug, slug))).length; i++) slug = `${src.slug.slice(0, 54)}-copie${i}`;
    const [row] = await db
      .insert(templates)
      .values({ slug, name: `${src.name} (copie)`.slice(0, 100), tagline: src.tagline, description: src.description, audience: src.audience, highlights: src.highlights, theme: src.theme, size: src.size, features: src.features, spec: src.spec, status: "draft", official: false, authorUserId: admin.id })
      .returning({ id: templates.id });
    await audit({ actorUserId: admin.id, actorType: "admin", action: "admin.template.duplicate", targetType: "template", targetId: row!.id, metadata: { from: src.id } });
    return json({ id: row!.id, issues: [] });
  }
  const { spec, issues, features } = checkTemplateSpec(body.spec);
  const [exists] = await db.select({ id: templates.id }).from(templates).where(eq(templates.slug, body.slug));
  if (exists) throw new HttpError(409, "Ce slug est déjà utilisé par un autre template.");
  const [row] = await db
    .insert(templates)
    .values({ ...body, spec, features, status: "draft", authorUserId: admin.id })
    .returning({ id: templates.id });
  await audit({ actorUserId: admin.id, actorType: "admin", action: "admin.template.create", targetType: "template", targetId: row!.id, metadata: { slug: body.slug } });
  return json({ id: row!.id, issues });
});
