import { ALL_PERMISSIONS, fromBitfield, permissionBit, toBitfield, type PermissionKey } from "./permissions";
import { EVERYONE, type Category, type Channel, type Overwrite, type ServerSpec } from "./schema";
import { allChannels } from "./spec-utils";

/**
 * Simulation des permissions effectives selon l’algorithme documenté par Discord
 * (permissions de base → surcharges @everyone → surcharges de rôles cumulées).
 *
 * Portée de la simulation : elle ne prend en compte que les rôles du projet.
 * Elle ignore les surcharges propres à un membre, les rôles déjà présents sur le
 * serveur, les rôles d’intégration, le propriétaire du serveur (qui a tous les
 * droits) et les exclusions temporaires.
 */
export const SIMULATION_SCOPE_NOTE =
  "Simulation basée uniquement sur les rôles et permissions de ce projet. Elle ne tient pas compte des permissions propres à un membre, des rôles déjà présents sur le serveur, des rôles d’applications, du propriétaire du serveur (qui a toujours tous les droits) ni des exclusions temporaires.";

function overwritesFor(channel: Channel, category: Category | null): Overwrite[] {
  if (channel.syncPermissions && category) return category.overwrites;
  return channel.overwrites;
}

export function basePermissions(spec: ServerSpec, roleIds: readonly string[]): bigint {
  let perms = toBitfield(spec.everyone.permissions);
  for (const id of roleIds) {
    const role = spec.roles.find((r) => r.id === id);
    if (role) perms |= toBitfield(role.permissions);
  }
  if (perms & permissionBit("ADMINISTRATOR")) return ALL_PERMISSIONS;
  return perms;
}

export function applyOverwrites(base: bigint, overwrites: readonly Overwrite[], roleIds: readonly string[]): bigint {
  if (base & permissionBit("ADMINISTRATOR")) return ALL_PERMISSIONS;
  let perms = base;
  const everyone = overwrites.find((o) => o.target === EVERYONE);
  if (everyone) {
    perms &= ~toBitfield(everyone.deny);
    perms |= toBitfield(everyone.allow);
  }
  let allow = 0n;
  let deny = 0n;
  for (const o of overwrites) {
    if (o.target !== EVERYONE && roleIds.includes(o.target)) {
      allow |= toBitfield(o.allow);
      deny |= toBitfield(o.deny);
    }
  }
  perms &= ~deny;
  perms |= allow;
  return perms;
}

/** Permissions implicitement retirées par Discord (ex. sans « Voir le salon », aucun accès). */
function applyImplicit(perms: bigint, type: Channel["type"] | "category"): bigint {
  if (perms === ALL_PERMISSIONS) return perms;
  if (!(perms & permissionBit("VIEW_CHANNEL"))) return 0n;
  const textLike = type === "text" || type === "announcement" || type === "forum";
  if (textLike && !(perms & permissionBit("SEND_MESSAGES"))) {
    for (const k of ["SEND_TTS_MESSAGES", "MENTION_EVERYONE", "EMBED_LINKS", "ATTACH_FILES"] as const) perms &= ~permissionBit(k);
  }
  if ((type === "voice" || type === "stage") && !(perms & permissionBit("CONNECT"))) {
    for (const k of ["SPEAK", "STREAM", "MUTE_MEMBERS", "DEAFEN_MEMBERS", "MOVE_MEMBERS", "USE_VAD", "PRIORITY_SPEAKER", "USE_SOUNDBOARD", "REQUEST_TO_SPEAK"] as const)
      perms &= ~permissionBit(k);
  }
  return perms;
}

export function channelPermissions(
  spec: ServerSpec,
  roleIds: readonly string[],
  channel: Channel,
  category: Category | null,
): bigint {
  const base = basePermissions(spec, roleIds);
  return applyImplicit(applyOverwrites(base, overwritesFor(channel, category), roleIds), channel.type);
}

export function categoryPermissions(spec: ServerSpec, roleIds: readonly string[], category: Category): bigint {
  const base = basePermissions(spec, roleIds);
  return applyImplicit(applyOverwrites(base, category.overwrites, roleIds), "category");
}

export type AccessLevel = "hidden" | "read" | "write" | "manage";

export interface ChannelAccess {
  channelId: string;
  level: AccessLevel;
  canView: boolean;
  canSend: boolean;
  canReadHistory: boolean;
  canConnect: boolean;
  canSpeak: boolean;
  canManage: boolean;
  permissions: PermissionKey[];
}

export function channelAccess(spec: ServerSpec, roleIds: readonly string[], channel: Channel, category: Category | null): ChannelAccess {
  const p = channelPermissions(spec, roleIds, channel, category);
  const has = (k: PermissionKey) => (p & permissionBit(k)) !== 0n;
  const voice = channel.type === "voice" || channel.type === "stage";
  const canView = has("VIEW_CHANNEL");
  const canSend = voice ? has("CONNECT") && has("SPEAK") : channel.type === "forum" ? has("SEND_MESSAGES") : has("SEND_MESSAGES");
  const canManage = has("MANAGE_CHANNELS") || has("MANAGE_MESSAGES");
  return {
    channelId: channel.id,
    level: !canView ? "hidden" : canManage ? "manage" : canSend ? "write" : "read",
    canView,
    canSend: canView && canSend,
    canReadHistory: has("READ_MESSAGE_HISTORY"),
    canConnect: has("CONNECT"),
    canSpeak: has("SPEAK"),
    canManage,
    permissions: fromBitfield(p),
  };
}

/** Vue « Voir comme ce rôle » : accès de chaque salon pour un membre ayant @everyone + ces rôles. */
export function simulateAsRoles(spec: ServerSpec, roleIds: readonly string[]): Map<string, ChannelAccess> {
  const map = new Map<string, ChannelAccess>();
  for (const { channel, category } of allChannels(spec)) map.set(channel.id, channelAccess(spec, roleIds, channel, category));
  return map;
}

/** @everyone peut-il voir / écrire dans ce salon ? (utilisé pour l’onboarding et l’écran d’accueil) */
export function everyoneAccess(spec: ServerSpec, channelId: string): ChannelAccess | null {
  const found = allChannels(spec).find((c) => c.channel.id === channelId);
  if (!found) return null;
  return channelAccess(spec, [], found.channel, found.category);
}
