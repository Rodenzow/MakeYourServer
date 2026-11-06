import { z } from "zod";
import { and, asc, audit, eq, getDb, gt, isNull, projectInvites, projectMembers } from "@mys/db";
import { HttpError, json, parseBody, withUser } from "@/lib/api";
import { MAX_PROJECT_MEMBERS, listProjectPeople, requireProjectAccess } from "@/lib/project-access";

type P = { id: string };

/** Propriétaire, co-gestionnaires et (pour le propriétaire) liens d’invitation encore valables. */
export const GET = withUser<P>(async (_req, user, { id }) => {
  const { project, role } = await requireProjectAccess(user.id, id);
  const people = await listProjectPeople(project.id);
  const invites =
    role === "owner"
      ? await getDb()
          .select({ id: projectInvites.id, expiresAt: projectInvites.expiresAt, createdAt: projectInvites.createdAt })
          .from(projectInvites)
          .where(and(eq(projectInvites.projectId, project.id), isNull(projectInvites.usedAt), gt(projectInvites.expiresAt, new Date())))
          .orderBy(asc(projectInvites.createdAt))
      : [];
  return json({ role, me: user.id, ...people, invites, maxMembers: MAX_PROJECT_MEMBERS });
});

const Remove = z.object({ userId: z.string().uuid() });

/**
 * Retirer un co-gestionnaire : le propriétaire peut retirer n’importe quel membre,
 * un membre peut se retirer lui-même (« Quitter le projet »).
 */
export const DELETE = withUser<P>(async (req, user, { id }) => {
  const body = await parseBody(req, Remove);
  const { project, role } = await requireProjectAccess(user.id, id);
  if (body.userId === project.userId) throw new HttpError(400, "Le propriétaire ne peut pas être retiré du projet.");
  if (role !== "owner" && body.userId !== user.id) throw new HttpError(403, "Seul le propriétaire peut retirer un autre co-gestionnaire.", "owner_only");
  const removed = await getDb()
    .delete(projectMembers)
    .where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, body.userId)))
    .returning({ userId: projectMembers.userId });
  if (!removed.length) throw new HttpError(404, "Cette personne ne fait pas partie du projet.");
  await audit({ actorUserId: user.id, actorType: "user", action: body.userId === user.id ? "project.member.leave" : "project.member.remove", targetType: "project", targetId: project.id, metadata: { userId: body.userId } });
  return json({ removed: true, left: body.userId === user.id });
});
