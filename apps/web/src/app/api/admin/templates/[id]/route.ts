import { z } from "zod";
import { and, audit, eq, getDb, ne, templates } from "@mys/db";
import { validateSpec } from "@mys/core";
import { HttpError, json, parseBody, withAdmin } from "@/lib/api";
import { checkTemplateSpec, TemplateBody } from "../shared";

async function load(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, "Template introuvable.");
  const [t] = await getDb().select().from(templates).where(eq(templates.id, id));
  if (!t) throw new HttpError(404, "Template introuvable.");
  return t;
}

export const PUT = withAdmin<{ id: string }>(async (req, admin, { id }) => {
  const body = await parseBody(req, TemplateBody);
  await load(id);
  const db = getDb();
  const { spec, issues, ok, features } = checkTemplateSpec(body.spec);
  const [clash] = await db.select({ id: templates.id }).from(templates).where(and(eq(templates.slug, body.slug), ne(templates.id, id)));
  if (clash) throw new HttpError(409, "Ce slug est déjà utilisé par un autre template.");
  const [row] = await db
    .update(templates)
    .set({ ...body, spec, features, updatedAt: new Date() })
    .where(eq(templates.id, id))
    .returning({ status: templates.status });
  // Un template publié qui devient invalide est repassé en brouillon : il ne doit pas être installable.
  if (row?.status === "published" && !ok) await db.update(templates).set({ status: "draft" }).where(eq(templates.id, id));
  await audit({ actorUserId: admin.id, actorType: "admin", action: "admin.template.update", targetType: "template", targetId: id, metadata: { slug: body.slug, valid: ok } });
  return json({ ok: true, issues, unpublished: row?.status === "published" && !ok });
});

const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("publish") }),
  z.object({ action: z.literal("archive") }),
  z.object({ action: z.literal("reject"), note: z.string().trim().min(3, "Expliquez le refus à l’auteur.").max(500) }),
  z.object({ action: z.literal("draft") }),
]);

/** Publication : action distincte, explicite et journalisée. */
export const POST = withAdmin<{ id: string }>(async (req, admin, { id }) => {
  const body = await parseBody(req, Action);
  const t = await load(id);
  const db = getDb();
  if (body.action === "publish") {
    const v = validateSpec(t.spec);
    if (!v.ok) throw new HttpError(409, `Publication impossible : ${v.errors.length} erreur(s) de validation (${v.errors[0]?.message}).`);
    await db.update(templates).set({ status: "published", publishedAt: t.publishedAt ?? new Date(), reviewNote: null, reviewedAt: new Date(), reviewedByUserId: admin.id, updatedAt: new Date() }).where(eq(templates.id, id));
  } else if (body.action === "archive") {
    await db.update(templates).set({ status: "archived", updatedAt: new Date() }).where(eq(templates.id, id));
  } else if (body.action === "reject") {
    await db.update(templates).set({ status: "rejected", reviewNote: body.note, reviewedAt: new Date(), reviewedByUserId: admin.id, updatedAt: new Date() }).where(eq(templates.id, id));
  } else {
    await db.update(templates).set({ status: "draft", updatedAt: new Date() }).where(eq(templates.id, id));
  }
  await audit({ actorUserId: admin.id, actorType: "admin", action: `admin.template.${body.action}`, targetType: "template", targetId: id, metadata: { slug: t.slug, ...(body.action === "reject" ? { note: body.note } : {}) } });
  return json({ ok: true });
});

export const DELETE = withAdmin<{ id: string }>(async (_req, admin, { id }) => {
  const t = await load(id);
  if (t.official) throw new HttpError(409, "Un template officiel ne peut pas être supprimé : archivez-le.");
  await getDb().delete(templates).where(eq(templates.id, id));
  await audit({ actorUserId: admin.id, actorType: "admin", action: "admin.template.delete", targetType: "template", targetId: id, metadata: { slug: t.slug } });
  return json({ ok: true });
});
