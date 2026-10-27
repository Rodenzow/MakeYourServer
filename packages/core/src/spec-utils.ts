import { EVERYONE, type Category, type Channel, type Overwrite, type Role, type ServerSpec } from "./schema";

/** Parcourt tous les salons (hors catégories) avec leur catégorie parente. */
export function allChannels(spec: ServerSpec): Array<{ channel: Channel; category: Category | null }> {
  const out: Array<{ channel: Channel; category: Category | null }> = [];
  for (const ch of spec.uncategorized) out.push({ channel: ch, category: null });
  for (const cat of spec.categories) for (const ch of cat.channels) out.push({ channel: ch, category: cat });
  return out;
}

export function findChannel(spec: ServerSpec, id: string) {
  return allChannels(spec).find((c) => c.channel.id === id) ?? null;
}

export function findRole(spec: ServerSpec, id: string): Role | null {
  return spec.roles.find((r) => r.id === id) ?? null;
}

export function findCategory(spec: ServerSpec, id: string): Category | null {
  return spec.categories.find((c) => c.id === id) ?? null;
}

export function channelCount(spec: ServerSpec): number {
  return spec.uncategorized.length + spec.categories.reduce((n, c) => n + 1 + c.channels.length, 0);
}

/** Ensemble des identifiants locaux utilisés (pour garantir l’unicité). */
export function usedIds(spec: ServerSpec): Set<string> {
  const ids = new Set<string>([EVERYONE]);
  spec.roles.forEach((r) => ids.add(r.id));
  spec.categories.forEach((c) => ids.add(c.id));
  allChannels(spec).forEach(({ channel }) => ids.add(channel.id));
  spec.messages.forEach((m) => ids.add(m.id));
  spec.automod.forEach((a) => ids.add(a.id));
  spec.onboarding?.prompts.forEach((p) => {
    ids.add(p.id);
    p.options.forEach((o) => ids.add(o.id));
  });
  return ids;
}

export function slugify(input: string): string {
  return (
    input
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "element"
  );
}

/** Génère un identifiant local unique à partir d’un libellé. */
export function uniqueId(spec: ServerSpec, base: string, extra?: Set<string>): string {
  const ids = usedIds(spec);
  const root = slugify(base);
  let candidate = root;
  let i = 2;
  while (ids.has(candidate) || extra?.has(candidate)) candidate = `${root}-${i++}`;
  return candidate;
}

/** Nom de salon tel que Discord l’affichera (les salons textuels sont en minuscules, sans espaces). */
export function normalizeChannelName(type: Channel["type"], name: string): string {
  const trimmed = name.trim();
  if (type === "voice" || type === "stage") return trimmed.slice(0, 100);
  return (
    trimmed
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/-{2,}/g, "-")
      .slice(0, 100) || "salon"
  );
}

export function cloneSpec<T>(v: T): T {
  return structuredClone(v);
}

/* -------------------------------------------------------------------------- */
/*                      Jetons de référence dans les textes                    */
/* -------------------------------------------------------------------------- */

/**
 * Dans les messages, les références s’écrivent {#idSalon} et {@idRole}.
 * Elles sont converties en vraies mentions Discord au moment de l’installation.
 */
export const CHANNEL_TOKEN_RE = /\{#([a-z0-9][a-z0-9_-]{0,63})\}/g;
export const ROLE_TOKEN_RE = /\{@([a-z0-9][a-z0-9_-]{0,63})\}/g;

export function extractTokens(text: string | undefined): { channels: string[]; roles: string[] } {
  if (!text) return { channels: [], roles: [] };
  return {
    channels: [...text.matchAll(CHANNEL_TOKEN_RE)].map((m) => m[1]!),
    roles: [...text.matchAll(ROLE_TOKEN_RE)].map((m) => m[1]!),
  };
}

export function renderTokens(
  text: string,
  resolve: { channel: (id: string) => string | null; role: (id: string) => string | null; server?: string },
): string {
  return text
    .replace(CHANNEL_TOKEN_RE, (_m, id: string) => resolve.channel(id) ?? `#${id}`)
    .replace(ROLE_TOKEN_RE, (_m, id: string) => resolve.role(id) ?? `@${id}`)
    .replace(/\{server\}/g, resolve.server ?? "le serveur");
}

/** Remplace les jetons visant un élément supprimé par son nom en clair. */
function stripTokenFor(text: string | undefined, kind: "channel" | "role", id: string, label: string) {
  if (!text) return text;
  const token = kind === "channel" ? `{#${id}}` : `{@${id}}`;
  return text.split(token).join(kind === "channel" ? `#${label}` : `@${label}`);
}

function mapMessageTexts(spec: ServerSpec, fn: (t: string | undefined) => string | undefined) {
  for (const m of spec.messages) {
    m.content = fn(m.content);
    for (const e of m.embeds) {
      e.title = fn(e.title);
      e.description = fn(e.description);
      e.footer = fn(e.footer);
      for (const f of e.fields) {
        f.name = fn(f.name) ?? f.name;
        f.value = fn(f.value) ?? f.value;
      }
    }
  }
  if (spec.features.welcome) spec.features.welcome.message = fn(spec.features.welcome.message) ?? spec.features.welcome.message;
}

/* -------------------------------------------------------------------------- */
/*                Suppressions en cascade (cohérence des références)           */
/* -------------------------------------------------------------------------- */

const withoutTarget = (ows: Overwrite[], id: string) => ows.filter((o) => o.target !== id);

/** Supprime un rôle et toutes les références qui le visent. Retourne une nouvelle spec. */
export function removeRole(input: ServerSpec, roleId: string): ServerSpec {
  const spec = cloneSpec(input);
  const role = findRole(spec, roleId);
  if (!role) return spec;
  spec.roles = spec.roles.filter((r) => r.id !== roleId);
  for (const cat of spec.categories) {
    cat.overwrites = withoutTarget(cat.overwrites, roleId);
    for (const ch of cat.channels) ch.overwrites = withoutTarget(ch.overwrites, roleId);
  }
  for (const ch of spec.uncategorized) ch.overwrites = withoutTarget(ch.overwrites, roleId);
  for (const m of spec.messages) {
    m.buttons = m.buttons.filter((b) => !("roleId" in b) || b.roleId !== roleId);
  }
  for (const rule of spec.automod) rule.exemptRoles = rule.exemptRoles.filter((r) => r !== roleId);
  if (spec.onboarding) {
    for (const p of spec.onboarding.prompts) for (const o of p.options) o.roleIds = o.roleIds.filter((r) => r !== roleId);
  }
  const f = spec.features;
  if (f.rulesGate?.roleId === roleId) delete f.rulesGate;
  if (f.tickets) {
    f.tickets.staffRoleIds = f.tickets.staffRoleIds.filter((r) => r !== roleId);
    if (f.tickets.staffRoleIds.length === 0) delete f.tickets;
  }
  mapMessageTexts(spec, (t) => stripTokenFor(t, "role", roleId, role.name));
  return pruneEmptyPrompts(spec);
}

/** Supprime un salon (ou une catégorie et tous ses salons) et nettoie les références. */
export function removeChannel(input: ServerSpec, channelId: string): ServerSpec {
  let spec = cloneSpec(input);
  const cat = findCategory(spec, channelId);
  if (cat) {
    for (const ch of [...cat.channels]) spec = removeChannel(spec, ch.id);
    spec.categories = spec.categories.filter((c) => c.id !== channelId);
    return spec;
  }
  const found = findChannel(spec, channelId);
  if (!found) return spec;
  const label = found.channel.name;
  spec.uncategorized = spec.uncategorized.filter((c) => c.id !== channelId);
  for (const c of spec.categories) c.channels = c.channels.filter((ch) => ch.id !== channelId);
  spec.messages = spec.messages.filter((m) => m.channelId !== channelId);
  for (const rule of spec.automod) {
    rule.exemptChannels = rule.exemptChannels.filter((c) => c !== channelId);
    rule.actions = rule.actions.filter((a) => a.type !== "alert" || a.channelId !== channelId);
    if (rule.actions.length === 0) rule.actions = [{ type: "block" }];
  }
  if (spec.onboarding) {
    spec.onboarding.defaultChannelIds = spec.onboarding.defaultChannelIds.filter((c) => c !== channelId);
    for (const p of spec.onboarding.prompts) for (const o of p.options) o.channelIds = o.channelIds.filter((c) => c !== channelId);
  }
  if (spec.welcomeScreen) spec.welcomeScreen.channels = spec.welcomeScreen.channels.filter((c) => c.channelId !== channelId);
  if (spec.serverGuide) {
    spec.serverGuide.newMemberActions = spec.serverGuide.newMemberActions.filter((a) => a.channelId !== channelId);
    spec.serverGuide.resourceChannels = spec.serverGuide.resourceChannels.filter((a) => a.channelId !== channelId);
  }
  const s = spec.settings;
  for (const key of ["systemChannelId", "rulesChannelId", "publicUpdatesChannelId", "safetyAlertsChannelId", "afkChannelId"] as const) {
    if (s[key] === channelId) delete s[key];
  }
  const f = spec.features;
  if (f.welcome?.channelId === channelId) delete f.welcome;
  if (f.joinLogs?.channelId === channelId) delete f.joinLogs;
  if (f.tickets?.channelId === channelId) delete f.tickets;
  if (f.suggestions?.channelId === channelId) delete f.suggestions;
  // Les boutons qui dépendent d’une fonctionnalité supprimée deviennent inutilisables : on les retire.
  for (const m of spec.messages) {
    m.buttons = m.buttons.filter(
      (b) => (b.action !== "ticket-open" || f.tickets) && (b.action !== "suggestion-open" || f.suggestions),
    );
  }
  mapMessageTexts(spec, (t) => stripTokenFor(t, "channel", channelId, label));
  return pruneEmptyPrompts(spec);
}

function pruneEmptyPrompts(spec: ServerSpec): ServerSpec {
  if (!spec.onboarding) return spec;
  for (const p of spec.onboarding.prompts) {
    p.options = p.options.filter((o) => o.roleIds.length > 0 || o.channelIds.length > 0);
  }
  spec.onboarding.prompts = spec.onboarding.prompts.filter((p) => p.options.length > 0);
  return spec;
}

/** Déplace un salon vers une catégorie (null = hors catégorie) à un index donné. */
export function moveChannel(input: ServerSpec, channelId: string, targetCategoryId: string | null, index: number): ServerSpec {
  const spec = cloneSpec(input);
  const found = findChannel(spec, channelId);
  if (!found) return spec;
  const ch = found.channel;
  spec.uncategorized = spec.uncategorized.filter((c) => c.id !== channelId);
  for (const c of spec.categories) c.channels = c.channels.filter((x) => x.id !== channelId);
  const list = targetCategoryId === null ? spec.uncategorized : findCategory(spec, targetCategoryId)?.channels;
  if (!list) {
    spec.uncategorized.push(ch);
    return spec;
  }
  list.splice(Math.max(0, Math.min(index, list.length)), 0, ch);
  return spec;
}

export function moveCategory(input: ServerSpec, categoryId: string, index: number): ServerSpec {
  const spec = cloneSpec(input);
  const i = spec.categories.findIndex((c) => c.id === categoryId);
  if (i < 0) return spec;
  const [cat] = spec.categories.splice(i, 1);
  spec.categories.splice(Math.max(0, Math.min(index, spec.categories.length)), 0, cat!);
  return spec;
}

export function moveRole(input: ServerSpec, roleId: string, index: number): ServerSpec {
  const spec = cloneSpec(input);
  const i = spec.roles.findIndex((r) => r.id === roleId);
  if (i < 0) return spec;
  const [role] = spec.roles.splice(i, 1);
  spec.roles.splice(Math.max(0, Math.min(index, spec.roles.length)), 0, role!);
  return spec;
}

/** Statistiques affichées sur les fiches et la prévisualisation. */
export function specStats(spec: ServerSpec) {
  const chans = allChannels(spec).map((c) => c.channel);
  return {
    categories: spec.categories.length,
    textChannels: chans.filter((c) => c.type === "text").length,
    voiceChannels: chans.filter((c) => c.type === "voice" || c.type === "stage").length,
    forums: chans.filter((c) => c.type === "forum").length,
    announcements: chans.filter((c) => c.type === "announcement").length,
    channels: chans.length,
    roles: spec.roles.length,
    messages: spec.messages.length,
    automodRules: spec.automod.length,
    onboardingPrompts: spec.onboarding?.prompts.length ?? 0,
    botFeatures: Object.values(spec.features).filter((f) => f && (f as { enabled?: boolean }).enabled !== false).length,
  };
}
