import { and, audit, eq, getDb, gt, isNull, projectInvites, projectMembers, sql } from "@mys/db";
import { HttpError, json, withUser } from "@/lib/api";
import { randomToken, sha256 } from "@/lib/crypto";
import { env } from "@/lib/env";
import { MAX_PROJECT_MEMBERS, requireProjectAccess } from "@/lib/project-access";

type P = { id: string };

const INVITE_DAYS = 7;
const MAX_ACTIVE_INVITES = 10;

/**
 * Crée un lien d’invitation à co-gérer le projet (propriétaire uniquement).
 * Seul le hachage SHA-256 du jeton est stocké : le lien n’est affiché qu’une fois.
 * Validité 7 jours, usage unique.
 */
export const POST = withUser<P>(async (_req, user, { id }) => {
  const { project } = await requireProjectAccess(user.id, id, { ownerOnly: true });
  const db = getDb();
  const now = new Date();
  const [{ members }] = (await db.select({ members: sql<number>`count(*)::int` }).from(projectMembers).where(eq(projectMembers.projectId, project.id))) as [{ members: number }];
  if (members >= MAX_PROJECT_MEMBERS) throw new HttpError(409, `Ce projet a déjà ${MAX_PROJECT_MEMBERS} co-gestionnaires, le maximum. Retirez quelqu’un pour en inviter un autre.`, "members_limit");
  const [{ active }] = (await db
    .select({ active: sql<number>`count(*)::int` })
    .from(projectInvites)
    .where(and(eq(projectInvites.projectId, project.id), isNull(projectInvites.usedAt), gt(projectInvites.expiresAt, now)))) as [{ active: number }];
  if (active >= MAX_ACTIVE_INVITES) throw new HttpError(429, "Trop de liens d’invitation encore valables. Désactivez les anciens liens avant d’en créer un nouveau.", "invites_limit");
  const token = randomToken(24);
  const expiresAt = new Date(now.getTime() + INVITE_DAYS * 86400_000);
  const [invite] = await db.insert(projectInvites).values({ projectId: project.id, tokenHash: sha256(token), createdByUserId: user.id, expiresAt }).returning({ id: projectInvites.id });
  await audit({ actorUserId: user.id, actorType: "user", action: "project.invite.create", targetType: "project", targetId: project.id, metadata: { inviteId: invite!.id } });
  const path = `/invitation/${token}`;
  return json({ id: invite!.id, path, url: new URL(path, env.appUrl).toString(), expiresAt }, 201);
});

/** Désactive tous les liens d’invitation encore valables (propriétaire uniquement). */
export const DELETE = withUser<P>(async (_req, user, { id }) => {
  const { project } = await requireProjectAccess(user.id, id, { ownerOnly: true });
  const now = new Date();
  const revoked = await getDb()
    .update(projectInvites)
    .set({ expiresAt: now })
    .where(and(eq(projectInvites.projectId, project.id), isNull(projectInvites.usedAt), gt(projectInvites.expiresAt, now)))
    .returning({ id: projectInvites.id });
  await audit({ actorUserId: user.id, actorType: "user", action: "project.invite.revoke", targetType: "project", targetId: project.id, metadata: { count: revoked.length } });
  return json({ revoked: revoked.length });
});
