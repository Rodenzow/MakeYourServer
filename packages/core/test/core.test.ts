import { describe, expect, it } from "vitest";
import {
  ServerSpecSchema,
  applyChanges,
  buildPlan,
  removeChannel,
  removeRole,
  simulateAsRoles,
  validateSpec,
  type GuildState,
  type ServerSpec,
} from "../src";
import { OFFICIAL_TEMPLATES } from "../src/templates";

const spec = (slug: string): ServerSpec => ServerSpecSchema.parse(OFFICIAL_TEMPLATES.find((t) => t.slug === slug)!.spec);

function emptyState(overrides: Partial<GuildState> = {}): GuildState {
  return {
    id: "1",
    name: "Test",
    ownerId: "2",
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
      { id: "1", name: "@everyone", color: 0, hoist: false, mentionable: false, permissions: "0", position: 0, managed: false },
      { id: "9", name: "Bot", color: 0, hoist: false, mentionable: false, permissions: "8", position: 1, managed: true },
    ],
    channels: [],
    bot: { userId: "9", roleIds: ["9"], permissions: (2n ** 53n - 1n).toString(), highestRolePosition: 1, isAdmin: true },
    fetchedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("simulation « Voir comme ce rôle »", () => {
  it("cache l’espace staff à @everyone et l’ouvre à la modération", () => {
    const s = spec("communaute");
    const everyone = simulateAsRoles(s, []);
    const mod = simulateAsRoles(s, ["moderateur"]);
    expect(everyone.get("staff-discussion")!.canView).toBe(false);
    expect(mod.get("staff-discussion")!.canView).toBe(true);
    expect(everyone.get("reglement")!.canView).toBe(true);
    expect(everyone.get("reglement")!.canSend).toBe(false);
    expect(everyone.get("general")!.canSend).toBe(true);
  });

  it("validation du règlement : un visiteur ne voit que l’accueil", () => {
    const s = spec("roleplay");
    const visitor = simulateAsRoles(s, []);
    const visible = [...visitor.values()].filter((a) => a.canView).length;
    const member = [...simulateAsRoles(s, ["voyageur"]).values()].filter((a) => a.canView).length;
    expect(visible).toBeLessThan(member);
    expect(visible).toBeGreaterThan(0);
  });
});

describe("cohérence des références", () => {
  it("supprimer un rôle le retire des permissions, boutons, onboarding et textes", () => {
    const s = removeRole(spec("communaute"), "jeux");
    expect(validateSpec(s).errors).toEqual([]);
    expect(JSON.stringify(s)).not.toContain('"jeux"');
    expect(JSON.stringify(s)).not.toContain("{@jeux}");
  });

  it("supprimer un salon nettoie messages, AutoMod, réglages et fonctionnalités", () => {
    const base = spec("communaute");
    const s = removeChannel(base, "alertes");
    expect(validateSpec(s).errors).toEqual([]);
    expect(s.settings.safetyAlertsChannelId).toBeUndefined();
    expect(s.automod.every((r) => r.actions.every((a) => a.type !== "alert" || a.channelId !== "alertes"))).toBe(true);
  });

  it("supprimer une catégorie supprime ses salons et garde un projet valide", () => {
    const s = removeChannel(spec("gaming"), spec("gaming").categories[1]!.id);
    expect(validateSpec(s).errors.filter((e) => !e.code.startsWith("onboarding") && !e.code.startsWith("community"))).toEqual([]);
  });

  it("détecte une mention vers un salon inexistant", () => {
    const s = spec("communaute");
    s.messages[0]!.content = "Voir {#salon-fantome}";
    expect(validateSpec(s).errors.some((e) => e.code === "missing-channel")).toBe(true);
  });

  it("refuse un rôle à permissions sensibles attribuable librement", () => {
    const s = spec("communaute");
    s.roles.find((r) => r.id === "jeux")!.permissions = ["BAN_MEMBERS"];
    expect(validateSpec(s).errors.some((e) => e.code === "self-role-dangerous")).toBe(true);
  });
});

describe("planificateur", () => {
  it("serveur vide : tout est créé, rien n’est supprimé par défaut", () => {
    const plan = buildPlan({ spec: spec("etudes"), state: emptyState(), mapping: {}, options: { mode: "empty" } });
    expect(plan.blockers).toEqual([]);
    expect(plan.ops.some((o) => o.destructive)).toBe(false);
    expect(plan.ops[0]!.kind).toBe("safety-backup");
    expect(plan.summary.create).toBeGreaterThan(20);
  });

  it("une suppression demandée est marquée destructive et exige confirmation", () => {
    const state = emptyState({ channels: [{ id: "50", name: "vieux", type: 0, parentId: null, position: 0, permissionOverwrites: [] }] });
    const plan = buildPlan({ spec: spec("etudes"), state, mapping: {}, options: { mode: "merge", existingChannels: "delete" } });
    expect(plan.requiresConfirmation).toBe(true);
    expect(plan.ops.find((o) => o.kind === "channel.delete")!.destructive).toBe(true);
  });

  it("bot sans permissions suffisantes : blocage explicite", () => {
    const state = emptyState({ bot: { userId: "9", roleIds: ["9"], permissions: (1n << 28n | 1n << 4n).toString(), highestRolePosition: 1, isAdmin: false } });
    const plan = buildPlan({ spec: spec("communaute"), state, mapping: {}, options: { mode: "merge" } });
    expect(plan.blockers.length).toBeGreaterThan(0);
  });

  it("rôle existant au-dessus du bot : impossible à modifier, signalé", () => {
    const state = emptyState();
    state.roles.push({ id: "70", name: "🛡️ Modération", color: 0, hoist: false, mentionable: false, permissions: "0", position: 5, managed: false });
    const plan = buildPlan({ spec: spec("communaute"), state, mapping: {}, options: { mode: "merge", resolutions: { moderateur: "update" } } });
    expect(plan.blockers.some((b) => b.code === "role-above-bot")).toBe(true);
  });

  it("mode ciblé : ajoute automatiquement les dépendances", () => {
    const plan = buildPlan({ spec: spec("communaute"), state: emptyState(), mapping: {}, options: { mode: "targeted", selected: ["staff-discussion"] } });
    const kinds = plan.ops.map((o) => o.key);
    expect(kinds).toContain("category.create:cat-staff");
    expect(kinds).toContain("role.create:moderateur");
    expect(plan.warnings.some((w) => w.code === "auto-dependency")).toBe(true);
  });
});

describe("modifications IA ciblées", () => {
  it("applique un sous-ensemble de changements et respecte « conserver mes rôles »", () => {
    const base = spec("communaute");
    const changeSet = {
      summary: "Test",
      changes: [
        { title: "Renommer un rôle", reason: "test", ops: [{ op: "upsert_role" as const, role: { ...base.roles[2]!, name: "Modo" } }] },
        { title: "Ajouter une catégorie", reason: "test", ops: [{ op: "upsert_category" as const, category: { id: "cat-new", name: "Nouveautés", overwrites: [] } }] },
      ],
    };
    const r = applyChanges(base, changeSet, [0, 1], { lockRoles: true });
    expect(r.ok).toBe(true);
    expect(r.rejected.length).toBe(1);
    expect(r.spec.roles[2]!.name).toBe(base.roles[2]!.name);
    expect(r.spec.categories.some((c) => c.id === "cat-new")).toBe(true);
  });
});
