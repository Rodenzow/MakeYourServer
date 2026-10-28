import { describe, expect, it } from "vitest";
import { ServerSpecSchema, hasSourceIdentifiers, prepareForPublication, validateSpec } from "../src";
import { OFFICIAL_TEMPLATES } from "../src/templates";

describe("prepareForPublication", () => {
  // Simule un projet issu d’une sauvegarde : identifiants dérivés des snowflakes Discord.
  const source = OFFICIAL_TEMPLATES.find((t) => t.slug === "gaming")!.spec;
  const swaps: Record<string, string> = { moderateur: "r-111111111111111111", admin: "r-222222222222222222", "hors-sujet": "c-333333333333333333", "cat-staff": "k-444444444444444444", "q-jeux": "p-555555555555555555" };
  let json = JSON.stringify(source);
  for (const [from, to] of Object.entries(swaps)) json = json.replace(new RegExp(`(["{#@])${from}(["}])`, "g"), `$1${to}$2`);
  const fromBackup = ServerSpecSchema.parse(JSON.parse(json));

  it("le projet simulé contient bien des identifiants d’origine et reste valide", () => {
    expect(hasSourceIdentifiers(fromBackup)).toBe(true);
    expect(validateSpec(fromBackup).errors).toEqual([]);
  });

  it("remplace les identifiants d’origine par des identifiants lisibles et garde les références", () => {
    const spec = prepareForPublication(fromBackup, "Mon serveur publié");
    expect(hasSourceIdentifiers(spec)).toBe(false);
    expect(spec.meta.name).toBe("Mon serveur publié");
    expect(validateSpec(spec).errors).toEqual([]);
    const mod = spec.roles.find((r) => r.name.includes("Modération"))!;
    expect(mod.id).toMatch(/moderation/);
    expect(spec.features.tickets!.staffRoleIds).toContain(mod.id);
    expect(JSON.stringify(spec.messages)).toContain(`{@${mod.id}}`);
  });

  it("ne touche pas un projet déjà lisible", () => {
    const clean = ServerSpecSchema.parse(source);
    expect(prepareForPublication(clean, clean.meta.name)).toEqual(clean);
  });
});
