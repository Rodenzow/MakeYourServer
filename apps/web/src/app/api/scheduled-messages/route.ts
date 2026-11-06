import { createScheduledMessage, listScheduledMessages } from "@mys/engine";
import { json, parseBody, withUser } from "@/lib/api";
import { getGateway } from "@/lib/gateway";
import { ScheduledMessageBody, toClient, toInput, translate } from "@/lib/scheduled-messages";

/** Messages programmés de l’utilisateur (tous serveurs). */
export const GET = withUser(async (_req, user) => {
  const rows = await listScheduledMessages(user.id);
  return json({ messages: rows.map(toClient) });
});

/** Création (Premium) : droits « Gérer le serveur » vérifiés via le bot, quota de l’offre. */
export const POST = withUser(async (req, user) => {
  const body = await parseBody(req, ScheduledMessageBody);
  const row = await translate(() => createScheduledMessage(getGateway(user.discordId), user, toInput(body)));
  return json({ message: toClient(row) }, 201);
});
