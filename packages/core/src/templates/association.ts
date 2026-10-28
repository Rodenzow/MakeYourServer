import type { PermissionKey } from "../permissions";
import { BRAND, PERMS, adminPerms, announcement, forum, moderatorPerms, own, privateTo, readOnly, text, voice, type TemplateDefinition } from "./helpers";

const BUREAU = ["president", "bureau"];
const WRITE: PermissionKey[] = ["SEND_MESSAGES", "SEND_MESSAGES_IN_THREADS", "CREATE_PUBLIC_THREADS", "CREATE_PRIVATE_THREADS"];

/** Visible par les adhérents (et le bureau), caché aux visiteurs qui n’ont pas validé le règlement. */
const adherents = (extraView: string[] = []) => [
  { target: "everyone", allow: [] as PermissionKey[], deny: ["VIEW_CHANNEL"] as PermissionKey[] },
  ...["membre", "bureau", ...extraView].map((r) => ({ target: r, allow: ["VIEW_CHANNEL"] as PermissionKey[], deny: [] as PermissionKey[] })),
];

/** Lecture seule pour les adhérents, publication réservée au bureau. */
const adherentsReadOnly = () => [
  { target: "everyone", allow: [] as PermissionKey[], deny: ["VIEW_CHANNEL", ...WRITE] as PermissionKey[] },
  { target: "membre", allow: ["VIEW_CHANNEL", "READ_MESSAGE_HISTORY"] as PermissionKey[], deny: [] as PermissionKey[] },
  { target: "bureau", allow: ["VIEW_CHANNEL", "SEND_MESSAGES", "SEND_MESSAGES_IN_THREADS"] as PermissionKey[], deny: [] as PermissionKey[] },
];

export const association: TemplateDefinition = {
  slug: "association",
  name: "Association loi 1901",
  tagline: "Le serveur de votre association : adhérents informés, bénévoles coordonnés, bureau organisé.",
  description:
    "Un espace structuré pour une association : accueil des visiteurs avec onboarding (pôles, statut, rappels), annonces et agenda tenus par le bureau, validation du règlement intérieur pour accéder aux documents et comptes rendus d’assemblée générale, suivi des projets en forum, salons par pôle, coordination des bénévoles et espace privé du bureau.",
  theme: "association",
  size: "small",
  audience: "Associations sportives, culturelles, étudiantes ou solidaires, de 10 à 500 adhérents, souhaitant centraliser l’information et la vie associative.",
  highlights: [
    "Onboarding : choix des pôles (communication, événements, logistique), du statut et des rappels",
    "Validation du règlement intérieur par bouton : documents, comptes rendus d’AG et votes réservés aux adhérents",
    "Annonces et agenda en lecture seule, publiés par le bureau",
    "Forum des projets avec tags (idée, en cours, terminé) et espace dédié aux bénévoles",
    "Espace privé du bureau avec trésorerie, documents internes et logs",
    "Tickets privés pour contacter le bureau et boîte à suggestions",
  ],
  popularity: 74,
  spec: {
    version: 1,
    meta: {
      name: "Association",
      description: "Serveur d’association loi 1901 : informations, vie associative, bénévolat et bureau.",
      theme: "association",
      size: "small",
      tone: "cordial et vouvoiement",
      audience: "Adhérents, bénévoles et bureau d’une association",
      accentColor: BRAND.blue,
    },
    settings: {
      verificationLevel: "low",
      explicitContentFilter: "all_members",
      defaultNotifications: "only_mentions",
      community: true,
      description: "Le serveur de l’association : actualités, projets, pôles bénévoles et échanges entre adhérents.",
      systemChannelId: "bienvenue",
      rulesChannelId: "reglement",
      publicUpdatesChannelId: "maj-discord",
      safetyAlertsChannelId: "alertes",
      suppressJoinNotifications: true,
      suppressSetupTips: true,
    },
    everyone: { permissions: PERMS.member },
    roles: [
      { id: "president", name: "🏛️ Présidence", color: 0xf2c14e, hoist: true, mentionable: true, permissions: adminPerms(), staff: true, description: "Président·e de l’association : représente l’association et administre le serveur." },
      { id: "tresorier", name: "💶 Trésorerie", color: 0x57c785, hoist: false, mentionable: true, permissions: PERMS.member, description: "Trésorier·ère : cotisations, budget et comptes. Accède au salon de trésorerie." },
      { id: "secretaire", name: "📝 Secrétariat", color: BRAND.periwinkle, hoist: false, mentionable: true, permissions: [...PERMS.member, "PIN_MESSAGES"], description: "Secrétaire : convocations, comptes rendus et documents officiels." },
      { id: "bureau", name: "🗂️ Bureau", color: BRAND.blue, hoist: true, mentionable: true, permissions: moderatorPerms(), staff: true, description: "Membres du bureau : publient les annonces, modèrent et répondent aux tickets." },
      { id: "benevole", name: "🙋 Bénévole", color: 0xff9f5a, hoist: true, mentionable: true, permissions: PERMS.member, description: "Adhérent·e engagé·e dans les actions de l’association, attribué par le bureau." },
      { id: "membre", name: "🤝 Adhérent", color: BRAND.lightBlue, hoist: true, permissions: [], description: "Obtenu en acceptant le règlement intérieur : donne accès aux documents, comptes rendus, votes et réunions." },
      { id: "pole-communication", name: "📢 Pôle communication", selfAssignable: true, mentionable: true, description: "Réseaux sociaux, affiches, newsletter et relations presse." },
      { id: "pole-evenements", name: "🎉 Pôle événements", selfAssignable: true, mentionable: true, description: "Organisation des manifestations, ateliers et sorties." },
      { id: "pole-logistique", name: "📦 Pôle logistique", selfAssignable: true, mentionable: true, description: "Matériel, salles, transport et installation le jour J." },
      { id: "statut-adherent", name: "🪪 Statut : adhérent", selfAssignable: true, description: "Déclare être déjà adhérent·e de l’association (cotisation vérifiée par le bureau)." },
      { id: "statut-futur-benevole", name: "✋ Statut : futur bénévole", selfAssignable: true, description: "Souhaite s’engager : le bureau peut le contacter et lui attribuer le rôle Bénévole." },
      { id: "statut-decouverte", name: "👀 Statut : découverte", selfAssignable: true, description: "Découvre l’association avant, peut-être, d’adhérer." },
      { id: "statut-partenaire", name: "🤲 Statut : partenaire", selfAssignable: true, description: "Représente une structure partenaire (collectivité, association, sponsor)." },
      { id: "notif-agenda", name: "🔔 Rappels agenda", selfAssignable: true, description: "Mentionné pour les rappels de réunions et d’événements." },
      { id: "notif-missions", name: "📣 Appels à bénévoles", selfAssignable: true, description: "Mentionné quand l’association cherche des volontaires." },
      { id: "notif-ag", name: "🏛️ Convocations AG", selfAssignable: true, description: "Mentionné pour les convocations aux assemblées générales et les votes." },
    ],
    categories: [
      {
        id: "cat-accueil",
        name: "📌 Accueil",
        overwrites: readOnly(["bureau"]),
        channels: [
          text("bienvenue", "👋・bienvenue", "Bienvenue ! Lisez le règlement intérieur puis validez-le pour accéder au serveur.", { purpose: "welcome" }),
          text("reglement", "📜・règlement-intérieur", "Règlement intérieur du serveur. Cliquez sur le bouton pour l’accepter.", { purpose: "rules" }),
          text("presentation-asso", "ℹ️・l-association", "Qui sommes-nous ? Missions, valeurs et fonctionnement de l’association.", { purpose: "info" }),
        ],
      },
      {
        id: "cat-infos",
        name: "📢 Informations",
        overwrites: readOnly(["bureau"]),
        channels: [
          announcement("annonces", "📣・annonces", "Les informations officielles du bureau.", { purpose: "announcements" }),
          text("agenda", "📅・agenda", "Réunions, permanences, événements et dates limites.", { purpose: "events" }),
          text("comptes-rendus", "🧾・comptes-rendus-ag", "Comptes rendus des assemblées générales et des réunions de bureau. Réservé aux adhérents.", { purpose: "info", ...own(adherentsReadOnly()) }),
          text("documents", "📁・documents", "Statuts, règlement intérieur, bulletin d’adhésion et documents utiles. Réservé aux adhérents.", { purpose: "info", ...own(adherentsReadOnly()) }),
          text("faq", "❓・faq", "Les réponses aux questions fréquentes des adhérents.", { purpose: "faq" }),
          text("roles", "🎭・mes-rôles", "Choisissez vos pôles, votre statut et les rappels que vous souhaitez recevoir.", { purpose: "roles" }),
        ],
      },
      {
        id: "cat-echanges",
        name: "💬 Vie associative",
        overwrites: [],
        channels: [
          text("general", "💬・discussions", "Échanges entre adhérents, bénévoles et sympathisants, dans la bonne humeur.", { purpose: "general" }),
          text("presentations", "🙋・présentations", "Présentez-vous : votre prénom, ce qui vous amène, ce que vous aimeriez apporter.", { slowmode: 300, purpose: "introductions" }),
          forum("projets", "🌱・projets", "Une publication par projet : objectif, besoins, calendrier. Utilisez les tags pour indiquer l’avancement.", [
            { name: "Idée", emoji: "💡" },
            { name: "En cours", emoji: "🚧" },
            { name: "Besoin d’aide", emoji: "🙋" },
            { name: "Terminé", emoji: "✅", moderated: true },
          ], { defaultReaction: "👍" }),
          text("pause-cafe", "☕・pause-café", "Discussions libres, hors activités de l’association."),
          text("suggestions", "💡・suggestions", "Proposez une idée avec le bouton : le bureau l’étudiera en réunion.", {
            purpose: "suggestions",
            ...own([
              { target: "everyone", allow: [], deny: ["VIEW_CHANNEL", "SEND_MESSAGES", "CREATE_PUBLIC_THREADS"] },
              { target: "membre", allow: ["VIEW_CHANNEL", "READ_MESSAGE_HISTORY", "ADD_REACTIONS", "SEND_MESSAGES_IN_THREADS"], deny: [] },
              { target: "bureau", allow: ["VIEW_CHANNEL", "SEND_MESSAGES"], deny: [] },
            ]),
          }),
          text("support", "🎫・contacter-le-bureau", "Une question sur votre adhésion, une demande particulière ? Ouvrez un ticket privé.", { purpose: "support", ...own(readOnly(["bureau"])) }),
        ],
      },
      {
        id: "cat-poles",
        name: "🧩 Pôles",
        overwrites: [],
        channels: [
          text("communication", "📢・pôle-communication", "Réseaux sociaux, affiches, newsletter : préparez ensemble la communication de l’association."),
          text("evenements", "🎉・pôle-événements", "Idées, rétroplannings et répartition des tâches pour les prochains événements."),
          text("logistique", "📦・pôle-logistique", "Matériel, réservations de salles, transport et installation."),
        ],
      },
      {
        id: "cat-benevoles",
        name: "🙋 Bénévolat",
        overwrites: privateTo(["benevole", "bureau"]),
        channels: [
          text("coordination", "🧭・coordination", "Organisation des actions : qui fait quoi, quand et où."),
          text("missions", "📋・missions", "Appels à volontaires et inscriptions aux créneaux.", { purpose: "events" }),
          voice("vocal-benevoles", "🎙️ Point bénévoles"),
        ],
      },
      {
        id: "cat-vocaux",
        name: "🔊 Réunions",
        overwrites: adherents(),
        channels: [voice("vocal-ag", "🏛️ Assemblée générale"), voice("vocal-permanence", "☕ Permanence (ouverte à tous)", own([]))],
      },
      {
        id: "cat-bureau",
        name: "🔒 Bureau",
        overwrites: privateTo(["bureau", "president", "secretaire"]),
        channels: [
          text("bureau-discussion", "🗂️・bureau", "Échanges du bureau. Les décisions sont consignées dans les comptes rendus.", { purpose: "staff" }),
          text("tresorerie", "💶・trésorerie", "Budget, cotisations, remboursements. Accès : présidence et trésorerie.", { ...own(privateTo(["president", "tresorier"])) }),
          text("documents-internes", "📁・documents-internes", "Brouillons, conventions, dossiers de subvention."),
          text("maj-discord", "📢・mises-à-jour-discord", "Messages officiels de Discord destinés au bureau.", { purpose: "updates", ...own(privateTo(BUREAU)) }),
          text("alertes", "🚨・alertes-automod", "Alertes de modération automatique et alertes de sécurité.", { purpose: "mod-logs" }),
          text("logs", "📋・logs-arrivées", "Arrivées et départs des membres.", { purpose: "logs" }),
          voice("vocal-bureau", "🔒 Réunion de bureau"),
        ],
      },
    ],
    messages: [
      {
        id: "msg-bienvenue",
        channelId: "bienvenue",
        pin: true,
        embeds: [
          {
            title: "Bienvenue sur le serveur de {server} 👋",
            description:
              "Ce serveur rassemble les adhérents, les bénévoles, le bureau et les sympathisants de l’association.\n\n**Pour bien commencer :**\n1. Lisez le {#reglement} et cliquez sur « J’accepte le règlement » : vous accéderez aux documents, aux comptes rendus et aux votes\n2. Choisissez vos pôles et vos rappels dans {#roles}\n3. Présentez-vous dans {#presentations}",
            fields: [
              { name: "Découvrir l’association", value: "Nos missions et notre fonctionnement sont présentés dans {#presentation-asso}." },
              { name: "Une question ?", value: "Posez-la dans {#general} ou contactez le bureau en privé dans {#support}." },
            ],
            footer: "Merci de votre engagement !",
          },
        ],
      },
      {
        id: "msg-reglement",
        channelId: "reglement",
        pin: true,
        embeds: [
          {
            title: "📜 Règlement intérieur du serveur",
            description: "Ce règlement complète les statuts de l’association, les [Conditions d’utilisation](https://discord.com/terms) et les [Règles de la communauté](https://discord.com/guidelines) de Discord.",
            fields: [
              { name: "1. Respect et bienveillance", value: "Les échanges restent courtois. Aucune insulte, discrimination ou attaque personnelle n’est tolérée." },
              { name: "2. Neutralité", value: "Le serveur n’est pas un lieu de propagande politique ou religieuse, conformément aux valeurs de l’association." },
              { name: "3. Confidentialité", value: "Les informations partagées ici (coordonnées, comptes rendus, documents) ne doivent pas être diffusées à l’extérieur sans accord du bureau." },
              { name: "4. Pas de démarchage", value: "Aucune publicité, collecte ou vente sans autorisation préalable du bureau." },
              { name: "5. Bons salons", value: "Utilisez le salon adapté : projets dans {#projets}, questions administratives dans {#support}." },
              { name: "6. Données personnelles", value: "Ne publiez pas d’informations personnelles sur d’autres membres. Vous pouvez demander la suppression de vos données au bureau." },
              { name: "7. Décisions", value: "Les décisions officielles sont prises en bureau ou en assemblée générale et publiées dans {#annonces}." },
            ],
            footer: "En cliquant sur le bouton, vous acceptez ce règlement et accédez aux espaces réservés aux adhérents.",
          },
        ],
        buttons: [{ action: "rules-accept", roleId: "membre", label: "J’accepte le règlement", emoji: "✅", style: "success" }],
      },
      {
        id: "msg-association",
        channelId: "presentation-asso",
        pin: true,
        embeds: [
          {
            title: "ℹ️ Notre association",
            description: "Présentez ici en quelques lignes l’objet de votre association, son histoire et ce qu’elle propose à ses adhérents.",
            fields: [
              { name: "🎯 Nos missions", value: "• Mission principale\n• Actions régulières\n• Projets ponctuels" },
              { name: "🗂️ Le bureau", value: "{@president}, {@tresorier} et {@secretaire} assurent le fonctionnement de l’association." },
              { name: "✍️ Adhérer", value: "Le bulletin d’adhésion et le montant de la cotisation sont disponibles dans {#documents} après validation du règlement." },
            ],
          },
        ],
      },
      {
        id: "msg-roles-poles",
        channelId: "roles",
        embeds: [{ title: "🧩 Vos pôles", description: "Rejoignez un ou plusieurs pôles pour suivre leurs salons et être mentionné quand ils ont besoin de vous." }],
        buttons: [
          { action: "role-toggle", roleId: "pole-communication", label: "Communication", emoji: "📢" },
          { action: "role-toggle", roleId: "pole-evenements", label: "Événements", emoji: "🎉" },
          { action: "role-toggle", roleId: "pole-logistique", label: "Logistique", emoji: "📦" },
        ],
      },
      {
        id: "msg-roles-statut",
        channelId: "roles",
        embeds: [{ title: "🪪 Votre statut", description: "Indiquez votre situation vis-à-vis de l’association : le bureau saura mieux vous accompagner. Un nouveau clic retire le rôle." }],
        buttons: [
          { action: "role-toggle", roleId: "statut-adherent", label: "Déjà adhérent·e", emoji: "🪪" },
          { action: "role-toggle", roleId: "statut-futur-benevole", label: "Futur bénévole", emoji: "✋" },
          { action: "role-toggle", roleId: "statut-decouverte", label: "Je découvre", emoji: "👀" },
          { action: "role-toggle", roleId: "statut-partenaire", label: "Partenaire", emoji: "🤲" },
        ],
      },
      {
        id: "msg-roles",
        channelId: "roles",
        embeds: [{ title: "🔔 Vos notifications", description: "Cliquez sur un bouton pour activer ou désactiver un rappel. Vous pouvez changer d’avis à tout moment." }],
        buttons: [
          { action: "role-toggle", roleId: "notif-agenda", label: "Rappels de l’agenda", emoji: "📅", style: "primary" },
          { action: "role-toggle", roleId: "notif-missions", label: "Appels à bénévoles", emoji: "📣", style: "primary" },
          { action: "role-toggle", roleId: "notif-ag", label: "Convocations AG", emoji: "🏛️", style: "primary" },
        ],
      },
      {
        id: "msg-faq",
        channelId: "faq",
        pin: true,
        embeds: [
          {
            title: "❓ Questions fréquentes",
            fields: [
              { name: "Comment régler ma cotisation ?", value: "Les modalités sont détaillées dans {#documents}. Pour toute question, ouvrez un ticket dans {#support}." },
              { name: "Comment devenir bénévole ?", value: "Prenez le statut {@statut-futur-benevole} dans {#roles}, répondez aux appels publiés dans les annonces ou signalez-vous au bureau : le rôle {@benevole} vous donnera accès à l’espace bénévoles." },
              { name: "À quoi servent les pôles ?", value: "Chaque pôle a son salon ({#communication}, {#evenements}, {#logistique}). Rejoignez-en un dans {#roles} pour suivre ses besoins." },
              { name: "Où trouver les comptes rendus ?", value: "Tous les comptes rendus d’assemblée générale sont publiés dans {#comptes-rendus}." },
              { name: "Comment proposer un projet ?", value: "Créez une publication dans {#projets} avec le tag « Idée », ou utilisez le bouton de {#suggestions}." },
            ],
          },
        ],
      },
      {
        id: "msg-support",
        channelId: "support",
        embeds: [
          {
            title: "🎫 Contacter le bureau",
            description: "Cliquez sur le bouton : un fil privé sera ouvert entre vous et le bureau. Seuls vous et les membres du bureau pourront le lire.",
          },
        ],
        buttons: [{ action: "ticket-open", label: "Ouvrir une demande", emoji: "🎫", style: "primary" }],
      },
      {
        id: "msg-suggestions",
        channelId: "suggestions",
        embeds: [{ title: "💡 Boîte à idées", description: "Une idée pour améliorer l’association ou ses activités ? Cliquez sur le bouton : votre proposition sera publiée ici et soumise au vote des adhérents." }],
        buttons: [{ action: "suggestion-open", label: "Proposer une idée", emoji: "💡" }],
      },
      {
        id: "msg-bureau",
        channelId: "bureau-discussion",
        pin: true,
        embeds: [
          {
            title: "🗂️ Mémo du bureau",
            fields: [
              { name: "Annonces", value: "Toute annonce officielle est relue par deux membres du bureau avant publication dans {#annonces}." },
              { name: "Comptes rendus", value: "Le secrétariat publie le compte rendu dans {#comptes-rendus} sous 15 jours après chaque AG." },
              { name: "Demandes des adhérents", value: "Les tickets reçoivent une réponse sous 72 h. Archivez le fil une fois la demande traitée." },
              { name: "Accès", value: "Attribuez {@benevole} aux volontaires (pensez à {@statut-futur-benevole}) et retirez {@membre} aux personnes qui ne sont plus adhérentes." },
            ],
          },
        ],
      },
    ],
    automod: [
      { id: "am-spam", name: "Anti-spam", trigger: { type: "spam" }, actions: [{ type: "block" }, { type: "alert", channelId: "alertes" }] },
      {
        id: "am-mentions",
        name: "Anti-mentions abusives",
        trigger: { type: "mention_spam", mentionLimit: 5, raidProtection: true },
        actions: [{ type: "block", customMessage: "Trop de mentions dans un seul message." }, { type: "alert", channelId: "alertes" }, { type: "timeout", durationSeconds: 600 }],
        exemptRoles: BUREAU,
      },
      {
        id: "am-invitations",
        name: "Liens d’invitation et arnaques",
        trigger: {
          type: "keyword",
          keywords: ["*nitro gratuit*", "*free nitro*", "*discord.gift*", "*gagnez un iphone*"],
          regexPatterns: ["(discord\\.gg|discord(app)?\\.com/invite)/[a-zA-Z0-9-]+"],
        },
        actions: [{ type: "block", customMessage: "Les invitations et liens suspects sont interdits. Contactez le bureau." }, { type: "alert", channelId: "alertes" }],
        exemptRoles: BUREAU,
      },
    ],
    onboarding: {
      enabled: true,
      mode: "default",
      defaultChannelIds: ["bienvenue", "reglement", "presentation-asso", "annonces", "agenda", "faq", "general", "presentations", "projets", "pause-cafe", "vocal-permanence"],
      prompts: [
        {
          id: "q-statut",
          title: "Quel est votre lien avec l’association ?",
          type: "multiple_choice",
          singleSelect: true,
          required: false,
          inOnboarding: true,
          options: [
            { id: "o-adherent", title: "Je suis déjà adhérent·e", description: "Cotisation réglée ou en cours", emoji: "🪪", roleIds: ["statut-adherent"], channelIds: ["roles"] },
            { id: "o-futur-benevole", title: "Je souhaite devenir bénévole", description: "Le bureau vous recontactera pour vos premières missions", emoji: "✋", roleIds: ["statut-futur-benevole", "notif-missions"], channelIds: ["support"] },
            { id: "o-decouverte", title: "Je découvre l’association", description: "Missions, fonctionnement et adhésion", emoji: "👀", roleIds: ["statut-decouverte"], channelIds: ["support"] },
            { id: "o-partenaire", title: "Je représente un partenaire", description: "Collectivité, association amie, sponsor", emoji: "🤲", roleIds: ["statut-partenaire"], channelIds: ["support"] },
          ],
        },
        {
          id: "q-poles",
          title: "Dans quels pôles aimeriez-vous donner un coup de main ?",
          type: "multiple_choice",
          singleSelect: false,
          required: false,
          inOnboarding: true,
          options: [
            { id: "o-communication", title: "Communication", description: "Réseaux sociaux, affiches, newsletter", emoji: "📢", roleIds: ["pole-communication"], channelIds: ["communication"] },
            { id: "o-evenements", title: "Événements", description: "Manifestations, ateliers et sorties", emoji: "🎉", roleIds: ["pole-evenements"], channelIds: ["evenements"] },
            { id: "o-logistique", title: "Logistique", description: "Matériel, salles, transport, installation", emoji: "📦", roleIds: ["pole-logistique"], channelIds: ["logistique"] },
          ],
        },
        {
          id: "q-notifs",
          title: "Quels rappels souhaitez-vous recevoir ?",
          type: "multiple_choice",
          singleSelect: false,
          required: false,
          inOnboarding: true,
          options: [
            { id: "o-notif-agenda", title: "Réunions et événements", description: "Rappels des dates de l’agenda", emoji: "📅", roleIds: ["notif-agenda"], channelIds: ["agenda"] },
            { id: "o-notif-missions", title: "Appels à bénévoles", description: "Quand l’association cherche des volontaires", emoji: "📣", roleIds: ["notif-missions"], channelIds: [] },
            { id: "o-notif-ag", title: "Assemblées générales et votes", description: "Convocations et résultats", emoji: "🏛️", roleIds: ["notif-ag"], channelIds: ["annonces"] },
          ],
        },
      ],
    },
    welcomeScreen: {
      enabled: true,
      description: "Le serveur de l’association : actualités, projets, pôles bénévoles et échanges entre adhérents.",
      channels: [
        { channelId: "reglement", description: "Lire et accepter le règlement", emoji: "📜" },
        { channelId: "presentation-asso", description: "Découvrir l’association", emoji: "ℹ️" },
        { channelId: "agenda", description: "Voir les prochaines dates", emoji: "📅" },
        { channelId: "projets", description: "Suivre les projets", emoji: "🌱" },
        { channelId: "general", description: "Échanger avec les membres", emoji: "💬" },
      ],
    },
    serverGuide: {
      welcomeMessage: "Bienvenue ! Découvrez l’association, acceptez le règlement intérieur et rejoignez les pôles qui vous intéressent.",
      newMemberActions: [
        { title: "Lire le règlement intérieur", channelId: "reglement", description: "Et l’accepter pour accéder aux espaces adhérents." },
        { title: "Se présenter", channelId: "presentations", description: "Votre prénom et ce qui vous amène." },
        { title: "Rejoindre un pôle", channelId: "roles", description: "Communication, événements ou logistique." },
      ],
      resourceChannels: [
        { title: "L’association", channelId: "presentation-asso" },
        { title: "Questions fréquentes", channelId: "faq" },
        { title: "Agenda", channelId: "agenda" },
        { title: "Contacter le bureau", channelId: "support" },
      ],
    },
    features: {
      welcome: {
        enabled: true,
        channelId: "bienvenue",
        message: "Bienvenue {user} ! Pour rejoindre la vie de l’association, lisez le {#reglement} et cliquez sur le bouton pour l’accepter.",
      },
      joinLogs: { enabled: true, channelId: "logs" },
      rulesGate: { enabled: true, roleId: "membre" },
      tickets: { enabled: true, channelId: "support", staffRoleIds: ["bureau", "president"], intro: "Merci pour votre message. Décrivez votre demande : un membre du bureau vous répondra dans ce fil privé." },
      suggestions: { enabled: true, channelId: "suggestions" },
    },
  },
};
