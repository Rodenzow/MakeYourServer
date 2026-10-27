import { ALL_PERMISSIONS, permissionBit, type GuildState } from "@mys/core";

/** Permissions d’un membre au niveau du serveur (sans les surcharges de salons). */
export function guildPermissionsFor(state: Pick<GuildState, "id" | "ownerId" | "roles">, userId: string, roleIds: string[]): bigint {
  if (userId === state.ownerId) return ALL_PERMISSIONS;
  let perms = 0n;
  const everyone = state.roles.find((r) => r.id === state.id);
  if (everyone) perms |= BigInt(everyone.permissions);
  for (const id of roleIds) {
    const role = state.roles.find((r) => r.id === id);
    if (role) perms |= BigInt(role.permissions);
  }
  if (perms & permissionBit("ADMINISTRATOR")) return ALL_PERMISSIONS;
  return perms;
}

export function highestRolePosition(state: Pick<GuildState, "roles">, roleIds: string[]): number {
  let max = 0;
  for (const id of roleIds) {
    const role = state.roles.find((r) => r.id === id);
    if (role && role.position > max) max = role.position;
  }
  return max;
}

export type AccessLevel = "manage" | "admin";

export const ACCESS_LABELS: Record<AccessLevel, string> = {
  manage: "« Gérer le serveur »",
  admin: "« Administrateur » (ou propriétaire du serveur)",
};

export function hasAccessLevel(perms: bigint, level: AccessLevel): boolean {
  if (perms & permissionBit("ADMINISTRATOR")) return true;
  if (level === "admin") return false;
  return (perms & permissionBit("MANAGE_GUILD")) !== 0n;
}

/** Bits de permissions renvoyés par l’OAuth (`GET /users/@me/guilds`). */
export function oauthGuildManageable(guild: { owner?: boolean; permissions?: string }): boolean {
  if (guild.owner) return true;
  if (!guild.permissions) return false;
  return hasAccessLevel(BigInt(guild.permissions), "manage");
}
