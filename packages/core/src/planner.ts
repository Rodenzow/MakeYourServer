import {
  categoryPayload,
  channelDiscordType,
  effectiveChannelOverwrites,
  guildSettingsPayload,
  overwritesPayload,
  rolePayload,
  type Resolver,
} from "./discord-payloads";
import {
  DISCORD_CHANNEL_TYPE,
  channelTypeName,
  type GuildState,
  type StateChannel,
  type StateOverwrite,
  type StateRole,
} from "./guild-state";
import { ALL_PERMISSIONS, PERMISSIONS, fromBitfield, permissionBit, type PermissionKey } from "./permissions";
import { EVERYONE, type Category, type Channel, type Role, type ServerSpec } from "./schema";
import { allChannels, extractTokens, findCategory, findChannel, normalizeChannelName } from "./spec-utils";
import { validateSpec, type Issue } from "./validate";

export type InstallMode = "empty" | "merge" | "targeted";
export type ConflictResolution = "reuse" | "update" | "create";

export const MODE_LABELS: Record<InstallMode, string> = {
  empty: "Serveur vide",
  merge: "Ajout à un serveur existant",
  targeted: "Modification ciblée",
};

export interface PlanOptions {
  mode: InstallMode;
  /** Mode ciblé : identifiants locaux à appliquer (+ "settings", "onboarding", "welcome"). */
  selected?: string[];
  /** Que faire des salons existants qui ne font pas partie du projet. */
  existingChannels?: "keep" | "archive" | "delete";
  /** Que faire des rôles existants qui ne font pas partie du projet. */
  existingRoles?: "keep" | "delete";
  /** Résolution des conflits de noms, par identifiant local. */
  resolutions?: Record<string, ConflictResolution>;
  includeMessages?: boolean;
  /** Opérations décochées par l’utilisateur (messages, AutoMod…). */
  excluded?: string[];
}

export type OpKind =
  | "safety-backup"
  | "role.create"
  | "role.update"
  | "role.adopt"
  | "role.positions"
  | "category.create"
  | "category.update"
  | "category.adopt"
  | "channel.create"
  | "channel.update"
  | "channel.adopt"
  | "guild.settings"
  | "community.enable"
  | "channel.positions"
  | "archive.category"
  | "channel.archive"
  | "channel.delete"
  | "role.delete"
  | "message.send"
  | "message.update"
  | "automod.create"
  | "automod.update"
  | "onboarding.put"
  | "welcome.put";

export type OpImpact = "create" | "update" | "existing" | "archive" | "delete" | "none";

export interface PlanOp {
  /** Clé stable et unique : garantit l’idempotence lors des reprises. */
  key: string;
  kind: OpKind;
  phase: number;
  label: string;
  impact: OpImpact;
  destructive: boolean;
  localId?: string;
  /** Identifiant Discord d’un élément existant visé par l’opération. */
  targetId?: string;
  details?: string[];
  /** Peut être décochée par l’utilisateur. */
  optional?: boolean;
}

export interface Conflict {
  localId: string;
  kind: "role" | "category" | "channel";
  name: string;
  existingId: string;
  existingName: string;
  resolution: ConflictResolution;
}

export interface ManualStep {
  id: string;
  title: string;
  why: string;
  instructions: string[];
  /** Contenu préparé à copier-coller. */
  content?: Array<{ label: string; value: string }>;
}

export type PreviewStatus = "new" | "updated" | "kept" | "reused" | "archived" | "deleted";
export interface PreviewChannel {
  name: string;
  type: string;
  status: PreviewStatus;
  localId?: string;
}
export interface PreviewCategory {
  name: string | null;
  status: PreviewStatus;
  channels: PreviewChannel[];
}

export interface Plan {
  mode: InstallMode;
  guildId: string;
  guildName: string;
  ops: PlanOp[];
  conflicts: Conflict[];
  blockers: Issue[];
  warnings: Issue[];
  manualSteps: ManualStep[];
  requiresConfirmation: boolean;
  summary: { create: number; update: number; archive: number; delete: number; messages: number; existingKept: number };
  before: { categories: PreviewCategory[]; roles: Array<{ name: string; color: number }> };
  after: { categories: PreviewCategory[]; roles: Array<{ name: string; color: number; status: PreviewStatus }> };
  /** Correspondances projet → serveur déterminées par l’analyse (réutilisations). */
  adoptions: Record<string, string>;
}

export interface PlanInput {
  spec: ServerSpec;
  state: GuildState;
  /** Correspondances déjà connues (installations précédentes du même projet sur ce serveur). */
  mapping: Record<string, string>;
  options: PlanOptions;
}

const PHASE = {
  backup: 0,
  roles: 1,
  rolePositions: 2,
  categories: 3,
  channels: 4,
  settings: 5,
  community: 6,
  communityChannels: 7,
  archive: 8,
  channelPositions: 9,
  destructive: 10,
  messages: 11,
  automod: 12,
  onboarding: 13,
} as const;

const lower = (s: string) => s.trim().toLocaleLowerCase("fr");

function sameOverwrites(a: StateOverwrite[], b: StateOverwrite[]): boolean {
  const norm = (x: StateOverwrite[]) =>
    x
      .filter((o) => o.type === 0)
      .map((o) => `${o.id}:${BigInt(o.allow)}:${BigInt(o.deny)}`)
      .sort()
      .join("|");
  return norm(a) === norm(b);
}

export function buildPlan(input: PlanInput): Plan {
  const { spec, state, options } = input;
  const mapping = { ...input.mapping };
  const mode = options.mode;
  const resolutions = options.resolutions ?? {};
  const excluded = new Set(options.excluded ?? []);
  const includeMessages = options.includeMessages ?? true;

  const ops: PlanOp[] = [];
  const blockers: Issue[] = [];
  const warnings: Issue[] = [];
  const conflicts: Conflict[] = [];
  const manualSteps: ManualStep[] = [];
  const adoptions: Record<string, string> = {};

  const block = (code: string, message: string, elementId?: string) => blockers.push({ level: "error", code, message, elementId });
  const warn = (code: string, message: string, elementId?: string) => warnings.push({ level: "warning", code, message, elementId });

  /* -------------------- Validation du projet -------------------- */
  const validation = validateSpec(spec);
  validation.errors.forEach((e) => blockers.push(e));
  validation.warnings.forEach((w) => warnings.push(w));

  /* -------------------- Bot : droits et hiérarchie -------------------- */
  const bot = state.bot;
  const botPerms = bot ? (bot.isAdmin ? ALL_PERMISSIONS : BigInt(bot.permissions)) : 0n;
  const botHas = (k: PermissionKey) => (botPerms & permissionBit(k)) !== 0n;
  const botTop = bot?.highestRolePosition ?? 0;
  const isCommunity = state.features.includes("COMMUNITY");

  if (!bot) block("bot-missing", "Le bot Make Your Server n’est pas présent sur ce serveur. Invitez-le avant de continuer.");

  /* -------------------- Périmètre (mode ciblé) -------------------- */
  const scope = new Set<string>();
  const autoAdded = new Set<string>();
  const allIds = [
    ...spec.roles.map((r) => r.id),
    ...spec.categories.map((c) => c.id),
    ...allChannels(spec).map((c) => c.channel.id),
    ...spec.messages.map((m) => m.id),
    ...spec.automod.map((a) => a.id),
    "settings",
    "onboarding",
    "welcome",
  ];
  if (mode === "targeted") (options.selected ?? []).forEach((id) => scope.add(id));
  else allIds.forEach((id) => scope.add(id));
  if (mode === "targeted" && scope.size === 0) block("empty-selection", "Mode ciblé : sélectionnez au moins un élément à appliquer.");

  /* -------------------- Correspondances existantes -------------------- */
  const roleById = new Map(state.roles.map((r) => [r.id, r]));
  const chanById = new Map(state.channels.map((c) => [c.id, c]));
  const usedExisting = new Set<string>();
  // Ne garder que les correspondances encore valides sur le serveur.
  for (const [local, discordId] of Object.entries(mapping)) {
    if (roleById.has(discordId) || chanById.has(discordId)) usedExisting.add(discordId);
  }

  type Match = { status: "mapped" | "conflict" | "new"; existingId?: string; resolution?: ConflictResolution };
  const matches = new Map<string, Match>();
  const defaultResolution: ConflictResolution = mode === "empty" ? "update" : "reuse";

  const matchRole = (role: Role): Match => {
    const mapped = mapping[role.id];
    if (mapped && roleById.has(mapped)) return { status: "mapped", existingId: mapped };
    const existing = state.roles.find(
      (r) => r.id !== state.id && !r.managed && !usedExisting.has(r.id) && lower(r.name) === lower(role.name),
    );
    if (existing) {
      usedExisting.add(existing.id);
      return { status: "conflict", existingId: existing.id, resolution: resolutions[role.id] ?? defaultResolution };
    }
    return { status: "new" };
  };
  for (const role of spec.roles) matches.set(role.id, matchRole(role));

  for (const cat of spec.categories) {
    const mapped = mapping[cat.id];
    if (mapped && chanById.has(mapped)) {
      matches.set(cat.id, { status: "mapped", existingId: mapped });
      continue;
    }
    const existing = state.channels.find(
      (c) => c.type === DISCORD_CHANNEL_TYPE.category && !usedExisting.has(c.id) && lower(c.name) === lower(cat.name),
    );
    if (existing) {
      usedExisting.add(existing.id);
      matches.set(cat.id, { status: "conflict", existingId: existing.id, resolution: resolutions[cat.id] ?? defaultResolution });
    } else matches.set(cat.id, { status: "new" });
  }

  const compatibleType = (spec: Channel, existing: StateChannel) => {
    const want = channelTypeName(channelDiscordType(spec, true));
    const wantFallback = channelTypeName(channelDiscordType(spec, false));
    const have = channelTypeName(existing.type);
    return have === want || have === wantFallback;
  };
  for (const { channel, category } of allChannels(spec)) {
    const mapped = mapping[channel.id];
    if (mapped && chanById.has(mapped)) {
      matches.set(channel.id, { status: "mapped", existingId: mapped });
      continue;
    }
    const parentExisting = category ? matches.get(category.id)?.existingId ?? null : null;
    const name = normalizeChannelName(channel.type, channel.name);
    const candidates = state.channels.filter(
      (c) => c.type !== DISCORD_CHANNEL_TYPE.category && !usedExisting.has(c.id) && lower(c.name) === lower(name) && compatibleType(channel, c),
    );
    const existing = candidates.find((c) => c.parentId === parentExisting) ?? candidates[0];
    if (existing) {
      usedExisting.add(existing.id);
      matches.set(channel.id, { status: "conflict", existingId: existing.id, resolution: resolutions[channel.id] ?? defaultResolution });
    } else matches.set(channel.id, { status: "new" });
  }

  for (const [localId, m] of matches) {
    if (m.status !== "conflict") continue;
    const role = spec.roles.find((r) => r.id === localId);
    const kind = role ? "role" : findCategory(spec, localId) ? "category" : "channel";
    const name = role?.name ?? findCategory(spec, localId)?.name ?? findChannel(spec, localId)?.channel.name ?? localId;
    const existingName = (role ? roleById.get(m.existingId!)?.name : chanById.get(m.existingId!)?.name) ?? "";
    conflicts.push({ localId, kind, name, existingId: m.existingId!, existingName, resolution: m.resolution! });
  }

  /** L’élément existera-t-il sur le serveur sans être créé par ce plan ? */
  const existsWithoutCreation = (localId: string) => {
    const m = matches.get(localId);
    return !!m && (m.status === "mapped" || (m.status === "conflict" && m.resolution !== "create"));
  };

  /* -------------------- Dépendances du mode ciblé -------------------- */
  if (mode === "targeted") {
    const addDep = (id: string) => {
      if (!scope.has(id) && !existsWithoutCreation(id) && id !== EVERYONE) {
        scope.add(id);
        autoAdded.add(id);
      }
    };
    let changed = true;
    while (changed) {
      const before = scope.size;
      for (const { channel, category } of allChannels(spec)) {
        if (!scope.has(channel.id)) continue;
        if (category) addDep(category.id);
        effectiveChannelOverwrites(channel, category).forEach((o) => addDep(o.target));
      }
      for (const cat of spec.categories) if (scope.has(cat.id)) cat.overwrites.forEach((o) => addDep(o.target));
      for (const m of spec.messages) {
        if (!scope.has(m.id)) continue;
        addDep(m.channelId);
        m.buttons.forEach((b) => "roleId" in b && addDep(b.roleId));
        const texts = [m.content, ...m.embeds.flatMap((e) => [e.title, e.description, e.footer, ...e.fields.map((f) => f.value)])];
        texts.forEach((t) => {
          const tk = extractTokens(t);
          tk.channels.forEach(addDep);
          tk.roles.forEach(addDep);
        });
      }
      changed = scope.size !== before;
    }
    autoAdded.forEach((id) =>
      warn("auto-dependency", `« ${labelOf(spec, id)} » sera aussi installé car un élément sélectionné en dépend.`, id),
    );
  }

  /* -------------------- Résolveur prévisionnel -------------------- */
  const projected = (localId: string): string | null => {
    const m = matches.get(localId);
    if (!m) return null;
    if (m.existingId && (m.status === "mapped" || m.resolution !== "create")) return m.existingId;
    return scope.has(localId) ? `new:${localId}` : null;
  };
  const resolver: Resolver = {
    guildId: state.id,
    role: projected,
    channel: projected,
    serverName: state.name,
  };

  /* -------------------- Sauvegarde de sécurité -------------------- */
  ops.push({
    key: "safety-backup",
    kind: "safety-backup",
    phase: PHASE.backup,
    label: "Sauvegarde de sécurité de la configuration actuelle",
    impact: "none",
    destructive: false,
  });

  /* -------------------- Rôles -------------------- */
  let rolesTouched = false;
  const permsNeeded = new Set<PermissionKey>();
  for (const role of spec.roles) {
    if (!scope.has(role.id)) continue;
    const m = matches.get(role.id)!;
    role.permissions.forEach((p) => permsNeeded.add(p));
    if (m.status === "new" || m.resolution === "create") {
      ops.push({ key: `role.create:${role.id}`, kind: "role.create", phase: PHASE.roles, label: `Créer le rôle « ${role.name} »`, impact: "create", destructive: false, localId: role.id });
      rolesTouched = true;
      continue;
    }
    const existing = roleById.get(m.existingId!)!;
    const shouldUpdate = m.status === "mapped" || m.resolution === "update";
    const diff = roleDiff(role, existing);
    if (!shouldUpdate) {
      adoptions[role.id] = existing.id;
      ops.push({ key: `role.adopt:${role.id}`, kind: "role.adopt", phase: PHASE.roles, label: `Réutiliser le rôle existant « ${existing.name} » sans le modifier`, impact: "none", destructive: false, localId: role.id, targetId: existing.id });
      continue;
    }
    if (existing.position >= botTop && bot && !diff.length) {
      adoptions[role.id] = existing.id;
      ops.push({ key: `role.adopt:${role.id}`, kind: "role.adopt", phase: PHASE.roles, label: `Réutiliser le rôle « ${existing.name} »`, impact: "none", destructive: false, localId: role.id, targetId: existing.id });
      continue;
    }
    if (existing.position >= botTop && bot) {
      block("role-above-bot", `Le rôle « ${existing.name} » est au-dessus du rôle du bot : il ne peut pas être modifié. Remontez le rôle du bot dans les réglages du serveur ou choisissez « Réutiliser sans modifier ».`, role.id);
      continue;
    }
    if (diff.length || m.status === "conflict") {
      adoptions[role.id] = existing.id;
      ops.push({
        key: `role.update:${role.id}`,
        kind: "role.update",
        phase: PHASE.roles,
        label: `Mettre à jour le rôle « ${existing.name} »`,
        impact: m.status === "mapped" ? "update" : "existing",
        destructive: false,
        localId: role.id,
        targetId: existing.id,
        details: diff,
      });
      rolesTouched = true;
    }
  }
  if (rolesTouched) {
    ops.push({ key: "role.positions", kind: "role.positions", phase: PHASE.rolePositions, label: "Ordonner la hiérarchie des rôles", impact: "update", destructive: false });
  }

  /* -------------------- Catégories & salons -------------------- */
  const willEnableCommunity = spec.settings.community && !isCommunity && scope.has("settings");
  const communityAvailable = isCommunity || (willEnableCommunity && botHas("ADMINISTRATOR"));
  let channelsTouched = false;

  for (const cat of spec.categories) {
    if (!scope.has(cat.id)) continue;
    const m = matches.get(cat.id)!;
    cat.overwrites.forEach((o) => [...o.allow, ...o.deny].forEach((p) => permsNeeded.add(p)));
    if (m.status === "new" || m.resolution === "create") {
      ops.push({ key: `category.create:${cat.id}`, kind: "category.create", phase: PHASE.categories, label: `Créer la catégorie « ${cat.name} »`, impact: "create", destructive: false, localId: cat.id });
      channelsTouched = true;
      continue;
    }
    const existing = chanById.get(m.existingId!)!;
    adoptions[cat.id] = existing.id;
    if (m.status === "conflict" && m.resolution === "reuse") {
      ops.push({ key: `category.adopt:${cat.id}`, kind: "category.adopt", phase: PHASE.categories, label: `Réutiliser la catégorie existante « ${existing.name} »`, impact: "none", destructive: false, localId: cat.id, targetId: existing.id });
      continue;
    }
    const desired = categoryPayload(cat, resolver);
    const details: string[] = [];
    if (existing.name !== desired.name) details.push(`Nom : « ${existing.name} » → « ${desired.name} »`);
    if (!sameOverwrites(existing.permissionOverwrites, desired.permission_overwrites)) details.push("Permissions de la catégorie");
    if (details.length || m.status === "conflict") {
      ops.push({ key: `category.update:${cat.id}`, kind: "category.update", phase: PHASE.categories, label: `Mettre à jour la catégorie « ${existing.name} »`, impact: m.status === "mapped" ? "update" : "existing", destructive: false, localId: cat.id, targetId: existing.id, details });
      channelsTouched = true;
    }
  }

  for (const { channel, category } of allChannels(spec)) {
    if (!scope.has(channel.id)) continue;
    const m = matches.get(channel.id)!;
    effectiveChannelOverwrites(channel, category).forEach((o) => [...o.allow, ...o.deny].forEach((p) => permsNeeded.add(p)));
    const needsCommunity = channel.type === "announcement" || channel.type === "stage";
    const phase = needsCommunity && willEnableCommunity && communityAvailable ? PHASE.communityChannels : PHASE.channels;
    if (needsCommunity && !communityAvailable) {
      warn("community-fallback", `« ${channel.name} » sera créé comme salon ${channel.type === "announcement" ? "textuel" : "vocal"} car la Communauté n’est pas active.`, channel.id);
    }
    if (m.status === "new" || m.resolution === "create") {
      ops.push({ key: `channel.create:${channel.id}`, kind: "channel.create", phase, label: `Créer ${channelKindLabel(channel)} « ${normalizeChannelName(channel.type, channel.name)} »`, impact: "create", destructive: false, localId: channel.id });
      channelsTouched = true;
      continue;
    }
    const existing = chanById.get(m.existingId!)!;
    adoptions[channel.id] = existing.id;
    if (m.status === "conflict" && m.resolution === "reuse") {
      ops.push({ key: `channel.adopt:${channel.id}`, kind: "channel.adopt", phase, label: `Réutiliser le salon existant « ${existing.name} »`, impact: "none", destructive: false, localId: channel.id, targetId: existing.id });
      continue;
    }
    const details = channelDiff(channel, category, existing, resolver, communityAvailable);
    if (details.length || m.status === "conflict") {
      ops.push({ key: `channel.update:${channel.id}`, kind: "channel.update", phase, label: `Mettre à jour le salon « ${existing.name} »`, impact: m.status === "mapped" ? "update" : "existing", destructive: false, localId: channel.id, targetId: existing.id, details });
      channelsTouched = true;
    }
  }

  /* -------------------- Contrôle des permissions accordables -------------------- */
  if (bot && !bot.isAdmin) {
    const missing = [...permsNeeded].filter((p) => !botHas(p));
    if (missing.length) {
      block(
        "bot-missing-permissions",
        `Le bot ne possède pas certaines permissions qu’il doit attribuer (${missing.map((p) => PERMISSIONS[p].label).join(", ")}). Discord interdit d’accorder une permission qu’on ne possède pas : donnez-les au bot ou la permission Administrateur.`,
      );
    }
  }

  /* -------------------- Réglages & Communauté -------------------- */
  if (scope.has("settings")) {
    const payload = guildSettingsPayload(spec, resolver, { includeCommunityChannels: false });
    const details = settingsDiff(payload, state);
    if (details.length) {
      ops.push({ key: "guild.settings", kind: "guild.settings", phase: PHASE.settings, label: "Appliquer les réglages du serveur", impact: "existing", destructive: false, details });
    }
    if (willEnableCommunity) {
      if (botHas("ADMINISTRATOR")) {
        ops.push({ key: "community.enable", kind: "community.enable", phase: PHASE.community, label: "Activer la Communauté Discord", impact: "existing", destructive: false, details: ["Salon du règlement et salon des mises à jour définis"] });
      } else {
        warn("community-manual", "Le bot n’est pas Administrateur : la Communauté devra être activée manuellement. Les salons d’annonces seront créés comme salons textuels.");
        manualSteps.push({
          id: "community",
          title: "Activer la Communauté",
          why: "Discord exige la permission Administrateur pour activer la Communauté via l’API.",
          instructions: [
            "Ouvrez les Paramètres du serveur → Activer la Communauté.",
            `Choisissez le salon du règlement : #${labelOf(spec, spec.settings.rulesChannelId ?? "")}.`,
            `Choisissez le salon des mises à jour : #${labelOf(spec, spec.settings.publicUpdatesChannelId ?? "")}.`,
            "Relancez ensuite une installation ciblée pour appliquer l’onboarding et l’écran d’accueil.",
          ],
        });
      }
    }
    if (spec.settings.community && (isCommunity || willEnableCommunity)) {
      const rulesId = projected(spec.settings.rulesChannelId ?? "");
      if (isCommunity && rulesId && rulesId !== state.rulesChannelId) {
        ops.push({ key: "guild.community-channels", kind: "guild.settings", phase: PHASE.community, label: "Définir les salons de la Communauté", impact: "existing", destructive: false });
      }
    }
  }
  if (!botHas("MANAGE_GUILD") && ops.some((o) => o.kind === "guild.settings")) block("bot-manage-guild", "Le bot a besoin de la permission « Gérer le serveur » pour appliquer les réglages.");
  if (!botHas("MANAGE_ROLES") && ops.some((o) => o.kind.startsWith("role."))) block("bot-manage-roles", "Le bot a besoin de la permission « Gérer les rôles ».");
  if (!botHas("MANAGE_CHANNELS") && ops.some((o) => o.kind.startsWith("channel.") || o.kind.startsWith("category."))) block("bot-manage-channels", "Le bot a besoin de la permission « Gérer les salons ».");

  /* -------------------- Éléments existants hors projet -------------------- */
  const keptExisting = state.channels.filter((c) => !usedExisting.has(c.id));
  const protectedChannels = new Set([state.rulesChannelId, state.publicUpdatesChannelId, state.safetyAlertsChannelId].filter(Boolean) as string[]);
  const existingPolicy = mode === "targeted" ? "keep" : options.existingChannels ?? "keep";
  if (existingPolicy === "archive") {
    const toArchive = keptExisting.filter((c) => c.type !== DISCORD_CHANNEL_TYPE.category);
    if (toArchive.length) {
      ops.push({ key: "archive.category", kind: "archive.category", phase: PHASE.archive, label: "Créer la catégorie « 📦 Archives »", impact: "create", destructive: false });
      for (const c of toArchive) {
        ops.push({ key: `channel.archive:${c.id}`, kind: "channel.archive", phase: PHASE.archive, label: `Archiver « ${c.name} » (déplacé et verrouillé, contenu conservé)`, impact: "archive", destructive: false, targetId: c.id });
      }
    }
  } else if (existingPolicy === "delete") {
    const deletable = keptExisting.filter((c) => !protectedChannels.has(c.id));
    keptExisting.filter((c) => protectedChannels.has(c.id)).forEach((c) => warn("protected-channel", `« ${c.name} » est requis par la Communauté et ne sera pas supprimé.`));
    // Salons d’abord, catégories ensuite.
    const ordered = [...deletable.filter((c) => c.type !== DISCORD_CHANNEL_TYPE.category), ...deletable.filter((c) => c.type === DISCORD_CHANNEL_TYPE.category)];
    for (const c of ordered) {
      ops.push({ key: `channel.delete:${c.id}`, kind: "channel.delete", phase: PHASE.destructive, label: `Supprimer définitivement « ${c.name} » et tout son historique`, impact: "delete", destructive: true, targetId: c.id });
    }
  }
  if (mode !== "targeted" && options.existingRoles === "delete") {
    const deletableRoles = state.roles.filter((r) => r.id !== state.id && !r.managed && !usedExisting.has(r.id));
    for (const r of deletableRoles) {
      if (r.position >= botTop) {
        warn("role-above-bot", `Le rôle « ${r.name} » est au-dessus du bot : il ne peut pas être supprimé.`);
        continue;
      }
      ops.push({ key: `role.delete:${r.id}`, kind: "role.delete", phase: PHASE.destructive, label: `Supprimer le rôle « ${r.name} » (retiré à tous ses membres)`, impact: "delete", destructive: true, targetId: r.id });
    }
  }
  if (channelsTouched || ops.some((o) => o.kind === "channel.archive")) {
    ops.push({ key: "channel.positions", kind: "channel.positions", phase: PHASE.channelPositions, label: "Ordonner les catégories et les salons", impact: "update", destructive: false });
  }

  /* -------------------- Messages -------------------- */
  if (includeMessages) {
    if (spec.messages.some((m) => scope.has(m.id)) && !botHas("SEND_MESSAGES")) block("bot-send", "Le bot a besoin de la permission « Envoyer des messages ».");
    for (const msg of spec.messages) {
      if (!scope.has(msg.id)) continue;
      const ch = findChannel(spec, msg.channelId)?.channel;
      const mapped = mapping[msg.id];
      const key = mapped ? `message.update:${msg.id}` : `message.send:${msg.id}`;
      if (excluded.has(key)) continue;
      const title = msg.embeds[0]?.title ?? msg.content?.slice(0, 40) ?? msg.id;
      ops.push({
        key,
        kind: mapped ? "message.update" : "message.send",
        phase: PHASE.messages,
        label: `${mapped ? "Mettre à jour" : "Publier"} « ${title} » dans #${ch ? normalizeChannelName(ch.type, ch.name) : msg.channelId}${msg.pin ? " (épinglé)" : ""}`,
        impact: mapped ? "update" : "create",
        destructive: false,
        localId: msg.id,
        targetId: mapped,
        optional: true,
      });
    }
    if (spec.messages.some((m) => m.pin && scope.has(m.id)) && !botHas("PIN_MESSAGES")) {
      warn("bot-pin", "Le bot n’a pas la permission « Épingler des messages » : les messages seront publiés sans être épinglés.");
    }
  }

  /* -------------------- AutoMod -------------------- */
  const existingRules = state.automodRules ?? [];
  const singleTypes: Record<string, number> = { spam: 3, keyword_preset: 4, mention_spam: 5 };
  let keywordRules = existingRules.filter((r) => r.triggerType === 1).length;
  for (const rule of spec.automod) {
    if (!scope.has(rule.id)) continue;
    const mapped = mapping[rule.id] && existingRules.find((r) => r.id === mapping[rule.id]);
    const sameType = rule.trigger.type in singleTypes ? existingRules.find((r) => r.triggerType === singleTypes[rule.trigger.type]) : undefined;
    const sameName = existingRules.find((r) => lower(r.name) === lower(rule.name));
    const target = mapped || sameType || sameName;
    const key = target ? `automod.update:${rule.id}` : `automod.create:${rule.id}`;
    if (excluded.has(key)) continue;
    if (!target && rule.trigger.type === "keyword") {
      keywordRules++;
      if (keywordRules > 6) {
        warn("automod-limit", `AutoMod « ${rule.name} » ignorée : le serveur a déjà atteint la limite de 6 règles par mots-clés.`, rule.id);
        continue;
      }
    }
    ops.push({
      key,
      kind: target ? "automod.update" : "automod.create",
      phase: PHASE.automod,
      label: target ? `Remplacer la règle AutoMod « ${target.name} » par « ${rule.name} »` : `Créer la règle AutoMod « ${rule.name} »`,
      impact: target ? (mapped ? "update" : "existing") : "create",
      destructive: !!target && !mapped,
      localId: rule.id,
      targetId: target?.id,
      optional: true,
    });
  }
  if (ops.some((o) => o.kind.startsWith("automod.")) && !botHas("MANAGE_GUILD")) block("bot-automod", "AutoMod : le bot a besoin de la permission « Gérer le serveur ».");

  /* -------------------- Onboarding & écran d’accueil -------------------- */
  if (spec.onboarding?.enabled && scope.has("onboarding")) {
    if (communityAvailable) {
      const replacing = !!state.onboarding && (state.onboarding.enabled || state.onboarding.prompts.length > 0) && !mapping["__onboarding"];
      ops.push({
        key: "onboarding.put",
        kind: "onboarding.put",
        phase: PHASE.onboarding,
        label: replacing ? "Remplacer la configuration d’intégration (onboarding) actuelle" : "Configurer l’intégration (onboarding) et ses questions",
        impact: replacing ? "existing" : "create",
        destructive: replacing,
        details: [`${spec.onboarding.prompts.length} question(s)`, `${spec.onboarding.defaultChannelIds.length} salon(s) par défaut`],
        optional: true,
      });
      if (!botHas("MANAGE_ROLES") || !botHas("MANAGE_GUILD")) block("bot-onboarding", "Onboarding : le bot a besoin de « Gérer le serveur » et « Gérer les rôles ».");
    } else warn("onboarding-skipped", "L’onboarding ne peut pas être configuré sans la Communauté : il sera ignoré.");
  }
  if (spec.welcomeScreen?.enabled && scope.has("welcome")) {
    if (communityAvailable) {
      const replacing = !!state.welcomeScreen && state.welcomeScreen.welcomeChannels.length > 0 && !mapping["__welcome"];
      ops.push({
        key: "welcome.put",
        kind: "welcome.put",
        phase: PHASE.onboarding,
        label: replacing ? "Remplacer l’écran d’accueil actuel" : "Configurer l’écran d’accueil",
        impact: replacing ? "existing" : "create",
        destructive: replacing,
        optional: true,
      });
    } else warn("welcome-skipped", "L’écran d’accueil nécessite la Communauté : il sera ignoré.");
  }

  /* -------------------- Étapes manuelles -------------------- */
  if (spec.serverGuide && (spec.serverGuide.newMemberActions.length || spec.serverGuide.resourceChannels.length || spec.serverGuide.welcomeMessage)) {
    const g = spec.serverGuide;
    manualSteps.push({
      id: "server-guide",
      title: "Configurer le Guide du serveur",
      why: "Le Guide du serveur (accueil, actions des nouveaux membres, ressources) n’est pas modifiable via l’API publique de Discord. Son contenu est prêt : il suffit de le recopier.",
      instructions: [
        "Le serveur doit avoir la Communauté activée.",
        "Paramètres du serveur → Intégration (Onboarding) → Guide du serveur.",
        "Collez le message d’accueil, ajoutez les actions et les ressources ci-dessous.",
      ],
      content: [
        ...(g.welcomeMessage ? [{ label: "Message d’accueil", value: g.welcomeMessage }] : []),
        ...g.newMemberActions.map((a, i) => ({ label: `Action ${i + 1} — #${labelOf(spec, a.channelId)}`, value: `${a.title}${a.description ? `\n${a.description}` : ""}` })),
        ...g.resourceChannels.map((r, i) => ({ label: `Ressource ${i + 1} — #${labelOf(spec, r.channelId)}`, value: `${r.title}${r.description ? `\n${r.description}` : ""}` })),
      ],
    });
  }
  if (bot?.isAdmin) {
    manualSteps.push({
      id: "bot-admin",
      title: "Réduire les permissions du bot (facultatif)",
      why: "La permission Administrateur facilite l’installation. Les boutons de rôles, tickets et suggestions ont seulement besoin de « Gérer les rôles », « Gérer les fils » et « Envoyer des messages ».",
      instructions: ["Paramètres du serveur → Rôles → rôle du bot → retirez « Administrateur » et gardez les permissions listées ci-dessus."],
    });
  }

  /* -------------------- Limites du serveur -------------------- */
  const creating = ops.filter((o) => o.kind === "channel.create" || o.kind === "category.create").length;
  const deleting = ops.filter((o) => o.kind === "channel.delete").length;
  if (state.channels.length + creating - deleting + (ops.some((o) => o.kind === "archive.category") ? 1 : 0) > 500)
    block("limit-channels", "L’installation dépasserait la limite Discord de 500 salons.");
  const newRoles = ops.filter((o) => o.kind === "role.create").length;
  if (state.roles.length + newRoles > 250) block("limit-roles", "L’installation dépasserait la limite Discord de 250 rôles.");
  for (const cat of spec.categories) {
    const existingId = matches.get(cat.id)?.existingId;
    if (!existingId) continue;
    const existingChildren = state.channels.filter((c) => c.parentId === existingId && !usedExisting.has(c.id)).length;
    const total = existingChildren + cat.channels.length;
    if (total > 50) block("limit-category", `La catégorie « ${cat.name} » contiendrait ${total} salons (maximum 50).`, cat.id);
  }

  /* -------------------- Aperçu avant / après -------------------- */
  const before = previewFromState(state);
  const after = previewAfter(spec, state, matches, scope, ops, communityAvailable);

  ops.sort((a, b) => a.phase - b.phase);
  const count = (pred: (o: PlanOp) => boolean) => ops.filter(pred).length;
  const summary = {
    create: count((o) => o.impact === "create" && !o.kind.startsWith("message.")),
    update: count((o) => o.impact === "update" || o.impact === "existing"),
    archive: count((o) => o.kind === "channel.archive"),
    delete: count((o) => o.impact === "delete"),
    messages: count((o) => o.kind.startsWith("message.")),
    existingKept: existingPolicy === "keep" ? keptExisting.length : 0,
  };

  return {
    mode,
    guildId: state.id,
    guildName: state.name,
    ops,
    conflicts,
    blockers,
    warnings,
    manualSteps,
    requiresConfirmation: ops.some((o) => o.destructive),
    summary,
    before,
    after,
    adoptions,
  };
}

/* -------------------------------------------------------------------------- */

function labelOf(spec: ServerSpec, id: string): string {
  return spec.roles.find((r) => r.id === id)?.name ?? findCategory(spec, id)?.name ?? findChannel(spec, id)?.channel.name ?? spec.messages.find((m) => m.id === id)?.embeds[0]?.title ?? id;
}

function channelKindLabel(ch: Channel): string {
  return { text: "le salon textuel", voice: "le salon vocal", announcement: "le salon d’annonces", forum: "le forum", stage: "la conférence" }[ch.type];
}

export function roleDiff(role: Role, existing: StateRole): string[] {
  const d: string[] = [];
  const p = rolePayload(role);
  if (existing.name !== p.name) d.push(`Nom : « ${existing.name} » → « ${p.name} »`);
  if (existing.color !== p.color) d.push("Couleur");
  if (existing.hoist !== p.hoist) d.push(p.hoist ? "Affiché séparément" : "Plus affiché séparément");
  if (existing.mentionable !== p.mentionable) d.push(p.mentionable ? "Mentionnable" : "Non mentionnable");
  if (BigInt(existing.permissions) !== BigInt(p.permissions)) {
    const before = new Set(fromBitfield(existing.permissions));
    const after = new Set(role.permissions);
    const added = [...after].filter((x) => !before.has(x)).map((k) => PERMISSIONS[k].label);
    const removed = [...before].filter((x) => !after.has(x)).map((k) => PERMISSIONS[k].label);
    if (added.length) d.push(`Permissions ajoutées : ${added.join(", ")}`);
    if (removed.length) d.push(`Permissions retirées : ${removed.join(", ")}`);
  }
  return d;
}

function channelDiff(ch: Channel, category: Category | null, existing: StateChannel, r: Resolver, community: boolean): string[] {
  const d: string[] = [];
  const name = normalizeChannelName(ch.type, ch.name);
  if (existing.name !== name) d.push(`Nom : « ${existing.name} » → « ${name} »`);
  if ((existing.topic ?? "") !== (ch.topic ?? "") && ch.type !== "voice" && ch.type !== "stage") d.push("Description");
  const parent = category ? r.channel(category.id) : null;
  if ((existing.parentId ?? null) !== parent) d.push("Catégorie");
  if ((existing.rateLimitPerUser ?? 0) !== ch.slowmode && (ch.type === "text" || ch.type === "forum")) d.push(`Mode lent : ${ch.slowmode} s`);
  if (!!existing.nsfw !== ch.nsfw) d.push(ch.nsfw ? "Réservé aux adultes" : "Plus réservé aux adultes");
  const desired = overwritesPayload(r, effectiveChannelOverwrites(ch, category));
  if (!sameOverwrites(existing.permissionOverwrites, desired)) d.push("Permissions du salon");
  if (channelDiscordType(ch, community) !== existing.type) d.push("Type de salon (conversion)");
  return d;
}

function settingsDiff(payload: Record<string, unknown>, state: GuildState): string[] {
  const d: string[] = [];
  const labels: Record<string, [string, unknown]> = {
    verification_level: ["Niveau de vérification", state.verificationLevel],
    explicit_content_filter: ["Filtre de contenu", state.explicitContentFilter],
    default_message_notifications: ["Notifications par défaut", state.defaultMessageNotifications],
    system_channel_flags: ["Messages système", state.systemChannelFlags],
    afk_timeout: ["Délai d’inactivité", state.afkTimeout],
    preferred_locale: ["Langue", state.preferredLocale],
    system_channel_id: ["Salon des messages système", state.systemChannelId],
    afk_channel_id: ["Salon AFK", state.afkChannelId],
  };
  for (const [k, v] of Object.entries(payload)) {
    const entry = labels[k];
    if (!entry) continue;
    if (String(v) !== String(entry[1])) d.push(entry[0]);
  }
  return d;
}

function previewFromState(state: GuildState): Plan["before"] {
  const cats = state.channels.filter((c) => c.type === DISCORD_CHANNEL_TYPE.category).sort((a, b) => a.position - b.position);
  const chans = state.channels.filter((c) => c.type !== DISCORD_CHANNEL_TYPE.category).sort((a, b) => a.position - b.position);
  const toPreview = (c: StateChannel): PreviewChannel => ({ name: c.name, type: channelTypeName(c.type), status: "kept" });
  return {
    categories: [
      { name: null, status: "kept" as const, channels: chans.filter((c) => !c.parentId).map(toPreview) },
      ...cats.map((cat) => ({ name: cat.name, status: "kept" as const, channels: chans.filter((c) => c.parentId === cat.id).map(toPreview) })),
    ].filter((c) => c.name !== null || c.channels.length > 0),
    roles: state.roles
      .filter((r) => r.id !== state.id)
      .sort((a, b) => b.position - a.position)
      .map((r) => ({ name: r.name, color: r.color })),
  };
}

function previewAfter(
  spec: ServerSpec,
  state: GuildState,
  matches: Map<string, { status: string; existingId?: string; resolution?: ConflictResolution }>,
  scope: Set<string>,
  ops: PlanOp[],
  community: boolean,
): Plan["after"] {
  const opFor = (localId: string) => ops.find((o) => o.localId === localId);
  const statusFor = (localId: string): PreviewStatus => {
    const op = opFor(localId);
    if (!op) return "kept";
    if (op.kind.endsWith(".create")) return "new";
    if (op.kind.endsWith(".adopt")) return "reused";
    return "updated";
  };
  const consumed = new Set<string>();
  for (const [id, m] of matches) if (m.existingId && scope.has(id) && m.resolution !== "create") consumed.add(m.existingId);
  const archivedIds = new Set(ops.filter((o) => o.kind === "channel.archive").map((o) => o.targetId!));
  const deletedIds = new Set(ops.filter((o) => o.kind === "channel.delete").map((o) => o.targetId!));

  const specChannel = (c: Channel): PreviewChannel => ({
    name: normalizeChannelName(c.type, c.name),
    type: channelTypeName(channelDiscordType(c, community)),
    status: scope.has(c.id) ? statusFor(c.id) : "kept",
    localId: c.id,
  });
  const leftovers = (parentId: string | null) =>
    state.channels
      .filter((c) => c.type !== DISCORD_CHANNEL_TYPE.category && c.parentId === parentId && !consumed.has(c.id) && !archivedIds.has(c.id))
      .map((c) => ({ name: c.name, type: channelTypeName(c.type), status: (deletedIds.has(c.id) ? "deleted" : "kept") as PreviewStatus }));

  const categories: PreviewCategory[] = [];
  const top = [...spec.uncategorized.filter((c) => scope.has(c.id) || matches.get(c.id)?.status === "mapped").map(specChannel), ...leftovers(null)];
  if (top.length) categories.push({ name: null, status: "kept", channels: top });
  for (const cat of spec.categories) {
    const m = matches.get(cat.id);
    if (!scope.has(cat.id) && m?.status !== "mapped") continue;
    const parentId = m?.existingId && m.resolution !== "create" ? m.existingId : null;
    categories.push({
      name: cat.name,
      status: scope.has(cat.id) ? statusFor(cat.id) : "kept",
      channels: [...cat.channels.filter((c) => scope.has(c.id) || matches.get(c.id)?.status === "mapped").map(specChannel), ...(parentId ? leftovers(parentId) : [])],
    });
  }
  for (const cat of state.channels.filter((c) => c.type === DISCORD_CHANNEL_TYPE.category && !consumed.has(c.id))) {
    const deleted = deletedIds.has(cat.id);
    categories.push({ name: cat.name, status: deleted ? "deleted" : "kept", channels: leftovers(cat.id) });
  }
  if (archivedIds.size) {
    categories.push({
      name: "📦 Archives",
      status: "new",
      channels: state.channels.filter((c) => archivedIds.has(c.id)).map((c) => ({ name: c.name, type: channelTypeName(c.type), status: "archived" as const })),
    });
  }

  const deletedRoles = new Set(ops.filter((o) => o.kind === "role.delete").map((o) => o.targetId!));
  const specRoleIds = new Set<string>();
  const roles: Plan["after"]["roles"] = spec.roles
    .filter((r) => scope.has(r.id) || matches.get(r.id)?.status === "mapped")
    .map((r) => {
      const m = matches.get(r.id);
      if (m?.existingId) specRoleIds.add(m.existingId);
      return { name: r.name, color: r.color, status: scope.has(r.id) ? statusFor(r.id) : ("kept" as PreviewStatus) };
    });
  for (const r of state.roles.filter((x) => x.id !== state.id && !specRoleIds.has(x.id)).sort((a, b) => b.position - a.position)) {
    roles.push({ name: r.name, color: r.color, status: deletedRoles.has(r.id) ? "deleted" : "kept" });
  }
  return { categories, roles };
}
