import { isDangerous, type PermissionKey } from "./permissions";
import { DISCORD_LIMITS, EVERYONE, safeParseSpec, type ServerSpec } from "./schema";
import { everyoneAccess } from "./simulate";
import { allChannels, channelCount, extractTokens, findChannel, findRole } from "./spec-utils";

export type IssueLevel = "error" | "warning";
export interface Issue {
  level: IssueLevel;
  code: string;
  message: string;
  /** Identifiant local de l’élément concerné, pour le mettre en évidence dans l’éditeur. */
  elementId?: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: Issue[];
  errors: Issue[];
  warnings: Issue[];
}

const TEXT_LIKE = new Set(["text", "announcement"]);

/** Validation structurelle (schéma) + validation sémantique (références, limites, règles Discord). */
export function validateSpecInput(input: unknown): ValidationResult & { spec?: ServerSpec } {
  const parsed = safeParseSpec(input);
  if (!parsed.success) {
    const issues: Issue[] = parsed.error.issues.slice(0, 50).map((i) => ({
      level: "error",
      code: "schema",
      message: `${i.path.join(".") || "racine"} : ${i.message}`,
    }));
    return { ok: false, issues, errors: issues, warnings: [] };
  }
  return { ...validateSpec(parsed.data), spec: parsed.data };
}

export function validateSpec(spec: ServerSpec): ValidationResult {
  const issues: Issue[] = [];
  const err = (code: string, message: string, elementId?: string) => issues.push({ level: "error", code, message, elementId });
  const warn = (code: string, message: string, elementId?: string) => issues.push({ level: "warning", code, message, elementId });

  /* ---------- Unicité des identifiants ---------- */
  const seen = new Set<string>();
  const checkId = (id: string, what: string) => {
    if (seen.has(id)) err("duplicate-id", `Identifiant « ${id} » utilisé plusieurs fois (${what}).`, id);
    seen.add(id);
  };
  spec.roles.forEach((r) => checkId(r.id, "rôle"));
  spec.categories.forEach((c) => checkId(c.id, "catégorie"));
  allChannels(spec).forEach(({ channel }) => checkId(channel.id, "salon"));
  spec.messages.forEach((m) => checkId(m.id, "message"));
  spec.automod.forEach((a) => checkId(a.id, "règle AutoMod"));

  const roleExists = (id: string) => id === EVERYONE || !!findRole(spec, id);
  const channel = (id: string) => findChannel(spec, id)?.channel ?? null;
  const requireRole = (id: string, ctx: string, elementId?: string) => {
    if (!roleExists(id)) err("missing-role", `${ctx} : le rôle « ${id} » n’existe pas.`, elementId);
  };
  const requireChannel = (id: string, ctx: string, types?: string[], elementId?: string) => {
    const ch = channel(id);
    if (!ch) return err("missing-channel", `${ctx} : le salon « ${id} » n’existe pas.`, elementId);
    if (types && !types.includes(ch.type)) err("wrong-channel-type", `${ctx} : « ${ch.name} » doit être un salon ${types.join(" ou ")}.`, ch.id);
  };

  /* ---------- Limites Discord ---------- */
  const total = channelCount(spec);
  if (total > DISCORD_LIMITS.maxChannels) err("limit-channels", `Trop de salons : ${total} (maximum Discord : ${DISCORD_LIMITS.maxChannels}).`);
  if (spec.roles.length > DISCORD_LIMITS.maxRoles) err("limit-roles", `Trop de rôles (maximum Discord : ${DISCORD_LIMITS.maxRoles}).`);
  for (const cat of spec.categories) {
    if (cat.channels.length > DISCORD_LIMITS.maxChannelsPerCategory)
      err("limit-category", `La catégorie « ${cat.name} » dépasse 50 salons.`, cat.id);
  }

  /* ---------- Permissions & surcharges ---------- */
  const checkOverwrites = (ows: { target: string }[], ctx: string, elementId: string) => {
    const targets = new Set<string>();
    for (const o of ows) {
      requireRole(o.target, ctx, elementId);
      if (targets.has(o.target)) err("duplicate-overwrite", `${ctx} : plusieurs surcharges pour le même rôle.`, elementId);
      targets.add(o.target);
    }
  };
  for (const cat of spec.categories) checkOverwrites(cat.overwrites, `Catégorie « ${cat.name} »`, cat.id);
  for (const { channel: ch, category } of allChannels(spec)) {
    if (!ch.syncPermissions || !category) checkOverwrites(ch.overwrites, `Salon « ${ch.name} »`, ch.id);
    if (ch.syncPermissions && !category && ch.overwrites.length === 0) {
      // salon hors catégorie : pas de catégorie à synchroniser, c’est normal
    }
    if ((ch.type === "announcement" || ch.type === "stage") && !spec.settings.community) {
      warn(
        "needs-community",
        `« ${ch.name} » est un salon ${ch.type === "announcement" ? "d’annonces" : "de conférence"} : il nécessite la Communauté. Sans elle, il sera créé comme salon ${ch.type === "announcement" ? "textuel" : "vocal"}.`,
        ch.id,
      );
    }
    if (ch.type !== "forum" && ch.forumTags?.length) warn("tags-non-forum", `« ${ch.name} » : les tags ne s’appliquent qu’aux forums.`, ch.id);
  }

  for (const role of spec.roles) {
    if (role.selfAssignable) {
      const dangerous = role.permissions.filter((p) => isDangerous(p as PermissionKey));
      if (dangerous.length)
        err("self-role-dangerous", `Le rôle « ${role.name} » est attribuable librement mais possède des permissions sensibles (${dangerous.join(", ")}).`, role.id);
    }
  }
  if (spec.everyone.permissions.some((p) => isDangerous(p as PermissionKey))) {
    err("everyone-dangerous", "@everyone possède des permissions sensibles : tous les membres en hériteraient.", EVERYONE);
  }

  /* ---------- Messages ---------- */
  for (const m of spec.messages) {
    requireChannel(m.channelId, `Message « ${m.id} »`, ["text", "announcement"], m.id);
    if (!m.content && m.embeds.length === 0) err("empty-message", `Le message « ${m.id} » est vide.`, m.id);
    const embedChars = m.embeds.reduce(
      (n, e) => n + (e.title?.length ?? 0) + (e.description?.length ?? 0) + (e.footer?.length ?? 0) + e.fields.reduce((k, f) => k + f.name.length + f.value.length, 0),
      0,
    );
    if (embedChars > 6000) err("embed-too-long", `Le message « ${m.id} » dépasse 6 000 caractères d’embeds.`, m.id);
    for (const b of m.buttons) {
      if (b.action === "role-toggle" || b.action === "rules-accept") {
        const role = findRole(spec, b.roleId);
        if (!role) err("missing-role", `Bouton « ${b.label} » : rôle introuvable.`, m.id);
        else if (b.action === "role-toggle" && !role.selfAssignable)
          err("role-not-self", `Bouton « ${b.label} » : le rôle « ${role.name} » n’est pas marqué comme attribuable par les membres.`, m.id);
        else if (role.permissions.some((p) => isDangerous(p as PermissionKey)))
          err("button-dangerous-role", `Bouton « ${b.label} » : le rôle « ${role.name} » a des permissions sensibles.`, m.id);
      }
      if (b.action === "ticket-open" && !spec.features.tickets?.enabled)
        err("feature-missing", `Bouton « ${b.label} » : la fonctionnalité Tickets n’est pas activée.`, m.id);
      if (b.action === "suggestion-open" && !spec.features.suggestions?.enabled)
        err("feature-missing", `Bouton « ${b.label} » : la fonctionnalité Suggestions n’est pas activée.`, m.id);
    }
    const texts = [m.content, ...m.embeds.flatMap((e) => [e.title, e.description, e.footer, ...e.fields.flatMap((f) => [f.name, f.value])])];
    for (const t of texts) {
      const tk = extractTokens(t);
      tk.channels.forEach((id) => !channel(id) && err("missing-channel", `Message « ${m.id} » : mention d’un salon inconnu « ${id} ».`, m.id));
      tk.roles.forEach((id) => !findRole(spec, id) && err("missing-role", `Message « ${m.id} » : mention d’un rôle inconnu « ${id} ».`, m.id));
    }
  }
  const pinsPerChannel = new Map<string, number>();
  spec.messages.filter((m) => m.pin).forEach((m) => pinsPerChannel.set(m.channelId, (pinsPerChannel.get(m.channelId) ?? 0) + 1));

  /* ---------- AutoMod ---------- */
  const counts = { keyword: 0, spam: 0, keyword_preset: 0, mention_spam: 0 };
  for (const rule of spec.automod) {
    counts[rule.trigger.type]++;
    rule.exemptRoles.forEach((r) => requireRole(r, `AutoMod « ${rule.name} »`, rule.id));
    rule.exemptChannels.forEach((c) => requireChannel(c, `AutoMod « ${rule.name} »`, undefined, rule.id));
    for (const a of rule.actions) {
      if (a.type === "alert") requireChannel(a.channelId, `AutoMod « ${rule.name} » (alerte)`, ["text", "announcement"], rule.id);
      if (a.type === "timeout" && rule.trigger.type !== "keyword" && rule.trigger.type !== "mention_spam")
        err("automod-timeout", `AutoMod « ${rule.name} » : l’exclusion temporaire n’est possible qu’avec les mots-clés ou le spam de mentions.`, rule.id);
    }
    if (rule.trigger.type === "keyword" && rule.trigger.keywords.length === 0 && rule.trigger.regexPatterns.length === 0)
      err("automod-empty", `AutoMod « ${rule.name} » : ajoutez au moins un mot-clé.`, rule.id);
  }
  if (counts.keyword > DISCORD_LIMITS.maxAutomodKeywordRules) err("automod-limit", "Discord limite à 6 règles AutoMod par mots-clés.");
  if (counts.spam > 1 || counts.keyword_preset > 1 || counts.mention_spam > 1)
    err("automod-limit", "Discord n’autorise qu’une règle de chaque type : spam, listes prédéfinies, spam de mentions.");

  /* ---------- Réglages ---------- */
  const s = spec.settings;
  if (s.systemChannelId) requireChannel(s.systemChannelId, "Salon des messages système", ["text"]);
  if (s.rulesChannelId) requireChannel(s.rulesChannelId, "Salon du règlement", ["text"]);
  if (s.publicUpdatesChannelId) requireChannel(s.publicUpdatesChannelId, "Salon des mises à jour de la communauté", ["text"]);
  if (s.safetyAlertsChannelId) requireChannel(s.safetyAlertsChannelId, "Salon des alertes de sécurité", ["text"]);
  if (s.afkChannelId) requireChannel(s.afkChannelId, "Salon AFK", ["voice"]);
  if (s.community) {
    if (!s.rulesChannelId) err("community-rules", "La Communauté exige un salon de règlement.");
    if (!s.publicUpdatesChannelId) err("community-updates", "La Communauté exige un salon pour les mises à jour de Discord (réservé au staff).");
    if (s.verificationLevel === "none") err("community-verification", "La Communauté exige au minimum le niveau de vérification « Faible ».");
    if (s.explicitContentFilter !== "all_members") err("community-filter", "La Communauté exige l’analyse des médias de tous les membres.");
  }

  /* ---------- Onboarding ---------- */
  const ob = spec.onboarding;
  if (ob?.enabled) {
    if (!s.community) err("onboarding-community", "L’intégration (onboarding) nécessite la Communauté Discord.");
    ob.defaultChannelIds.forEach((c) => requireChannel(c, "Onboarding (salon par défaut)"));
    const visible = ob.defaultChannelIds.filter((c) => everyoneAccess(spec, c)?.canView);
    const writable = ob.defaultChannelIds.filter((c) => everyoneAccess(spec, c)?.canSend);
    if (visible.length < ob.defaultChannelIds.length) err("onboarding-hidden", "Onboarding : certains salons par défaut sont invisibles pour @everyone.");
    if (ob.mode === "default") {
      if (ob.defaultChannelIds.length < DISCORD_LIMITS.onboardingMinDefaultChannels)
        err("onboarding-min", `Onboarding : Discord exige au moins 7 salons par défaut (actuellement ${ob.defaultChannelIds.length}).`);
      if (writable.length < DISCORD_LIMITS.onboardingMinWritableDefaultChannels)
        err("onboarding-writable", `Onboarding : au moins 5 salons par défaut doivent permettre à @everyone d’écrire (actuellement ${writable.length}).`);
    }
    for (const p of ob.prompts) {
      for (const o of p.options) {
        o.roleIds.forEach((r) => {
          requireRole(r, `Onboarding « ${p.title} »`);
          const role = findRole(spec, r);
          if (role?.permissions.some((x) => isDangerous(x as PermissionKey)))
            err("onboarding-dangerous", `Onboarding : le rôle « ${role.name} » a des permissions sensibles et ne peut pas être proposé.`, role.id);
        });
        o.channelIds.forEach((c) => requireChannel(c, `Onboarding « ${p.title} »`));
      }
    }
  }

  /* ---------- Écran d’accueil ---------- */
  if (spec.welcomeScreen?.enabled) {
    if (!s.community) err("welcome-community", "L’écran d’accueil nécessite la Communauté Discord.");
    for (const w of spec.welcomeScreen.channels) {
      requireChannel(w.channelId, "Écran d’accueil");
      if (channel(w.channelId) && !everyoneAccess(spec, w.channelId)?.canView)
        err("welcome-hidden", "Écran d’accueil : un salon mis en avant est invisible pour @everyone.", w.channelId);
    }
  }

  /* ---------- Guide du serveur (préparé, installé manuellement) ---------- */
  spec.serverGuide?.newMemberActions.forEach((a) => requireChannel(a.channelId, "Guide du serveur"));
  spec.serverGuide?.resourceChannels.forEach((a) => requireChannel(a.channelId, "Guide du serveur"));

  /* ---------- Fonctionnalités du bot ---------- */
  const f = spec.features;
  if (f.welcome) requireChannel(f.welcome.channelId, "Message de bienvenue", [...TEXT_LIKE]);
  if (f.joinLogs) {
    requireChannel(f.joinLogs.channelId, "Logs d’arrivées", ["text"]);
    if (channel(f.joinLogs.channelId) && everyoneAccess(spec, f.joinLogs.channelId)?.canView)
      warn("logs-public", "Le salon de logs est visible par tous les membres : pensez à le réserver au staff.", f.joinLogs.channelId);
  }
  if (f.rulesGate) {
    requireRole(f.rulesGate.roleId, "Validation du règlement");
    if (f.rulesGate.enabled && !spec.messages.some((m) => m.buttons.some((b) => b.action === "rules-accept")))
      warn("rules-gate-button", "La validation du règlement est activée mais aucun message ne contient de bouton « J’accepte ».");
  }
  if (f.tickets) {
    requireChannel(f.tickets.channelId, "Tickets", ["text"]);
    f.tickets.staffRoleIds.forEach((r) => requireRole(r, "Tickets"));
  }
  if (f.suggestions) requireChannel(f.suggestions.channelId, "Suggestions", [...TEXT_LIKE]);
  if (f.welcome?.message) {
    const tk = extractTokens(f.welcome.message);
    tk.channels.forEach((id) => !channel(id) && err("missing-channel", `Message de bienvenue : salon inconnu « ${id} ».`));
    tk.roles.forEach((id) => !findRole(spec, id) && err("missing-role", `Message de bienvenue : rôle inconnu « ${id} ».`));
  }

  const errors = issues.filter((i) => i.level === "error");
  return { ok: errors.length === 0, issues, errors, warnings: issues.filter((i) => i.level === "warning") };
}
