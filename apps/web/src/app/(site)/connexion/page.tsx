import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { discordConfigured, env } from "@/lib/env";
import { ButtonLink, Notice, buttonClass } from "@/components/ui";
import { IconCheck, IconX } from "@/components/icons";

export const metadata = { title: "Connexion" };

const ERRORS: Record<string, string> = {
  refus: "Vous avez annulé l’autorisation sur Discord. Aucune donnée n’a été partagée.",
  etat: "La demande de connexion a expiré ou n’est pas valide. Réessayez.",
  discord: "Discord n’a pas répondu correctement. Réessayez dans un instant.",
  suspendu: "Ce compte est suspendu. Contactez l’équipe si vous pensez qu’il s’agit d’une erreur.",
  config: "La connexion Discord n’est pas encore configurée sur cette instance (DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET).",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ suivant?: string; erreur?: string }> }) {
  const { suivant, erreur } = await searchParams;
  const user = await getCurrentUser();
  const next = suivant?.startsWith("/") && !suivant.startsWith("//") ? suivant : "/tableau-de-bord";
  if (user) redirect(next);
  return (
    <div className="mx-auto grid max-w-4xl items-center gap-10 py-6 md:grid-cols-[1fr_1fr]">
      <div className="brick blueprint hidden aspect-square items-center justify-center p-10 md:flex">
        <Image src="/brand/logo-512.png" alt="" width={260} height={260} className="rounded-[28px] border-2 border-edge shadow-[6px_6px_0_0_rgb(131_168_243/0.3)]" priority />
      </div>
      <div>
        <p className="eyebrow">Espace personnel</p>
        <h1 className="mt-2 text-3xl font-bold">Connectez-vous avec Discord</h1>
        <p className="mt-3 text-ink">Pas de mot de passe à créer : votre compte Discord suffit. Vos projets et sauvegardes sont ensuite enregistrés dans votre espace.</p>

        {erreur && ERRORS[erreur] && (
          <Notice tone="danger" className="mt-5">
            {ERRORS[erreur]}
          </Notice>
        )}

        <div className="mt-6 flex flex-col gap-3">
          {discordConfigured() ? (
            <>
              <ButtonLink href={`/api/auth/login?suivant=${encodeURIComponent(next)}`} size="lg">
                Continuer avec Discord
              </ButtonLink>
              <p className="text-sm text-muted">Discord vous demandera d’autoriser Make Your Server, puis vous reviendrez automatiquement ici.</p>
            </>
          ) : (
            <Notice tone="warning" title="Connexion Discord non configurée">
              Renseignez DISCORD_CLIENT_ID et DISCORD_CLIENT_SECRET dans le fichier .env (voir README).
            </Notice>
          )}
          {env.devLogin && (
            <form action="/api/auth/dev-login" method="post" className="panel mt-2 space-y-3 p-4">
              <p className="text-sm font-semibold">Connexion de développement (DEV_LOGIN, jamais en production)</p>
              <input type="hidden" name="suivant" value={next} />
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className="label">Pseudo de test</span>
                  <input name="username" defaultValue="testeur" className="field" />
                </label>
                <label className="block">
                  <span className="label">Identifiant Discord de test</span>
                  <input name="discordId" defaultValue="100000000000000001" className="field font-mono" inputMode="numeric" />
                </label>
              </div>
              <button className={buttonClass("secondary", "sm")}>Se connecter en mode test</button>
            </form>
          )}
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div>
            <h2 className="text-sm font-semibold text-fg">Ce que nous recevons</h2>
            <ul className="mt-2 space-y-1.5 text-sm text-ink">
              <li className="flex gap-2">
                <IconCheck size={16} className="mt-0.5 shrink-0 text-success" />
                Votre pseudo et votre avatar Discord
              </li>
              <li className="flex gap-2">
                <IconCheck size={16} className="mt-0.5 shrink-0 text-success" />
                La liste de vos serveurs, pour vous proposer ceux que vous gérez
              </li>
            </ul>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-fg">Ce que nous ne faisons jamais</h2>
            <ul className="mt-2 space-y-1.5 text-sm text-ink">
              <li className="flex gap-2">
                <IconX size={16} className="mt-0.5 shrink-0 text-danger" />
                Lire vos messages ou votre adresse e-mail
              </li>
              <li className="flex gap-2">
                <IconX size={16} className="mt-0.5 shrink-0 text-danger" />
                Publier quoi que ce soit en votre nom
              </li>
            </ul>
          </div>
        </div>

        <p className="mt-6 text-sm text-muted">
          Pas encore de compte Discord ?{" "}
          <a href="https://discord.com/register" target="_blank" rel="noreferrer" className="link font-semibold">
            Créez-en un gratuitement
            <span className="sr-only"> (nouvel onglet)</span>
          </a>
          , puis revenez ici.
        </p>
        <p className="mt-3 text-xs text-muted">
          En vous connectant, vous acceptez que vos projets et sauvegardes soient enregistrés sur votre compte. Ils restent privés et peuvent être supprimés à tout moment. Détails :{" "}
          <Link href="/confidentialite" className="link">
            confidentialité
          </Link>
          {" · "}
          <Link href="/aide#compte" className="link">
            aide
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
