import { describe, expect, it } from "vitest";
import { ServerSpecSchema, allChannels, countAdditions, describeAdditions, findChannel, findRole, mergeTemplateAdditions, removeChannel, removeRole, validateSpec, type ServerSpec } from "../src";
import { OFFICIAL_TEMPLATES } from "../src/templates";

const template = (slug: string): ServerSpec => ServerSpecSchema.parse(OFFICIAL_TEMPLATES.find((t) => t.slug === slug)!.spec);
const errorKeys = (s: ServerSpec) => validateSpec(s).errors.map((e) => `${e.code}|${e.elementId ?? ""}|${e.message}`);

/** Version « améliorée » du template gaming : un rôle, une catégorie, un salon, un message, une règle, une question. */
function improvedGaming(): ServerSpec {
  const t = template("gaming");
  t.roles.splice(4, 0, { id: "coach", name: "Coach", color: 0x22aa88, hoist: true, mentionable: false, permissions: [], selfAssignable: false, staff: false });
  t.roles.push({ id: "notif-events", name: "Notif événements", color: 0, hoist: false, mentionable: true, permissions: [], selfAssignable: true, staff: false });
  t.categories.find((c) => c.id === "cat-commu")!.channels.splice(2, 0, { id: "memes", name: "memes", type: "text", nsfw: false, slowmode: 0, syncPermissions: true, overwrites: [] });
  t.categories.splice(3, 0, {
    id: "cat-coaching",
    name: "Coaching",
    overwrites: [{ target: "coach", allow: ["MANAGE_MESSAGES"], deny: [] }],
    channels: [
      { id: "coaching-demandes", name: "demandes", type: "text", nsfw: false, slowmode: 0, syncPermissions: true, overwrites: [] },
      { id: "coaching-vocal", name: "Coaching", type: "voice", nsfw: false, slowmode: 0, syncPermissions: true, overwrites: [] },
    ],
  });
  t.messages.push({
    id: "msg-coaching",
    channelId: "coaching-demandes",
    content: "Besoin d’aide ? Les {@coach} répondent ici. Pensez à lire {#reglement}.",
    embeds: [],
    buttons: [{ action: "role-toggle", roleId: "notif-events", label: "Être prévenu", style: "secondary" }],
    pin: true,
  });
  t.automod.push({ id: "am-liens", name: "Liens suspects", enabled: true, trigger: { type: "keyword", keywords: ["free nitro"], regexPatterns: [], allowList: [] }, actions: [{ type: "block" }], exemptRoles: ["coach"], exemptChannels: [] });
  t.onboarding!.prompts.push({
    id: "q-coaching",
    title: "Voulez-vous progresser ?",
    type: "multiple_choice",
    singleSelect: false,
    required: false,
    inOnboarding: true,
    options: [{ id: "opt-coaching", title: "Oui, je veux un coach", roleIds: ["notif-events"], channelIds: ["coaching-demandes"] }],
  });
  return ServerSpecSchema.parse(t);
}

describe("mergeTemplateAdditions", () => {
  it("n’ajoute rien quand le projet contient déjà tout le template", () => {
    const user = template("gaming");
    const { spec, added } = mergeTemplateAdditions(user, template("gaming"));
    expect(countAdditions(added)).toBe(0);
    expect(spec).toEqual(user);
    expect(describeAdditions(added)).toBe("aucun élément");
  });

  it("ajoute les nouveautés du template, à leur place, sans nouvelle erreur", () => {
    const user = template("gaming");
    const { spec, added } = mergeTemplateAdditions(user, improvedGaming());
    expect(added.roles.map((r) => r.id)).toEqual(["coach", "notif-events"]);
    expect(added.categories).toEqual([{ id: "cat-coaching", name: "Coaching", channels: 2 }]);
    expect(added.channels.map((c) => c.id).sort()).toEqual(["coaching-demandes", "coaching-vocal", "memes"]);
    expect(added.messages.map((m) => m.id)).toEqual(["msg-coaching"]);
    expect(added.automod.map((a) => a.id)).toEqual(["am-liens"]);
    expect(added.onboardingPrompts.map((p) => p.id)).toEqual(["q-coaching"]);
    // Positions : le rôle « coach » suit « orga », la catégorie suit « cat-jeux », « memes » suit « presentations ».
    expect(spec.roles[spec.roles.findIndex((r) => r.id === "coach") - 1]!.id).toBe("orga");
    expect(spec.categories.map((c) => c.id).indexOf("cat-coaching")).toBe(spec.categories.map((c) => c.id).indexOf("cat-jeux") + 1);
    const commu = spec.categories.find((c) => c.id === "cat-commu")!.channels.map((c) => c.id);
    expect(commu.indexOf("memes")).toBe(commu.indexOf("presentations") + 1);
    expect(validateSpec(spec).errors).toEqual([]);
    expect(ServerSpecSchema.safeParse(spec).success).toBe(true);
    expect(describeAdditions(added)).toContain("2 rôles");
  });

  it("conserve toutes les personnalisations (noms, couleurs, ajouts personnels)", () => {
    const user = template("gaming");
    user.meta.name = "Ma super team";
    findRole(user, "admin")!.color = 0x123456;
    findChannel(user, "general")!.channel.name = "discussion-libre";
    user.categories.find((c) => c.id === "cat-commu")!.name = "Notre coin";
    user.messages.find((m) => m.id === "msg-bienvenue")!.content = "Mon propre message";
    user.roles.push({ id: "perso", name: "Rôle perso", color: 0, hoist: false, mentionable: false, permissions: [], selfAssignable: false, staff: false });
    const { spec } = mergeTemplateAdditions(user, improvedGaming());
    expect(spec.meta.name).toBe("Ma super team");
    expect(findRole(spec, "admin")!.color).toBe(0x123456);
    expect(findChannel(spec, "general")!.channel.name).toBe("discussion-libre");
    expect(spec.categories.find((c) => c.id === "cat-commu")!.name).toBe("Notre coin");
    expect(spec.messages.find((m) => m.id === "msg-bienvenue")!.content).toBe("Mon propre message");
    expect(findRole(spec, "perso")).not.toBeNull();
    // Rien n’est supprimé.
    for (const { channel } of allChannels(user)) expect(findChannel(spec, channel.id)).not.toBeNull();
    for (const r of user.roles) expect(findRole(spec, r.id)).not.toBeNull();
  });

  it("ne rajoute pas ce que l’utilisateur a supprimé quand la version d’origine est connue", () => {
    const base = template("gaming");
    const user = removeRole(removeChannel(template("gaming"), "clips"), "streamer");
    const withBase = mergeTemplateAdditions(user, improvedGaming(), { base });
    expect(findChannel(withBase.spec, "clips")).toBeNull();
    expect(findRole(withBase.spec, "streamer")).toBeNull();
    expect(withBase.added.roles.map((r) => r.id)).toEqual(["coach", "notif-events"]);
    // Sans version d’origine, tout ce qui manque est proposé.
    const withoutBase = mergeTemplateAdditions(user, improvedGaming());
    expect(findChannel(withoutBase.spec, "clips")).not.toBeNull();
    expect(findRole(withoutBase.spec, "streamer")).not.toBeNull();
  });

  it("ne recrée pas une catégorie supprimée par l’utilisateur, ni ses nouveaux salons", () => {
    const user = removeChannel(template("gaming"), "cat-commu");
    const { spec, added } = mergeTemplateAdditions(user, improvedGaming(), { base: template("gaming") });
    expect(spec.categories.some((c) => c.id === "cat-commu")).toBe(false);
    expect(findChannel(spec, "memes")).toBeNull();
    expect(added.channels.map((c) => c.id)).not.toContain("memes");
  });

  it("respecte la limite de 50 salons par catégorie", () => {
    const user = template("gaming");
    const commu = user.categories.find((c) => c.id === "cat-commu")!;
    while (commu.channels.length < 50) commu.channels.push({ id: `extra-${commu.channels.length}`, name: `extra-${commu.channels.length}`, type: "text", nsfw: false, slowmode: 0, syncPermissions: true, overwrites: [] });
    const { spec, added } = mergeTemplateAdditions(user, improvedGaming());
    expect(findChannel(spec, "memes")).toBeNull();
    expect(added.channels.map((c) => c.id)).not.toContain("memes");
    expect(spec.categories.find((c) => c.id === "cat-commu")!.channels).toHaveLength(50);
    expect(errorKeys(spec)).toEqual(errorKeys(user));
  });

  it("respecte la limite Discord de 250 rôles", () => {
    const user = template("gaming");
    while (user.roles.length < 250) user.roles.push({ id: `r-${user.roles.length}`, name: `R${user.roles.length}`, color: 0, hoist: false, mentionable: false, permissions: [], selfAssignable: false, staff: false });
    const { spec, added } = mergeTemplateAdditions(user, improvedGaming());
    expect(spec.roles).toHaveLength(250);
    expect(added.roles).toEqual([]);
    // Le message qui mentionnait le rôle manquant reste valide : la mention devient du texte.
    const msg = spec.messages.find((m) => m.id === "msg-coaching");
    if (msg) {
      expect(msg.content).toContain("@Coach");
      expect(msg.buttons).toEqual([]);
    }
    expect(validateSpec(spec).errors).toEqual([]);
  });

  it("respecte la limite de 6 règles AutoMod par mots-clés", () => {
    const user = template("gaming");
    while (user.automod.filter((r) => r.trigger.type === "keyword").length < 6) {
      const n = user.automod.length;
      user.automod.push({ id: `kw-${n}`, name: `Mots ${n}`, enabled: true, trigger: { type: "keyword", keywords: [`mot${n}`], regexPatterns: [], allowList: [] }, actions: [{ type: "block" }], exemptRoles: [], exemptChannels: [] });
    }
    const { spec, added } = mergeTemplateAdditions(user, improvedGaming());
    expect(added.automod).toEqual([]);
    expect(spec.automod.filter((r) => r.trigger.type === "keyword")).toHaveLength(6);
  });

  it("ignore un élément dont l’identifiant est déjà pris par un autre type d’élément", () => {
    const user = template("gaming");
    // L’utilisateur a créé un salon « coach » : le rôle « coach » du template ne peut pas être ajouté.
    user.categories[0]!.channels.push({ id: "coach", name: "coach", type: "text", nsfw: false, slowmode: 0, syncPermissions: true, overwrites: [] });
    const { spec, added } = mergeTemplateAdditions(user, improvedGaming());
    expect(added.roles.map((r) => r.id)).toEqual(["notif-events"]);
    expect(spec.roles.some((r) => r.id === "coach")).toBe(false);
    // La surcharge et l’exemption qui visaient « coach » sont retirées, la mention devient du texte.
    expect(spec.categories.find((c) => c.id === "cat-coaching")!.overwrites).toEqual([]);
    expect(spec.automod.find((a) => a.id === "am-liens")!.exemptRoles).toEqual([]);
    expect(spec.messages.find((m) => m.id === "msg-coaching")!.content).toContain("@Coach");
    expect(validateSpec(spec).errors).toEqual([]);
  });

  it("retire les boutons de fonctionnalités désactivées dans le projet", () => {
    const user = template("gaming");
    delete user.features.tickets;
    user.messages = user.messages.map((m) => ({ ...m, buttons: m.buttons.filter((b) => b.action !== "ticket-open") }));
    const tpl = improvedGaming();
    tpl.messages.push({ id: "msg-ticket-2", channelId: "support", content: "Ouvrez un ticket", embeds: [], buttons: [{ action: "ticket-open", label: "Ticket", style: "primary" }], pin: false });
    const { spec, added } = mergeTemplateAdditions(user, tpl);
    expect(added.messages.map((m) => m.id)).toContain("msg-ticket-2");
    expect(spec.messages.find((m) => m.id === "msg-ticket-2")!.buttons).toEqual([]);
    expect(errorKeys(spec).filter((k) => !errorKeys(user).includes(k))).toEqual([]);
  });

  it("n’ajoute pas l’onboarding à un projet sans Communauté", () => {
    const user = template("gaming");
    user.settings.community = false;
    user.onboarding = undefined;
    user.welcomeScreen = undefined;
    const { spec, added } = mergeTemplateAdditions(user, improvedGaming());
    expect(spec.onboarding).toBeUndefined();
    expect(added.onboardingPrompts).toEqual([]);
    expect(errorKeys(spec).filter((k) => !errorKeys(user).includes(k))).toEqual([]);
  });

  for (const t of OFFICIAL_TEMPLATES) {
    it(`« ${t.slug} » : restaure les éléments retirés sans nouvelle erreur`, () => {
      const full = template(t.slug);
      const lastCategory = full.categories.at(-1)!;
      const lastRole = full.roles.at(-1)!;
      const user = removeRole(removeChannel(full, lastCategory.id), lastRole.id);
      const { spec, added } = mergeTemplateAdditions(user, full);
      expect(errorKeys(spec).filter((k) => !errorKeys(user).includes(k))).toEqual([]);
      expect(added.categories.map((c) => c.id)).toContain(lastCategory.id);
      expect(added.roles.map((r) => r.id)).toContain(lastRole.id);
      expect(ServerSpecSchema.safeParse(spec).success).toBe(true);
    });
  }
});
