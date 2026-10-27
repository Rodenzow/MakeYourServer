import Image from "next/image";
import { requireUser } from "@/lib/session";
import { inviteUrl, listManageableGuilds } from "@/lib/guilds";
import { Badge, ButtonLink, EmptyState, Notice, PageHeader } from "@/components/ui";
import { botConfigured } from "@/lib/env";

export const metadata = { title: "Serveurs" };

export default async function ServersPage({ searchParams }: { searchParams: Promise<{ rafraichir?: string }> }) {
  const user = await requireUser("/serveurs");
  const { rafraichir } = await searchParams;
  const { guilds, needsReauth } = await listManageableGuilds(user.id, rafraichir === "1");
  return (
    <>
      <PageHeader eyebrow="Discord" title="Mes serveurs accessibles" actions={<ButtonLink href="/serveurs?rafraichir=1" variant="secondary">Actualiser</ButtonLink>}>
        Seuls les serveurs où vous êtes propriétaire, administrateur ou avez « Gérer le serveur » sont affichés. Vos droits sont revérifiés par le bot avant chaque opération.
      </PageHeader>
      {!botConfigured() && <Notice tone="warning" className="mb-4" title="Bot non configuré">DISCORD_BOT_TOKEN n’est pas renseigné sur cette instance : l’analyse et l’installation sont indisponibles.</Notice>}
      {needsReauth && (
        <Notice tone="warning" className="mb-4" title="Reconnexion nécessaire">
          Votre autorisation Discord a expiré ou a été révoquée. <a href="/api/auth/login?suivant=/serveurs" className="font-semibold underline">Se reconnecter avec Discord</a>
        </Notice>
      )}
      {guilds.length === 0 && !needsReauth ? (
        <EmptyState title="Aucun serveur gérable">Créez un serveur dans Discord (bouton « + » dans la liste des serveurs), puis actualisez cette page.</EmptyState>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {guilds.map((g) => (
            <li key={g.id} className="panel flex items-center gap-3 p-4">
              {g.iconUrl ? <Image src={g.iconUrl} alt="" width={48} height={48} className="rounded-xl" /> : <span className="flex size-12 items-center justify-center rounded-xl bg-night font-display text-lg font-bold text-light">{g.name.slice(0, 1)}</span>}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{g.name}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {g.owner && <Badge>Propriétaire</Badge>}
                  {g.botPresent ? <Badge tone="success">Bot installé</Badge> : <Badge tone="warning">Bot absent</Badge>}
                </div>
              </div>
              {g.botPresent ? (
                <ButtonLink href={`/sauvegardes?serveur=${g.id}`} size="sm" variant="secondary">
                  Sauvegardes
                </ButtonLink>
              ) : (
                !g.sandbox && (
                  <ButtonLink href={inviteUrl(g.id)} size="sm" target="_blank" rel="noreferrer">
                    Inviter le bot
                  </ButtonLink>
                )
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
