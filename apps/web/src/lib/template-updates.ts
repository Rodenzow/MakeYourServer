import "server-only";
import { countAdditions, describeAdditions, mergeTemplateAdditions, type ServerSpec } from "@mys/core";
import { accessibleProjectsCondition } from "@mys/engine";
import { and, asc, audit, desc, eq, getDb, isNotNull, projectRevisions, projects, sql, templates } from "@mys/db";
import { HttpError } from "./api";
import { saveProject } from "./data";
import { requireProjectAccess } from "./project-access";

/**
 * Avis de mise à jour de template : un projet créé depuis un template est
 * prévenu quand le CONTENU de ce template a été modifié après sa création
 * (`templates.specUpdatedAt`). L’avis disparaît quand les nouveautés ont été
 * appliquées (révision « Nouveautés du template… ») ou ignorées (journal).
 */
export const UPDATE_NOTE_PREFIX = "Nouveautés du template";
const DISMISS_ACTION = "project.template_update.dismiss";

/** Date du dernier traitement (application ou refus) des nouveautés pour un projet. */
const lastHandledAt = sql<Date | null>`greatest(
  (select max(r.created_at) from ${projectRevisions} r where r.project_id = ${projects.id} and r.note like ${`${UPDATE_NOTE_PREFIX}%`}),
  (select max(a.created_at) from audit_logs a where a.action = ${DISMISS_ACTION} and a.target_type = 'project' and a.target_id = ${projects.id}::text)
)`;

const pendingCondition = and(
  isNotNull(templates.specUpdatedAt),
  eq(templates.status, "published"),
  sql`${templates.specUpdatedAt} > ${projects.createdAt}`,
  sql`(${lastHandledAt} is null or ${templates.specUpdatedAt} > ${lastHandledAt})`,
);

export interface TemplateUpdateNotice {
  projectId: string;
  projectName: string;
  templateName: string;
  templateSlug: string;
  updatedAt: Date;
  /** Résumé des ajouts possibles (« 2 rôles et 1 salon »). */
  summary: string;
  count: number;
}

/** Versions du template déjà proposées : le projet à sa création, puis après la dernière mise à jour appliquée. */
async function offeredBases(projectId: string): Promise<ServerSpec[]> {
  const db = getDb();
  const [first] = await db.select({ spec: projectRevisions.spec }).from(projectRevisions).where(eq(projectRevisions.projectId, projectId)).orderBy(asc(projectRevisions.revision)).limit(1);
  const [lastApplied] = await db
    .select({ spec: projectRevisions.spec })
    .from(projectRevisions)
    .where(and(eq(projectRevisions.projectId, projectId), sql`${projectRevisions.note} like ${`${UPDATE_NOTE_PREFIX}%`}`))
    .orderBy(desc(projectRevisions.revision))
    .limit(1);
  return [first?.spec, lastApplied?.spec].filter(Boolean) as ServerSpec[];
}

/**
 * Projets (possédés ou partagés) dont le template d’origine a été amélioré ET
 * qui ont réellement quelque chose à recevoir (pas d’avis « vide »).
 */
export async function listTemplateUpdateNotices(userId: string): Promise<TemplateUpdateNotice[]> {
  const rows = await getDb()
    .select({
      projectId: projects.id,
      projectName: projects.name,
      projectSpec: projects.spec,
      templateName: templates.name,
      templateSlug: templates.slug,
      templateSpec: templates.spec,
      updatedAt: templates.specUpdatedAt,
    })
    .from(projects)
    .innerJoin(templates, eq(templates.id, projects.sourceTemplateId))
    .where(and(accessibleProjectsCondition(userId), pendingCondition))
    .orderBy(desc(templates.specUpdatedAt))
    .limit(10);
  const notices: TemplateUpdateNotice[] = [];
  for (const r of rows) {
    const { added } = mergeTemplateAdditions(r.projectSpec, r.templateSpec, { base: await offeredBases(r.projectId) });
    const count = countAdditions(added);
    if (count === 0) continue;
    notices.push({ projectId: r.projectId, projectName: r.projectName, templateName: r.templateName, templateSlug: r.templateSlug, updatedAt: r.updatedAt!, summary: describeAdditions(added), count });
  }
  return notices;
}

async function loadUpdate(userId: string, projectId: string) {
  const { project } = await requireProjectAccess(userId, projectId);
  if (!project.sourceTemplateId) throw new HttpError(404, "Ce projet n’a pas été créé à partir d’un template.");
  const db = getDb();
  const [t] = await db
    .select({ id: templates.id, name: templates.name, slug: templates.slug, spec: templates.spec, specUpdatedAt: templates.specUpdatedAt, status: templates.status })
    .from(templates)
    .where(eq(templates.id, project.sourceTemplateId));
  if (!t || t.status !== "published") throw new HttpError(404, "Le template d’origine n’est plus disponible.");
  const [pending] = await db
    .select({ id: projects.id })
    .from(projects)
    .innerJoin(templates, eq(templates.id, projects.sourceTemplateId))
    .where(and(eq(projects.id, project.id), pendingCondition));
  const merge = mergeTemplateAdditions(project.spec, t.spec, { base: await offeredBases(project.id) });
  return { project, template: t, merge, pending: !!pending };
}

/** Aperçu des nouveautés (rien n’est enregistré). */
export async function previewTemplateUpdate(userId: string, projectId: string) {
  const { template, merge, pending } = await loadUpdate(userId, projectId);
  return {
    template: { name: template.name, slug: template.slug, updatedAt: template.specUpdatedAt },
    pending,
    added: merge.added,
    count: countAdditions(merge.added),
    summary: describeAdditions(merge.added),
  };
}

/** Ajoute les nouveautés au projet (nouvelle révision) et retourne la liste des ajouts. */
export async function applyTemplateUpdate(userId: string, projectId: string, expectedRevision?: number) {
  const { project, template, merge } = await loadUpdate(userId, projectId);
  const count = countAdditions(merge.added);
  if (count === 0) {
    // Rien de nouveau pour ce projet : on considère l’avis comme traité.
    await audit({ actorUserId: userId, actorType: "user", action: DISMISS_ACTION, targetType: "project", targetId: project.id, metadata: { reason: "nothing_new" } });
    return { added: merge.added, count, summary: describeAdditions(merge.added), revision: project.revision, spec: project.spec };
  }
  const summary = describeAdditions(merge.added);
  const { project: saved, validation } = await saveProject(userId, project.id, {
    spec: merge.spec,
    revision: expectedRevision ?? project.revision,
    note: `${UPDATE_NOTE_PREFIX} « ${template.name} » : ${summary}`.slice(0, 300),
    author: "user",
  });
  await audit({ actorUserId: userId, actorType: "user", action: "project.template_update.apply", targetType: "project", targetId: project.id, metadata: { templateId: template.id, count } });
  return { added: merge.added, count, summary, revision: saved.revision, spec: saved.spec, validation };
}

export async function dismissTemplateUpdate(userId: string, projectId: string) {
  const { project } = await requireProjectAccess(userId, projectId);
  await audit({ actorUserId: userId, actorType: "user", action: DISMISS_ACTION, targetType: "project", targetId: project.id });
}
