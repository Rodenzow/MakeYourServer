import { z } from "zod";
import { PERMISSION_KEYS, type PermissionKey } from "./permissions";

/**
 * ServerSpec : description complète d’un serveur, indépendante de Discord.
 * Les éléments se référencent entre eux par des identifiants locaux (`id`),
 * jamais par des identifiants Discord. Le moteur d’installation conserve les
 * correspondances localId → identifiant Discord réellement créé.
 */

export const LOCAL_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
export const EVERYONE = "everyone" as const;

export const LocalId = z.string().regex(LOCAL_ID_RE, "Identifiant local invalide (minuscules, chiffres, - et _)");
export const RoleRef = LocalId; // peut valoir "everyone"
export const Permission = z.enum(PERMISSION_KEYS as [PermissionKey, ...PermissionKey[]]);
const Color = z.number().int().min(0).max(0xffffff);
const Emoji = z.string().min(1).max(32);

export const OverwriteSchema = z.object({
  target: RoleRef,
  allow: z.array(Permission).default([]),
  deny: z.array(Permission).default([]),
});
export type Overwrite = z.infer<typeof OverwriteSchema>;

export const CHANNEL_TYPES = ["text", "voice", "announcement", "forum", "stage"] as const;
export const ChannelType = z.enum(CHANNEL_TYPES);
export type ChannelType = z.infer<typeof ChannelType>;

export const CHANNEL_PURPOSES = [
  "rules",
  "welcome",
  "announcements",
  "updates",
  "info",
  "faq",
  "roles",
  "introductions",
  "general",
  "events",
  "suggestions",
  "support",
  "logs",
  "mod-logs",
  "staff",
  "afk",
  "media",
] as const;
export const ChannelPurpose = z.enum(CHANNEL_PURPOSES);
export type ChannelPurpose = z.infer<typeof ChannelPurpose>;

export const ForumTagSchema = z.object({
  name: z.string().min(1).max(20),
  emoji: Emoji.optional(),
  moderated: z.boolean().default(false),
});

export const ChannelSchema = z.object({
  id: LocalId,
  name: z.string().min(1).max(100),
  type: ChannelType,
  topic: z.string().max(1024).optional(),
  nsfw: z.boolean().default(false),
  slowmode: z.number().int().min(0).max(21600).default(0),
  userLimit: z.number().int().min(0).max(99).optional(),
  bitrate: z.number().int().min(8000).max(384000).optional(),
  /** true : hérite des permissions de la catégorie. false : utilise `overwrites`. */
  syncPermissions: z.boolean().default(true),
  overwrites: z.array(OverwriteSchema).default([]),
  forumTags: z.array(ForumTagSchema).max(20).optional(),
  defaultReaction: Emoji.optional(),
  purpose: ChannelPurpose.optional(),
});
export type Channel = z.infer<typeof ChannelSchema>;

export const CategorySchema = z.object({
  id: LocalId,
  name: z.string().min(1).max(100),
  overwrites: z.array(OverwriteSchema).default([]),
  channels: z.array(ChannelSchema).max(50),
});
export type Category = z.infer<typeof CategorySchema>;

export const RoleSchema = z.object({
  id: LocalId.refine((v) => v !== EVERYONE, "« everyone » est réservé"),
  name: z.string().min(1).max(100),
  color: Color.default(0),
  hoist: z.boolean().default(false),
  mentionable: z.boolean().default(false),
  permissions: z.array(Permission).default([]),
  /** Explication affichée dans l’éditeur et dans « Voir comme ce rôle ». */
  description: z.string().max(300).optional(),
  /** Le rôle peut être pris par les membres via un bouton ou l’onboarding. */
  selfAssignable: z.boolean().default(false),
  /** Rôle d’équipe (staff) : utile aux fonctionnalités tickets / logs. */
  staff: z.boolean().default(false),
});
export type Role = z.infer<typeof RoleSchema>;

const ButtonStyle = z.enum(["primary", "secondary", "success", "danger"]);
const ButtonBase = { label: z.string().min(1).max(80), emoji: Emoji.optional() };

export const ButtonSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("role-toggle"), roleId: LocalId, style: ButtonStyle.default("secondary"), ...ButtonBase }),
  z.object({ action: z.literal("rules-accept"), roleId: LocalId, style: ButtonStyle.default("success"), ...ButtonBase }),
  z.object({ action: z.literal("ticket-open"), style: ButtonStyle.default("primary"), ...ButtonBase }),
  z.object({ action: z.literal("suggestion-open"), style: ButtonStyle.default("primary"), ...ButtonBase }),
  z.object({ action: z.literal("link"), url: z.string().url().startsWith("https://"), ...ButtonBase }),
]);
export type Button = z.infer<typeof ButtonSchema>;

export const EmbedSchema = z.object({
  title: z.string().max(256).optional(),
  description: z.string().max(4096).optional(),
  color: Color.optional(),
  fields: z
    .array(z.object({ name: z.string().min(1).max(256), value: z.string().min(1).max(1024), inline: z.boolean().default(false) }))
    .max(25)
    .default([]),
  footer: z.string().max(2048).optional(),
  imageUrl: z.string().url().startsWith("https://").optional(),
  thumbnailUrl: z.string().url().startsWith("https://").optional(),
});
export type Embed = z.infer<typeof EmbedSchema>;

export const MessageSchema = z.object({
  id: LocalId,
  channelId: LocalId,
  content: z.string().max(2000).optional(),
  embeds: z.array(EmbedSchema).max(10).default([]),
  buttons: z.array(ButtonSchema).max(5).default([]),
  pin: z.boolean().default(false),
});
export type Message = z.infer<typeof MessageSchema>;

const AutoModAction = z.discriminatedUnion("type", [
  z.object({ type: z.literal("block"), customMessage: z.string().max(150).optional() }),
  z.object({ type: z.literal("alert"), channelId: LocalId }),
  z.object({ type: z.literal("timeout"), durationSeconds: z.number().int().min(1).max(2419200) }),
]);

export const AutoModTrigger = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("keyword"),
    keywords: z.array(z.string().min(1).max(60)).max(1000).default([]),
    regexPatterns: z.array(z.string().min(1).max(260)).max(10).default([]),
    allowList: z.array(z.string().min(1).max(60)).max(100).default([]),
  }),
  z.object({ type: z.literal("spam") }),
  z.object({
    type: z.literal("keyword_preset"),
    presets: z.array(z.enum(["profanity", "sexual_content", "slurs"])).min(1),
    allowList: z.array(z.string().min(1).max(60)).max(1000).default([]),
  }),
  z.object({
    type: z.literal("mention_spam"),
    mentionLimit: z.number().int().min(1).max(50),
    raidProtection: z.boolean().default(true),
  }),
]);

export const AutoModRuleSchema = z.object({
  id: LocalId,
  name: z.string().min(1).max(100),
  enabled: z.boolean().default(true),
  trigger: AutoModTrigger,
  actions: z.array(AutoModAction).min(1).max(3),
  exemptRoles: z.array(LocalId).max(20).default([]),
  exemptChannels: z.array(LocalId).max(50).default([]),
});
export type AutoModRule = z.infer<typeof AutoModRuleSchema>;

export const OnboardingSchema = z.object({
  enabled: z.boolean().default(true),
  mode: z.enum(["default", "advanced"]).default("default"),
  defaultChannelIds: z.array(LocalId).default([]),
  prompts: z
    .array(
      z.object({
        id: LocalId,
        title: z.string().min(1).max(100),
        type: z.enum(["multiple_choice", "dropdown"]).default("multiple_choice"),
        singleSelect: z.boolean().default(false),
        required: z.boolean().default(false),
        inOnboarding: z.boolean().default(true),
        options: z
          .array(
            z.object({
              id: LocalId,
              title: z.string().min(1).max(50),
              description: z.string().max(100).optional(),
              emoji: Emoji.optional(),
              roleIds: z.array(LocalId).default([]),
              channelIds: z.array(LocalId).default([]),
            }),
          )
          .min(1)
          .max(50),
      }),
    )
    .max(15)
    .default([]),
});
export type Onboarding = z.infer<typeof OnboardingSchema>;

export const WelcomeScreenSchema = z.object({
  enabled: z.boolean().default(true),
  description: z.string().max(140).optional(),
  channels: z
    .array(z.object({ channelId: LocalId, description: z.string().min(1).max(50), emoji: Emoji.optional() }))
    .max(5)
    .default([]),
});
export type WelcomeScreen = z.infer<typeof WelcomeScreenSchema>;

export const SettingsSchema = z.object({
  verificationLevel: z.enum(["none", "low", "medium", "high", "very_high"]).default("low"),
  explicitContentFilter: z.enum(["disabled", "members_without_roles", "all_members"]).default("all_members"),
  defaultNotifications: z.enum(["all_messages", "only_mentions"]).default("only_mentions"),
  /** Activer la Communauté Discord (nécessite que le bot soit Administrateur). */
  community: z.boolean().default(false),
  description: z.string().max(120).optional(),
  preferredLocale: z.string().default("fr"),
  systemChannelId: LocalId.optional(),
  rulesChannelId: LocalId.optional(),
  publicUpdatesChannelId: LocalId.optional(),
  safetyAlertsChannelId: LocalId.optional(),
  afkChannelId: LocalId.optional(),
  afkTimeout: z.union([z.literal(60), z.literal(300), z.literal(900), z.literal(1800), z.literal(3600)]).default(300),
  suppressJoinNotifications: z.boolean().default(false),
  suppressBoostNotifications: z.boolean().default(false),
  suppressSetupTips: z.boolean().default(true),
});
export type Settings = z.infer<typeof SettingsSchema>;

/** Fonctionnalités assurées par le bot Make Your Server (et non par Discord). */
export const FeaturesSchema = z.object({
  welcome: z
    .object({
      enabled: z.boolean().default(true),
      channelId: LocalId,
      /** Jetons : {user}, {server}, {memberCount} et les références {#salon} {@role}. */
      message: z.string().min(1).max(1500),
    })
    .optional(),
  joinLogs: z.object({ enabled: z.boolean().default(true), channelId: LocalId }).optional(),
  rulesGate: z.object({ enabled: z.boolean().default(true), roleId: LocalId }).optional(),
  tickets: z
    .object({
      enabled: z.boolean().default(true),
      channelId: LocalId,
      staffRoleIds: z.array(LocalId).min(1).max(5),
      intro: z.string().max(1000).default("Merci pour ta demande ! Décris ton besoin, l’équipe te répondra ici."),
    })
    .optional(),
  suggestions: z.object({ enabled: z.boolean().default(true), channelId: LocalId }).optional(),
});
export type Features = z.infer<typeof FeaturesSchema>;

/** Contenu préparé pour le Guide du serveur : non automatisable via l’API publique. */
export const ServerGuideSchema = z.object({
  welcomeMessage: z.string().max(300).optional(),
  newMemberActions: z
    .array(z.object({ title: z.string().min(1).max(60), channelId: LocalId, description: z.string().max(200).optional() }))
    .max(5)
    .default([]),
  resourceChannels: z
    .array(z.object({ title: z.string().min(1).max(60), channelId: LocalId, description: z.string().max(200).optional() }))
    .max(7)
    .default([]),
});
export type ServerGuide = z.infer<typeof ServerGuideSchema>;

export const THEMES = [
  "communaute",
  "gaming",
  "musique",
  "createur",
  "association",
  "etudes",
  "roleplay",
  "professionnel",
  "tech",
  "art",
  "anime",
  "amis",
  "sport",
  "autre",
] as const;
export const THEME_LABELS: Record<(typeof THEMES)[number], string> = {
  communaute: "Communauté",
  gaming: "Gaming",
  musique: "Musique & rap",
  createur: "Créateur de contenu",
  association: "Association",
  etudes: "Études",
  roleplay: "Roleplay",
  professionnel: "Projet professionnel",
  tech: "Tech & développement",
  art: "Art & création",
  anime: "Anime & manga",
  amis: "Entre amis",
  sport: "Sport & bien-être",
  autre: "Autre",
};
export const SIZES = ["small", "medium", "large"] as const;
export const SIZE_LABELS: Record<(typeof SIZES)[number], string> = {
  small: "Petit (moins de 50 membres)",
  medium: "Moyen (50 à 1 000 membres)",
  large: "Grand (plus de 1 000 membres)",
};

export const MetaSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  theme: z.enum(THEMES).default("autre"),
  size: z.enum(SIZES).default("medium"),
  tone: z.string().max(80).optional(),
  audience: z.string().max(200).optional(),
  accentColor: Color.optional(),
});

export const ServerSpecSchema = z.object({
  version: z.literal(1).default(1),
  meta: MetaSchema,
  settings: SettingsSchema.default(SettingsSchema.parse({})),
  everyone: z.object({ permissions: z.array(Permission) }),
  /** Ordre : du plus haut au plus bas dans la hiérarchie. */
  roles: z.array(RoleSchema).max(250),
  /** Salons hors catégorie, affichés en haut de la liste. */
  uncategorized: z.array(ChannelSchema).default([]),
  categories: z.array(CategorySchema),
  messages: z.array(MessageSchema).default([]),
  automod: z.array(AutoModRuleSchema).default([]),
  onboarding: OnboardingSchema.optional(),
  welcomeScreen: WelcomeScreenSchema.optional(),
  features: FeaturesSchema.default({}),
  serverGuide: ServerGuideSchema.optional(),
});
export type ServerSpec = z.infer<typeof ServerSpecSchema>;
export type ServerSpecInput = z.input<typeof ServerSpecSchema>;

export function parseSpec(input: unknown): ServerSpec {
  return ServerSpecSchema.parse(input);
}

export function safeParseSpec(input: unknown) {
  return ServerSpecSchema.safeParse(input);
}

/** Limites Discord connues (documentées ou constatées) utilisées pour les contrôles. */
export const DISCORD_LIMITS = {
  maxChannels: 500,
  maxChannelsPerCategory: 50,
  maxRoles: 250,
  maxAutomodKeywordRules: 6,
  maxAutomodSpamRules: 1,
  maxAutomodPresetRules: 1,
  maxAutomodMentionRules: 1,
  onboardingMinDefaultChannels: 7,
  onboardingMinWritableDefaultChannels: 5,
  welcomeScreenMaxChannels: 5,
  maxPinsPerChannel: 250,
} as const;
