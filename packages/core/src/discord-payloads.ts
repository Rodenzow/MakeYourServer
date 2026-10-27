import { permissionBit, toBitfield, type PermissionKey } from "./permissions";
import {
  EVERYONE,
  type AutoModRule,
  type Button,
  type Category,
  type Channel,
  type Embed,
  type Message,
  type Overwrite,
  type Role,
  type ServerSpec,
} from "./schema";
import { DISCORD_CHANNEL_TYPE, EXPLICIT_FILTERS, NOTIFICATION_LEVELS, SYSTEM_CHANNEL_FLAGS, VERIFICATION_LEVELS, type StateOverwrite } from "./guild-state";
import { normalizeChannelName, renderTokens } from "./spec-utils";

/** Résout un identifiant local en identifiant Discord (ou null s’il n’existe pas encore). */
export interface Resolver {
  guildId: string;
  role(localId: string): string | null;
  channel(localId: string): string | null;
  serverName?: string;
}

export function resolveRoleTarget(r: Resolver, target: string): string | null {
  return target === EVERYONE ? r.guildId : r.role(target);
}

/** Boutons : identifiants de composants interprétés par notre bot. */
export const CUSTOM_ID = {
  roleToggle: (roleId: string) => `mys:rt:${roleId}`,
  rulesAccept: (roleId: string) => `mys:ra:${roleId}`,
  ticketOpen: () => `mys:tk:open`,
  suggestionOpen: () => `mys:sg:open`,
} as const;

export function overwritesPayload(r: Resolver, ows: readonly Overwrite[], extra: StateOverwrite[] = []): StateOverwrite[] {
  const out: StateOverwrite[] = [];
  for (const o of ows) {
    const id = resolveRoleTarget(r, o.target);
    if (!id) continue;
    out.push({ id, type: 0, allow: toBitfield(o.allow).toString(), deny: toBitfield(o.deny).toString() });
  }
  return [...out, ...extra];
}

/** Surcharge ajoutée pour que le bot garde l’accès aux salons privés qu’il crée. */
export function botAccessOverwrite(botUserId: string, botPermissions: bigint): StateOverwrite | null {
  const wanted: PermissionKey[] = ["VIEW_CHANNEL", "SEND_MESSAGES", "EMBED_LINKS", "READ_MESSAGE_HISTORY", "MANAGE_MESSAGES", "PIN_MESSAGES", "CREATE_PRIVATE_THREADS", "SEND_MESSAGES_IN_THREADS", "MANAGE_THREADS", "CONNECT"];
  const allow = toBitfield(wanted.filter((k) => (botPermissions & permissionBit(k)) !== 0n));
  if (allow === 0n) return null;
  return { id: botUserId, type: 1, allow: allow.toString(), deny: "0" };
}

/** @everyone est-il privé de lecture ou d’écriture ? (le bot non administrateur serait alors bloqué lui aussi) */
export function hidesFromEveryone(ows: readonly Overwrite[]): boolean {
  return ows.some((o) => o.target === EVERYONE && (o.deny.includes("VIEW_CHANNEL") || o.deny.includes("SEND_MESSAGES")));
}

export function rolePayload(role: Role) {
  return {
    name: role.name,
    color: role.color,
    hoist: role.hoist,
    mentionable: role.mentionable,
    permissions: toBitfield(role.permissions).toString(),
  };
}

export function channelDiscordType(ch: Channel, community: boolean): number {
  if (ch.type === "announcement") return community ? DISCORD_CHANNEL_TYPE.announcement : DISCORD_CHANNEL_TYPE.text;
  if (ch.type === "stage") return community ? DISCORD_CHANNEL_TYPE.stage : DISCORD_CHANNEL_TYPE.voice;
  return DISCORD_CHANNEL_TYPE[ch.type];
}

export function effectiveChannelOverwrites(ch: Channel, category: Category | null): Overwrite[] {
  return ch.syncPermissions && category ? category.overwrites : ch.overwrites;
}

export function channelPayload(
  ch: Channel,
  category: Category | null,
  r: Resolver,
  opts: { community: boolean; parentId: string | null; botOverwrite?: StateOverwrite | null },
) {
  const ows = effectiveChannelOverwrites(ch, category);
  const type = channelDiscordType(ch, opts.community);
  const isText = type === DISCORD_CHANNEL_TYPE.text || type === DISCORD_CHANNEL_TYPE.announcement;
  const isVoice = type === DISCORD_CHANNEL_TYPE.voice || type === DISCORD_CHANNEL_TYPE.stage;
  const extra = opts.botOverwrite && hidesFromEveryone(ows) ? [opts.botOverwrite] : [];
  const payload: Record<string, unknown> = {
    name: normalizeChannelName(ch.type, ch.name),
    type,
    parent_id: opts.parentId,
    permission_overwrites: overwritesPayload(r, ows, extra),
  };
  if (isText || type === DISCORD_CHANNEL_TYPE.forum) {
    payload.topic = ch.topic ?? null;
    payload.nsfw = ch.nsfw;
  }
  if (type === DISCORD_CHANNEL_TYPE.text || type === DISCORD_CHANNEL_TYPE.forum) payload.rate_limit_per_user = ch.slowmode;
  if (isVoice) {
    if (ch.userLimit !== undefined) payload.user_limit = ch.userLimit;
    if (ch.bitrate !== undefined) payload.bitrate = ch.bitrate;
  }
  if (type === DISCORD_CHANNEL_TYPE.forum) {
    if (ch.forumTags?.length)
      payload.available_tags = ch.forumTags.map((t) => ({ name: t.name, moderated: t.moderated, emoji_name: t.emoji ?? null }));
    if (ch.defaultReaction) payload.default_reaction_emoji = { emoji_name: ch.defaultReaction };
  }
  return payload;
}

export function categoryPayload(cat: Category, r: Resolver, botOverwrite?: StateOverwrite | null) {
  const extra = botOverwrite && hidesFromEveryone(cat.overwrites) ? [botOverwrite] : [];
  return {
    name: cat.name,
    type: DISCORD_CHANNEL_TYPE.category,
    permission_overwrites: overwritesPayload(r, cat.overwrites, extra),
  };
}

const BUTTON_STYLE = { primary: 1, secondary: 2, success: 3, danger: 4 } as const;

function buttonComponent(b: Button, r: Resolver) {
  const emoji = b.emoji ? { name: b.emoji } : undefined;
  if (b.action === "link") return { type: 2, style: 5, label: b.label, url: b.url, emoji };
  let custom_id: string;
  if (b.action === "role-toggle" || b.action === "rules-accept") {
    const roleId = r.role(b.roleId);
    if (!roleId) return null;
    custom_id = b.action === "role-toggle" ? CUSTOM_ID.roleToggle(roleId) : CUSTOM_ID.rulesAccept(roleId);
  } else if (b.action === "ticket-open") custom_id = CUSTOM_ID.ticketOpen();
  else custom_id = CUSTOM_ID.suggestionOpen();
  return { type: 2, style: BUTTON_STYLE[b.style], label: b.label, custom_id, emoji };
}

function renderText(t: string | undefined, r: Resolver): string | undefined {
  if (t === undefined) return undefined;
  return renderTokens(t, {
    channel: (id) => {
      const d = r.channel(id);
      return d ? `<#${d}>` : null;
    },
    role: (id) => {
      const d = r.role(id);
      return d ? `<@&${d}>` : null;
    },
    server: r.serverName,
  });
}

function embedPayload(e: Embed, r: Resolver, fallbackColor?: number) {
  return {
    title: renderText(e.title, r),
    description: renderText(e.description, r),
    color: e.color ?? fallbackColor,
    fields: e.fields.map((f) => ({ name: renderText(f.name, r)!, value: renderText(f.value, r)!, inline: f.inline })),
    footer: e.footer ? { text: renderText(e.footer, r)! } : undefined,
    image: e.imageUrl ? { url: e.imageUrl } : undefined,
    thumbnail: e.thumbnailUrl ? { url: e.thumbnailUrl } : undefined,
  };
}

export function messagePayload(m: Message, r: Resolver, accentColor?: number) {
  const buttons = m.buttons.map((b) => buttonComponent(b, r)).filter((b): b is NonNullable<typeof b> => b !== null);
  return {
    content: renderText(m.content, r) ?? "",
    embeds: m.embeds.map((e) => embedPayload(e, r, accentColor)),
    components: buttons.length ? [{ type: 1, components: buttons }] : [],
    // Les mentions de rôles dans les messages installés ne doivent pas notifier tout le monde.
    allowed_mentions: { parse: [] as string[] },
  };
}

const AUTOMOD_TRIGGER = { keyword: 1, spam: 3, keyword_preset: 4, mention_spam: 5 } as const;
const AUTOMOD_PRESET = { profanity: 1, sexual_content: 2, slurs: 3 } as const;

export function automodPayload(rule: AutoModRule, r: Resolver) {
  const t = rule.trigger;
  let trigger_metadata: Record<string, unknown> = {};
  if (t.type === "keyword") trigger_metadata = { keyword_filter: t.keywords, regex_patterns: t.regexPatterns, allow_list: t.allowList };
  if (t.type === "keyword_preset") trigger_metadata = { presets: t.presets.map((p) => AUTOMOD_PRESET[p]), allow_list: t.allowList };
  if (t.type === "mention_spam") trigger_metadata = { mention_total_limit: t.mentionLimit, mention_raid_protection_enabled: t.raidProtection };
  const actions = rule.actions
    .map((a) => {
      if (a.type === "block") return { type: 1, metadata: a.customMessage ? { custom_message: a.customMessage } : {} };
      if (a.type === "alert") {
        const ch = r.channel(a.channelId);
        return ch ? { type: 2, metadata: { channel_id: ch } } : null;
      }
      return { type: 3, metadata: { duration_seconds: a.durationSeconds } };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);
  return {
    name: rule.name,
    event_type: 1,
    trigger_type: AUTOMOD_TRIGGER[t.type],
    trigger_metadata,
    actions: actions.length ? actions : [{ type: 1, metadata: {} }],
    enabled: rule.enabled,
    exempt_roles: rule.exemptRoles.map((id) => resolveRoleTarget(r, id)).filter(Boolean),
    exempt_channels: rule.exemptChannels.map((id) => r.channel(id)).filter(Boolean),
  };
}

export const AUTOMOD_TRIGGER_TYPES = AUTOMOD_TRIGGER;

/** Réglages modifiables via PATCH /guilds/{id} (hors Communauté). */
export function guildSettingsPayload(spec: ServerSpec, r: Resolver, opts: { includeCommunityChannels: boolean }) {
  const s = spec.settings;
  let flags = 0;
  if (s.suppressJoinNotifications) flags |= SYSTEM_CHANNEL_FLAGS.suppressJoinNotifications;
  if (s.suppressBoostNotifications) flags |= SYSTEM_CHANNEL_FLAGS.suppressBoostNotifications;
  if (s.suppressSetupTips) flags |= SYSTEM_CHANNEL_FLAGS.suppressSetupTips;
  const payload: Record<string, unknown> = {
    verification_level: VERIFICATION_LEVELS.indexOf(s.verificationLevel),
    explicit_content_filter: EXPLICIT_FILTERS.indexOf(s.explicitContentFilter),
    default_message_notifications: NOTIFICATION_LEVELS.indexOf(s.defaultNotifications),
    system_channel_flags: flags,
    afk_timeout: s.afkTimeout,
    preferred_locale: s.preferredLocale,
  };
  if (s.systemChannelId) payload.system_channel_id = r.channel(s.systemChannelId);
  if (s.afkChannelId) payload.afk_channel_id = r.channel(s.afkChannelId);
  if (opts.includeCommunityChannels) {
    if (s.rulesChannelId) payload.rules_channel_id = r.channel(s.rulesChannelId);
    if (s.publicUpdatesChannelId) payload.public_updates_channel_id = r.channel(s.publicUpdatesChannelId);
    if (s.safetyAlertsChannelId) payload.safety_alerts_channel_id = r.channel(s.safetyAlertsChannelId);
    if (s.description) payload.description = s.description;
  }
  return payload;
}

/** Génère un identifiant au format snowflake (utilisé pour les nouvelles questions d’onboarding). */
export function generateSnowflake(offset = 0): string {
  return ((BigInt(Date.now() - 1420070400000) << 22n) + BigInt(offset)).toString();
}

export function onboardingPayload(spec: ServerSpec, r: Resolver, genId?: (seed: string) => string) {
  let counter = 0;
  genId ??= () => generateSnowflake(counter++);
  const ob = spec.onboarding!;
  return {
    enabled: ob.enabled,
    mode: ob.mode === "advanced" ? 1 : 0,
    default_channel_ids: ob.defaultChannelIds.map((c) => r.channel(c)).filter(Boolean),
    prompts: ob.prompts.map((p) => ({
      id: genId(p.id),
      type: p.type === "dropdown" ? 1 : 0,
      title: p.title,
      single_select: p.singleSelect,
      required: p.required,
      in_onboarding: p.inOnboarding,
      options: p.options.map((o) => ({
        id: genId(`${p.id}/${o.id}`),
        title: o.title,
        description: o.description ?? null,
        emoji_name: o.emoji ?? null,
        role_ids: o.roleIds.map((id) => r.role(id)).filter(Boolean),
        channel_ids: o.channelIds.map((id) => r.channel(id)).filter(Boolean),
      })),
    })),
  };
}

export function welcomeScreenPayload(spec: ServerSpec, r: Resolver) {
  const w = spec.welcomeScreen!;
  return {
    enabled: w.enabled,
    description: w.description ?? null,
    welcome_channels: w.channels
      .map((c) => ({ channel_id: r.channel(c.channelId), description: c.description, emoji_name: c.emoji ?? null }))
      .filter((c) => c.channel_id),
  };
}

/** Petit hachage déterministe (FNV-1a 53 bits) pour générer des identifiants numériques stables. */
export function stableNumericId(input: string): number {
  let h1 = 0x811c9dc5;
  let h2 = 0x1000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
  }
  return (h2 & 0x1fffff) * 0x100000000 + h1;
}

/** Nonce déterministe (≤ 25 caractères) pour éviter les doublons de messages lors d’une relance. */
export function messageNonce(seed: string): string {
  return stableNumericId(seed).toString(36).padStart(11, "0").slice(0, 25);
}
