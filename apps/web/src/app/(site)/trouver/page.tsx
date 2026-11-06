import { PageHeader } from "@/components/ui";
import { TemplateQuiz } from "@/components/templates/template-quiz";
import { searchTemplates } from "@/lib/data";
import { getCurrentUser } from "@/lib/session";
import type { QuizTemplate } from "@/lib/template-quiz";

export const metadata = {
  title: "Trouver mon template",
  description: "Cinq questions pour trouver le template de serveur Discord qui vous correspond : type de communauté, taille, ambiance, fonctions et modération.",
};
export const dynamic = "force-dynamic";

export default async function FindTemplatePage() {
  const [templates, user] = await Promise.all([searchTemplates({ sort: "popular" }), getCurrentUser()]);
  // Seules les informations utiles au calcul sont envoyées au navigateur.
  const cards: QuizTemplate[] = templates.map((t) => ({
    slug: t.slug,
    name: t.name,
    tagline: t.tagline,
    theme: t.theme,
    size: t.size,
    features: t.features,
    popularity: t.popularity,
    official: t.official,
    stats: t.stats,
  }));
  return (
    <>
      <div className="mx-auto max-w-4xl">
        <PageHeader eyebrow="Gratuit · 1 minute" title="Trouver mon template">
          Répondez à cinq questions : nous comparons vos réponses aux {cards.length} templates de la bibliothèque et vous proposons les trois qui vous correspondent le mieux, avec nos raisons.
        </PageHeader>
      </div>
      <TemplateQuiz templates={cards} loggedIn={!!user} />
    </>
  );
}
