/**
 * État d’un serveur Discord tel que récupéré via l’API (sans données personnelles
 * des membres). Utilisé par le planificateur, les sauvegardes et la restauration.
 */

export const DISCORD_CHANNEL_TYPE = {
  text: 0,
  voice: 2,
  category: 4,
  announcement: 5,
  stage: 13,
  forum: 15,
  media: 16,
} as const;

export type DiscordChannelTypeName = keyof typeof DISCORD_CHANNEL_TYPE;

export function channelTypeName(t: number): DiscordChannelTypeName | "other" {
  const e = Object.entries(DISCORD_CHANNEL_TYPE).find(([, v]) => v === t);
  return (e?.[0] as DiscordChannelTypeName) ?? "other";
}

export interface StateOverwrite {
  id: string;
  /** 0 = rôle, 1 = membre */
  type: 0 | 1;
  allow: string;
  deny: string;
}

export interface StateRole {
  id: string;
  name: string;
  color: number;
  hoist: boolean;
  mentionable: boolean;
  permissions: string;
  position: number;
  managed: boolean;
  /** Rôle géré par une intégration (bot, booster…) */
  tags?: { botId?: string; premiumSubscriber?: boolean; integrationId?: string };
}

export interface StateForumTag {
  id?: string;
  name: string;
  emojiName?: string | null;
  moderated?: boolean;
}

export interface StateChannel {
  id: string;
  name: string;
  type: number;
  parentId: string | null;
  position: number;
  topic?: string | null;
  nsfw?: boolean;
  rateLimitPerUser?: number;
  userLimit?: number;
  bitrate?: number;
  permissionOverwrites: StateOverwrite[];
  availableTags?: StateForumTag[];
  defaultReactionEmoji?: string | null;
}

export interface StateAutoModRule {
  id: string;
  name: string;
  eventType: number;
  triggerType: number;
  triggerMetadata: Record<string, unknown>;
  actions: Array<{ type: number; metadata?: Record<string, unknown> }>;
  enabled: boolean;
  exemptRoles: string[];
  exemptChannels: string[];
  creatorId?: string;
}

export interface StateOnboarding {
  enabled: boolean;
  mode: number;
  defaultChannelIds: string[];
  prompts: Array<{
    id: string;
    type: number;
    title: string;
    singleSelect: boolean;
    required: boolean;
    inOnboarding: boolean;
    options: Array<{ id: string; title: string; description?: string | null; emojiName?: string | null; roleIds: string[]; channelIds: string[] }>;
  }>;
}

export interface StateWelcomeScreen {
  description: string | null;
  enabled?: boolean;
  welcomeChannels: Array<{ channelId: string; description: string; emojiName?: string | null }>;
}

export interface GuildState {
  id: string;
  name: string;
  ownerId: string;
  iconUrl?: string | null;
  features: string[];
  verificationLevel: number;
  explicitContentFilter: number;
  defaultMessageNotifications: number;
  systemChannelId: string | null;
  systemChannelFlags: number;
  rulesChannelId: string | null;
  publicUpdatesChannelId: string | null;
  safetyAlertsChannelId: string | null;
  afkChannelId: string | null;
  afkTimeout: number;
  preferredLocale: string;
  description: string | null;
  premiumTier: number;
  roles: StateRole[];
  channels: StateChannel[];
  automodRules?: StateAutoModRule[];
  onboarding?: StateOnboarding | null;
  welcomeScreen?: StateWelcomeScreen | null;
  /** Informations sur le bot dans ce serveur (calculées à la lecture). */
  bot?: {
    userId: string;
    roleIds: string[];
    permissions: string;
    highestRolePosition: number;
    isAdmin: boolean;
  };
  fetchedAt: string;
}

export const VERIFICATION_LEVELS = ["none", "low", "medium", "high", "very_high"] as const;
export const EXPLICIT_FILTERS = ["disabled", "members_without_roles", "all_members"] as const;
export const NOTIFICATION_LEVELS = ["all_messages", "only_mentions"] as const;

/** Drapeaux du salon système (SUPPRESS_*). */
export const SYSTEM_CHANNEL_FLAGS = {
  suppressJoinNotifications: 1 << 0,
  suppressBoostNotifications: 1 << 1,
  suppressSetupTips: 1 << 2,
  suppressJoinReplies: 1 << 3,
} as const;

/** Date de création encodée dans un identifiant Discord (snowflake). */
export function snowflakeTime(id: string): number {
  return Number((BigInt(id) >> 22n) + 1420070400000n);
}
