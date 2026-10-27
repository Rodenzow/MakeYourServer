import { DEFAULT_QUOTAS, ServerSpecSchema } from "@mys/core";
import { OFFICIAL_TEMPLATES, detectFeatures } from "@mys/core/templates";
import { getDb } from "./client";
import { plans, templates } from "./schema";

/**
 * Données initiales : offres (sans prix : à saisir dans l’administration) et
 * templates officiels. Relancer le seed met à jour les templates officiels
 * sans toucher aux réglages modifiés depuis l’administration.
 */
export async function seed() {
  const db = getDb();
  await db
    .insert(plans)
    .values([
      { key: "free", name: "Gratuit", description: "Templates complets, éditeur, installation et sauvegarde de sécurité.", quotas: DEFAULT_QUOTAS.free, purchasable: false },
      { key: "premium", name: "Premium", description: "Conception par IA, modifications IA ciblées, sauvegardes versionnées et programmées.", quotas: DEFAULT_QUOTAS.premium, purchasable: false },
    ])
    .onConflictDoNothing();

  for (const t of OFFICIAL_TEMPLATES) {
    const spec = ServerSpecSchema.parse(t.spec);
    const values = {
      slug: t.slug,
      name: t.name,
      tagline: t.tagline,
      description: t.description,
      audience: t.audience,
      highlights: t.highlights,
      theme: t.theme,
      size: t.size,
      features: detectFeatures(spec),
      spec,
      official: true,
      status: "published",
      popularity: t.popularity,
      publishedAt: new Date(),
    };
    await db
      .insert(templates)
      .values(values)
      .onConflictDoUpdate({
        target: templates.slug,
        set: { name: values.name, tagline: values.tagline, description: values.description, audience: values.audience, highlights: values.highlights, theme: values.theme, size: values.size, features: values.features, spec: values.spec, updatedAt: new Date() },
      });
  }
  return { templates: OFFICIAL_TEMPLATES.length };
}
