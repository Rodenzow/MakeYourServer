import { z } from "zod";
import { and, audit, eq, getDb, inArray, jobs } from "@mys/db";
import { HttpError, json, parseBody, withAdmin } from "@/lib/api";

const Body = z.object({ action: z.enum(["requeue", "cancel"]) });

/** Remise en file d’une tâche échouée, ou annulation d’une tâche en attente. */
export const POST = withAdmin<{ id: string }>(async (req, admin, { id }) => {
  const { action } = await parseBody(req, Body);
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, "Tâche introuvable.");
  const db = getDb();
  const rows =
    action === "requeue"
      ? await db
          .update(jobs)
          .set({ status: "queued", runAt: new Date(), attempts: 0, lastError: null, finishedAt: null, lockedBy: null, lockedUntil: null, updatedAt: new Date() })
          .where(and(eq(jobs.id, id), inArray(jobs.status, ["failed", "cancelled"])))
          .returning({ id: jobs.id, type: jobs.type })
      : await db
          .update(jobs)
          .set({ status: "cancelled", finishedAt: new Date(), updatedAt: new Date() })
          .where(and(eq(jobs.id, id), eq(jobs.status, "queued")))
          .returning({ id: jobs.id, type: jobs.type });
  if (!rows[0]) throw new HttpError(409, action === "requeue" ? "Seule une tâche échouée ou annulée peut être remise en file." : "Seule une tâche en attente peut être annulée (une tâche en cours s’annule depuis l’installation).");
  await audit({ actorUserId: admin.id, actorType: "admin", action: `admin.job.${action}`, targetType: "job", targetId: id, metadata: { type: rows[0].type } });
  return json({ ok: true });
});
