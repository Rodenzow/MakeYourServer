import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { discordConfigured, env } from "@/lib/env";
import { ButtonLink, Notice, buttonClass } from "@/components/ui";

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
      <div className="brick blueprint flex aspect-square items-center justify-center p-10">
        <Image src="/brand/logo-512.png" alt="Logo Make Your Server" width={260} height={260} className="rounded-[28px] border-2 border-edge shadow-[6px_6px_0_0_rgb(131_168_243/0.3)]" priority />
      </div>
      <div>
        <p className="eyebrow">Espace personnel</p>
        <h1 className="mt-2 text-3xl font-bold">Connectez-vous avec Discord</h1>
        <p className="mt-3 text-muted">
          Nous demandons uniquement votre identité Discord et la liste de vos serveurs, pour vous proposer ceux où vous pouvez installer un projet. Nous ne lisons jamais vos messages et ne publions rien en votre nom.
        </p>
        {erreur && ERRORS[erreur] && (
          <Notice tone="danger" className="mt-5">
            {ERRORS[erreur]}
          </Notice>
        )}
        <div className="mt-6 flex flex-col gap-3">
          {discordConfigured() ? (
            <ButtonLink href={`/api/auth/login?suivant=${encodeURIComponent(next)}`} size="lg">
              Continuer avec Discord
            </ButtonLink>
          ) : (
            <Notice tone="warning" title="Connexion Discord non configurée">
              Renseignez DISCORD_CLIENT_ID et DISCORD_CLIENT_SECRET dans le fichier .env (voir README).
            </Notice>
          )}
          {env.devLogin && (
            <form action="/api/auth/dev-login" method="post" className="panel mt-2 space-y-3 p-4">
              <p className="text-sm font-semibold">Connexion de développement (DEV_LOGIN, jamais en production)</p>
              <input type="hidden" name="suivant" value={next} />
              <div className="grid grid-cols-2 gap-2">
                <input name="username" defaultValue="testeur" className="field" aria-label="Pseudo de test" />
                <input name="discordId" defaultValue="100000000000000001" className="field font-mono" aria-label="Identifiant Discord de test" />
              </div>
              <button className={buttonClass("secondary", "sm")}>Se connecter en mode test</button>
            </form>
          )}
        </div>
        <p className="mt-6 text-xs text-muted">En vous connectant, vous acceptez que vos projets et sauvegardes soient enregistrés sur votre compte. Ils restent privés et peuvent être supprimés à tout moment.</p>
      </div>
    </div>
  );
}
