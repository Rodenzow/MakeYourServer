import { ServerSpecSchema, type ServerSpec } from "../schema";
import { allChannels, specStats } from "../spec-utils";
import { association } from "./association";
import { communaute } from "./communaute";
import { etudes } from "./etudes";
import { professionnel } from "./professionnel";
import { roleplay } from "./roleplay";
import { createur } from "./createur";
import { gaming } from "./gaming";
import { musique } from "./musique";
import type { TemplateDefinition } from "./helpers";

export type { TemplateDefinition } from "./helpers";
export { BRAND } from "./helpers";

/** Templates officiels livrés avec la plateforme (insérés en base par le seed). */
export const OFFICIAL_TEMPLATES: TemplateDefinition[] = [communaute, association, etudes, roleplay, professionnel, gaming, musique, createur];

export const FEATURE_TAGS = {
  onboarding: "Onboarding Discord",
  automod: "AutoMod",
  tickets: "Tickets",
  suggestions: "Suggestions",
  "self-roles": "Rôles à boutons",
  "rules-gate": "Validation du règlement",
  welcome: "Message de bienvenue",
  logs: "Logs",
  forum: "Forums",
  events: "Événements",
  voice: "Vocaux",
  staff: "Espace staff",
} as const;
export type FeatureTag = keyof typeof FEATURE_TAGS;

/** Fonctionnalités détectées dans un projet : sert aux filtres de la bibliothèque. */
export function detectFeatures(spec: ServerSpec): FeatureTag[] {
  const tags = new Set<FeatureTag>();
  const chans = allChannels(spec).map((c) => c.channel);
  if (spec.onboarding?.enabled) tags.add("onboarding");
  if (spec.automod.length) tags.add("automod");
  if (spec.features.tickets?.enabled) tags.add("tickets");
  if (spec.features.suggestions?.enabled) tags.add("suggestions");
  if (spec.messages.some((m) => m.buttons.some((b) => b.action === "role-toggle"))) tags.add("self-roles");
  if (spec.features.rulesGate?.enabled) tags.add("rules-gate");
  if (spec.features.welcome?.enabled) tags.add("welcome");
  if (spec.features.joinLogs?.enabled || chans.some((c) => c.purpose === "logs" || c.purpose === "mod-logs")) tags.add("logs");
  if (chans.some((c) => c.type === "forum")) tags.add("forum");
  if (chans.some((c) => c.purpose === "events" || c.type === "stage")) tags.add("events");
  if (chans.some((c) => c.type === "voice" || c.type === "stage")) tags.add("voice");
  if (chans.some((c) => c.purpose === "staff")) tags.add("staff");
  return [...tags];
}

export function getOfficialTemplate(slug: string) {
  const t = OFFICIAL_TEMPLATES.find((x) => x.slug === slug);
  if (!t) return null;
  const spec = ServerSpecSchema.parse(t.spec);
  return { ...t, spec, features: detectFeatures(spec), stats: specStats(spec) };
}
