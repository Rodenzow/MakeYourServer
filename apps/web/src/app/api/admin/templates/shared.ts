import { z } from "zod";
import { ServerSpecSchema, SIZES, THEMES, validateSpec } from "@mys/core";
import { detectFeatures } from "@mys/core/templates";
import { HttpError } from "@/lib/api";

export const TemplateBody = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{1,60}$/, "Slug invalide : minuscules, chiffres et tirets."),
  tagline: z.string().max(200).default(""),
  description: z.string().max(2000).default(""),
  audience: z.string().max(500).default(""),
  highlights: z.array(z.string().max(200)).max(12).default([]),
  theme: z.enum(THEMES),
  size: z.enum(SIZES),
  popularity: z.number().int().min(0).max(1000).default(0),
  official: z.boolean().default(false),
  spec: z.unknown(),
});

/** Valide le projet d’un template : schéma strict puis contrôles sémantiques. */
export function checkTemplateSpec(raw: unknown) {
  const parsed = ServerSpecSchema.safeParse(raw);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    throw new HttpError(400, `Projet invalide : ${i?.path.join(".") || "racine"} — ${i?.message}`, "validation");
  }
  const v = validateSpec(parsed.data);
  return { spec: parsed.data, issues: v.issues.map((x) => ({ level: x.level, message: x.message })), ok: v.ok, features: detectFeatures(parsed.data) };
}
