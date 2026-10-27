import type { PermissionKey } from "../permissions";
import type { ServerSpecInput, THEMES, SIZES } from "../schema";

/** Couleurs de la marque Make Your Server (utilisées par défaut dans les embeds). */
export const BRAND = {
  lightBlue: 0xb8d7ff,
  blue: 0x83a8f3,
  periwinkle: 0xa7bdff,
  night: 0x07142d,
} as const;

export interface TemplateDefinition {
  slug: string;
  name: string;
  /** Une phrase d’accroche. */
  tagline: string;
  description: string;
  theme: (typeof THEMES)[number];
  size: (typeof SIZES)[number];
  /** Public visé, en une ou deux phrases. */
  audience: string;
  /** Points forts présentés sur la fiche. */
  highlights: string[];
  /** Popularité initiale (avant les vraies statistiques d’installation). */
  popularity: number;
  spec: ServerSpecInput;
}

type Ch = NonNullable<ServerSpecInput["categories"]>[number]["channels"][number];
type Ow = NonNullable<Ch["overwrites"]>[number];

/* ------------------------------- Permissions ------------------------------ */

export const PERMS = {
  /** Permissions de base de @everyone : discuter, réagir, rejoindre les vocaux. */
  member: [
    "VIEW_CHANNEL",
    "SEND_MESSAGES",
    "SEND_MESSAGES_IN_THREADS",
    "CREATE_PUBLIC_THREADS",
    "EMBED_LINKS",
    "ATTACH_FILES",
    "ADD_REACTIONS",
    "USE_EXTERNAL_EMOJIS",
    "USE_EXTERNAL_STICKERS",
    "READ_MESSAGE_HISTORY",
    "USE_APPLICATION_COMMANDS",
    "SEND_VOICE_MESSAGES",
    "SEND_POLLS",
    "CONNECT",
    "SPEAK",
    "STREAM",
    "USE_VAD",
    "USE_SOUNDBOARD",
    "USE_EMBEDDED_ACTIVITIES",
    "REQUEST_TO_SPEAK",
    "CHANGE_NICKNAME",
    "CREATE_INSTANT_INVITE",
  ] as PermissionKey[],
  /** @everyone quand l’accès est conditionné à l’acceptation du règlement. */
  gated: ["READ_MESSAGE_HISTORY", "ADD_REACTIONS", "USE_APPLICATION_COMMANDS", "CHANGE_NICKNAME"] as PermissionKey[],
  moderator: [
    "KICK_MEMBERS",
    "MODERATE_MEMBERS",
    "MANAGE_MESSAGES",
    "PIN_MESSAGES",
    "MANAGE_THREADS",
    "MANAGE_NICKNAMES",
    "MUTE_MEMBERS",
    "DEAFEN_MEMBERS",
    "MOVE_MEMBERS",
    "VIEW_AUDIT_LOG",
    "BYPASS_SLOWMODE",
    "MENTION_EVERYONE",
  ] as PermissionKey[],
  admin: [
    "BAN_MEMBERS",
    "MANAGE_CHANNELS",
    "MANAGE_ROLES",
    "MANAGE_GUILD",
    "MANAGE_WEBHOOKS",
    "MANAGE_EVENTS",
    "MANAGE_GUILD_EXPRESSIONS",
    "VIEW_GUILD_INSIGHTS",
  ] as PermissionKey[],
};

export const unique = <T>(xs: T[]): T[] => [...new Set(xs)];
export const moderatorPerms = () => unique([...PERMS.member, ...PERMS.moderator]);
export const adminPerms = () => unique([...PERMS.member, ...PERMS.moderator, ...PERMS.admin]);

const WRITE: PermissionKey[] = ["SEND_MESSAGES", "SEND_MESSAGES_IN_THREADS", "CREATE_PUBLIC_THREADS", "CREATE_PRIVATE_THREADS"];

/** Salon / catégorie visible uniquement par certains rôles. */
export function privateTo(roles: string[], extra: PermissionKey[] = []): Ow[] {
  return [
    { target: "everyone", allow: [], deny: ["VIEW_CHANNEL"] },
    ...roles.map((r) => ({ target: r, allow: ["VIEW_CHANNEL", "SEND_MESSAGES", "READ_MESSAGE_HISTORY", "CONNECT", "SPEAK", ...extra] as PermissionKey[], deny: [] })),
  ];
}

/** Lecture seule pour tous, écriture réservée à certains rôles. */
export function readOnly(writers: string[] = [], everyoneView = true): Ow[] {
  return [
    { target: "everyone", allow: everyoneView ? ["VIEW_CHANNEL", "READ_MESSAGE_HISTORY"] : [], deny: WRITE },
    ...writers.map((r) => ({ target: r, allow: ["SEND_MESSAGES", "SEND_MESSAGES_IN_THREADS"] as PermissionKey[], deny: [] })),
  ];
}

/** Visible pour un rôle (ex. « Membre ») mais caché à @everyone : utilisé avec la validation du règlement. */
export function membersOnly(memberRole: string): Ow[] {
  return [
    { target: "everyone", allow: [], deny: ["VIEW_CHANNEL"] },
    { target: memberRole, allow: ["VIEW_CHANNEL"], deny: [] },
  ];
}

/* --------------------------------- Salons --------------------------------- */

type ChOpts = Partial<Omit<Ch, "id" | "name" | "type">>;

export function text(id: string, name: string, topic?: string, opts: ChOpts = {}): Ch {
  return { id, name, type: "text", topic, ...opts };
}
export function announcement(id: string, name: string, topic?: string, opts: ChOpts = {}): Ch {
  return { id, name, type: "announcement", topic, ...opts };
}
export function forum(id: string, name: string, topic: string, tags: Array<string | { name: string; emoji?: string; moderated?: boolean }>, opts: ChOpts = {}): Ch {
  return {
    id,
    name,
    type: "forum",
    topic,
    forumTags: tags.map((t) => (typeof t === "string" ? { name: t } : t)),
    ...opts,
  };
}
export function voice(id: string, name: string, opts: ChOpts = {}): Ch {
  return { id, name, type: "voice", ...opts };
}
export function stage(id: string, name: string, topic?: string, opts: ChOpts = {}): Ch {
  return { id, name, type: "stage", topic, ...opts };
}
/** Salon dont les permissions sont propres (non synchronisées avec la catégorie). */
export function own(overwrites: Ow[]): ChOpts {
  return { syncPermissions: false, overwrites };
}
