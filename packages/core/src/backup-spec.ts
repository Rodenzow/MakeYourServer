import { DISCORD_CHANNEL_TYPE, EXPLICIT_FILTERS, NOTIFICATION_LEVELS, SYSTEM_CHANNEL_FLAGS, VERIFICATION_LEVELS, type GuildState, type StateChannel, type StateOverwrite } from "./guild-state";
import { fromBitfield } from "./permissions";
import { EVERYONE, type AutoModRule, type Channel, type Overwrite, type ServerSpec, ServerSpecSchema } from "./schema";

/**
 * Convertit l’état sauvegardé d’un serveur en projet (ServerSpec) + correspondances
 * localId → identifiant Discord d’origine. La restauration s’appuie dessus :
 * les éléments encore présents sont mis à jour, les éléments disparus sont recréés
 * (avec de NOUVEAUX identifiants Discord : Discord ne permet pas de réutiliser un identifiant).
 */
export interface BackupConversion {
  spec: ServerSpec;
  mapping: Record<string, string>;
  /** Éléments de la sauvegarde qui ne peuvent pas être restaurés automatiquement. */
  skipped: string[];
}

const TYPE_NAME: Record<number, Channel["type"] | undefined> = {
  [DISCORD_CHANNEL_TYPE.text]: "text",
  [DISCORD_CHANNEL_TYPE.voice]: "voice",
  [DISCORD_CHANNEL_TYPE.announcement]: "announcement",
  [DISCORD_CHANNEL_TYPE.stage]: "stage",
  [DISCORD_CHANNEL_TYPE.forum]: "forum",
};

export function backupToSpec(state: GuildState): BackupConversion {
  const mapping: Record<string, string> = {};
  const skipped: string[] = [];
  const roleLocal = new Map<string, string>();
  const chanLocal = new Map<string, string>();

  const roles = state.roles
    .filter((r) => r.id !== state.id && !r.managed)
    .sort((a, b) => b.position - a.position)
    .map((r) => {
      const id = `r-${r.id}`;
      roleLocal.set(r.id, id);
      mapping[id] = r.id;
      return { id, name: r.name, color: r.color, hoist: r.hoist, mentionable: r.mentionable, permissions: fromBitfield(r.permissions) };
    });
  state.roles.filter((r) => r.managed).forEach((r) => skipped.push(`Rôle géré par une intégration « ${r.name} » (recréé automatiquement par l’application concernée)`));

  const everyoneRole = state.roles.find((r) => r.id === state.id);

  const convOverwrites = (ows: StateOverwrite[]): Overwrite[] =>
    ows
      .filter((o) => o.type === 0)
      .map((o) => ({
        target: o.id === state.id ? EVERYONE : roleLocal.get(o.id) ?? "",
        allow: fromBitfield(o.allow),
        deny: fromBitfield(o.deny),
      }))
      .filter((o) => o.target !== "");

  const sameOws = (a: StateOverwrite[], b: StateOverwrite[]) => {
    const n = (x: StateOverwrite[]) => x.filter((o) => o.type === 0).map((o) => `${o.id}:${o.allow}:${o.deny}`).sort().join("|");
    return n(a) === n(b);
  };

  const sorted = [...state.channels].sort((a, b) => a.position - b.position);
  const categoriesState = sorted.filter((c) => c.type === DISCORD_CHANNEL_TYPE.category);

  const toChannel = (c: StateChannel, parent: StateChannel | null): Channel | null => {
    const type = TYPE_NAME[c.type];
    if (!type) {
      skipped.push(`Salon « ${c.name} » (type non pris en charge)`);
      return null;
    }
    const id = `c-${c.id}`;
    chanLocal.set(c.id, id);
    mapping[id] = c.id;
    const sync = !!parent && sameOws(c.permissionOverwrites, parent.permissionOverwrites);
    if (c.permissionOverwrites.some((o) => o.type === 1)) skipped.push(`Permissions propres à certains membres dans « ${c.name} »`);
    return {
      id,
      name: c.name,
      type,
      topic: c.topic ? c.topic.slice(0, 1024) : undefined,
      nsfw: !!c.nsfw,
      slowmode: c.rateLimitPerUser ?? 0,
      userLimit: c.userLimit !== undefined ? Math.min(c.userLimit, 99) : undefined,
      bitrate: c.bitrate !== undefined ? Math.min(Math.max(c.bitrate, 8000), 384000) : undefined,
      syncPermissions: sync,
      overwrites: sync ? [] : convOverwrites(c.permissionOverwrites),
      forumTags: c.availableTags?.length ? c.availableTags.slice(0, 20).map((t) => ({ name: t.name.slice(0, 20), emoji: t.emojiName ?? undefined, moderated: !!t.moderated })) : undefined,
      defaultReaction: c.defaultReactionEmoji ?? undefined,
    };
  };

  const uncategorized = sorted
    .filter((c) => c.type !== DISCORD_CHANNEL_TYPE.category && !c.parentId)
    .map((c) => toChannel(c, null))
    .filter((c): c is Channel => c !== null);

  const categories = categoriesState.map((cat) => {
    const id = `k-${cat.id}`;
    chanLocal.set(cat.id, id);
    mapping[id] = cat.id;
    return {
      id,
      name: cat.name,
      overwrites: convOverwrites(cat.permissionOverwrites),
      channels: sorted
        .filter((c) => c.parentId === cat.id && c.type !== DISCORD_CHANNEL_TYPE.category)
        .map((c) => toChannel(c, cat))
        .filter((c): c is Channel => c !== null)
        .slice(0, 50),
    };
  });

  const ch = (id: string | null | undefined) => (id ? chanLocal.get(id) : undefined);

  const automod: AutoModRule[] = [];
  for (const r of state.automodRules ?? []) {
    const md = r.triggerMetadata as Record<string, any>;
    let trigger: AutoModRule["trigger"] | null = null;
    if (r.triggerType === 1) trigger = { type: "keyword", keywords: md.keyword_filter ?? [], regexPatterns: md.regex_patterns ?? [], allowList: md.allow_list ?? [] };
    if (r.triggerType === 3) trigger = { type: "spam" };
    if (r.triggerType === 4) {
      const map = { 1: "profanity", 2: "sexual_content", 3: "slurs" } as const;
      trigger = { type: "keyword_preset", presets: (md.presets ?? []).map((p: 1 | 2 | 3) => map[p]).filter(Boolean), allowList: md.allow_list ?? [] };
    }
    if (r.triggerType === 5) trigger = { type: "mention_spam", mentionLimit: md.mention_total_limit ?? 5, raidProtection: !!md.mention_raid_protection_enabled };
    if (!trigger) {
      skipped.push(`Règle AutoMod « ${r.name} » (type non pris en charge)`);
      continue;
    }
    const actions = r.actions
      .map((a) => {
        if (a.type === 1) return { type: "block" as const, customMessage: (a.metadata?.custom_message as string) || undefined };
        if (a.type === 2 && ch(a.metadata?.channel_id as string)) return { type: "alert" as const, channelId: ch(a.metadata?.channel_id as string)! };
        if (a.type === 3) return { type: "timeout" as const, durationSeconds: Number(a.metadata?.duration_seconds ?? 60) };
        return null;
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);
    const id = `a-${r.id}`;
    mapping[id] = r.id;
    automod.push({
      id,
      name: r.name,
      enabled: r.enabled,
      trigger,
      actions: actions.length ? actions : [{ type: "block" }],
      exemptRoles: r.exemptRoles.map((x) => roleLocal.get(x)).filter((x): x is string => !!x),
      exemptChannels: r.exemptChannels.map((x) => chanLocal.get(x)).filter((x): x is string => !!x),
    });
  }

  const community = state.features.includes("COMMUNITY");
  const flags = state.systemChannelFlags;
  const raw = {
    version: 1,
    meta: { name: state.name.slice(0, 100).padEnd(2, " "), description: `Projet créé depuis la sauvegarde de « ${state.name} ».`, theme: "autre", size: "medium" },
    settings: {
      verificationLevel: VERIFICATION_LEVELS[state.verificationLevel] ?? "low",
      explicitContentFilter: EXPLICIT_FILTERS[state.explicitContentFilter] ?? "all_members",
      defaultNotifications: NOTIFICATION_LEVELS[state.defaultMessageNotifications] ?? "only_mentions",
      community,
      description: state.description?.slice(0, 120) || undefined,
      preferredLocale: state.preferredLocale || "fr",
      systemChannelId: ch(state.systemChannelId),
      rulesChannelId: ch(state.rulesChannelId),
      publicUpdatesChannelId: ch(state.publicUpdatesChannelId),
      safetyAlertsChannelId: ch(state.safetyAlertsChannelId),
      afkChannelId: ch(state.afkChannelId),
      afkTimeout: [60, 300, 900, 1800, 3600].includes(state.afkTimeout) ? state.afkTimeout : 300,
      suppressJoinNotifications: !!(flags & SYSTEM_CHANNEL_FLAGS.suppressJoinNotifications),
      suppressBoostNotifications: !!(flags & SYSTEM_CHANNEL_FLAGS.suppressBoostNotifications),
      suppressSetupTips: !!(flags & SYSTEM_CHANNEL_FLAGS.suppressSetupTips),
    },
    everyone: { permissions: everyoneRole ? fromBitfield(everyoneRole.permissions) : [] },
    roles,
    uncategorized,
    categories,
    messages: [],
    automod,
    onboarding: state.onboarding
      ? {
          enabled: state.onboarding.enabled,
          mode: state.onboarding.mode === 1 ? "advanced" : "default",
          defaultChannelIds: state.onboarding.defaultChannelIds.map((c) => ch(c)).filter(Boolean),
          prompts: state.onboarding.prompts.map((p) => ({
            id: `p-${p.id}`,
            title: p.title.slice(0, 100),
            type: p.type === 1 ? "dropdown" : "multiple_choice",
            singleSelect: p.singleSelect,
            required: p.required,
            inOnboarding: p.inOnboarding,
            options: p.options.map((o) => ({
              id: `o-${o.id}`,
              title: o.title.slice(0, 50),
              description: o.description?.slice(0, 100) || undefined,
              emoji: o.emojiName ?? undefined,
              roleIds: o.roleIds.map((x) => roleLocal.get(x)).filter(Boolean),
              channelIds: o.channelIds.map((x) => chanLocal.get(x)).filter(Boolean),
            })),
          })),
        }
      : undefined,
    welcomeScreen: state.welcomeScreen
      ? {
          enabled: state.welcomeScreen.enabled ?? state.features.includes("WELCOME_SCREEN_ENABLED"),
          description: state.welcomeScreen.description?.slice(0, 140) || undefined,
          channels: state.welcomeScreen.welcomeChannels
            .filter((w) => ch(w.channelId))
            .slice(0, 5)
            .map((w) => ({ channelId: ch(w.channelId)!, description: w.description.slice(0, 50) || "Salon", emoji: w.emojiName ?? undefined })),
        }
      : undefined,
    features: {},
  };
  if (raw.onboarding && raw.onboarding.prompts.some((p) => p.options.every((o) => o.roleIds.length === 0 && o.channelIds.length === 0))) {
    raw.onboarding.prompts = raw.onboarding.prompts.filter((p) => p.options.some((o) => o.roleIds.length || o.channelIds.length));
  }
  // La configuration d’onboarding et l’écran d’accueil proviennent de ce même serveur.
  if (raw.onboarding) mapping["__onboarding"] = state.id;
  if (raw.welcomeScreen) mapping["__welcome"] = state.id;
  const spec = ServerSpecSchema.parse(raw);
  return { spec, mapping, skipped };
}
