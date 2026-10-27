import {
  ALL_PERMISSIONS,
  DEFAULT_EVERYONE_PERMISSIONS,
  DISCORD_CHANNEL_TYPE,
  permissionBit,
  toBitfield,
  type GuildState,
  type PermissionKey,
  type StateChannel,
} from "@mys/core";
import { GatewayError, type GuildBasics, type GuildGateway, type MemberInfo, type RawMessage } from "./gateway";
import { guildPermissionsFor, highestRolePosition } from "./permissions";

/** Erreur simulant l’arrêt brutal du processus juste après une action réussie côté Discord. */
export class SimulatedCrash extends Error {
  constructor(method: string) {
    super(`Arrêt simulé après ${method}`);
    this.name = "SimulatedCrash";
  }
}

export interface FakeFailure {
  method: keyof GuildGateway;
  /** Filtre optionnel sur les arguments. */
  when?: (args: unknown[]) => boolean;
  error: GatewayError;
  /** Nombre d’échecs à produire (défaut : illimité). */
  times?: number;
}

let seq = 0n;
function snowflake(): string {
  const t = BigInt(Date.now() - 1420070400000) << 22n;
  seq = (seq + 1n) & 0xfffn;
  return (t | (1n << 17n) | seq).toString();
}

const perm = (keys: PermissionKey[]) => toBitfield(keys).toString();

/**
 * Serveur Discord simulé en mémoire. Reproduit les contraintes importantes
 * (permissions du bot, hiérarchie des rôles, limites, Communauté, nonce des
 * messages) pour tester le moteur et proposer un mode « simulation ».
 */
export class FakeGateway implements GuildGateway {
  readonly simulated = true;
  readonly calls: Array<{ method: string; args: unknown[] }> = [];
  readonly messages = new Map<string, RawMessage[]>();
  readonly pins = new Set<string>();
  readonly members = new Map<string, string[]>();
  private nonces = new Map<string, string>();
  failures: FakeFailure[] = [];
  /** Arrêt simulé après le N-ième appel de la méthode (l’action est appliquée). */
  crashAfter: { method: keyof GuildGateway; count: number } | null = null;
  private methodCounts = new Map<string, number>();

  constructor(
    public state: GuildState,
    readonly botUserId: string,
  ) {}

  static emptyGuild(opts: { guildId?: string; ownerId?: string; botAdmin?: boolean; name?: string; botPermissions?: PermissionKey[] } = {}) {
    const guildId = opts.guildId ?? snowflake();
    const botUserId = "900000000000000001";
    const ownerId = opts.ownerId ?? "100000000000000001";
    const botRoleId = snowflake();
    const catText = snowflake();
    const catVoice = snowflake();
    const state: GuildState = {
      id: guildId,
      name: opts.name ?? "Serveur de test",
      ownerId,
      features: [],
      verificationLevel: 0,
      explicitContentFilter: 0,
      defaultMessageNotifications: 0,
      systemChannelId: null,
      systemChannelFlags: 0,
      rulesChannelId: null,
      publicUpdatesChannelId: null,
      safetyAlertsChannelId: null,
      afkChannelId: null,
      afkTimeout: 300,
      preferredLocale: "fr",
      description: null,
      premiumTier: 0,
      roles: [
        { id: guildId, name: "@everyone", color: 0, hoist: false, mentionable: false, permissions: perm(DEFAULT_EVERYONE_PERMISSIONS), position: 0, managed: false },
        {
          id: botRoleId,
          name: "Make Your Server",
          color: 0,
          hoist: false,
          mentionable: false,
          permissions: opts.botAdmin === false ? perm(opts.botPermissions ?? []) : ALL_PERMISSIONS.toString(),
          position: 1,
          managed: true,
          tags: { botId: botUserId },
        },
      ],
      channels: [
        { id: catText, name: "Salons textuels", type: 4, parentId: null, position: 0, permissionOverwrites: [] },
        { id: snowflake(), name: "général", type: 0, parentId: catText, position: 0, permissionOverwrites: [] },
        { id: catVoice, name: "Salons vocaux", type: 4, parentId: null, position: 1, permissionOverwrites: [] },
        { id: snowflake(), name: "Général", type: 2, parentId: catVoice, position: 0, permissionOverwrites: [], bitrate: 64000, userLimit: 0 },
      ],
      automodRules: [],
      onboarding: { enabled: false, mode: 0, defaultChannelIds: [], prompts: [] },
      welcomeScreen: null,
      fetchedAt: new Date().toISOString(),
    };
    const gw = new FakeGateway(state, botUserId);
    gw.members.set(botUserId, [botRoleId]);
    gw.members.set(ownerId, []);
    return gw;
  }

  /** Copie d’un serveur réel : utilisée par le mode « simulation » (aucune action sur Discord). */
  static fromState(state: GuildState, botUserId: string) {
    const gw = new FakeGateway(structuredClone(state), botUserId);
    gw.members.set(botUserId, state.bot?.roleIds ?? []);
    return gw;
  }

  private record(method: keyof GuildGateway, args: unknown[]) {
    this.calls.push({ method, args });
    for (const f of this.failures) {
      if (f.method !== method) continue;
      if (f.when && !f.when(args)) continue;
      if (f.times !== undefined) {
        if (f.times <= 0) continue;
        f.times--;
      }
      throw f.error;
    }
  }

  private after(method: keyof GuildGateway) {
    const n = (this.methodCounts.get(method) ?? 0) + 1;
    this.methodCounts.set(method, n);
    if (this.crashAfter && this.crashAfter.method === method && this.crashAfter.count === n) {
      this.crashAfter = null;
      throw new SimulatedCrash(method);
    }
  }

  private botPerms(): bigint {
    return guildPermissionsFor(this.state, this.botUserId, this.members.get(this.botUserId) ?? []);
  }
  private botTop(): number {
    return highestRolePosition(this.state, this.members.get(this.botUserId) ?? []);
  }
  private requirePerm(k: PermissionKey) {
    if (!(this.botPerms() & permissionBit(k))) throw new GatewayError("Le bot n’a pas les permissions nécessaires (ou le rôle visé est au-dessus du sien).", 50013, 403, false);
  }
  private requireGrantable(bits: bigint) {
    const p = this.botPerms();
    if (p === ALL_PERMISSIONS) return;
    if ((bits & ~p) !== 0n) throw new GatewayError("Le bot n’a pas les permissions nécessaires (ou le rôle visé est au-dessus du sien).", 50013, 403, false);
  }
  private channel(id: string): StateChannel {
    const c = this.state.channels.find((x) => x.id === id);
    if (!c) throw new GatewayError("Salon introuvable (il a peut-être été supprimé entre-temps).", 10003, 404, false);
    return c;
  }

  async fetchState(guildId: string): Promise<GuildState> {
    this.record("fetchState", [guildId]);
    const s = structuredClone(this.state);
    const roles = this.members.get(this.botUserId) ?? [];
    const p = this.botPerms();
    s.bot = { userId: this.botUserId, roleIds: roles, permissions: p.toString(), highestRolePosition: this.botTop(), isAdmin: (p & permissionBit("ADMINISTRATOR")) !== 0n };
    s.fetchedAt = new Date().toISOString();
    return s;
  }

  async fetchGuild(_guildId: string): Promise<GuildBasics> {
    const s = structuredClone(this.state);
    return { id: s.id, name: s.name, ownerId: s.ownerId, roles: s.roles, features: s.features };
  }

  async getMember(_guildId: string, userId: string): Promise<MemberInfo | null> {
    const roles = this.members.get(userId);
    return roles ? { userId, roles } : null;
  }

  async createRole(_g: string, body: Record<string, any>, _r: string) {
    this.record("createRole", [body]);
    this.requirePerm("MANAGE_ROLES");
    this.requireGrantable(BigInt(body.permissions ?? "0"));
    if (this.state.roles.length >= 250) throw new GatewayError("Le serveur a atteint la limite de 250 rôles.", 30005, 400, false);
    const id = snowflake();
    for (const r of this.state.roles) if (r.position >= 1 && r.id !== this.state.id) r.position++;
    this.state.roles.push({ id, name: body.name, color: body.color ?? 0, hoist: !!body.hoist, mentionable: !!body.mentionable, permissions: String(body.permissions ?? "0"), position: 1, managed: false });
    this.after("createRole");
    return { id };
  }

  async editRole(_g: string, roleId: string, body: Record<string, any>, _r: string) {
    this.record("editRole", [roleId, body]);
    this.requirePerm("MANAGE_ROLES");
    const role = this.state.roles.find((r) => r.id === roleId);
    if (!role) throw new GatewayError("Rôle introuvable (il a peut-être été supprimé entre-temps).", 10011, 404, false);
    if (role.position >= this.botTop()) throw new GatewayError("Le bot n’a pas les permissions nécessaires (ou le rôle visé est au-dessus du sien).", 50013, 403, false);
    if (body.permissions !== undefined) this.requireGrantable(BigInt(body.permissions));
    Object.assign(role, {
      name: body.name ?? role.name,
      color: body.color ?? role.color,
      hoist: body.hoist ?? role.hoist,
      mentionable: body.mentionable ?? role.mentionable,
      permissions: body.permissions !== undefined ? String(body.permissions) : role.permissions,
    });
    this.after("editRole");
  }

  async deleteRole(_g: string, roleId: string) {
    this.record("deleteRole", [roleId]);
    this.requirePerm("MANAGE_ROLES");
    const role = this.state.roles.find((r) => r.id === roleId);
    if (!role) throw new GatewayError("Rôle introuvable (il a peut-être été supprimé entre-temps).", 10011, 404, false);
    if (role.position >= this.botTop() || role.managed) throw new GatewayError("Le bot n’a pas les permissions nécessaires (ou le rôle visé est au-dessus du sien).", 50013, 403, false);
    this.state.roles = this.state.roles.filter((r) => r.id !== roleId);
    this.after("deleteRole");
  }

  async setRolePositions(_g: string, positions: Array<{ id: string; position: number }>) {
    this.record("setRolePositions", [positions]);
    this.requirePerm("MANAGE_ROLES");
    const top = this.botTop();
    for (const p of positions) {
      const role = this.state.roles.find((r) => r.id === p.id);
      if (!role) throw new GatewayError("Rôle introuvable (il a peut-être été supprimé entre-temps).", 10011, 404, false);
      if (role.position >= top || p.position >= top) throw new GatewayError("Le bot n’a pas les permissions nécessaires (ou le rôle visé est au-dessus du sien).", 50013, 403, false);
      role.position = p.position;
    }
    this.after("setRolePositions");
  }

  async createChannel(_g: string, body: Record<string, any>, _r: string) {
    this.record("createChannel", [body]);
    this.requirePerm("MANAGE_CHANNELS");
    if (this.state.channels.length >= 500) throw new GatewayError("Le serveur a atteint la limite de 500 salons.", 30013, 400, false);
    if ((body.type === DISCORD_CHANNEL_TYPE.announcement || body.type === DISCORD_CHANNEL_TYPE.stage) && !this.state.features.includes("COMMUNITY"))
      throw new GatewayError("Données refusées par Discord. Détail : type : salon réservé aux serveurs Communauté", 50035, 400, false);
    if (body.parent_id) {
      const parent = this.channel(body.parent_id);
      if (parent.type !== 4) throw new GatewayError("Données refusées par Discord.", 50035, 400, false);
      if (this.state.channels.filter((c) => c.parentId === body.parent_id).length >= 50) throw new GatewayError("Données refusées par Discord. Détail : catégorie pleine", 50035, 400, false);
    }
    for (const o of body.permission_overwrites ?? []) this.requireGrantable(BigInt(o.allow) | BigInt(o.deny));
    const id = snowflake();
    const siblings = this.state.channels.filter((c) => c.parentId === (body.parent_id ?? null) && c.type === body.type);
    this.state.channels.push({
      id,
      name: body.name,
      type: body.type,
      parentId: body.parent_id ?? null,
      position: siblings.length,
      topic: body.topic ?? null,
      nsfw: !!body.nsfw,
      rateLimitPerUser: body.rate_limit_per_user ?? 0,
      userLimit: body.user_limit,
      bitrate: body.bitrate,
      permissionOverwrites: (body.permission_overwrites ?? []).map((o: any) => ({ id: o.id, type: o.type, allow: String(o.allow), deny: String(o.deny) })),
      availableTags: body.available_tags?.map((t: any) => ({ id: snowflake(), name: t.name, emojiName: t.emoji_name, moderated: t.moderated })),
    });
    this.after("createChannel");
    return { id };
  }

  async editChannel(channelId: string, body: Record<string, any>, _r: string) {
    this.record("editChannel", [channelId, body]);
    this.requirePerm("MANAGE_CHANNELS");
    const c = this.channel(channelId);
    if (body.type !== undefined && body.type !== c.type) {
      const ok = [0, 5].includes(body.type) && [0, 5].includes(c.type) && this.state.features.includes("COMMUNITY");
      if (!ok) throw new GatewayError("Action impossible sur ce type de salon.", 50024, 400, false);
    }
    for (const o of body.permission_overwrites ?? []) this.requireGrantable(BigInt(o.allow) | BigInt(o.deny));
    if (body.name !== undefined) c.name = body.name;
    if (body.type !== undefined) c.type = body.type;
    if (body.topic !== undefined) c.topic = body.topic;
    if (body.nsfw !== undefined) c.nsfw = body.nsfw;
    if (body.rate_limit_per_user !== undefined) c.rateLimitPerUser = body.rate_limit_per_user;
    if (body.parent_id !== undefined) c.parentId = body.parent_id;
    if (body.user_limit !== undefined) c.userLimit = body.user_limit;
    if (body.bitrate !== undefined) c.bitrate = body.bitrate;
    if (body.permission_overwrites !== undefined)
      c.permissionOverwrites = body.permission_overwrites.map((o: any) => ({ id: o.id, type: o.type, allow: String(o.allow), deny: String(o.deny) }));
    this.after("editChannel");
  }

  async deleteChannel(channelId: string) {
    this.record("deleteChannel", [channelId]);
    this.requirePerm("MANAGE_CHANNELS");
    const c = this.channel(channelId);
    if ([this.state.rulesChannelId, this.state.publicUpdatesChannelId].includes(c.id)) throw new GatewayError("Données refusées par Discord.", 50074, 400, false);
    this.state.channels = this.state.channels.filter((x) => x.id !== channelId);
    for (const x of this.state.channels) if (x.parentId === channelId) x.parentId = null;
    this.after("deleteChannel");
  }

  async setChannelPositions(_g: string, positions: Array<{ id: string; position: number; parent_id?: string | null }>) {
    this.record("setChannelPositions", [positions]);
    this.requirePerm("MANAGE_CHANNELS");
    for (const p of positions) {
      const c = this.channel(p.id);
      c.position = p.position;
      if (p.parent_id !== undefined) c.parentId = p.parent_id;
    }
    this.after("setChannelPositions");
  }

  async editGuild(_g: string, body: Record<string, any>) {
    this.record("editGuild", [body]);
    this.requirePerm("MANAGE_GUILD");
    if (body.features) {
      const adding = body.features.includes("COMMUNITY") && !this.state.features.includes("COMMUNITY");
      if (adding) {
        this.requirePerm("ADMINISTRATOR");
        const rules = body.rules_channel_id ?? this.state.rulesChannelId;
        const updates = body.public_updates_channel_id ?? this.state.publicUpdatesChannelId;
        if (!rules || !updates) throw new GatewayError("Données refusées par Discord. Détail : salons de la Communauté manquants", 50035, 400, false);
        if ((body.verification_level ?? this.state.verificationLevel) < 1 || (body.explicit_content_filter ?? this.state.explicitContentFilter) < 2)
          throw new GatewayError("Données refusées par Discord. Détail : niveau de vérification insuffisant", 50035, 400, false);
      }
      this.state.features = body.features;
    }
    const map: Record<string, keyof GuildState> = {
      verification_level: "verificationLevel",
      explicit_content_filter: "explicitContentFilter",
      default_message_notifications: "defaultMessageNotifications",
      system_channel_id: "systemChannelId",
      system_channel_flags: "systemChannelFlags",
      rules_channel_id: "rulesChannelId",
      public_updates_channel_id: "publicUpdatesChannelId",
      safety_alerts_channel_id: "safetyAlertsChannelId",
      afk_channel_id: "afkChannelId",
      afk_timeout: "afkTimeout",
      preferred_locale: "preferredLocale",
      description: "description",
      name: "name",
    };
    for (const [k, v] of Object.entries(body)) if (map[k]) (this.state as unknown as Record<string, unknown>)[map[k]] = v;
    this.after("editGuild");
  }

  async sendMessage(channelId: string, body: Record<string, any>) {
    this.record("sendMessage", [channelId, body]);
    this.channel(channelId);
    if (body.enforce_nonce && body.nonce && this.nonces.has(`${channelId}:${body.nonce}`)) {
      return { id: this.nonces.get(`${channelId}:${body.nonce}`)! };
    }
    const id = snowflake();
    const list = this.messages.get(channelId) ?? [];
    list.unshift({
      id,
      channelId,
      authorId: this.botUserId,
      authorName: "Make Your Server",
      authorAvatar: null,
      authorIsBot: true,
      content: body.content ?? "",
      embeds: body.embeds ?? [],
      attachments: [],
      timestamp: new Date().toISOString(),
      nonce: body.nonce ?? null,
    });
    this.messages.set(channelId, list);
    if (body.nonce) this.nonces.set(`${channelId}:${body.nonce}`, id);
    this.after("sendMessage");
    return { id };
  }

  async editMessage(channelId: string, messageId: string, body: Record<string, any>) {
    this.record("editMessage", [channelId, messageId, body]);
    const m = (this.messages.get(channelId) ?? []).find((x) => x.id === messageId);
    if (!m) throw new GatewayError("Message introuvable.", 10008, 404, false);
    m.content = body.content ?? m.content;
    m.embeds = body.embeds ?? m.embeds;
    this.after("editMessage");
  }

  async messageExists(channelId: string, messageId: string) {
    return (this.messages.get(channelId) ?? []).some((m) => m.id === messageId);
  }

  async listMessages(channelId: string, opts: { limit: number; before?: string }) {
    this.record("listMessages", [channelId, opts]);
    let list = this.messages.get(channelId) ?? [];
    if (opts.before) list = list.filter((m) => BigInt(m.id) < BigInt(opts.before!));
    return list.slice(0, opts.limit);
  }

  async pinMessage(channelId: string, messageId: string) {
    this.record("pinMessage", [channelId, messageId]);
    this.requirePerm("PIN_MESSAGES");
    this.pins.add(`${channelId}:${messageId}`);
    this.after("pinMessage");
  }

  async createAutomodRule(_g: string, body: Record<string, any>) {
    this.record("createAutomodRule", [body]);
    this.requirePerm("MANAGE_GUILD");
    const rules = this.state.automodRules ?? [];
    const sameType = rules.filter((r) => r.triggerType === body.trigger_type).length;
    if ((body.trigger_type === 1 && sameType >= 6) || (body.trigger_type !== 1 && sameType >= 1))
      throw new GatewayError("Limite de règles AutoMod atteinte pour ce type.", 30035, 400, false);
    const id = snowflake();
    rules.push({ id, name: body.name, eventType: 1, triggerType: body.trigger_type, triggerMetadata: body.trigger_metadata, actions: body.actions, enabled: body.enabled, exemptRoles: body.exempt_roles, exemptChannels: body.exempt_channels });
    this.state.automodRules = rules;
    this.after("createAutomodRule");
    return { id };
  }

  async editAutomodRule(_g: string, ruleId: string, body: Record<string, any>) {
    this.record("editAutomodRule", [ruleId, body]);
    this.requirePerm("MANAGE_GUILD");
    const rule = (this.state.automodRules ?? []).find((r) => r.id === ruleId);
    if (!rule) throw new GatewayError("Règle AutoMod introuvable.", 10066, 404, false);
    Object.assign(rule, { name: body.name, triggerMetadata: body.trigger_metadata, actions: body.actions, enabled: body.enabled, exemptRoles: body.exempt_roles, exemptChannels: body.exempt_channels });
    this.after("editAutomodRule");
  }

  async putOnboarding(_g: string, body: Record<string, any>) {
    this.record("putOnboarding", [body]);
    this.requirePerm("MANAGE_GUILD");
    this.requirePerm("MANAGE_ROLES");
    if (!this.state.features.includes("COMMUNITY")) throw new GatewayError("Configuration d’onboarding refusée par Discord.", 350000, 400, false);
    if (body.enabled && (body.default_channel_ids?.length ?? 0) < 7) throw new GatewayError("Discord exige au moins 7 salons par défaut dans l’onboarding.", 220001, 400, false);
    this.state.onboarding = {
      enabled: body.enabled,
      mode: body.mode,
      defaultChannelIds: body.default_channel_ids,
      prompts: body.prompts.map((p: any) => ({
        id: p.id,
        type: p.type,
        title: p.title,
        singleSelect: p.single_select,
        required: p.required,
        inOnboarding: p.in_onboarding,
        options: p.options.map((o: any) => ({ id: o.id, title: o.title, description: o.description, emojiName: o.emoji_name, roleIds: o.role_ids, channelIds: o.channel_ids })),
      })),
    };
    this.after("putOnboarding");
  }

  async editWelcomeScreen(_g: string, body: Record<string, any>) {
    this.record("editWelcomeScreen", [body]);
    this.requirePerm("MANAGE_GUILD");
    this.state.welcomeScreen = {
      description: body.description,
      enabled: body.enabled,
      welcomeChannels: body.welcome_channels.map((w: any) => ({ channelId: w.channel_id, description: w.description, emojiName: w.emoji_name })),
    };
    this.after("editWelcomeScreen");
  }

  async createWebhook(channelId: string, name: string) {
    this.record("createWebhook", [channelId, name]);
    this.requirePerm("MANAGE_WEBHOOKS");
    return { id: snowflake(), token: `fake-${channelId}` };
  }
  async executeWebhook(webhookId: string, token: string, body: Record<string, any>) {
    this.record("executeWebhook", [webhookId, body]);
    const channelId = token.replace("fake-", "");
    const id = snowflake();
    const list = this.messages.get(channelId) ?? [];
    list.unshift({ id, channelId, authorId: webhookId, authorName: body.username ?? "Webhook", authorAvatar: body.avatar_url ?? null, authorIsBot: true, content: body.content ?? "", embeds: body.embeds ?? [], attachments: [], timestamp: new Date().toISOString() });
    this.messages.set(channelId, list);
    return { id };
  }
  async deleteWebhook(webhookId: string) {
    this.record("deleteWebhook", [webhookId]);
  }

  count(method: keyof GuildGateway): number {
    return this.calls.filter((c) => c.method === method).length;
  }
}
