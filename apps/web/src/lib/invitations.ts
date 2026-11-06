import "server-only";
import { and, audit, eq, getDb, projectInvites, projectMembers, projects, sql, users } from "@mys/db";
import { HttpError } from "./api";
import { sha256 } from "./crypto";
import { MAX_PROJECT_MEMBERS, avatarUrl } from "./project-access";

const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;

export type InviteState = "ok" | "invalid" | "expired" | "used" | "owner" | "member" | "full";

/** Invitation vue par la personne connectée : projet, auteur de l’invitation et état. */
export async function describeInvite(token: string, userId: string) {
  if (!TOKEN_RE.test(token)) return { state: "invalid" as const };
  const db = getDb();
  const [row] = await db
    .select({
      invite: projectInvites,
      project: { id: projects.id, name: projects.name, ownerId: projects.userId, accentColor: sql<number | null>`(${projects.spec}->'meta'->>'accentColor')::int` },
    })
    .from(projectInvites)
    .innerJoin(projects, eq(projects.id, projectInvites.projectId))
    .where(eq(projectInvites.tokenHash, sha256(token)));
  if (!row) return { state: "invalid" as const };
  const [inviter] = await db
    .select({ username: users.username, globalName: users.globalName, discordId: users.discordId, avatar: users.avatar })
    .from(users)
    .where(eq(users.id, row.invite.createdByUserId));
  const [membership] = await db
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, row.project.id), eq(projectMembers.userId, userId)));
  const [{ n }] = (await db.select({ n: sql<number>`count(*)::int` }).from(projectMembers).where(eq(projectMembers.projectId, row.project.id))) as [{ n: number }];
  const state: InviteState =
    row.project.ownerId === userId
      ? "owner"
      : membership
        ? "member"
        : row.invite.usedAt
          ? "used"
          : row.invite.expiresAt.getTime() <= Date.now()
            ? "expired"
            : n >= MAX_PROJECT_MEMBERS
              ? "full"
              : "ok";
  return {
    state,
    project: { id: row.project.id, name: row.project.name, accentColor: row.project.accentColor },
    inviter: inviter ? { name: inviter.globalName ?? inviter.username, avatarUrl: avatarUrl(inviter) } : null,
    expiresAt: row.invite.expiresAt,
  };
}

/**
 * Accepte une invitation : ajoute la personne comme co-gestionnaire et consomme
 * le lien (usage unique), dans une transaction verrouillée.
 */
export async function acceptInvite(token: string, userId: string) {
  if (!TOKEN_RE.test(token)) throw new HttpError(404, "Ce lien d’invitation n’existe pas.", "invite_invalid");
  const db = getDb();
  const result = await db.transaction(async (tx) => {
    const [invite] = await tx.select().from(projectInvites).where(eq(projectInvites.tokenHash, sha256(token))).for("update");
    if (!invite) throw new HttpError(404, "Ce lien d’invitation n’existe pas.", "invite_invalid");
    const [project] = await tx.select({ id: projects.id, userId: projects.userId }).from(projects).where(eq(projects.id, invite.projectId));
    if (!project) throw new HttpError(404, "Ce projet n’existe plus.", "invite_invalid");
    if (project.userId === userId) return { projectId: project.id, already: true };
    const [existing] = await tx
      .select({ userId: projectMembers.userId })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, userId)));
    if (existing) return { projectId: project.id, already: true };
    if (invite.usedAt) throw new HttpError(410, "Ce lien a déjà été utilisé. Demandez un nouveau lien à la personne qui vous a invité.", "invite_used");
    if (invite.expiresAt.getTime() <= Date.now()) throw new HttpError(410, "Ce lien a expiré (validité : 7 jours). Demandez un nouveau lien à la personne qui vous a invité.", "invite_expired");
    const [{ n }] = (await tx.select({ n: sql<number>`count(*)::int` }).from(projectMembers).where(eq(projectMembers.projectId, project.id))) as [{ n: number }];
    if (n >= MAX_PROJECT_MEMBERS) throw new HttpError(409, "Ce projet a atteint le nombre maximum de co-gestionnaires.", "members_limit");
    await tx.insert(projectMembers).values({ projectId: project.id, userId, role: "editor", addedByUserId: invite.createdByUserId }).onConflictDoNothing();
    await tx.update(projectInvites).set({ usedAt: new Date(), usedByUserId: userId }).where(eq(projectInvites.id, invite.id));
    return { projectId: project.id, already: false };
  });
  if (!result.already) await audit({ actorUserId: userId, actorType: "user", action: "project.member.join", targetType: "project", targetId: result.projectId });
  return result;
}
