import { and, eq, getDb, or, projectMembers, projects, sql } from "@mys/db";

export type ProjectRole = "owner" | "editor";
export type ProjectRecord = typeof projects.$inferSelect;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Projet accessible à un utilisateur : son propriétaire, ou un co-gestionnaire
 * (membre « editor »). Les droits Discord de la personne sur un serveur restent
 * vérifiés séparément à chaque installation.
 */
export async function getAccessibleProject(userId: string, projectId: string): Promise<{ project: ProjectRecord; role: ProjectRole } | null> {
  if (!UUID_RE.test(projectId) || !UUID_RE.test(userId)) return null;
  const [row] = await getDb()
    .select({ project: projects, memberRole: projectMembers.role })
    .from(projects)
    .leftJoin(projectMembers, and(eq(projectMembers.projectId, projects.id), eq(projectMembers.userId, userId)))
    .where(and(eq(projects.id, projectId), or(eq(projects.userId, userId), sql`${projectMembers.userId} is not null`)));
  if (!row) return null;
  return { project: row.project, role: row.project.userId === userId ? "owner" : "editor" };
}

/** Condition SQL : projets dont l’utilisateur est propriétaire ou co-gestionnaire. */
export function accessibleProjectsCondition(userId: string) {
  return or(eq(projects.userId, userId), sql`exists (select 1 from ${projectMembers} pm where pm.project_id = ${projects.id} and pm.user_id = ${userId})`)!;
}
