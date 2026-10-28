/**
 * Vérifie un template officiel avant de l’ajouter à la bibliothèque.
 * Usage : pnpm exec tsx scripts/check-template.ts packages/core/src/templates/<fichier>.ts <nomExport>
 * Mêmes exigences que packages/core/test/templates.test.ts.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ServerSpecSchema, allChannels, specStats, validateSpec } from "../packages/core/src";
import { detectFeatures, type TemplateDefinition } from "../packages/core/src/templates";

const [file, name] = process.argv.slice(2);
if (!file || !name) throw new Error("Usage : tsx scripts/check-template.ts <fichier> <export>");
const mod = (await import(pathToFileURL(path.resolve(file)).href)) as Record<string, TemplateDefinition>;
const t = mod[name];
if (!t) throw new Error(`Export « ${name} » introuvable dans ${file}`);

const problems: string[] = [];
const parsed = ServerSpecSchema.safeParse(t.spec);
if (!parsed.success) {
  console.error(JSON.stringify(parsed.error.issues.slice(0, 10), null, 2));
  process.exit(1);
}
const spec = parsed.data;
const v = validateSpec(spec);
v.errors.forEach((e) => problems.push(`ERREUR ${e.code} : ${e.message}`));
v.warnings.forEach((w) => console.log(`avertissement ${w.code} : ${w.message}`));
const s = specStats(spec);
if (s.channels < 12 || s.channels > 45) problems.push(`salons : ${s.channels} (attendu 12 à 45)`);
if (s.roles < 4) problems.push(`rôles : ${s.roles} (attendu ≥ 4)`);
if (s.messages < 4) problems.push(`messages : ${s.messages} (attendu ≥ 4)`);
if (spec.automod.length < 2) problems.push("AutoMod : au moins 2 règles");
const purposes = allChannels(spec).map((c) => c.channel.purpose);
if (!purposes.includes("rules")) problems.push("salon purpose « rules » manquant");
if (!purposes.includes("welcome")) problems.push("salon purpose « welcome » manquant");
if (!detectFeatures(spec).includes("staff")) problems.push("espace staff manquant (purpose « staff »)");
if ((spec.onboarding?.prompts.length ?? 0) < 3) problems.push("onboarding : au moins 3 questions");
if (!spec.settings.community) problems.push("Communauté Discord non activée (requise pour l’onboarding)");
if (t.highlights.length < 3) problems.push("highlights : au moins 3");
if (t.audience.length <= 20) problems.push("audience trop courte");
if (t.description.length <= 60) problems.push("description trop courte");
console.log(`${t.slug} : ${s.channels} salons, ${s.roles} rôles, ${s.messages} messages, ${spec.onboarding?.prompts.length ?? 0} questions d’onboarding`);
if (problems.length) {
  problems.forEach((p) => console.error(`✗ ${p}`));
  process.exit(1);
}
console.log("✓ Template valide");
