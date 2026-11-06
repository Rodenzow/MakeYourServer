import { specStats, type ServerSpec } from "@mys/core";
import { getPublishedTemplate } from "@/lib/data";
import { OG_CONTENT_TYPE, OG_SIZE, siteCard, templateCard } from "@/lib/og/card";

// Image de partage d’un template (aperçu dans Discord, X…) : dégradé du thème, emoji,
// nom, accroche et statistiques. Mise en cache en périphérie par worker.ts.
export const dynamic = "force-dynamic";
export const alt = "Aperçu du template sur Make Your Server";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const t = await getPublishedTemplate((await params).slug).catch(() => null);
  if (!t) return siteCard();
  const s = specStats(t.spec as ServerSpec);
  return templateCard({
    name: t.name,
    tagline: t.tagline,
    theme: t.theme,
    official: t.official,
    stats: { channels: s.channels, roles: s.roles, categories: s.categories, onboardingPrompts: s.onboardingPrompts, automodRules: s.automodRules },
  });
}
