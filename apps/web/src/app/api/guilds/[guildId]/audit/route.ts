import { latestServerAudit, runServerAudit } from "@mys/engine";
import { HttpError, json, withUser } from "@/lib/api";
import { getGateway } from "@/lib/gateway";

const GUILD_ID_RE = /^\d{17,20}$/;

/** Dernière analyse « Santé du serveur » enregistrée pour ce serveur (null si aucune). */
export const GET = withUser<{ guildId: string }>(async (_req, user, { guildId }) => {
  if (!GUILD_ID_RE.test(guildId)) throw new HttpError(400, "Identifiant de serveur invalide.");
  const audit = await latestServerAudit(user.id, guildId);
  return json({ audit });
});

/** Nouvelle analyse : droits revérifiés via le bot, état lu en direct, aucune modification. */
export const POST = withUser<{ guildId: string }>(async (_req, user, { guildId }) => {
  if (!GUILD_ID_RE.test(guildId)) throw new HttpError(400, "Identifiant de serveur invalide.");
  const audit = await runServerAudit(getGateway(user.discordId), { userId: user.id, guildId });
  return json({ audit }, 201);
});
