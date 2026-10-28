import "server-only";
import { z } from "zod";
import { THEMES, prepareForPublication, slugify, validateSpec, type ServerSpec } from "@mys/core";
import { detectFeatures } from "@mys/core/templates";
import { and, audit, count, desc, eq, getDb, inArray, isNull, templateReports, templates } from "@mys/db";
import { HttpError } from "./api";
import type { CurrentUser } from "./session";

/**
 * Publication communautaire : un membre propose un projet ou une sauvegarde comme
 * template public. Rien n’est visible avant la relecture et l’accord d’un administrateur.
 */

/** Propositions en attente simultanées par membre (limite anti-abus). */
export const MAX_PENDING_PER_USER = 5;

export const SubmissionBody = z.object({
  name: z.string().trim().min(3, "Le nom doit faire au moins 3 caractères.").max(80),
  tagline: z.string().trim().min(10, "L’accroche doit faire au moins 10 caractères.").max(160),
  description: z.string().trim().min(40, "Décrivez le serveur en au moins 40 caractères.").max(1500),
  audience: z.string().trim().min(20, "Précisez à qui s’adresse ce serveur (20 caractères minimum).").max(300),
  theme: z.enum(THEMES),
  /** Afficher le pseudo Discord de l’auteur sur la fiche publique. */
  showAuthor: z.boolean().default(true),
  /** Le contenu respecte les règles de publication et celles de Discord. */
  consentRules: z.literal(true, { error: "Vous devez accepter les règles de publication." }),
  /** L’auteur a le droit de partager cette structure (serveur qu’il gère ou création personnelle). */
  consentRights: z.literal(true, { error: "Vous devez confirmer avoir le droit de partager ce serveur." }),
});
export type Submission = z.infer<typeof SubmissionBody>;

export const STATUS_LABELS: Record<string, string> = {
  pending_review: "En attente de relecture",
  published: "Publié",
  rejected: "Refusé",
  archived: "Retiré",
  draft: "Brouillon",
};

export async function submitPublication(
  user: CurrentUser,
  source: { spec: ServerSpec; projectId?: string; backupId?: string },
  body: Submission,
) {
  const db = getDb();
  const [{ n }] = (await db
    .select({ n: count() })
    .from(templates)
    .where(and(eq(templates.authorUserId, user.id), eq(templates.status, "pending_review")))) as [{ n: number }];
  if (Number(n) >= MAX_PENDING_PER_USER) throw new HttpError(429, `Vous avez déjà ${MAX_PENDING_PER_USER} propositions en attente. Patientez pendant leur relecture.`);

  const sourceCond = source.projectId ? eq(templates.sourceProjectId, source.projectId) : eq(templates.sourceBackupId, source.backupId!);
  const [existing] = await db.select({ id: templates.id }).from(templates).where(and(sourceCond, eq(templates.status, "pending_review")));
  if (existing) throw new HttpError(409, "Cette proposition est déjà en attente de relecture.");

  const spec = prepareForPublication(source.spec, body.name);
  spec.meta.theme = body.theme;
  spec.meta.description = body.tagline;
  const v = validateSpec(spec);
  if (!v.ok) {
    throw new HttpError(
      400,
      source.backupId
        ? `Cette sauvegarde ne peut pas être publiée telle quelle : ${v.errors[0]!.message} Créez un projet à partir de la sauvegarde, corrigez-le dans l’éditeur, puis publiez le projet.`
        : `Corrigez d’abord le projet : ${v.errors[0]!.message}`,
      "validation",
    );
  }

  const [t] = await db
    .insert(templates)
    .values({
      slug: `${slugify(body.name).slice(0, 50) || "serveur"}-${crypto.randomUUID().slice(0, 6)}`,
      name: body.name,
      tagline: body.tagline,
      description: body.description,
      audience: body.audience,
      highlights: [],
      theme: body.theme,
      size: spec.meta.size,
      features: detectFeatures(spec),
      spec,
      status: "pending_review",
      official: false,
      authorUserId: user.id,
      showAuthor: body.showAuthor,
      sourceProjectId: source.projectId ?? null,
      sourceBackupId: source.backupId ?? null,
      submittedAt: new Date(),
    })
    .returning({ id: templates.id });
  await audit({
    actorUserId: user.id,
    actorType: "user",
    action: "template.submit",
    targetType: "template",
    targetId: t!.id,
    metadata: { source: source.projectId ? "project" : "backup" },
  });
  return t!;
}

/** Propositions d’un membre, avec leur statut et leurs statistiques. */
export async function listUserPublications(userId: string) {
  return getDb()
    .select({
      id: templates.id,
      slug: templates.slug,
      name: templates.name,
      tagline: templates.tagline,
      theme: templates.theme,
      status: templates.status,
      reviewNote: templates.reviewNote,
      viewCount: templates.viewCount,
      installCount: templates.installCount,
      submittedAt: templates.submittedAt,
      publishedAt: templates.publishedAt,
      sourceProjectId: templates.sourceProjectId,
      sourceBackupId: templates.sourceBackupId,
      accentColor: templates.spec,
    })
    .from(templates)
    .where(and(eq(templates.authorUserId, userId), eq(templates.official, false)))
    .orderBy(desc(templates.createdAt))
    .then((rows) => rows.map((r) => ({ ...r, accentColor: r.accentColor.meta.accentColor ?? 0x83a8f3 })));
}

/** L’auteur retire sa proposition : supprimée si elle n’a jamais été publiée, sinon retirée de la bibliothèque. */
export async function withdrawPublication(userId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, "Publication introuvable.");
  const db = getDb();
  const [t] = await db.select().from(templates).where(and(eq(templates.id, id), eq(templates.authorUserId, userId), eq(templates.official, false)));
  if (!t) throw new HttpError(404, "Publication introuvable.");
  if (t.status === "published" || t.publishedAt) {
    await db.update(templates).set({ status: "archived", updatedAt: new Date() }).where(eq(templates.id, id));
  } else {
    await db.delete(templates).where(eq(templates.id, id));
  }
  await audit({ actorUserId: userId, actorType: "user", action: "template.withdraw", targetType: "template", targetId: id });
}

export const REPORT_REASONS = {
  inappropriate: "Contenu inapproprié ou contraire aux règles de Discord",
  copyright: "Copie d’un serveur sans l’accord de ses responsables",
  misleading: "Description trompeuse ou template qui ne fonctionne pas",
  other: "Autre raison",
} as const;

/** Nombre de signalements non traités, par template (pour l’administration). */
export async function openReportCounts(templateIds: string[]) {
  if (!templateIds.length) return new Map<string, number>();
  const rows = await getDb()
    .select({ templateId: templateReports.templateId, n: count() })
    .from(templateReports)
    .where(and(inArray(templateReports.templateId, templateIds), isNull(templateReports.resolvedAt)))
    .groupBy(templateReports.templateId);
  return new Map(rows.map((r) => [r.templateId, Number(r.n)]));
}
