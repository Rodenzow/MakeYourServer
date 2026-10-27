import { z } from "zod";
import { validateSpec, slugify } from "@mys/core";
import { detectFeatures } from "@mys/core/templates";
import { and, audit, eq, getDb, templates } from "@mys/db";
import { HttpError, json, parseBody, withUser } from "@/lib/api";
import { getOwnedProject } from "@/lib/data";

const Body = z.object({
  tagline: z.string().min(10).max(160),
  description: z.string().min(40).max(1500),
  audience: z.string().min(20).max(300),
  /** Confirmation explicite : le contenu deviendra public après relecture. */
  consent: z.literal(true),
});

/**
 * Proposer un projet comme template public : action distincte, volontaire, et
 * soumise à relecture par l’administration avant toute publication.
 */
export const POST = withUser<{ id: string }>(async (req, user, { id }) => {
  const body = await parseBody(req, Body);
  const p = await getOwnedProject(user.id, id);
  if (!p) throw new HttpError(404, "Projet introuvable.");
  if (p.sourceType === "backup") throw new HttpError(400, "Un projet issu d’une sauvegarde privée ne peut pas être proposé tel quel. Repartez d’un template ou d’un projet vierge.");
  const v = validateSpec(p.spec);
  if (!v.ok) throw new HttpError(400, `Corrigez d’abord le projet : ${v.errors[0]!.message}`);
  const db = getDb();
  const [existing] = await db.select().from(templates).where(and(eq(templates.sourceProjectId, p.id), eq(templates.status, "pending_review")));
  if (existing) throw new HttpError(409, "Ce projet est déjà en attente de relecture.");
  const [t] = await db
    .insert(templates)
    .values({
      slug: `${slugify(p.name)}-${p.id.slice(0, 6)}`,
      name: p.name,
      tagline: body.tagline,
      description: body.description,
      audience: body.audience,
      highlights: [],
      theme: p.spec.meta.theme,
      size: p.spec.meta.size,
      features: detectFeatures(p.spec),
      spec: p.spec,
      status: "pending_review",
      official: false,
      authorUserId: user.id,
      sourceProjectId: p.id,
    })
    .returning();
  await audit({ actorUserId: user.id, actorType: "user", action: "template.submit", targetType: "template", targetId: t!.id });
  return json({ submitted: true }, 201);
});
