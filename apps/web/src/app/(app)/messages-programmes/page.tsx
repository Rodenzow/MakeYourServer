import { DEFAULT_QUOTAS } from "@mys/core";
import { eq, getDb, plans } from "@mys/db";
import { getEntitlement, listScheduledMessages } from "@mys/engine";
import { requireUser } from "@/lib/session";
import { listManageableGuilds } from "@/lib/guilds";
import { toClient } from "@/lib/scheduled-messages";
import { ScheduledMessagesManager } from "@/components/app/scheduled-messages";
import { ScheduledPreview } from "@/components/app/scheduled-preview";
import { Badge, ButtonLink, Notice, PageHeader } from "@/components/ui";
import { IconClock, IconShield, IconUndo } from "@/components/icons";
import { Reveal } from "@/components/motion";

export const metadata = { title: "Messages programmés" };

const BENEFITS = [
  { icon: <IconClock size={20} />, title: "À l’heure, sans y penser", text: "Choisissez la date et l’heure (heure de Paris) : le bot publie le message pour vous, même quand vous dormez." },
  { icon: <IconUndo size={20} />, title: "Chaque jour ou chaque semaine", text: "Rappel d’événement, programme hebdomadaire, règles à relire : un message répété reste à jour tout seul." },
  { icon: <IconShield size={20} />, title: "Sans spam ni mauvaise surprise", text: "Aucune notification de masse (@everyone est désactivé), aucun message privé, et vos droits sont revérifiés avant chaque envoi." },
];

export default async function ScheduledMessagesPage() {
  const user = await requireUser("/messages-programmes");
  const [ent, rows, guildList] = await Promise.all([getEntitlement(user.id), listScheduledMessages(user.id), listManageableGuilds(user.id).catch(() => ({ guilds: [], needsReauth: true }))]);
  const max = ent.quotas.scheduledMessages;
  const messages = rows.map(toClient);
  const used = rows.filter((r) => r.status === "active").length;
  const guilds = guildList.guilds.filter((g) => g.botPresent).map((g) => ({ id: g.id, name: g.name }));

  if (max <= 0) {
    const [premium] = await getDb().select({ quotas: plans.quotas }).from(plans).where(eq(plans.key, "premium"));
    const premiumMax = { ...DEFAULT_QUOTAS.premium, ...(premium?.quotas ?? {}) }.scheduledMessages;
    return (
      <>
        <PageHeader eyebrow="Premium" title="Messages programmés">
          Préparez vos annonces à l’avance : le bot les publie dans le salon de votre choix, à l’heure prévue, une fois ou à intervalle régulier.
        </PageHeader>
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Reveal className="space-y-4">
            {BENEFITS.map((b) => (
              <div key={b.title} className="panel flex gap-3 p-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-blue/15 text-blue-strong">{b.icon}</span>
                <div>
                  <p className="font-semibold text-fg">{b.title}</p>
                  <p className="text-sm text-muted">{b.text}</p>
                </div>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <ButtonLink href="/abonnement" size="lg">
                Découvrir le Premium
              </ButtonLink>
              <span className="text-sm text-muted">Jusqu’à {premiumMax} messages programmés actifs avec le Premium.</span>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="eyebrow mb-2">Exemple</p>
            <ScheduledPreview
              channelName="annonces"
              when="chaque vendredi à 18:00"
              content="🎮 **Soirée jeux ce soir à 21 h !** Rendez-vous dans le vocal."
              embedTitle="Programme du week-end"
              embedDescription={"Samedi : tournoi Rocket League\nDimanche : quiz musical"}
              embedColor={0x83a8f3}
            />
            <p className="mt-2 text-xs text-muted">Envoyé automatiquement chaque semaine par le bot Make Your Server.</p>
          </Reveal>
        </div>
        {messages.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-2 text-xl font-bold">
              Vos anciens messages programmés <Badge tone="neutral">Suspendus</Badge>
            </h2>
            <p className="mb-4 text-sm text-muted">Votre offre actuelle ne permet plus leur envoi. Vous pouvez les supprimer, ou les reprendre après être repassé au Premium.</p>
            <ScheduledMessagesManager guilds={guilds} messages={messages} used={used} max={max} readOnly />
          </section>
        )}
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow="Premium" title="Messages programmés">
        Le bot publie vos messages dans le salon choisi, à l’heure prévue (heure de Paris), une fois, chaque jour ou chaque semaine. Aucune mention de masse, aucun message privé.
      </PageHeader>
      {guildList.needsReauth && (
        <Notice tone="warning" className="mb-6" title="Liste de vos serveurs indisponible">
          Reconnectez-vous avec Discord pour retrouver la liste des serveurs que vous gérez.
        </Notice>
      )}
      <ScheduledMessagesManager guilds={guilds} messages={messages} used={used} max={max} />
    </>
  );
}
