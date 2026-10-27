import { REST } from "@discordjs/rest";
import { ChannelFlags, Routes } from "discord-api-types/v10";
import { permissionBit, type GuildState, type StateChannel, type StateRole } from "@mys/core";
import { translateDiscordError, type GuildGateway, type MemberInfo, type RawMessage } from "./gateway";
import { guildPermissionsFor, highestRolePosition } from "./permissions";

type Json = Record<string, any>;

/** Encode la raison d’audit (en-tête X-Audit-Log-Reason). */
const reasonHeader = (reason: string) => ({ reason: reason.slice(0, 512) });

/**
 * Implémentation réelle via l’API REST officielle de Discord. @discordjs/rest gère
 * les limites de débit (buckets, 429, limite globale) pour tout le processus.
 */
export class DiscordRestGateway implements GuildGateway {
  readonly simulated = false;
  constructor(
    private readonly rest: REST,
    readonly botUserId: string,
  ) {}

  static fromToken(token: string, botUserId: string): DiscordRestGateway {
    const rest = new REST({ version: "10", timeout: 20_000, retries: 3 }).setToken(token);
    return new DiscordRestGateway(rest, botUserId);
  }

  private async call<T>(fn: () => Promise<unknown>): Promise<T> {
    try {
      return (await fn()) as T;
    } catch (e) {
      throw translateDiscordError(e);
    }
  }

  private async optional<T>(fn: () => Promise<unknown>): Promise<T | null> {
    try {
      return (await fn()) as T;
    } catch {
      return null;
    }
  }

  async fetchState(guildId: string): Promise<GuildState> {
    const guild = await this.call<Json>(() => this.rest.get(Routes.guild(guildId)));
    const channels = await this.call<Json[]>(() => this.rest.get(Routes.guildChannels(guildId)));
    const automod = (await this.optional<Json[]>(() => this.rest.get(Routes.guildAutoModerationRules(guildId)))) ?? [];
    const onboarding = await this.optional<Json>(() => this.rest.get(Routes.guildOnboarding(guildId)));
    const welcome = await this.optional<Json>(() => this.rest.get(Routes.guildWelcomeScreen(guildId)));
    const botMember = await this.optional<Json>(() => this.rest.get(Routes.guildMember(guildId, this.botUserId)));

    const roles: StateRole[] = (guild.roles as Json[]).map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color ?? 0,
      hoist: !!r.hoist,
      mentionable: !!r.mentionable,
      permissions: String(r.permissions),
      position: r.position,
      managed: !!r.managed,
      tags: r.tags ? { botId: r.tags.bot_id, premiumSubscriber: r.tags.premium_subscriber === null, integrationId: r.tags.integration_id } : undefined,
    }));

    const state: GuildState = {
      id: guild.id,
      name: guild.name,
      ownerId: guild.owner_id,
      iconUrl: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` : null,
      features: guild.features ?? [],
      verificationLevel: guild.verification_level,
      explicitContentFilter: guild.explicit_content_filter,
      defaultMessageNotifications: guild.default_message_notifications,
      systemChannelId: guild.system_channel_id,
      systemChannelFlags: guild.system_channel_flags ?? 0,
      rulesChannelId: guild.rules_channel_id,
      publicUpdatesChannelId: guild.public_updates_channel_id,
      safetyAlertsChannelId: guild.safety_alerts_channel_id ?? null,
      afkChannelId: guild.afk_channel_id,
      afkTimeout: guild.afk_timeout,
      preferredLocale: guild.preferred_locale,
      description: guild.description,
      premiumTier: guild.premium_tier ?? 0,
      roles,
      // Salons « obfusqués » : invisibles pour le bot, il ne peut ni les lire ni les modifier.
      channels: channels.filter((c) => !((c.flags ?? 0) & ChannelFlags.ChannelObfuscated)).map(toStateChannel),
      automodRules: automod.map((r) => ({
        id: r.id,
        name: r.name,
        eventType: r.event_type,
        triggerType: r.trigger_type,
        triggerMetadata: r.trigger_metadata ?? {},
        actions: r.actions ?? [],
        enabled: r.enabled,
        exemptRoles: r.exempt_roles ?? [],
        exemptChannels: r.exempt_channels ?? [],
        creatorId: r.creator_id,
      })),
      onboarding: onboarding
        ? {
            enabled: onboarding.enabled,
            mode: onboarding.mode,
            defaultChannelIds: onboarding.default_channel_ids ?? [],
            prompts: (onboarding.prompts ?? []).map((p: Json) => ({
              id: p.id,
              type: p.type,
              title: p.title,
              singleSelect: p.single_select,
              required: p.required,
              inOnboarding: p.in_onboarding,
              options: (p.options ?? []).map((o: Json) => ({
                id: o.id,
                title: o.title,
                description: o.description,
                emojiName: o.emoji?.name ?? null,
                roleIds: o.role_ids ?? [],
                channelIds: o.channel_ids ?? [],
              })),
            })),
          }
        : null,
      welcomeScreen: welcome
        ? {
            description: welcome.description ?? null,
            enabled: (guild.features ?? []).includes("WELCOME_SCREEN_ENABLED"),
            welcomeChannels: (welcome.welcome_channels ?? []).map((w: Json) => ({ channelId: w.channel_id, description: w.description, emojiName: w.emoji_name })),
          }
        : null,
      fetchedAt: new Date().toISOString(),
    };
    if (botMember) {
      const perms = guildPermissionsFor(state, this.botUserId, botMember.roles);
      state.bot = {
        userId: this.botUserId,
        roleIds: botMember.roles,
        permissions: perms.toString(),
        highestRolePosition: highestRolePosition(state, botMember.roles),
        isAdmin: (perms & permissionBit("ADMINISTRATOR")) !== 0n,
      };
    }
    return state;
  }

  async getMember(guildId: string, userId: string): Promise<MemberInfo | null> {
    try {
      const m = (await this.rest.get(Routes.guildMember(guildId, userId))) as Json;
      return { userId, roles: m.roles ?? [] };
    } catch (e) {
      const err = translateDiscordError(e);
      if (err.code === 10007 || err.code === 10013 || err.status === 404) return null;
      throw err;
    }
  }

  async createRole(guildId: string, body: Json, reason: string) {
    const r = await this.call<Json>(() => this.rest.post(Routes.guildRoles(guildId), { body, ...reasonHeader(reason) }));
    return { id: r.id as string };
  }
  async editRole(guildId: string, roleId: string, body: Json, reason: string) {
    await this.call(() => this.rest.patch(Routes.guildRole(guildId, roleId), { body, ...reasonHeader(reason) }));
  }
  async deleteRole(guildId: string, roleId: string, reason: string) {
    await this.call(() => this.rest.delete(Routes.guildRole(guildId, roleId), reasonHeader(reason)));
  }
  async setRolePositions(guildId: string, positions: Array<{ id: string; position: number }>, reason: string) {
    if (!positions.length) return;
    await this.call(() => this.rest.patch(Routes.guildRoles(guildId), { body: positions, ...reasonHeader(reason) }));
  }

  async createChannel(guildId: string, body: Json, reason: string) {
    const c = await this.call<Json>(() => this.rest.post(Routes.guildChannels(guildId), { body, ...reasonHeader(reason) }));
    return { id: c.id as string };
  }
  async editChannel(channelId: string, body: Json, reason: string) {
    await this.call(() => this.rest.patch(Routes.channel(channelId), { body, ...reasonHeader(reason) }));
  }
  async deleteChannel(channelId: string, reason: string) {
    await this.call(() => this.rest.delete(Routes.channel(channelId), reasonHeader(reason)));
  }
  async setChannelPositions(guildId: string, positions: Array<{ id: string; position: number; parent_id?: string | null; lock_permissions?: boolean }>, reason: string) {
    if (!positions.length) return;
    await this.call(() => this.rest.patch(Routes.guildChannels(guildId), { body: positions, ...reasonHeader(reason) }));
  }

  async editGuild(guildId: string, body: Json, reason: string) {
    await this.call(() => this.rest.patch(Routes.guild(guildId), { body, ...reasonHeader(reason) }));
  }

  async sendMessage(channelId: string, body: Json) {
    const m = await this.call<Json>(() => this.rest.post(Routes.channelMessages(channelId), { body }));
    return { id: m.id as string };
  }
  async editMessage(channelId: string, messageId: string, body: Json) {
    await this.call(() => this.rest.patch(Routes.channelMessage(channelId, messageId), { body }));
  }
  async messageExists(channelId: string, messageId: string) {
    try {
      await this.rest.get(Routes.channelMessage(channelId, messageId));
      return true;
    } catch (e) {
      const err = translateDiscordError(e);
      if (err.status === 404) return false;
      throw err;
    }
  }
  async listMessages(channelId: string, opts: { limit: number; before?: string }): Promise<RawMessage[]> {
    const query = new URLSearchParams({ limit: String(Math.min(100, opts.limit)) });
    if (opts.before) query.set("before", opts.before);
    const list = await this.call<Json[]>(() => this.rest.get(Routes.channelMessages(channelId), { query }));
    return list.map((m) => ({
      id: m.id,
      channelId,
      authorId: m.author?.id,
      authorName: m.author?.global_name ?? m.author?.username ?? "Inconnu",
      authorAvatar: m.author?.avatar ? `https://cdn.discordapp.com/avatars/${m.author.id}/${m.author.avatar}.png` : null,
      authorIsBot: !!m.author?.bot,
      content: m.content ?? "",
      embeds: m.embeds ?? [],
      attachments: (m.attachments ?? []).map((a: Json) => ({ name: a.filename, url: a.url })),
      timestamp: m.timestamp,
      nonce: m.nonce ?? null,
    }));
  }
  async pinMessage(channelId: string, messageId: string, reason: string) {
    await this.call(() => this.rest.put(Routes.channelMessagesPin(channelId, messageId), reasonHeader(reason)));
  }

  async createAutomodRule(guildId: string, body: Json, reason: string) {
    const r = await this.call<Json>(() => this.rest.post(Routes.guildAutoModerationRules(guildId), { body, ...reasonHeader(reason) }));
    return { id: r.id as string };
  }
  async editAutomodRule(guildId: string, ruleId: string, body: Json, reason: string) {
    // Le type de déclencheur ne peut pas être modifié après création.
    const { trigger_type: _t, ...rest } = body;
    await this.call(() => this.rest.patch(Routes.guildAutoModerationRule(guildId, ruleId), { body: rest, ...reasonHeader(reason) }));
  }

  async putOnboarding(guildId: string, body: Json, reason: string) {
    await this.call(() => this.rest.put(Routes.guildOnboarding(guildId), { body, ...reasonHeader(reason) }));
  }
  async editWelcomeScreen(guildId: string, body: Json, reason: string) {
    await this.call(() => this.rest.patch(Routes.guildWelcomeScreen(guildId), { body, ...reasonHeader(reason) }));
  }

  async createWebhook(channelId: string, name: string, reason: string) {
    const w = await this.call<Json>(() => this.rest.post(Routes.channelWebhooks(channelId), { body: { name }, ...reasonHeader(reason) }));
    return { id: w.id as string, token: w.token as string };
  }
  async executeWebhook(webhookId: string, token: string, body: Json) {
    const query = new URLSearchParams({ wait: "true" });
    const m = await this.call<Json>(() => this.rest.post(Routes.webhook(webhookId, token), { body, query, auth: false }));
    return { id: m.id as string };
  }
  async deleteWebhook(webhookId: string, reason: string) {
    await this.call(() => this.rest.delete(Routes.webhook(webhookId), reasonHeader(reason)));
  }
}

function toStateChannel(c: Json): StateChannel {
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    parentId: c.parent_id ?? null,
    position: c.position ?? 0,
    topic: c.topic ?? null,
    nsfw: !!c.nsfw,
    rateLimitPerUser: c.rate_limit_per_user ?? 0,
    userLimit: c.user_limit,
    bitrate: c.bitrate,
    permissionOverwrites: (c.permission_overwrites ?? []).map((o: Json) => ({ id: o.id, type: o.type, allow: String(o.allow), deny: String(o.deny) })),
    availableTags: c.available_tags?.map((t: Json) => ({ id: t.id, name: t.name, emojiName: t.emoji_name, moderated: t.moderated })),
    defaultReactionEmoji: c.default_reaction_emoji?.emoji_name ?? null,
  };
}
