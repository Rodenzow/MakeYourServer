import "server-only";
import { asc, eq, getDb, projectMembers, projects, users } from "@mys/db";
import { getAccessibleProject as engineGetAccessibleProject, type ProjectRole } from "@mys/engine";
import { HttpError } from "./api";

export type { ProjectRole };

/** Nombre maximum de co-gestionnaires par projet (en plus du propriétaire). */
export const MAX_PROJECT_MEMBERS = 10;

/**
 * Projet accessible : propriétaire ou co-gestionnaire.
 * Retourne `null` si l’utilisateur n’y a pas accès (ou si l’identifiant est invalide).
 */
export async function getAccessibleProject(userId: string, projectId: string) {
  return engineGetAccessibleProject(userId, projectId);
}

/**
 * Variante qui lève une erreur HTTP : 404 si le projet est inaccessible (on ne
 * révèle pas son existence), 403 si l’action est réservée au propriétaire.
 */
export async function requireProjectAccess(userId: string, projectId: string, opts: { ownerOnly?: boolean } = {}) {
  const access = await getAccessibleProject(userId, projectId);
  if (!access) throw new HttpError(404, "Projet introuvable.");
  if (opts.ownerOnly && access.role !== "owner") throw new HttpError(403, "Seul le propriétaire du projet peut faire cela.", "owner_only");
  return access;
}

export const avatarUrl = (u: { discordId: string; avatar: string | null }) =>
  u.avatar ? `https://cdn.discordapp.com/avatars/${u.discordId}/${u.avatar}.png?size=64` : null;

const publicUser = (u: { id: string; username: string; globalName: string | null; discordId: string; avatar: string | null }) => ({
  id: u.id,
  name: u.globalName ?? u.username,
  username: u.username,
  avatarUrl: avatarUrl(u),
});
export type PublicUser = ReturnType<typeof publicUser>;

/** Propriétaire et co-gestionnaires d’un projet. */
export async function listProjectPeople(projectId: string) {
  const db = getDb();
  const [ownerRow] = await db
    .select({ id: users.id, username: users.username, globalName: users.globalName, discordId: users.discordId, avatar: users.avatar })
    .from(projects)
    .innerJoin(users, eq(users.id, projects.userId))
    .where(eq(projects.id, projectId));
  const memberRows = await db
    .select({ id: users.id, username: users.username, globalName: users.globalName, discordId: users.discordId, avatar: users.avatar, role: projectMembers.role, createdAt: projectMembers.createdAt })
    .from(projectMembers)
    .innerJoin(users, eq(users.id, projectMembers.userId))
    .where(eq(projectMembers.projectId, projectId))
    .orderBy(asc(projectMembers.createdAt));
  return {
    owner: ownerRow ? publicUser(ownerRow) : null,
    members: memberRows.map((m) => ({ ...publicUser(m), role: m.role, addedAt: m.createdAt })),
  };
}
