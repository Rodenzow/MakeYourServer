import { DISCORD_CHANNEL_TYPE } from "@mys/core";
import { assertGuildAccess } from "@mys/engine";
import { HttpError, json, withUser } from "@/lib/api";
import { getGateway } from "@/lib/gateway";

/**
 * Salons où un message programmé peut être envoyé (textuels et d’annonces),
 * lus en direct depuis l’état du serveur via le bot, après contrôle des droits.
 */
export const GET = withUser(async (req, user) => {
  const guildId = req.nextUrl.searchParams.get("guildId") ?? "";
  if (!/^\d{17,20}$/.test(guildId)) throw new HttpError(400, "Identifiant de serveur invalide.");
  const gw = getGateway(user.discordId);
  await assertGuildAccess(gw, guildId, user.discordId, "manage");
  const state = await gw.fetchState(guildId);
  const categories = new Map(state.channels.filter((c) => c.type === DISCORD_CHANNEL_TYPE.category).map((c) => [c.id, c]));
  const rank = (parentId: string | null) => (parentId ? (categories.get(parentId)?.position ?? 0) + 1 : 0);
  const channels = state.channels
    .filter((c) => c.type === DISCORD_CHANNEL_TYPE.text || c.type === DISCORD_CHANNEL_TYPE.announcement)
    .sort((a, b) => rank(a.parentId) - rank(b.parentId) || a.position - b.position)
    .map((c) => ({ id: c.id, name: c.name, announcement: c.type === DISCORD_CHANNEL_TYPE.announcement, category: c.parentId ? (categories.get(c.parentId)?.name ?? null) : null }));
  return json({ guild: { id: state.id, name: state.name }, channels });
});
