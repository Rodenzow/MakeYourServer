import { z } from "zod";
import { json, parseBody, withUser } from "@/lib/api";
import { applyEdit } from "@/lib/ai/service";

const Body = z.object({ accepted: z.array(z.number().int().min(0)).min(1).max(20), revision: z.number().int().min(1) });

/** Applique les changements acceptés (contrôle de version : 409 si le projet a changé entre-temps). */
export const POST = withUser<{ id: string }>(async (req, user, { id }) => {
  const body = await parseBody(req, Body);
  return json(await applyEdit(user.id, id, body.accepted, body.revision));
});
