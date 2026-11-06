import type { Metadata } from "next";
import { describeInvite } from "@/lib/invitations";
import { requireUser } from "@/lib/session";
import { ButtonLink, colorHex } from "@/components/ui";
import { IconAlert, IconUsers } from "@/components/icons";
import { Avatar } from "@/components/projects/common";
import { AcceptInvite } from "@/components/projects/accept-invite";

export const metadata: Metadata = { title: "Invitation à co-gérer un projet", robots: { index: false, follow: false }, referrer: "no-referrer" };

const MESSAGES = {
  invalid: ["Lien d’invitation introuvable", "Ce lien n’existe pas ou a été mal copié. Vérifiez qu’il est complet, ou demandez-en un nouveau à la personne qui vous a invité."],
  expired: ["Ce lien a expiré", "Les liens d’invitation sont valables 7 jours. Demandez un nouveau lien à la personne qui vous a invité."],
  used: ["Ce lien a déjà été utilisé", "Chaque lien ne fonctionne qu’une seule fois. Demandez un nouveau lien à la personne qui vous a invité."],
  full: ["Ce projet est complet", "Le nombre maximum de co-gestionnaires est atteint. Le propriétaire doit retirer quelqu’un avant de vous accueillir."],
} as const;

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // Connexion obligatoire : sans session, redirection vers /connexion?suivant=/invitation/…
  const user = await requireUser(`/invitation/${token}`);
  const invite = await describeInvite(token, user.id);

  return (
    <div className="mx-auto max-w-lg py-6">
      <div className="panel blueprint relative overflow-hidden p-6 text-center sm:p-8">
        {invite.state === "invalid" || invite.state === "expired" || invite.state === "used" || invite.state === "full" ? (
          <>
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-warning-soft text-warning">
              <IconAlert size={26} />
            </span>
            <h1 className="mt-4 text-2xl font-bold">{MESSAGES[invite.state][0]}</h1>
            <p className="mt-2 text-muted">{MESSAGES[invite.state][1]}</p>
            {"project" in invite && invite.project && <p className="mt-3 text-sm text-muted">Projet concerné : « {invite.project.name} »</p>}
            <div className="mt-6 flex justify-center">
              <ButtonLink href="/projets" variant="secondary">
                Voir mes projets
              </ButtonLink>
            </div>
          </>
        ) : (
          <>
            <div className="mx-auto flex w-fit items-center">
              {invite.inviter && <Avatar name={invite.inviter.name} url={invite.inviter.avatarUrl} size={56} className="ring-4 ring-surface" />}
              <span className="-ml-3 grid size-14 place-items-center rounded-full ring-4 ring-surface" style={{ background: colorHex(invite.project.accentColor ?? 0x83a8f3) }} aria-hidden>
                <IconUsers size={24} className="text-white" />
              </span>
            </div>
            <p className="eyebrow mt-5">Invitation</p>
            <h1 className="mt-1 text-2xl font-bold">
              {invite.state === "owner" ? "C’est votre projet" : invite.state === "member" ? "Vous co-gérez déjà ce projet" : `Rejoindre « ${invite.project.name} »`}
            </h1>
            <p className="mt-2 text-ink">
              {invite.state === "owner" || invite.state === "member" ? (
                <>Vous avez déjà accès à « {invite.project.name} ».</>
              ) : (
                <>
                  <strong>{invite.inviter?.name ?? "Un membre"}</strong> vous invite à co-gérer son projet de serveur Discord.
                </>
              )}
            </p>
            {invite.state === "ok" && (
              <ul className="mx-auto mt-5 max-w-sm space-y-1.5 text-left text-sm text-ink">
                <li>• Vous pourrez modifier le projet, consulter son historique et utiliser l’IA (comptée sur votre offre).</li>
                <li>• Vous pourrez l’installer sur un serveur où vous avez vous-même les droits Discord nécessaires.</li>
                <li>• Le projet ne compte pas dans votre nombre de projets.</li>
              </ul>
            )}
            <div className="mt-6 flex justify-center">
              {invite.state === "ok" ? (
                <AcceptInvite token={token} projectName={invite.project.name} />
              ) : (
                <ButtonLink href={`/projets/${invite.project.id}`}>Ouvrir le projet</ButtonLink>
              )}
            </div>
            <p className="mt-4 text-xs text-muted">Connecté en tant que {user.globalName ?? user.username}.</p>
          </>
        )}
      </div>
    </div>
  );
}
