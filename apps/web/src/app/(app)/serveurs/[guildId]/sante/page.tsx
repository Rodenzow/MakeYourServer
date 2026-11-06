import Link from "next/link";
import { notFound } from "next/navigation";
import { latestServerAudit } from "@mys/engine";
import { requireUser } from "@/lib/session";
import { inviteUrl, listManageableGuilds } from "@/lib/guilds";
import { botConfigured, env } from "@/lib/env";
import { Notice, PageHeader } from "@/components/ui";
import { ServerHealth } from "@/components/app/server-health";

export const metadata = { title: "Santé du serveur" };

export default async function ServerHealthPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  if (!/^\d{17,20}$/.test(guildId)) notFound();
  const user = await requireUser(`/serveurs/${guildId}/sante`);
  const [latest, { guilds }] = await Promise.all([latestServerAudit(user.id, guildId), listManageableGuilds(user.id).catch(() => ({ guilds: [], needsReauth: false }))]);
  const guild = guilds.find((g) => g.id === guildId);
  const name = guild?.name ?? latest?.guildName ?? "ce serveur";
  return (
    <>
      <PageHeader eyebrow="Analyse gratuite" title="Santé du serveur">
        Nous vérifions la sécurité, la modération, l’organisation et l’accueil de <strong className="text-fg">{name}</strong>, puis nous expliquons simplement ce qui peut être amélioré. L’analyse ne modifie rien sur votre serveur.
      </PageHeader>
      <p className="-mt-4 mb-6 text-sm">
        <Link href="/serveurs" className="text-muted hover:text-fg">
          ← Retour à mes serveurs
        </Link>
      </p>
      {!botConfigured() && (
        <Notice tone="warning" className="mb-4" title="Bot non configuré">
          DISCORD_BOT_TOKEN n’est pas renseigné sur cette instance : l’analyse est indisponible.
        </Notice>
      )}
      <ServerHealth
        guildId={guildId}
        guildName={name}
        initial={latest ? { ...latest, createdAt: latest.createdAt.toISOString() } : null}
        inviteUrl={env.sandbox ? null : inviteUrl(guildId)}
        sandbox={env.sandbox}
      />
    </>
  );
}
