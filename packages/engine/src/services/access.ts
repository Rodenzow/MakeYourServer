import { permissionBit } from "@mys/core";
import type { GuildGateway } from "../gateway";
import { ACCESS_LABELS, guildPermissionsFor, hasAccessLevel, type AccessLevel } from "../permissions";

export class AccessDeniedError extends Error {
  readonly status = 403;
  constructor(message: string) {
    super(message);
    this.name = "AccessDeniedError";
  }
}

export class BotMissingError extends Error {
  readonly status = 409;
  constructor(public readonly guildId: string) {
    super("Le bot Make Your Server n’est pas sur ce serveur. Invitez-le, puis réessayez.");
    this.name = "BotMissingError";
  }
}

/**
 * Vérifie, via le bot et au moment de l’opération, que l’utilisateur possède
 * toujours les droits requis sur le serveur. Appelé côté site ET côté Discord,
 * à la préparation puis à l’exécution.
 */
export async function assertGuildAccess(gateway: GuildGateway, guildId: string, userDiscordId: string, level: AccessLevel) {
  let guild;
  try {
    guild = await gateway.fetchGuild(guildId);
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status === 403 || status === 404) throw new BotMissingError(guildId);
    throw e;
  }
  const member = await gateway.getMember(guildId, userDiscordId);
  if (!member) throw new AccessDeniedError("Vous n’êtes pas membre de ce serveur.");
  const perms = guildPermissionsFor(guild, userDiscordId, member.roles);
  if (!hasAccessLevel(perms, level)) {
    throw new AccessDeniedError(`Cette action nécessite la permission ${ACCESS_LABELS[level]} sur « ${guild.name} ».`);
  }
  return { guild, perms, isOwner: guild.ownerId === userDiscordId, isAdmin: (perms & permissionBit("ADMINISTRATOR")) !== 0n };
}
