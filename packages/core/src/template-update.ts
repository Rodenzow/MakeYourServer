import { isDangerous, type PermissionKey } from "./permissions";
import { DISCORD_LIMITS, type Category, type Channel, type ChannelType, type Message, type Overwrite, type ServerSpec } from "./schema";
import { CHANNEL_TOKEN_RE, ROLE_TOKEN_RE, channelCount, cloneSpec, findChannel, findRole, usedIds } from "./spec-utils";
import { validateSpec, type ValidationResult } from "./validate";

/**
 * Mises à jour de template : quand un template a été amélioré après la création
 * d’un projet, on propose d’AJOUTER ce qui manque au projet (rôles, catégories,
 * salons, messages, règles AutoMod, questions d’onboarding), sans jamais rien
 * supprimer ni écraser une personnalisation. La comparaison se fait par
 * identifiant local. Chaque ajout est validé : il est ignoré s’il ferait
 * apparaître une nouvelle erreur (limites Discord, références…).
 */

export interface TemplateAdditions {
  roles: Array<{ id: string; name: string; color: number }>;
  categories: Array<{ id: string; name: string; channels: number }>;
  channels: Array<{ id: string; name: string; type: ChannelType; categoryName: string | null }>;
  messages: Array<{ id: string; channelId: string; channelName: string; title: string }>;
  automod: Array<{ id: string; name: string }>;
  onboardingPrompts: Array<{ id: string; title: string }>;
}

export interface MergeOptions {
  /**
   * Versions du template déjà proposées au projet (ex. le projet à sa création,
   * puis après la dernière mise à jour appliquée). Un élément présent dans l’une
   * d’elles n’est PAS rajouté : l’utilisateur l’a peut-être supprimé exprès.
   */
  base?: ServerSpec | ServerSpec[] | null;
}

export interface MergeResult {
  spec: ServerSpec;
  added: TemplateAdditions;
}

const emptyAdditions = (): TemplateAdditions => ({ roles: [], categories: [], channels: [], messages: [], automod: [], onboardingPrompts: [] });

/** Nombre total d’éléments ajoutés. */
export function countAdditions(added: TemplateAdditions): number {
  return added.roles.length + added.categories.length + added.channels.length + added.messages.length + added.automod.length + added.onboardingPrompts.length;
}

const issueKey = (i: { code: string; message: string; elementId?: string }) => `${i.code}|${i.elementId ?? ""}|${i.message}`;

function errorCounts(v: ValidationResult) {
  const m = new Map<string, number>();
  for (const e of v.errors) m.set(issueKey(e), (m.get(issueKey(e)) ?? 0) + 1);
  return m;
}

/** Vrai si `v` contient une erreur qui n’existait pas (ou pas autant de fois) dans la référence. */
function hasNewErrors(v: ValidationResult, baseline: Map<string, number>) {
  const counts = errorCounts(v);
  for (const [k, n] of counts) if (n > (baseline.get(k) ?? 0)) return true;
  return false;
}

/** Insère `item` à la place qu’il occupe dans le template, par rapport à ses voisins déjà présents. */
function insertByNeighbors<T extends { id: string }>(list: T[], item: T, templateList: Array<{ id: string }>, index: number) {
  for (let j = index - 1; j >= 0; j--) {
    const k = list.findIndex((x) => x.id === templateList[j]!.id);
    if (k >= 0) return void list.splice(k + 1, 0, item);
  }
  for (let j = index + 1; j < templateList.length; j++) {
    const k = list.findIndex((x) => x.id === templateList[j]!.id);
    if (k >= 0) return void list.splice(k, 0, item);
  }
  list.push(item);
}

const dangerousRole = (spec: ServerSpec, id: string) => !!findRole(spec, id)?.permissions.some((p) => isDangerous(p as PermissionKey));

export function mergeTemplateAdditions(userSpec: ServerSpec, templateSpec: ServerSpec, options: MergeOptions = {}): MergeResult {
  let spec = cloneSpec(userSpec);
  const tpl = templateSpec;
  const added = emptyAdditions();
  const baseline = errorCounts(validateSpec(spec));

  const bases = options.base ? (Array.isArray(options.base) ? options.base : [options.base]) : [];
  const known = new Set<string>();
  for (const b of bases) for (const id of usedIds(b)) known.add(id);
  const isNew = (id: string) => !known.has(id);
  const taken = (id: string) => usedIds(spec).has(id);

  /** Applique une modification sur une copie et ne la garde que si elle n’ajoute aucune erreur. */
  const tryAdd = (mutate: (draft: ServerSpec) => boolean | void): boolean => {
    const draft = cloneSpec(spec);
    if (mutate(draft) === false) return false;
    if (hasNewErrors(validateSpec(draft), baseline)) return false;
    spec = draft;
    return true;
  };

  const roleOk = (s: ServerSpec, id: string) => id === "everyone" || !!findRole(s, id);
  const cleanOverwrites = (s: ServerSpec, ows: Overwrite[]) => ows.filter((o) => roleOk(s, o.target)).map((o) => ({ ...o, allow: [...o.allow], deny: [...o.deny] }));
  const cleanChannel = (s: ServerSpec, ch: Channel): Channel => ({ ...cloneSpec(ch), overwrites: cleanOverwrites(s, ch.overwrites) });

  /* ------------------------------- Rôles ------------------------------- */
  tpl.roles.forEach((role, i) => {
    if (!isNew(role.id) || taken(role.id)) return;
    if (spec.roles.length >= DISCORD_LIMITS.maxRoles) return;
    if (tryAdd((d) => insertByNeighbors(d.roles, cloneSpec(role), tpl.roles, i))) added.roles.push({ id: role.id, name: role.name, color: role.color });
  });

  /* ------------------------------ Salons ------------------------------- */
  const addChannel = (ch: Channel, siblings: Channel[], index: number, categoryId: string | null) => {
    if (!isNew(ch.id) || taken(ch.id)) return false;
    if (channelCount(spec) + 1 > DISCORD_LIMITS.maxChannels) return false;
    const ok = tryAdd((d) => {
      const list = categoryId === null ? d.uncategorized : d.categories.find((c) => c.id === categoryId)?.channels;
      if (!list || (categoryId !== null && list.length >= DISCORD_LIMITS.maxChannelsPerCategory)) return false;
      insertByNeighbors(list, cleanChannel(d, ch), siblings, index);
    });
    if (ok) added.channels.push({ id: ch.id, name: ch.name, type: ch.type, categoryName: categoryId === null ? null : (spec.categories.find((c) => c.id === categoryId)?.name ?? null) });
    return ok;
  };

  tpl.uncategorized.forEach((ch, i) => addChannel(ch, tpl.uncategorized, i, null));

  tpl.categories.forEach((cat, i) => {
    const existing = spec.categories.find((c) => c.id === cat.id);
    if (existing) {
      // Catégorie déjà présente (même renommée) : on complète seulement ses salons.
      cat.channels.forEach((ch, j) => addChannel(ch, cat.channels, j, cat.id));
      return;
    }
    if (!isNew(cat.id) || taken(cat.id)) return; // supprimée par l’utilisateur, ou identifiant déjà pris
    if (channelCount(spec) + 1 > DISCORD_LIMITS.maxChannels) return;
    const before = spec;
    const shell: Category = { id: cat.id, name: cat.name, overwrites: [], channels: [] };
    if (!tryAdd((d) => insertByNeighbors(d.categories, { ...shell, overwrites: cleanOverwrites(d, cat.overwrites) }, tpl.categories, i))) return;
    const channelsBefore = added.channels.length;
    cat.channels.forEach((ch, j) => addChannel(ch, cat.channels, j, cat.id));
    const count = added.channels.length - channelsBefore;
    if (count === 0 && cat.channels.length > 0) {
      spec = before; // catégorie vide : on n’ajoute rien
      return;
    }
    added.categories.push({ id: cat.id, name: cat.name, channels: count });
  });

  /* ----------------------------- Messages ------------------------------ */
  const tplChannelName = (id: string) => findChannel(tpl, id)?.channel.name ?? id;
  const tplRoleName = (id: string) => findRole(tpl, id)?.name ?? id;
  const fixTokens = (s: ServerSpec, text: string | undefined) =>
    text
      ?.replace(CHANNEL_TOKEN_RE, (m, id: string) => (findChannel(s, id) ? m : `#${tplChannelName(id)}`))
      .replace(ROLE_TOKEN_RE, (m, id: string) => (findRole(s, id) ? m : `@${tplRoleName(id)}`));

  const prepareMessage = (s: ServerSpec, m: Message): Message => {
    const msg = cloneSpec(m);
    msg.content = fixTokens(s, msg.content);
    for (const e of msg.embeds) {
      e.title = fixTokens(s, e.title);
      e.description = fixTokens(s, e.description);
      e.footer = fixTokens(s, e.footer);
      for (const f of e.fields) {
        f.name = fixTokens(s, f.name) ?? f.name;
        f.value = fixTokens(s, f.value) ?? f.value;
      }
    }
    msg.buttons = msg.buttons.filter((b) => {
      if (b.action === "role-toggle") return !!findRole(s, b.roleId)?.selfAssignable && !dangerousRole(s, b.roleId);
      if (b.action === "rules-accept") return !!findRole(s, b.roleId) && !dangerousRole(s, b.roleId);
      if (b.action === "ticket-open") return !!s.features.tickets?.enabled;
      if (b.action === "suggestion-open") return !!s.features.suggestions?.enabled;
      return true;
    });
    return msg;
  };

  tpl.messages.forEach((m, i) => {
    if (!isNew(m.id) || taken(m.id)) return;
    const target = findChannel(spec, m.channelId)?.channel;
    if (!target) return;
    const ok = tryAdd((d) => {
      const msg = prepareMessage(d, m);
      if (!msg.content && msg.embeds.length === 0) return false;
      insertByNeighbors(d.messages, msg, tpl.messages, i);
    });
    if (ok) {
      const title = m.embeds[0]?.title ?? m.content?.split("\n")[0] ?? "Message";
      added.messages.push({ id: m.id, channelId: m.channelId, channelName: target.name, title: title.replace(CHANNEL_TOKEN_RE, (_x, id: string) => `#${tplChannelName(id)}`).replace(ROLE_TOKEN_RE, (_x, id: string) => `@${tplRoleName(id)}`).slice(0, 120) });
    }
  });

  /* ------------------------------ AutoMod ------------------------------ */
  const limitFor = (type: string) => (type === "keyword" ? DISCORD_LIMITS.maxAutomodKeywordRules : 1);
  tpl.automod.forEach((rule) => {
    if (!isNew(rule.id) || taken(rule.id)) return;
    if (spec.automod.filter((r) => r.trigger.type === rule.trigger.type).length >= limitFor(rule.trigger.type)) return;
    const ok = tryAdd((d) => {
      const r = cloneSpec(rule);
      r.exemptRoles = r.exemptRoles.filter((id) => !!findRole(d, id));
      r.exemptChannels = r.exemptChannels.filter((id) => !!findChannel(d, id));
      r.actions = r.actions.filter((a) => a.type !== "alert" || !!findChannel(d, a.channelId));
      if (r.actions.length === 0) r.actions = [{ type: "block" }];
      d.automod.push(r);
    });
    if (ok) added.automod.push({ id: rule.id, name: rule.name });
  });

  /* ---------------------------- Onboarding ----------------------------- */
  const cleanOptions = (d: ServerSpec, opts: NonNullable<ServerSpec["onboarding"]>["prompts"][number]["options"]) =>
    opts
      .filter((o) => !usedIds(d).has(o.id))
      .map((o) => ({
        ...cloneSpec(o),
        roleIds: o.roleIds.filter((id) => !!findRole(d, id) && !dangerousRole(d, id)),
        channelIds: o.channelIds.filter((id) => !!findChannel(d, id)),
      }))
      .filter((o) => o.roleIds.length > 0 || o.channelIds.length > 0);

  if (tpl.onboarding) {
    const tplOnboarding = tpl.onboarding;
    if (!spec.onboarding) {
      // Onboarding entièrement nouveau dans le template (jamais proposé au projet).
      const everOffered = bases.some((b) => !!b.onboarding);
      if (!everOffered) {
        const ok = tryAdd((d) => {
          const prompts = tplOnboarding.prompts
            .filter((p) => !usedIds(d).has(p.id))
            .map((p) => ({ ...cloneSpec(p), options: cleanOptions(d, p.options) }))
            .filter((p) => p.options.length > 0);
          d.onboarding = { ...cloneSpec(tplOnboarding), defaultChannelIds: tplOnboarding.defaultChannelIds.filter((id) => !!findChannel(d, id)), prompts };
        });
        if (ok) for (const p of (spec as ServerSpec).onboarding?.prompts ?? []) added.onboardingPrompts.push({ id: p.id, title: p.title });
      }
    } else {
      for (const p of tplOnboarding.prompts) {
        if (!isNew(p.id) || taken(p.id)) continue;
        if (spec.onboarding.prompts.length >= 15) break;
        const ok = tryAdd((d) => {
          const options = cleanOptions(d, p.options);
          if (!options.length || !d.onboarding) return false;
          d.onboarding.prompts.push({ ...cloneSpec(p), options });
        });
        if (ok) added.onboardingPrompts.push({ id: p.id, title: p.title });
      }
    }
  }

  return { spec, added };
}

/** Résumé lisible des ajouts (« 2 rôles, 1 catégorie, 5 salons… »). */
export function describeAdditions(added: TemplateAdditions): string {
  const part = (n: number, one: string, many: string) => (n ? `${n} ${n > 1 ? many : one}` : null);
  const parts = [
    part(added.roles.length, "rôle", "rôles"),
    part(added.categories.length, "catégorie", "catégories"),
    part(added.channels.length, "salon", "salons"),
    part(added.messages.length, "message", "messages"),
    part(added.automod.length, "règle AutoMod", "règles AutoMod"),
    part(added.onboardingPrompts.length, "question d’accueil", "questions d’accueil"),
  ].filter(Boolean) as string[];
  if (!parts.length) return "aucun élément";
  return parts.length === 1 ? parts[0]! : `${parts.slice(0, -1).join(", ")} et ${parts.at(-1)}`;
}
