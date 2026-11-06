import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader, Notice, ButtonLink } from "@/components/ui";
import { Term } from "@/components/help/term";
import { IconArchive, IconBot, IconCheck, IconClock, IconCube, IconEye, IconGrip, IconHand, IconSave, IconShield, IconTrash, IconUndo } from "@/components/icons";

export const metadata = {
  title: "Comment ça marche",
  description: "Le parcours complet en 4 étapes, ce qui est automatique, ce qui reste à faire vous-même, et ce qui protège votre serveur.",
};

const STEPS: Array<{ icon: ReactNode; title: string; who: string; time: string; text: ReactNode }> = [
  {
    icon: <IconCube size={22} />,
    title: "Choisir un template",
    who: "Vous, sur le site",
    time: "2 minutes",
    text: (
      <>
        Un <Term id="template">template</Term> est un modèle de serveur déjà prêt. Parcourez la bibliothèque et ouvrez l’aperçu pour voir chaque salon.
      </>
    ),
  },
  {
    icon: <IconGrip size={22} />,
    title: "Le personnaliser",
    who: "Vous, dans l’éditeur",
    time: "Facultatif",
    text: (
      <>
        Votre copie devient un <Term id="projet">projet</Term> privé. Changez les noms, les <Term id="role">rôles</Term>, les messages… Tout est enregistré automatiquement.
      </>
    ),
  },
  {
    icon: <IconBot size={22} />,
    title: "Inviter le bot",
    who: "Vous, dans Discord",
    time: "1 minute",
    text: (
      <>
        Créez un <Term id="serveur">serveur</Term> si besoin, puis ajoutez-y notre <Term id="bot">bot</Term> en un clic. C’est lui qui fera le travail.
      </>
    ),
  },
  {
    icon: <IconCheck size={22} />,
    title: "Installer",
    who: "Le bot, après votre accord",
    time: "Quelques minutes",
    text: <>Le site vous montre d’abord ce qui va changer. Vous confirmez, puis le bot crée tout, étape par étape.</>,
  },
];

const INSTALL_FLOW: Array<{ title: string; text: ReactNode }> = [
  {
    title: "Analyse",
    text: (
      <>
        Le site lit votre serveur grâce au bot : vos droits, ceux du bot, ce qui existe déjà et les limites de Discord. Vous voyez un aperçu « avant / après ». <strong>Rien n’est modifié.</strong>
      </>
    ),
  },
  {
    title: "Confirmation",
    text: <>Vous vérifiez la liste des opérations, puis vous confirmez. Si quelque chose doit être supprimé, vous devez retaper le nom du serveur.</>,
  },
  {
    title: "Sauvegarde de sécurité",
    text: (
      <>
        Juste avant de commencer, le bot enregistre une <Term id="sauvegarde-securite">sauvegarde de sécurité</Term> de votre serveur.
      </>
    ),
  },
  {
    title: "Installation",
    text: <>Le bot réalise chaque opération, une par une. S’il est interrompu, il reprend là où il s’était arrêté, sans rien créer en double. Vous pouvez fermer la page.</>,
  },
  {
    title: "Suivi",
    text: <>Chaque étape affiche son vrai résultat. Si certaines échouent, la cause est indiquée et vous pouvez relancer seulement celles-ci.</>,
  },
  {
    title: "Finitions",
    text: <>Quelques réglages ne peuvent pas être faits par un bot. Un assistant vous les explique, avec le texte prêt à copier.</>,
  },
];

const SAFETY: Array<{ icon: ReactNode; title: string; text: ReactNode }> = [
  { icon: <IconEye size={20} />, title: "Vous voyez tout avant", text: "L’analyse liste chaque création, modification ou suppression avant que quoi que ce soit change." },
  { icon: <IconHand size={20} />, title: "Rien sans votre accord", text: "Le bot n’agit qu’après votre confirmation, et seulement sur un serveur que vous gérez." },
  { icon: <IconSave size={20} />, title: "Une sauvegarde d’abord", text: "Une sauvegarde de sécurité est prise automatiquement avant chaque installation." },
  { icon: <IconTrash size={20} />, title: "Pas de suppression par erreur", text: "Rien n’est supprimé par défaut. Pour supprimer, vous retapez le nom du serveur." },
  {
    icon: <IconShield size={20} />,
    title: "Un essai à blanc possible",
    text: (
      <>
        La <Term id="simulation">simulation</Term> rejoue l’installation sur une copie : Discord n’est pas touché.
      </>
    ),
  },
  { icon: <IconUndo size={20} />, title: "Reprise sans doublon", text: "Chaque élément créé est mémorisé : une installation interrompue reprend proprement." },
];

const AUTO: ReactNode[] = [
  <>
    <Term id="categorie">Catégories</Term>, salons écrits, <Term id="vocal">vocaux</Term> et <Term id="forum">forums</Term>, avec leur ordre et leur description
  </>,
  <>
    <Term id="role">Rôles</Term>, couleurs, <Term id="hierarchie">hiérarchie</Term> et <Term id="permission">permissions</Term> générales
  </>,
  <>
    <Term id="surcharge">Permissions particulières des salons</Term>, par exemple un espace privé pour l’équipe
  </>,
  <>
    Messages, <Term id="embed">messages enrichis</Term>, et mentions des rôles et salons créés
  </>,
  <>Réglages du serveur : niveau de vérification, filtre de contenu, notifications, salon système, salon d’inactivité</>,
  <>
    Règles <Term id="automod">AutoMod</Term> (Discord en accepte 6 par mots-clés au maximum)
  </>,
];

const CONDITIONAL: Array<[ReactNode, ReactNode]> = [
  [
    <>
      Activation de la <Term id="communaute">Communauté Discord</Term>
    </>,
    "Automatique si le bot est Administrateur. Sinon, un guide vous explique comment l’activer.",
  ],
  [
    <>
      <Term id="onboarding">Onboarding</Term> et <Term id="ecran-accueil">écran d’accueil</Term>
    </>,
    "Automatiques une fois la Communauté activée.",
  ],
  [
    <>
      <Term id="salon-annonces">Salons d’annonces</Term> et de <Term id="conference">conférence</Term>
    </>,
    "Créés tels quels si la Communauté est activée. Sinon, ils deviennent des salons écrits classiques.",
  ],
  [<>Messages épinglés</>, "Si le bot a la permission « Épingler des messages »."],
];

const BOT_FEATURES: ReactNode[] = [
  <>Boutons pour choisir ses rôles, et validation du règlement par un bouton</>,
  <>
    <Term id="ticket">Tickets</Term> privés vers l’équipe, et suggestions avec votes
  </>,
  <>Message de bienvenue et journal des arrivées (si l’application a accès aux arrivées de membres, l’intention « Server Members »)</>,
];

const MANUAL: Array<[ReactNode, ReactNode]> = [
  [<>Créer le serveur lui-même</>, "Discord ne permet plus aux applications de créer un serveur. Cela prend 30 secondes dans Discord."],
  [
    <>
      Le <Term id="guide-serveur">Guide du serveur</Term>
    </>,
    "Discord ne permet pas aux bots de le remplir. Le contenu est préparé : vous n’avez qu’à le copier.",
  ],
  [<>Icône, bannière, émojis et autocollants</>, "Pas encore inclus dans les projets."],
];

export default function HowPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow="Comment ça marche" title="Comment fonctionne Make Your Server" help={{ href: "/aide", label: "Centre d’aide" }}>
        En résumé : vous choisissez un modèle, vous l’adaptez si vous le souhaitez, et notre bot l’installe sur votre serveur Discord. Rien ne change sans votre accord. Nous vous disons aussi,
        honnêtement, ce qui est automatique et ce qui ne l’est pas.
      </PageHeader>

      {/* ------------------------------ Parcours ------------------------------ */}
      <section aria-labelledby="parcours">
        <h2 id="parcours" className="text-2xl font-bold">
          Le parcours en 4 étapes
        </h2>
        <ol className="relative mt-6 grid gap-4 md:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative">
              {i < STEPS.length - 1 && (
                <span aria-hidden className="absolute top-9 -right-4 z-10 hidden h-0.5 w-4 bg-edge md:block">
                  <span className="absolute -top-[3px] right-0 size-2 rotate-45 border-t-2 border-r-2 border-edge" />
                </span>
              )}
              <div className="brick flex h-full flex-col p-5">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl border border-edge bg-night text-light" aria-hidden>
                    {s.icon}
                  </span>
                  <span className="font-mono text-sm font-semibold text-peri" aria-hidden>
                    0{i + 1}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-bold">
                  <span className="sr-only">Étape {i + 1} : </span>
                  {s.title}
                </h3>
                <p className="mt-1 text-sm text-ink">{s.text}</p>
                <dl className="mt-auto space-y-1 pt-4 text-xs">
                  <div className="flex gap-1.5">
                    <dt className="font-semibold text-muted">Qui :</dt>
                    <dd className="text-ink">{s.who}</dd>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <dt className="flex items-center gap-1 font-semibold text-muted">
                      <IconClock size={13} /> Durée :
                    </dt>
                    <dd className="text-ink">{s.time}</dd>
                  </div>
                </dl>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------------------------- Vocabulaire ---------------------------- */}
      <section aria-labelledby="mots" className="mt-14">
        <h2 id="mots" className="text-2xl font-bold">
          Quatre mots à connaître
        </h2>
        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          {(
            [
              ["Template", "Un modèle public et réutilisable, le même pour tout le monde."],
              ["Projet", "Votre version personnelle d’un template : privée, modifiable, enregistrée sur votre compte."],
              ["Sauvegarde", "Une photo de la structure d’un vrai serveur (salons, rôles, réglages), prise par le bot."],
              ["Installation", "Le moment où le bot applique un projet ou une sauvegarde sur votre serveur, après votre accord."],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="panel p-4">
              <dt className="font-display font-semibold text-fg">{k}</dt>
              <dd className="mt-1 text-sm text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-sm text-muted">
          D’autres mots vous bloquent ? Ils sont tous expliqués dans le{" "}
          <Link href="/aide/glossaire" className="link font-semibold">
            glossaire
          </Link>
          .
        </p>
      </section>

      {/* ------------------------- Pendant l’installation ------------------------- */}
      <section aria-labelledby="pendant" className="mt-14">
        <h2 id="pendant" className="text-2xl font-bold">
          Que se passe-t-il quand vous cliquez sur « Installer » ?
        </h2>
        <ol className="mt-6 space-y-0">
          {INSTALL_FLOW.map((s, i) => (
            <li key={s.title} className="relative flex gap-4 pb-6 last:pb-0">
              {i < INSTALL_FLOW.length - 1 && <span aria-hidden className="absolute top-9 bottom-0 left-[17px] w-px bg-edge" />}
              <span aria-hidden className="relative flex size-9 shrink-0 items-center justify-center rounded-full border border-edge bg-night font-mono text-sm font-bold text-light">
                {i + 1}
              </span>
              <div className="pt-1">
                <h3 className="font-display text-lg font-semibold">
                  <span className="sr-only">Étape {i + 1} : </span>
                  {s.title}
                </h3>
                <p className="mt-0.5 text-ink">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ------------------------------ Sécurité ------------------------------ */}
      <section aria-labelledby="protege" className="mt-14">
        <h2 id="protege" className="text-2xl font-bold">
          Ce qui protège votre serveur
        </h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SAFETY.map((s) => (
            <li key={s.title} className="panel p-4">
              <p className="flex items-center gap-2 font-semibold text-fg">
                <span className="text-peri" aria-hidden>
                  {s.icon}
                </span>
                {s.title}
              </p>
              <p className="mt-1 text-sm text-ink">{s.text}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ----------------------------- Qui fait quoi ----------------------------- */}
      <section className="mt-14 scroll-mt-24" id="limites" aria-labelledby="qui-fait-quoi">
        <h2 id="qui-fait-quoi" className="text-2xl font-bold">
          Qui fait quoi ?
        </h2>
        <p className="mt-1 text-ink">Rien n’est présenté comme configuré s’il ne l’est pas réellement.</p>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <WhoBox tone="success" title="Installé automatiquement par le bot">
            <ul className="space-y-2">
              {AUTO.map((t, i) => (
                <Item key={i} tone="success">
                  {t}
                </Item>
              ))}
            </ul>
          </WhoBox>

          <WhoBox tone="blue" title="Automatique, sous condition">
            <ul className="space-y-3">
              {CONDITIONAL.map(([t, c], i) => (
                <Item key={i} tone="blue">
                  <span className="font-medium text-fg">{t}</span>
                  <span className="block text-sm text-muted">{c}</span>
                </Item>
              ))}
            </ul>
          </WhoBox>

          <WhoBox tone="blue" title="Assuré par notre bot, tant qu’il reste sur le serveur">
            <ul className="space-y-2">
              {BOT_FEATURES.map((t, i) => (
                <Item key={i} tone="blue">
                  {t}
                </Item>
              ))}
            </ul>
          </WhoBox>

          <WhoBox tone="warning" title="À faire vous-même, ou pas encore inclus">
            <ul className="space-y-3">
              {MANUAL.map(([t, c], i) => (
                <Item key={i} tone="warning">
                  <span className="font-medium text-fg">{t}</span>
                  <span className="block text-sm text-muted">{c}</span>
                </Item>
              ))}
            </ul>
          </WhoBox>
        </div>
      </section>

      {/* ------------------------------ Sauvegardes ------------------------------ */}
      <section className="mt-14 space-y-4" aria-labelledby="sauvegardes">
        <h2 id="sauvegardes" className="text-2xl font-bold">
          Sauvegardes et restaurations : ce qui est possible
        </h2>
        <p className="text-ink">
          Une <Term id="sauvegarde">sauvegarde</Term> garde la structure de votre serveur : salons, rôles, permissions et réglages. La <Term id="restauration">restauration</Term> remet cette structure
          en place : les éléments disparus sont recréés, les autres reprennent leurs réglages. Rien n’est supprimé.
        </p>
        <Notice tone="warning" title="Une restauration n’est pas une remise à l’identique">
          <p>Discord ne permet pas de réutiliser un élément supprimé. Un salon ou un rôle recréé est un nouvel élément, et l’historique des messages d’un salon supprimé est perdu.</p>
          <p className="mt-2">
            Avec le Premium, les messages exportés peuvent être republiés par un <Term id="webhook">webhook</Term>, avec le nom de leur auteur et leur date d’origine. C’est une republication, pas les
            messages d’origine.
          </p>
        </Notice>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="panel p-4">
            <p className="flex items-center gap-2 font-semibold text-fg">
              <IconArchive size={18} className="text-peri" /> Archiver un salon
            </p>
            <p className="mt-1 text-sm text-ink">Le salon est rangé dans une catégorie « 📦 Archives » cachée aux membres. Tous ses messages sont conservés.</p>
          </div>
          <div className="panel p-4">
            <p className="flex items-center gap-2 font-semibold text-fg">
              <IconTrash size={18} className="text-danger" /> Supprimer un salon
            </p>
            <p className="mt-1 text-sm text-ink">Ses messages sont effacés pour toujours. C’est pourquoi vous devez retaper le nom du serveur pour confirmer.</p>
          </div>
        </div>
      </section>

      {/* --------------------------- Permissions du bot --------------------------- */}
      <section className="mt-14 space-y-3" aria-labelledby="permissions-bot">
        <h2 id="permissions-bot" className="text-2xl font-bold">
          Quelles permissions donner au bot ?
        </h2>
        <p className="text-ink">
          Discord interdit à un bot de donner une <Term id="permission">permission</Term> qu’il n’a pas lui-même. Et seul un <Term id="administrateur">Administrateur</Term> peut activer la Communauté.
        </p>
        <p className="text-ink">
          Nous conseillons donc d’inviter le bot avec la permission <strong>Administrateur</strong> le temps de l’installation. Ensuite, vous pouvez la lui retirer : les boutons du serveur
          continueront de fonctionner avec « Gérer les rôles », « Gérer les fils » et « Envoyer des messages ».
        </p>
        <p className="text-ink">
          Pour installer, il vous faut la permission <Term id="gerer-serveur">« Gérer le serveur »</Term>. Pour restaurer une sauvegarde ou supprimer des éléments, il faut être Administrateur ou
          propriétaire du serveur.
        </p>
      </section>

      <div className="mt-14 flex flex-wrap gap-3">
        <ButtonLink href="/templates" size="lg">
          Voir les templates
        </ButtonLink>
        <ButtonLink href="/aide" variant="secondary" size="lg">
          Ouvrir le centre d’aide
        </ButtonLink>
      </div>
    </div>
  );
}

function WhoBox({ title, tone, children }: { title: string; tone: "success" | "blue" | "warning"; children: ReactNode }) {
  const border = { success: "border-t-success", blue: "border-t-blue", warning: "border-t-warning" }[tone];
  return (
    <div className={`panel border-t-4 p-5 ${border}`}>
      <h3 className="text-lg font-bold">{title}</h3>
      <div className="mt-3 text-ink">{children}</div>
    </div>
  );
}

function Item({ tone, children }: { tone: "success" | "blue" | "warning"; children: ReactNode }) {
  const dot = { success: "bg-success", blue: "bg-blue", warning: "bg-warning" }[tone];
  return (
    <li className="flex gap-2.5">
      <span aria-hidden className={`mt-2 size-1.5 shrink-0 rounded-full ${dot}`} />
      <span>{children}</span>
    </li>
  );
}
