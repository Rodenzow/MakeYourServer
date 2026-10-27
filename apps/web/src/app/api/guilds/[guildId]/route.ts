import { DISCORD_CHANNEL_TYPE } from "@mys/core";
import { assertGuildAccess } from "@mys/engine";
import { HttpError, json, withUser } from "@/lib/api";
import { getGateway } from "@/lib/gateway";

/**
 * Vérification d’un serveur : droits de l’utilisateur ET présence/permissions du bot,
 * contrôlés en direct via le bot. Renvoie aussi la liste des salons (pour choisir
 * les salons dont exporter les messages).
 */
export const GET = withUser<{ guildId: string }>(async (_req, user, { guildId }) => {
  if (!/^\d{17,20}$/.test(guildId)) throw new HttpError(400, "Identifiant de serveur invalide.");
  const gw = getGateway(user.discordId);
  const access = await assertGuildAccess(gw, guildId, user.discordId, "manage");
  const state = await gw.fetchState(guildId);
  return json({
    guild: { id: state.id, name: state.name, iconUrl: state.iconUrl ?? null, community: state.features.includes("COMMUNITY") },
    you: { isOwner: access.isOwner, isAdmin: access.isAdmin },
    bot: state.bot ? { isAdmin: state.bot.isAdmin, permissions: state.bot.permissions } : null,
    counts: { channels: state.channels.filter((c) => c.type !== DISCORD_CHANNEL_TYPE.category).length, roles: state.roles.length - 1 },
    textChannels: state.channels.filter((c) => c.type === 0 || c.type === 5).map((c) => ({ id: c.id, name: c.name })),
  });
});
