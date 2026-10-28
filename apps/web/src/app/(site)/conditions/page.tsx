import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { env } from "@/lib/env";

export const metadata = { title: "Conditions d’utilisation", description: "Conditions d’utilisation de Make Your Server, règles de publication et mentions légales." };

const DISCORD_TERMS = "https://discord.com/terms";
const DISCORD_GUIDELINES = "https://discord.com/guidelines";

export default function TermsPage() {
  const contact = env.contactEmail ? (
    <a href={`mailto:${env.contactEmail}`} className="link">
      {env.contactEmail}
    </a>
  ) : (
    "l’adresse de contact indiquée par l’éditeur"
  );
  return (
    <div className="max-w-3xl space-y-8 text-ink">
      <PageHeader eyebrow="Informations" title="Conditions d’utilisation">
        En utilisant Make Your Server (le site et le bot), vous acceptez les conditions ci-dessous. Elles complètent les conditions de Discord, qui s’appliquent toujours.
      </PageHeader>

      <Section title="1. Le service">
        <p>
          Make Your Server permet de concevoir un serveur Discord (templates, éditeur, IA en option), puis de le faire installer par un bot, de le sauvegarder et de le restaurer. Make Your Server n’est pas
          affilié à Discord Inc. ; « Discord » est une marque de Discord Inc.
        </p>
        <p>Le bot n’agit que sur un serveur où il a été invité, à la demande d’une personne qui en a les droits, et seulement après votre confirmation. Il n’envoie pas de messages privés non sollicités.</p>
      </Section>

      <Section title="2. Votre compte">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            La connexion se fait avec votre compte Discord. Vous devez avoir l’âge minimum requis par les{" "}
            <a href={DISCORD_TERMS} className="link" target="_blank" rel="noreferrer">
              Conditions d’utilisation de Discord
            </a>{" "}
            dans votre pays.
          </li>
          <li>Vous êtes responsable des actions réalisées depuis votre compte et des serveurs que vous configurez.</li>
          <li>
            Vous pouvez exporter vos données ou supprimer votre compte à tout moment depuis votre{" "}
            <Link href="/tableau-de-bord" className="link">
              tableau de bord
            </Link>
            .
          </li>
        </ul>
      </Section>

      <Section title="3. Utilisation acceptable">
        <p>Il est interdit d’utiliser le service pour :</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>enfreindre les Conditions d’utilisation ou les Règles de la communauté de Discord ;</li>
          <li>prendre le contrôle d’un serveur sans l’accord de ses responsables, ou le modifier sans en avoir les droits ;</li>
          <li>créer des serveurs destinés au spam, aux raids, aux arnaques, au harcèlement ou à des contenus illégaux ;</li>
          <li>contourner les limites, les quotas ou les mesures de sécurité du service ou de Discord.</li>
        </ul>
        <p>Nous pouvons suspendre un compte qui enfreint ces règles.</p>
      </Section>

      <Section title="4. Règles de publication dans la bibliothèque" id="publication">
        <p>Chaque proposition est relue par l’équipe avant d’être publiée. En proposant un projet ou une sauvegarde, vous garantissez que :</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>vous êtes l’auteur du projet, ou vous gérez le serveur sauvegardé et avez l’accord de ses responsables pour en partager la structure ;</li>
          <li>
            le contenu respecte les{" "}
            <a href={DISCORD_GUIDELINES} className="link" target="_blank" rel="noreferrer">
              Règles de la communauté de Discord
            </a>{" "}
            : aucun contenu haineux, harcelant, sexuel, violent, trompeur ou illégal, aucun salon soumis à une limite d’âge ;
          </li>
          <li>il ne contient aucune donnée personnelle (noms réels, coordonnées, identifiants), aucun lien d’invitation ni publicité non sollicitée ;</li>
          <li>il ne reprend pas sans autorisation le nom, le logo ou l’identité d’une marque, d’une personne ou d’une autre communauté ;</li>
          <li>la description est honnête et le template fonctionne tel que décrit.</li>
        </ul>
        <p>
          Seule la structure d’une sauvegarde est publiée : les messages exportés et les identifiants Discord du serveur d’origine ne le sont jamais. Vous accordez à Make Your Server le droit d’afficher
          et de distribuer gratuitement votre template dans la bibliothèque, et aux membres celui de l’installer et de le modifier. Vous pouvez le retirer à tout moment depuis « Mes publications ».
        </p>
        <p>L’équipe peut refuser, modifier la présentation ou retirer un template, notamment après un signalement. Tout membre connecté peut signaler un template depuis sa fiche.</p>
      </Section>

      <Section title="5. Premium et paiements">
        <ul className="list-disc space-y-1 pl-5">
          <li>Le prix et le contenu de l’offre Premium sont affichés sur la page Offres avant tout achat.</li>
          <li>Le paiement est géré par notre prestataire (Stripe) ou par Discord pour un achat dans l’application ; l’offre est au même prix au maximum sur le site et dans Discord.</li>
          <li>L’abonnement se renouvelle automatiquement et peut être résilié à tout moment ; il reste actif jusqu’à la fin de la période payée.</li>
          <li>
            Pour un achat sur le site, vous disposez d’un droit de rétractation de 14 jours, sauf si vous demandez expressément à utiliser le Premium immédiatement et renoncez à ce droit lors de l’achat.
          </li>
        </ul>
      </Section>

      <Section title="6. Responsabilité">
        <p>
          Avant chaque installation ou restauration, une analyse est présentée et une sauvegarde de sécurité est réalisée. Discord peut toutefois refuser certaines opérations (limites, permissions, règles
          internes) : nous l’indiquons honnêtement, sans promettre un résultat que l’API ne permet pas. Le service est fourni en l’état ; vérifiez l’analyse avant de confirmer.
        </p>
      </Section>

      <Section title="7. Mentions légales">
        <ul className="list-disc space-y-1 pl-5">
          <li>Éditeur : {env.legalEditor || "le responsable du service Make Your Server (identité communiquée à l’hébergeur)"}.</li>
          <li>Contact : {contact}.</li>
          <li>Hébergement : Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107, États-Unis.</li>
          <li>
            Données personnelles : voir la{" "}
            <Link href="/confidentialite" className="link">
              politique de confidentialité
            </Link>
            .
          </li>
        </ul>
      </Section>

      <p className="text-sm text-muted">Ces conditions peuvent évoluer ; la version en ligne fait foi. Dernière mise à jour : octobre 2026.</p>
    </div>
  );
}

function Section({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 space-y-2">
      <h2 className="text-xl font-bold text-fg">{title}</h2>
      {children}
    </section>
  );
}
