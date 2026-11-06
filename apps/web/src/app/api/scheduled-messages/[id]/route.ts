import { z } from "zod";
import { deleteScheduledMessage, getOwnedScheduledMessage, setScheduledMessagePaused, updateScheduledMessage } from "@mys/engine";
import { HttpError, json, parseBody, withUser } from "@/lib/api";
import { getGateway } from "@/lib/gateway";
import { ScheduledMessageBody, toClient, toInput, translate } from "@/lib/scheduled-messages";

const checkId = (id: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, "Message programmé introuvable.", "not_found");
  return id;
};

export const GET = withUser<{ id: string }>(async (_req, user, { id }) => {
  const row = await getOwnedScheduledMessage(user.id, checkId(id));
  if (!row) throw new HttpError(404, "Message programmé introuvable.", "not_found");
  return json({ message: toClient(row) });
});

/** Modification complète (droits « Gérer le serveur » et salon revérifiés). */
export const PUT = withUser<{ id: string }>(async (req, user, { id }) => {
  const body = await parseBody(req, ScheduledMessageBody);
  const row = await translate(() => updateScheduledMessage(getGateway(user.discordId), user, checkId(id), toInput(body)));
  return json({ message: toClient(row) });
});

const Action = z.object({ action: z.enum(["pause", "resume"]) });

/** Pause ou reprise (la reprise revérifie les droits et le quota). */
export const POST = withUser<{ id: string }>(async (req, user, { id }) => {
  const { action } = await parseBody(req, Action);
  const row = await translate(() => setScheduledMessagePaused(getGateway(user.discordId), user, checkId(id), action === "pause"));
  return json({ message: toClient(row) });
});

/** Suppression : toujours possible pour le créateur. */
export const DELETE = withUser<{ id: string }>(async (_req, user, { id }) => {
  if (!(await deleteScheduledMessage(user.id, checkId(id)))) throw new HttpError(404, "Message programmé introuvable.", "not_found");
  return json({ deleted: true });
});
