import { PageHeader } from "@/components/ui";

export const metadata = { title: "Confidentialité" };

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl space-y-6 text-ink">
      <PageHeader eyebrow="Vos données" title="Confidentialité" />
      <section>
        <h2 className="text-xl font-bold">Ce que nous enregistrons</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Votre identifiant, pseudo et avatar Discord (connexion OAuth2, portées « identify » et « guilds »).</li>
          <li>Vos jetons d’accès Discord, chiffrés (AES-256-GCM), uniquement pour lister vos serveurs.</li>
          <li>Vos projets, générations IA, installations et sauvegardes.</li>
          <li>Des journaux techniques nettoyés (jamais de jetons ni de secrets).</li>
        </ul>
      </section>
      <section>
        <h2 className="text-xl font-bold">Ce que nous ne faisons pas</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Vos sauvegardes ne sont jamais publiées ni proposées dans la bibliothèque. Publier un template est une action distincte, volontaire et relue par l’équipe.</li>
          <li>Le contenu de vos sauvegardes n’est jamais envoyé à l’IA sans action explicite de votre part.</li>
          <li>Nous ne lisons pas les messages de vos serveurs, sauf les salons que vous choisissez d’exporter dans une sauvegarde Premium.</li>
        </ul>
      </section>
      <section>
        <h2 className="text-xl font-bold">Suppression</h2>
        <p className="mt-2">Vous pouvez supprimer à tout moment chaque projet et chaque sauvegarde depuis votre espace. Les sauvegardes expirent automatiquement selon la durée de conservation de votre offre.</p>
      </section>
    </div>
  );
}
