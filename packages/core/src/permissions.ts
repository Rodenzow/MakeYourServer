/**
 * Permissions Discord (bitfield) avec libellés français.
 * Source : https://docs.discord.com/developers/topics/permissions
 */

export const PERMISSIONS = {
  CREATE_INSTANT_INVITE: { bit: 0, label: "Créer une invitation", group: "general", channel: true },
  KICK_MEMBERS: { bit: 1, label: "Expulser des membres", group: "moderation", channel: false, dangerous: true },
  BAN_MEMBERS: { bit: 2, label: "Bannir des membres", group: "moderation", channel: false, dangerous: true },
  ADMINISTRATOR: { bit: 3, label: "Administrateur", group: "admin", channel: false, dangerous: true },
  MANAGE_CHANNELS: { bit: 4, label: "Gérer les salons", group: "admin", channel: true, dangerous: true },
  MANAGE_GUILD: { bit: 5, label: "Gérer le serveur", group: "admin", channel: false, dangerous: true },
  ADD_REACTIONS: { bit: 6, label: "Ajouter des réactions", group: "text", channel: true },
  VIEW_AUDIT_LOG: { bit: 7, label: "Voir les logs du serveur", group: "moderation", channel: false, dangerous: true },
  PRIORITY_SPEAKER: { bit: 8, label: "Voix prioritaire", group: "voice", channel: true },
  STREAM: { bit: 9, label: "Vidéo / partage d’écran", group: "voice", channel: true },
  VIEW_CHANNEL: { bit: 10, label: "Voir le salon", group: "general", channel: true },
  SEND_MESSAGES: { bit: 11, label: "Envoyer des messages", group: "text", channel: true },
  SEND_TTS_MESSAGES: { bit: 12, label: "Messages de synthèse vocale", group: "text", channel: true },
  MANAGE_MESSAGES: { bit: 13, label: "Gérer les messages", group: "moderation", channel: true, dangerous: true },
  EMBED_LINKS: { bit: 14, label: "Intégrer des liens", group: "text", channel: true },
  ATTACH_FILES: { bit: 15, label: "Joindre des fichiers", group: "text", channel: true },
  READ_MESSAGE_HISTORY: { bit: 16, label: "Voir l’historique des messages", group: "text", channel: true },
  MENTION_EVERYONE: { bit: 17, label: "Mentionner @everyone et tous les rôles", group: "text", channel: true, dangerous: true },
  USE_EXTERNAL_EMOJIS: { bit: 18, label: "Émojis externes", group: "text", channel: true },
  VIEW_GUILD_INSIGHTS: { bit: 19, label: "Voir les statistiques du serveur", group: "admin", channel: false },
  CONNECT: { bit: 20, label: "Se connecter (vocal)", group: "voice", channel: true },
  SPEAK: { bit: 21, label: "Parler", group: "voice", channel: true },
  MUTE_MEMBERS: { bit: 22, label: "Rendre muet des membres", group: "voice", channel: true, dangerous: true },
  DEAFEN_MEMBERS: { bit: 23, label: "Mettre en sourdine des membres", group: "voice", channel: true, dangerous: true },
  MOVE_MEMBERS: { bit: 24, label: "Déplacer des membres", group: "voice", channel: true, dangerous: true },
  USE_VAD: { bit: 25, label: "Détection de la voix", group: "voice", channel: true },
  CHANGE_NICKNAME: { bit: 26, label: "Changer de pseudo", group: "general", channel: false },
  MANAGE_NICKNAMES: { bit: 27, label: "Gérer les pseudos", group: "moderation", channel: false, dangerous: true },
  MANAGE_ROLES: { bit: 28, label: "Gérer les rôles / permissions", group: "admin", channel: true, dangerous: true },
  MANAGE_WEBHOOKS: { bit: 29, label: "Gérer les webhooks", group: "admin", channel: true, dangerous: true },
  MANAGE_GUILD_EXPRESSIONS: { bit: 30, label: "Gérer les expressions", group: "admin", channel: false, dangerous: true },
  USE_APPLICATION_COMMANDS: { bit: 31, label: "Utiliser les commandes d’applications", group: "text", channel: true },
  REQUEST_TO_SPEAK: { bit: 32, label: "Demander à parler (conférence)", group: "voice", channel: true },
  MANAGE_EVENTS: { bit: 33, label: "Gérer les événements", group: "admin", channel: true, dangerous: true },
  MANAGE_THREADS: { bit: 34, label: "Gérer les fils et publications", group: "moderation", channel: true, dangerous: true },
  CREATE_PUBLIC_THREADS: { bit: 35, label: "Créer des fils publics", group: "text", channel: true },
  CREATE_PRIVATE_THREADS: { bit: 36, label: "Créer des fils privés", group: "text", channel: true },
  USE_EXTERNAL_STICKERS: { bit: 37, label: "Autocollants externes", group: "text", channel: true },
  SEND_MESSAGES_IN_THREADS: { bit: 38, label: "Envoyer des messages dans les fils", group: "text", channel: true },
  USE_EMBEDDED_ACTIVITIES: { bit: 39, label: "Utiliser les activités", group: "voice", channel: true },
  MODERATE_MEMBERS: { bit: 40, label: "Exclure temporairement", group: "moderation", channel: false, dangerous: true },
  VIEW_CREATOR_MONETIZATION_ANALYTICS: { bit: 41, label: "Voir les statistiques de monétisation", group: "admin", channel: false },
  USE_SOUNDBOARD: { bit: 42, label: "Utiliser la soundboard", group: "voice", channel: true },
  CREATE_GUILD_EXPRESSIONS: { bit: 43, label: "Créer des expressions", group: "general", channel: false },
  CREATE_EVENTS: { bit: 44, label: "Créer des événements", group: "general", channel: true },
  USE_EXTERNAL_SOUNDS: { bit: 45, label: "Sons externes", group: "voice", channel: true },
  SEND_VOICE_MESSAGES: { bit: 46, label: "Envoyer des messages vocaux", group: "text", channel: true },
  SET_VOICE_CHANNEL_STATUS: { bit: 48, label: "Définir le statut du salon vocal", group: "voice", channel: true },
  SEND_POLLS: { bit: 49, label: "Créer des sondages", group: "text", channel: true },
  USE_EXTERNAL_APPS: { bit: 50, label: "Utiliser des applications externes", group: "text", channel: true },
  PIN_MESSAGES: { bit: 51, label: "Épingler des messages", group: "moderation", channel: true },
  BYPASS_SLOWMODE: { bit: 52, label: "Ignorer le mode lent", group: "moderation", channel: true },
} as const satisfies Record<
  string,
  { bit: number; label: string; group: PermissionGroup; channel: boolean; dangerous?: boolean }
>;

export type PermissionGroup = "general" | "text" | "voice" | "moderation" | "admin";
export type PermissionKey = keyof typeof PERMISSIONS;
export const PERMISSION_KEYS = Object.keys(PERMISSIONS) as PermissionKey[];

export const PERMISSION_GROUP_LABELS: Record<PermissionGroup, string> = {
  general: "Général",
  text: "Salons textuels",
  voice: "Salons vocaux",
  moderation: "Modération",
  admin: "Administration",
};

export function isPermissionKey(value: string): value is PermissionKey {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, value);
}

export function permissionBit(key: PermissionKey): bigint {
  return 1n << BigInt(PERMISSIONS[key].bit);
}

export function toBitfield(keys: readonly PermissionKey[]): bigint {
  let v = 0n;
  for (const k of keys) v |= permissionBit(k);
  return v;
}

export function fromBitfield(bits: bigint | string): PermissionKey[] {
  const v = typeof bits === "string" ? BigInt(bits) : bits;
  return PERMISSION_KEYS.filter((k) => (v & permissionBit(k)) !== 0n);
}

export function isDangerous(key: PermissionKey): boolean {
  return "dangerous" in PERMISSIONS[key] && PERMISSIONS[key].dangerous === true;
}

export const ALL_PERMISSIONS = PERMISSION_KEYS.reduce((acc, k) => acc | permissionBit(k), 0n);

/** Permissions par défaut de @everyone sur un serveur Discord récent (valeur indicative). */
export const DEFAULT_EVERYONE_PERMISSIONS: PermissionKey[] = [
  "CREATE_INSTANT_INVITE",
  "CHANGE_NICKNAME",
  "VIEW_CHANNEL",
  "SEND_MESSAGES",
  "SEND_MESSAGES_IN_THREADS",
  "CREATE_PUBLIC_THREADS",
  "CREATE_PRIVATE_THREADS",
  "EMBED_LINKS",
  "ATTACH_FILES",
  "ADD_REACTIONS",
  "USE_EXTERNAL_EMOJIS",
  "USE_EXTERNAL_STICKERS",
  "READ_MESSAGE_HISTORY",
  "USE_APPLICATION_COMMANDS",
  "SEND_VOICE_MESSAGES",
  "SEND_POLLS",
  "USE_EXTERNAL_APPS",
  "CONNECT",
  "SPEAK",
  "STREAM",
  "USE_VAD",
  "USE_SOUNDBOARD",
  "USE_EXTERNAL_SOUNDS",
  "USE_EMBEDDED_ACTIVITIES",
  "REQUEST_TO_SPEAK",
  "CREATE_EVENTS",
  "CREATE_GUILD_EXPRESSIONS",
];

/** Permissions demandées au bot quand l’utilisateur choisit l’invitation « minimale ». */
export const BOT_MINIMAL_PERMISSIONS: PermissionKey[] = [
  "VIEW_CHANNEL",
  "MANAGE_CHANNELS",
  "MANAGE_ROLES",
  "MANAGE_GUILD",
  "MANAGE_WEBHOOKS",
  "MANAGE_MESSAGES",
  "MANAGE_THREADS",
  "PIN_MESSAGES",
  "SEND_MESSAGES",
  "SEND_MESSAGES_IN_THREADS",
  "CREATE_PRIVATE_THREADS",
  "EMBED_LINKS",
  "ATTACH_FILES",
  "READ_MESSAGE_HISTORY",
  "ADD_REACTIONS",
  "USE_EXTERNAL_EMOJIS",
];

export type ChannelKind = "text" | "voice" | "announcement" | "forum" | "stage";

/** Permissions pertinentes selon le type de salon (pour l’éditeur et la simulation). */
export function permissionsForChannelKind(kind: ChannelKind | "category"): PermissionKey[] {
  const keys = PERMISSION_KEYS.filter((k) => PERMISSIONS[k].channel);
  if (kind === "category") return keys;
  const voiceLike = kind === "voice" || kind === "stage";
  return keys.filter((k) => {
    const g = PERMISSIONS[k].group;
    if (g === "voice") return voiceLike;
    if (k === "REQUEST_TO_SPEAK") return kind === "stage";
    return true;
  });
}
