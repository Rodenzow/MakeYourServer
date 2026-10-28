import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { env } from "@/lib/env";

export const metadata = { title: "Confidentialité", description: "Données enregistrées par Make Your Server, durées de conservation et vos droits." };

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl space-y-8 text-ink">
      <PageHeader eyebrow="Vos données" title="Confidentialité">
        Nous n’enregistrons que ce qui est nécessaire au fonctionnement du service. Rien n’est vendu ni utilisé à des fins publicitaires.
      </PageHeader>

      <Section title="Ce que nous enregistrons">
        <ul className="list-disc space-y-1 pl-5">
          <li>Votre identifiant, pseudo et avatar Discord (connexion OAuth2, portées « identify » et « guilds » uniquement : nous ne lisons ni vos messages privés ni votre adresse e-mail).</li>
          <li>Vos jetons d’accès Discord, chiffrés (AES-256-GCM), uniquement pour lister les serveurs que vous gérez.</li>
          <li>Vos projets, générations IA, installations et sauvegardes (structure des serveurs : salons, rôles, permissions, AutoMod, onboarding).</li>
          <li>
            Les messages des salons que <strong>vous</strong> choisissez d’exporter dans une sauvegarde Premium : contenu, pseudo et avatar de leurs auteurs, pièces jointes (liens). Ils ne servent qu’à la
            restauration et sont supprimés avec la sauvegarde.
          </li>
          <li>Vos publications dans la bibliothèque, leurs statistiques (vues, installations) et les signalements que vous envoyez.</li>
          <li>Pour un abonnement : l’identifiant client et l’état de l’abonnement transmis par Stripe ou Discord (jamais vos coordonnées bancaires).</li>
          <li>Des journaux techniques nettoyés (jamais de jetons ni de secrets) et un journal des actions importantes, pour la sécurité.</li>
        </ul>
      </Section>

      <Section title="Cookies">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Session</strong> (« mys_session ») : vous garder connecté, 30 jours au plus. Indispensable au service.
          </li>
          <li>
            <strong>Connexion Discord</strong> : un cookie temporaire protège la connexion contre la falsification (quelques minutes).
          </li>
          <li>
            <strong>Compteur de vues</strong> (« mys_v_… ») : éviter de compter plusieurs fois votre visite d’une même fiche, 24 h. Il ne contient aucune donnée personnelle et ne sert qu’au compteur
            affiché.
          </li>
        </ul>
        <p>Aucun cookie publicitaire ni outil de suivi tiers n’est utilisé.</p>
      </Section>

      <Section title="Ce que nous ne faisons pas">
        <ul className="list-disc space-y-1 pl-5">
          <li>Vos sauvegardes ne sont jamais publiées. Publier un template est une action distincte, volontaire et relue par l’équipe ; seule la structure est publiée, sans messages ni identifiants Discord.</li>
          <li>Le contenu de vos projets et sauvegardes n’est envoyé à l’IA que lorsque vous utilisez une fonction d’IA sur ce projet.</li>
          <li>Le bot ne lit pas les messages de vos serveurs en continu et n’envoie pas de messages privés.</li>
          <li>Votre pseudo n’apparaît sur une publication que si vous l’avez accepté.</li>
        </ul>
      </Section>

      <Section title="Prestataires">
        <ul className="list-disc space-y-1 pl-5">
          <li>Cloudflare (hébergement du site et du bot), Supabase (base de données).</li>
          <li>Discord (connexion, bot), Stripe (paiements par carte), Anthropic (fonctions d’IA, uniquement à votre demande).</li>
        </ul>
      </Section>

      <Section title="Durées de conservation">
        <ul className="list-disc space-y-1 pl-5">
          <li>Compte, projets et publications : jusqu’à la suppression de votre compte.</li>
          <li>Sauvegardes : selon la durée de votre offre, puis suppression automatique (ou plus tôt si vous les supprimez).</li>
          <li>Journaux techniques : quelques semaines.</li>
        </ul>
      </Section>

      <Section title="Vos droits">
        <p>
          Vous pouvez à tout moment, depuis votre{" "}
          <Link href="/tableau-de-bord" className="link">
            tableau de bord
          </Link>{" "}
          : exporter vos données (JSON), supprimer chaque projet, sauvegarde ou publication, et supprimer votre compte avec toutes ses données. Vous pouvez aussi retirer l’accès de l’application depuis
          Discord (Paramètres → Applications autorisées).
        </p>
        <p>
          Pour toute autre demande (rectification, opposition, réclamation) :{" "}
          {env.contactEmail ? (
            <a href={`mailto:${env.contactEmail}`} className="link">
              {env.contactEmail}
            </a>
          ) : (
            "contactez l’éditeur (voir les conditions d’utilisation)"
          )}
          . Vous pouvez également saisir la CNIL.
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xl font-bold text-fg">{title}</h2>
      {children}
    </section>
  );
}
