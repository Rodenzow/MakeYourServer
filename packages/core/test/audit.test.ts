import { describe, expect, it } from "vitest";
import {
  AUDIT_FIX_IDS,
  applyAuditFixes,
  auditGuild,
  backupToSpec,
  buildAuditFixProject,
  buildPlan,
  everyoneAccess,
  gradeFor,
  toBitfield,
  validateSpec,
  DEFAULT_EVERYONE_PERMISSIONS,
  type GuildState,
} from "../src";

const GUILD = "100000000000000000";
const perm = (...keys: Parameters<typeof toBitfield>[0][number][]) => toBitfield(keys).toString();

/** Serveur mal configuré : @everyone administrateur, aucune protection. */
function badState(): GuildState {
  return {
    id: GUILD,
    name: "Serveur fragile",
    ownerId: "200000000000000000",
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
      { id: GUILD, name: "@everyone", color: 0, hoist: false, mentionable: false, permissions: perm(...DEFAULT_EVERYONE_PERMISSIONS, "KICK_MEMBERS", "MENTION_EVERYONE", "MANAGE_MESSAGES"), position: 0, managed: false },
      { id: "300000000000000001", name: "Modérateurs", color: 0, hoist: true, mentionable: true, permissions: perm("MANAGE_MESSAGES", "KICK_MEMBERS", "VIEW_CHANNEL", "SEND_MESSAGES"), position: 2, managed: false },
      { id: "300000000000000002", name: "Admin 1", color: 0, hoist: false, mentionable: false, permissions: perm("ADMINISTRATOR"), position: 3, managed: false },
      { id: "300000000000000003", name: "Admin 2", color: 0, hoist: false, mentionable: false, permissions: perm("ADMINISTRATOR"), position: 4, managed: false },
      { id: "300000000000000004", name: "Admin 3", color: 0, hoist: false, mentionable: false, permissions: perm("ADMINISTRATOR"), position: 5, managed: false },
      { id: "300000000000000005", name: "Admin 4", color: 0, hoist: false, mentionable: false, permissions: perm("ADMINISTRATOR"), position: 6, managed: false },
      { id: "300000000000000009", name: "Make Your Server", color: 0, hoist: false, mentionable: false, permissions: perm("ADMINISTRATOR"), position: 7, managed: true, tags: { botId: "900000000000000001" } },
    ],
    channels: [
      { id: "400000000000000001", name: "Infos", type: 4, parentId: null, position: 0, permissionOverwrites: [] },
      { id: "400000000000000002", name: "annonces", type: 0, parentId: "400000000000000001", position: 0, permissionOverwrites: [] },
      { id: "400000000000000003", name: "Vide", type: 4, parentId: null, position: 1, permissionOverwrites: [] },
      ...Array.from({ length: 6 }, (_, i) => ({ id: `40000000000000010${i}`, name: `vrac-${i}`, type: 0, parentId: null, position: i, permissionOverwrites: [] })),
      { id: "400000000000000200", name: "logs", type: 0, parentId: null, position: 9, permissionOverwrites: [] },
    ],
    automodRules: [],
    onboarding: null,
    welcomeScreen: null,
    bot: { userId: "900000000000000001", roleIds: ["300000000000000009"], permissions: perm("ADMINISTRATOR"), highestRolePosition: 7, isAdmin: true },
    fetchedAt: new Date(0).toISOString(),
  };
}

/** Serveur bien configuré : Communauté, règlement, AutoMod, espace équipe privé. */
function goodState(): GuildState {
  const s = badState();
  s.name = "Serveur solide";
  s.features = ["COMMUNITY", "WELCOME_SCREEN_ENABLED"];
  s.verificationLevel = 2;
  s.explicitContentFilter = 2;
  s.defaultMessageNotifications = 1;
  s.roles = s.roles.filter((r) => !r.name.startsWith("Admin ") || r.name === "Admin 1");
  s.roles[0]!.permissions = perm(...DEFAULT_EVERYONE_PERMISSIONS);
  s.roles[1]!.mentionable = false;
  s.channels = [
    { id: "400000000000000001", name: "Infos", type: 4, parentId: null, position: 0, permissionOverwrites: [] },
    { id: "400000000000000010", name: "📜・règlement", type: 0, parentId: "400000000000000001", position: 0, permissionOverwrites: [{ id: GUILD, type: 0, allow: "0", deny: perm("SEND_MESSAGES") }] },
    { id: "400000000000000002", name: "annonces", type: 5, parentId: "400000000000000001", position: 1, permissionOverwrites: [{ id: GUILD, type: 0, allow: "0", deny: perm("SEND_MESSAGES") }] },
    { id: "400000000000000011", name: "général", type: 0, parentId: "400000000000000001", position: 2, permissionOverwrites: [] },
    { id: "400000000000000020", name: "Équipe", type: 4, parentId: null, position: 1, permissionOverwrites: [{ id: GUILD, type: 0, allow: "0", deny: perm("VIEW_CHANNEL") }] },
    { id: "400000000000000021", name: "logs-modération", type: 0, parentId: "400000000000000020", position: 0, permissionOverwrites: [{ id: GUILD, type: 0, allow: "0", deny: perm("VIEW_CHANNEL") }] },
  ];
  s.rulesChannelId = "400000000000000010";
  s.publicUpdatesChannelId = "400000000000000021";
  s.safetyAlertsChannelId = "400000000000000021";
  s.systemChannelId = "400000000000000011";
  s.automodRules = [
    { id: "500000000000000001", name: "Spam", eventType: 1, triggerType: 3, triggerMetadata: {}, actions: [{ type: 1 }], enabled: true, exemptRoles: [], exemptChannels: [] },
    { id: "500000000000000002", name: "Mentions", eventType: 1, triggerType: 5, triggerMetadata: { mention_total_limit: 5 }, actions: [{ type: 1 }], enabled: true, exemptRoles: [], exemptChannels: [] },
  ];
  s.onboarding = { enabled: true, mode: 0, defaultChannelIds: [], prompts: [] };
  s.welcomeScreen = { description: "Bienvenue", enabled: true, welcomeChannels: [] };
  return s;
}

const errorKeys = (spec: Parameters<typeof validateSpec>[0]) => new Set(validateSpec(spec).errors.map((e) => `${e.code}|${e.message}`));

describe("auditGuild", () => {
  it("note un serveur bien configuré comme excellent, sans problème critique", () => {
    const r = auditGuild(goodState());
    expect(r.counts.critical).toBe(0);
    expect(r.issues.map((i) => i.id)).toEqual([]);
    expect(r.score).toBe(100);
    expect(r.grade).toBe("excellent");
    expect(r.strengths.length).toBeGreaterThan(5);
  });

  it("détecte les problèmes d’un serveur fragile et les trie par gravité", () => {
    const r = auditGuild(badState());
    const ids = r.issues.map((i) => i.id);
    for (const id of [
      "everyone-dangerous",
      "everyone-mention",
      "too-many-admins",
      "verification-none",
      "content-filter-off",
      "automod-none",
      "announcement-open",
      "logs-public",
      "no-staff-channel",
      "mentionable-staff",
      "notifications-all",
      "uncategorized-many",
      "empty-categories",
      "no-rules",
      "community-off",
      "system-channel-missing",
    ]) {
      expect(ids, id).toContain(id);
    }
    const rank = { critical: 0, warning: 1, tip: 2 };
    for (let i = 1; i < r.issues.length; i++) expect(rank[r.issues[i - 1]!.severity]).toBeLessThanOrEqual(rank[r.issues[i]!.severity]);
    expect(r.score).toBe(0);
    expect(r.grade).toBe("fragile");
    expect(r.issues.find((i) => i.id === "announcement-open")?.items).toEqual(["#annonces"]);
  });

  it("est déterministe et plafonne le score en cas de problème critique", () => {
    const s = goodState();
    s.roles[0]!.permissions = perm(...DEFAULT_EVERYONE_PERMISSIONS, "MENTION_EVERYONE");
    const a = auditGuild(s);
    const b = auditGuild(structuredClone(s));
    expect(a).toEqual(b);
    expect(a.issues.map((i) => i.id)).toEqual(["everyone-mention"]);
    expect(a.score).toBe(69);
    expect(a.grade).toBe("moyen");
  });

  it("signale @everyone administrateur comme critique", () => {
    const s = goodState();
    s.roles[0]!.permissions = perm("ADMINISTRATOR");
    const r = auditGuild(s);
    expect(r.issues[0]?.id).toBe("everyone-admin");
    expect(r.issues[0]?.fix).toBe("everyone-permissions");
    expect(r.issues.some((i) => i.id === "announcement-open")).toBe(false);
  });

  it("calcule l’appréciation selon le score", () => {
    expect(gradeFor(100)).toBe("excellent");
    expect(gradeFor(85)).toBe("excellent");
    expect(gradeFor(84)).toBe("bon");
    expect(gradeFor(70)).toBe("bon");
    expect(gradeFor(50)).toBe("moyen");
    expect(gradeFor(49)).toBe("fragile");
  });
});

describe("applyAuditFixes", () => {
  it("applique tous les correctifs sans créer de nouvelle erreur de validation", () => {
    const state = badState();
    const original = backupToSpec(state).spec;
    const before = errorKeys(original);
    expect([...before].some((k) => k.startsWith("everyone-dangerous"))).toBe(true);
    const fixed = applyAuditFixes(original, [...AUDIT_FIX_IDS]);
    const after = errorKeys(fixed);
    for (const k of after) expect(before.has(k), k).toBe(true);
    expect(after.size).toBe(0);

    expect(fixed.everyone.permissions).not.toContain("KICK_MEMBERS");
    expect(fixed.everyone.permissions).not.toContain("MENTION_EVERYONE");
    expect(fixed.everyone.permissions).toContain("SEND_MESSAGES");
    expect(fixed.settings.verificationLevel).toBe("medium");
    expect(fixed.settings.explicitContentFilter).toBe("all_members");
    expect(fixed.settings.defaultNotifications).toBe("only_mentions");
    expect(fixed.automod.map((r) => r.trigger.type).sort()).toEqual(["keyword_preset", "mention_spam", "spam"]);

    const ann = fixed.categories.flatMap((c) => c.channels).find((c) => c.name === "annonces")!;
    expect(everyoneAccess(fixed, ann.id)?.canSend).toBe(false);
    expect(everyoneAccess(fixed, ann.id)?.canView).toBe(true);
    // Les modérateurs (non administrateurs) peuvent toujours publier.
    expect(ann.overwrites.find((o) => o.target === "r-300000000000000001")?.allow).toContain("SEND_MESSAGES");
    // La spécification d’origine n’est pas modifiée.
    expect(original.everyone.permissions).toContain("KICK_MEMBERS");
  });

  it("ne dépasse pas les limites AutoMod et réactive une règle désactivée", () => {
    const state = goodState();
    state.automodRules![0]!.enabled = false;
    const spec = backupToSpec(state).spec;
    const fixed = applyAuditFixes(spec, ["automod-basics", "automod-spam", "automod-mentions"]);
    const types = fixed.automod.map((r) => r.trigger.type);
    expect(types.filter((t) => t === "spam")).toHaveLength(1);
    expect(types.filter((t) => t === "mention_spam")).toHaveLength(1);
    expect(types.filter((t) => t === "keyword_preset")).toHaveLength(1);
    expect(fixed.automod.find((r) => r.trigger.type === "spam")?.enabled).toBe(true);
    const before = errorKeys(spec);
    for (const k of errorKeys(fixed)) expect(before.has(k), k).toBe(true);
  });

  it("ignore les identifiants de correctifs inconnus", () => {
    const spec = backupToSpec(goodState()).spec;
    expect(applyAuditFixes(spec, ["inconnu"])).toEqual(spec);
  });
});

describe("buildAuditFixProject", () => {
  it("produit un projet minimal, valide et installable sans doublon", () => {
    const state = badState();
    const project = buildAuditFixProject(state, ["everyone-permissions", "verification", "automod-basics", "announcements-readonly", "pas-un-correctif"]);
    expect(project.errors).toEqual([]);
    expect(project.applied).toEqual(["everyone-permissions", "verification", "automod-basics", "announcements-readonly"]);
    expect(project.spec.onboarding).toBeUndefined();
    expect(project.mapping["r-300000000000000001"]).toBe("300000000000000001");

    const plan = buildPlan({ spec: project.spec, state, mapping: project.mapping, options: { mode: "merge" } });
    expect(plan.blockers).toEqual([]);
    const kinds = plan.ops.map((o) => o.kind);
    expect(kinds).toContain("everyone.update");
    expect(kinds).toContain("guild.settings");
    expect(kinds.filter((k) => k === "automod.create")).toHaveLength(3);
    expect(kinds).not.toContain("role.create");
    expect(kinds).not.toContain("channel.create");
    expect(kinds).not.toContain("category.create");
    expect(plan.ops.filter((o) => o.kind === "channel.update").map((o) => o.targetId)).toEqual(["400000000000000002"]);
    expect(plan.ops.some((o) => o.destructive)).toBe(false);
  });

  it("signale les erreurs quand un correctif indispensable n’est pas choisi", () => {
    const project = buildAuditFixProject(badState(), ["verification"]);
    expect(project.errors.map((e) => e.code)).toContain("everyone-dangerous");
  });
});
