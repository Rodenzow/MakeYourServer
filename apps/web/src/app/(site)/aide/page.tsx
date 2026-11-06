import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { HelpCenter } from "@/components/help/help-center";
import { IconArrowRight, IconInfo } from "@/components/icons";
import { HELP_QUESTIONS, answerText } from "@/lib/help-content";
import { env } from "@/lib/env";

export const metadata = {
  title: "Centre d’aide",
  description: "Réponses simples aux questions sur Make Your Server : templates, installation par le bot, sauvegardes, publication, Premium et confidentialité.",
};

export default function HelpPage() {
  // Données structurées « FAQ » pour les moteurs de recherche.
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: HELP_QUESTIONS.map((q) => ({ "@type": "Question", name: q.question, acceptedAnswer: { "@type": "Answer", text: answerText(q) } })),
  };
  return (
    <div className="mx-auto max-w-3xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faq).replace(/</g, "\\u003c") }} />
      <PageHeader eyebrow="Aide" title="Centre d’aide">
        Des réponses courtes et claires, sans jargon. Tapez un mot ou parcourez les rubriques.
      </PageHeader>

      <HelpCenter />

      <aside className="mt-10 grid gap-3 sm:grid-cols-2">
        <Link href="/aide/glossaire" className="panel group flex items-center justify-between gap-3 p-4 transition-colors hover:border-edge">
          <span>
            <span className="block font-display font-semibold text-fg">Glossaire</span>
            <span className="text-sm text-muted">Rôle, salon, onboarding… chaque mot expliqué simplement.</span>
          </span>
          <IconArrowRight className="shrink-0 text-peri transition-transform group-hover:translate-x-0.5" />
        </Link>
        <Link href="/fonctionnement" className="panel group flex items-center justify-between gap-3 p-4 transition-colors hover:border-edge">
          <span>
            <span className="block font-display font-semibold text-fg">Comment ça marche</span>
            <span className="text-sm text-muted">Le parcours complet, et ce qui est automatique ou non.</span>
          </span>
          <IconArrowRight className="shrink-0 text-peri transition-transform group-hover:translate-x-0.5" />
        </Link>
      </aside>

      <section id="contact" aria-labelledby="titre-contact" className="brick mt-10 scroll-mt-24 p-6">
        <h2 id="titre-contact" className="flex items-center gap-2 text-xl font-bold">
          <IconInfo className="text-peri" /> Vous ne trouvez pas ?
        </h2>
        <p className="mt-2 text-ink">
          Écrivez-nous, même pour une question simple.{" "}
          {env.contactEmail && (
            <>
              Adresse :{" "}
              <a href={`mailto:${env.contactEmail}`} className="link font-semibold">
                {env.contactEmail}
              </a>
              .{" "}
            </>
          )}
          Toutes nos coordonnées sont dans les{" "}
          <Link href="/conditions#contact" className="link font-semibold">
            mentions légales
          </Link>
          .
        </p>
        <p className="mt-2 text-sm text-muted">
          Pour aller plus vite, indiquez le nom de votre serveur et, si possible, le lien de la page où vous êtes bloqué. Ne nous envoyez jamais votre mot de passe ni un jeton Discord.
        </p>
      </section>
    </div>
  );
}
