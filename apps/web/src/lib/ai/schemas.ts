import { z } from "zod";
import { ChangeSetSchema, ServerSpecSchema, SIZES, THEMES } from "@mys/core";

/** Schéma JSON envoyé au modèle (dérivé des schémas zod du moteur). La réponse est TOUJOURS revalidée par zod. */
function toToolSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

let specSchemaCache: Record<string, unknown> | null = null;
let changeSetSchemaCache: Record<string, unknown> | null = null;

export const specToolSchema = () => (specSchemaCache ??= toToolSchema(ServerSpecSchema));
export const changeSetToolSchema = () => (changeSetSchemaCache ??= toToolSchema(ChangeSetSchema));

export const FEATURE_OPTIONS = {
  welcome: "Message de bienvenue (bot)",
  joinLogs: "Logs d’arrivées et départs (bot)",
  tickets: "Tickets privés vers l’équipe (bot)",
  suggestions: "Boîte à suggestions avec votes (bot)",
  rulesGate: "Accès après acceptation du règlement (bouton)",
  selfRoles: "Rôles à choisir par boutons",
  automod: "Modération automatique AutoMod",
} as const;
export type FeatureOption = keyof typeof FEATURE_OPTIONS;

export const CreateRequestSchema = z.object({
  description: z.string().trim().min(20, "Décrivez votre besoin en au moins 20 caractères.").max(2000),
  name: z.string().trim().min(2).max(100).optional(),
  theme: z.enum(THEMES).default("autre"),
  size: z.enum(SIZES).default("medium"),
  tone: z.string().trim().max(80).default("chaleureux, tutoiement"),
  audience: z.string().trim().max(200).optional(),
  community: z.boolean().default(true),
  onboarding: z.boolean().default(true),
  features: z.array(z.enum(Object.keys(FEATURE_OPTIONS) as [FeatureOption, ...FeatureOption[]])).default(["welcome", "joinLogs", "tickets", "automod", "selfRoles"]),
});
export type CreateRequest = z.infer<typeof CreateRequestSchema>;

export const EditRequestSchema = z.object({
  projectId: z.string().uuid(),
  instruction: z.string().trim().min(5, "Décrivez la modification souhaitée.").max(1500),
  lockRoles: z.boolean().default(false),
  noRemovals: z.boolean().default(false),
});
export type EditRequest = z.infer<typeof EditRequestSchema>;
