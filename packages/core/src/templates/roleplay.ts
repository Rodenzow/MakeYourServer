import type { PermissionKey } from "../permissions";
import { BRAND, PERMS, adminPerms, forum, moderatorPerms, own, privateTo, readOnly, text, voice, type TemplateDefinition } from "./helpers";

const STAFF = ["fondateur", "moderateur", "mj"];
const WRITE: PermissionKey[] = ["SEND_MESSAGES", "SEND_MESSAGES_IN_THREADS", "CREATE_PUBLIC_THREADS", "CREATE_PRIVATE_THREADS"];
type Ow = { target: string; allow: PermissionKey[]; deny: PermissionKey[] };

/** Accessible après validation du règlement (rôle Voyageur). */
const voyageurs = (): Ow[] => [
  { target: "everyone", allow: [], deny: ["VIEW_CHANNEL"] },
  { target: "voyageur", allow: ["VIEW_CHANNEL"], deny: [] },
  ...STAFF.map((r) => ({ target: r, allow: ["VIEW_CHANNEL"] as PermissionKey[], deny: [] as PermissionKey[] })),
];

/** Lisible par les voyageurs, rédigé par les maîtres du jeu et le staff. */
const lore = (): Ow[] => [
  { target: "everyone", allow: [], deny: ["VIEW_CHANNEL", ...WRITE] },
  { target: "voyageur", allow: ["VIEW_CHANNEL", "READ_MESSAGE_HISTORY"], deny: [] },
  ...STAFF.map((r) => ({ target: r, allow: ["VIEW_CHANNEL", "SEND_MESSAGES", "SEND_MESSAGES_IN_THREADS"] as PermissionKey[], deny: [] as PermissionKey[] })),
];

/** Lieux RP : lisibles par les voyageurs, écriture réservée aux personnages validés. */
const lieux = (): Ow[] => [
  { target: "everyone", allow: [], deny: ["VIEW_CHANNEL", ...WRITE] },
  { target: "voyageur", allow: ["VIEW_CHANNEL", "READ_MESSAGE_HISTORY", "ADD_REACTIONS"], deny: [] },
  { target: "valide", allow: ["VIEW_CHANNEL", "SEND_MESSAGES", "SEND_MESSAGES_IN_THREADS", "CREATE_PUBLIC_THREADS", "ATTACH_FILES"], deny: [] },
  ...STAFF.map((r) => ({ target: r, allow: ["VIEW_CHANNEL", "SEND_MESSAGES", "SEND_MESSAGES_IN_THREADS", "CREATE_PUBLIC_THREADS"] as PermissionKey[], deny: [] as PermissionKey[] })),
];

export const roleplay: TemplateDefinition = {
  slug: "roleplay",
  name: "Roleplay médiéval-fantastique",
  tagline: "Un univers RP prêt à jouer : lore, fiches validées, lieux et quêtes.",
  description:
    "Un serveur de roleplay écrit, adaptable à tout univers : portail d’entrée avec acceptation de la charte, lore en lecture seule, fiches de personnages en forum avec validation par les maîtres du jeu, lieux RP réservés aux personnages validés, tableau des quêtes, espaces hors-RP et équipe dédiée à la validation.",
  theme: "roleplay",
  size: "medium",
  audience: "Créateurs d’univers et communautés de roleplay écrit (médiéval-fantastique, mais adaptable), de 10 à 1 000 joueurs encadrés par des maîtres du jeu.",
  highlights: [
    "Accès par acceptation de la charte : les visiteurs ne voient que le portail",
    "Fiches de personnages en forum avec tags de validation réservés au staff",
    "Lieux RP en écriture réservée aux personnages validés, lisibles par tous les voyageurs",
    "Tableau des quêtes, chroniques et lore publiés par les maîtres du jeu",
    "Espace staff avec salon de validation des fiches, logs et alertes AutoMod",
  ],
  popularity: 77,
  spec: {
    version: 1,
    meta: {
      name: "Royaume d’Aldoria",
      description: "Serveur de roleplay écrit médiéval-fantastique, adaptable à votre propre univers.",
      theme: "roleplay",
      size: "medium",
      tone: "immersif côté RP, chaleureux côté HRP",
      audience: "Joueurs de roleplay écrit",
      accentColor: 0xc9a86a,
    },
    settings: {
      verificationLevel: "medium",
      explicitContentFilter: "all_members",
      defaultNotifications: "only_mentions",
      community: false,
      systemChannelId: "bienvenue",
      suppressJoinNotifications: true,
      suppressSetupTips: true,
    },
    everyone: { permissions: PERMS.member },
    roles: [
      { id: "fondateur", name: "👑 Fondateur", color: 0xf2c14e, hoist: true, mentionable: true, permissions: adminPerms(), staff: true, description: "Créateur de l’univers et administrateur du serveur." },
      { id: "moderateur", name: "🛡️ Modération", color: 0xe5534b, hoist: true, mentionable: true, permissions: moderatorPerms(), staff: true, description: "Fait respecter la charte HRP et traite les tickets." },
      { id: "mj", name: "🎲 Maître du jeu", color: 0x9b6dff, hoist: true, mentionable: true, permissions: [...PERMS.member, "MANAGE_THREADS", "PIN_MESSAGES", "MANAGE_EVENTS"], staff: true, description: "Anime les quêtes, valide les fiches et fait évoluer le lore." },
      { id: "valide", name: "📜 Personnage validé", color: 0xc9a86a, hoist: true, permissions: [], description: "Attribué par un MJ quand la fiche est validée : permet d’écrire dans les lieux RP." },
      { id: "voyageur", name: "🧭 Voyageur", color: BRAND.lightBlue, permissions: [], description: "Obtenu en acceptant la charte : donne accès à l’univers et aux espaces HRP." },
      { id: "notif-quetes", name: "⚔️ Appel aux quêtes", selfAssignable: true, description: "Mentionné lorsqu’une quête recrute des aventuriers." },
      { id: "notif-annonces", name: "🔔 Annonces", selfAssignable: true, description: "Mentionné pour les annonces importantes du serveur." },
    ],
    categories: [
      {
        id: "cat-portail",
        name: "🚪 Portail",
        overwrites: readOnly(["fondateur"]),
        channels: [
          text("bienvenue", "👋・bienvenue", "Bienvenue, voyageur. Lis la charte pour franchir le portail.", { purpose: "welcome" }),
          text("reglement", "📜・charte", "La charte du serveur. Accepte-la avec le bouton pour accéder au royaume.", { purpose: "rules" }),
        ],
      },
      {
        id: "cat-univers",
        name: "📖 L’univers",
        overwrites: lore(),
        channels: [
          text("annonces", "📣・annonces", "Annonces du staff : mises à jour, événements, recrutements.", { purpose: "announcements" }),
          text("lore", "📖・lore", "Histoire, cosmologie et grandes époques du royaume.", { purpose: "info" }),
          text("carte", "🗺️・carte-et-lieux", "Géographie du royaume et description des lieux jouables.", { purpose: "info" }),
          text("peuples", "⚔️・peuples-et-classes", "Races jouables, classes, magie et limites de puissance.", { purpose: "info" }),
          text("chroniques", "📜・chroniques", "Résumés des quêtes passées et événements marquants, rédigés par les MJ."),
          text("roles", "🎭・notifications", "Choisis les annonces pour lesquelles tu veux être mentionné.", { purpose: "roles" }),
        ],
      },
      {
        id: "cat-personnages",
        name: "🧝 Personnages",
        overwrites: voyageurs(),
        channels: [
          text("modele-fiche", "🧾・modèle-de-fiche", "Le modèle à recopier pour créer ta fiche.", { ...own(lore()) }),
          forum("fiches", "🧝・fiches-personnages", "Une publication par personnage, en suivant le modèle. Un MJ appliquera le tag de validation.", [
            { name: "En attente", emoji: "⏳", moderated: true },
            { name: "À corriger", emoji: "✏️", moderated: true },
            { name: "Validée", emoji: "✅", moderated: true },
            { name: "Refusée", emoji: "❌", moderated: true },
            { name: "Archivée", emoji: "📦", moderated: true },
          ]),
          text("relations", "🤝・recherche-de-partenaires", "Trouve des partenaires de RP, propose des liens entre personnages."),
        ],
      },
      {
        id: "cat-lieux",
        name: "🏰 Le royaume (RP)",
        overwrites: lieux(),
        channels: [
          text("taverne", "🍺・taverne-du-sanglier-d-or", "Lieu de rencontres, de rumeurs et de contrats. Le tavernier écoute tout."),
          text("cite", "🏰・cité-d-aldoria", "La capitale : marché, palais, ruelles et guet."),
          text("foret", "🌲・forêt-des-murmures", "Une forêt ancienne où l’on dit que les arbres parlent."),
          text("port", "⚓・port-de-brumeval", "Navires marchands, contrebandiers et voyageurs venus d’ailleurs."),
          text("ruines", "🗿・ruines-oubliées", "Vestiges d’une civilisation disparue. Dangereux sans escorte."),
        ],
      },
      {
        id: "cat-quetes",
        name: "⚔️ Quêtes",
        overwrites: lore(),
        channels: [
          text("quetes", "📯・tableau-des-quêtes", "Les MJ publient ici les quêtes ouvertes, leurs conditions et le nombre de places.", { purpose: "events" }),
          text("quete-en-cours", "🗡️・quête-en-cours", "La quête animée par un MJ en ce moment. Seuls les participants y écrivent.", { ...own(lieux()) }),
        ],
      },
      {
        id: "cat-hrp",
        name: "💬 Hors-RP",
        overwrites: voyageurs(),
        channels: [
          text("general", "💬・hrp-général", "Discussions hors-roleplay entre joueurs.", { purpose: "general" }),
          text("presentations", "🙋・présentations-joueurs", "Présente-toi en tant que joueur ou joueuse (pas ton personnage !).", { slowmode: 300, purpose: "introductions" }),
          text("fan-art", "🎨・fan-art-et-inspirations", "Illustrations, musiques d’ambiance, inspirations.", { purpose: "media" }),
          text("suggestions", "💡・suggestions", "Une idée pour l’univers ou le serveur ? Utilise le bouton.", {
            purpose: "suggestions",
            ...own([
              { target: "everyone", allow: [], deny: ["VIEW_CHANNEL", "SEND_MESSAGES", "CREATE_PUBLIC_THREADS"] },
              { target: "voyageur", allow: ["VIEW_CHANNEL", "ADD_REACTIONS", "SEND_MESSAGES_IN_THREADS"], deny: [] },
              ...STAFF.map((r) => ({ target: r, allow: ["VIEW_CHANNEL", "SEND_MESSAGES"] as PermissionKey[], deny: [] as PermissionKey[] })),
            ]),
          }),
          text("support", "🎫・support", "Une question, un conflit HRP ? Ouvre un ticket privé avec le staff.", { purpose: "support" }),
        ],
      },
      {
        id: "cat-vocaux",
        name: "🔊 Vocaux",
        overwrites: voyageurs(),
        channels: [voice("vocal-taverne", "🍺 Taverne (vocal HRP)"), voice("vocal-session", "🎲 Session MJ", { userLimit: 8 }), voice("vocal-ecriture", "✍️ Écriture en silence")],
      },
      {
        id: "cat-staff",
        name: "🛡️ Conseil des MJ",
        overwrites: privateTo(STAFF),
        channels: [
          text("staff", "🗂️・conseil", "Coordination du staff, décisions sur l’univers et les sanctions.", { purpose: "staff" }),
          text("validation", "✅・validation-fiches", "Suivi des fiches à relire : une ligne par fiche, avec le MJ responsable."),
          text("alertes", "🚨・alertes-automod", "Alertes de modération automatique.", { purpose: "mod-logs" }),
          text("logs", "📋・logs-arrivées", "Arrivées et départs.", { purpose: "logs" }),
          voice("staff-vocal", "🔇 Conseil vocal"),
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
            title: "Bienvenue au royaume d’Aldoria, voyageur 🧭",
            description:
              "Ici, nous écrivons ensemble une histoire médiévale-fantastique où chaque personnage compte.\n\n**Pour entrer :**\n1. Lis la {#reglement} et accepte-la avec le bouton\n2. Découvre le {#lore} et la {#carte}\n3. Rédige ta fiche dans {#fiches} à partir du {#modele-fiche}\n4. Une fois validée par un {@mj}, rejoins l’aventure à la {#taverne} !",
            footer: "Que ta plume soit vive et tes dés cléments.",
          },
        ],
      },
      {
        id: "msg-reglement",
        channelId: "reglement",
        pin: true,
        embeds: [
          {
            title: "📜 Charte du royaume",
            description: "Cette charte s’ajoute aux [Conditions d’utilisation](https://discord.com/terms) et aux [Règles de la communauté](https://discord.com/guidelines) de Discord.",
            fields: [
              { name: "1. Le RP n’est pas le HRP", value: "Les conflits entre personnages restent en jeu. Aucune rancune, insulte ou pression entre joueurs." },
              { name: "2. Pas de métagaming", value: "Ton personnage ne sait que ce qu’il a vécu ou appris en jeu, pas ce que tu as lu ailleurs." },
              { name: "3. Pas de « powergaming »", value: "Tu ne décides jamais des actions ou blessures d’un autre personnage. Laisse-lui la possibilité de réagir." },
              { name: "4. Cohérence avec l’univers", value: "Ton personnage respecte le lore, les peuples et les limites de puissance décrits dans {#peuples}." },
              { name: "5. Contenu sensible", value: "Violence suggérée, pas détaillée. Aucun contenu sexuel explicite. Préviens avec ||balises spoiler|| pour les thèmes durs." },
              { name: "6. Qualité d’écriture", value: "Au moins trois lignes par réponse dans les lieux RP, à la troisième personne et au passé ou au présent." },
              { name: "7. Absences", value: "Prévenez en HRP si vous vous absentez pendant une quête, pour que le MJ puisse adapter l’histoire." },
              { name: "8. Le staff tranche", value: "Les décisions des MJ sur le jeu et du staff sur la modération s’appliquent. Contestation possible via {#support}." },
            ],
            footer: "Cliquer sur le bouton signifie que tu acceptes la charte.",
          },
        ],
        buttons: [{ action: "rules-accept", roleId: "voyageur", label: "J’accepte la charte", emoji: "🗝️", style: "success" }],
      },
      {
        id: "msg-modele-fiche",
        channelId: "modele-fiche",
        pin: true,
        embeds: [
          {
            title: "🧾 Modèle de fiche personnage",
            description: "Recopie ce modèle dans une nouvelle publication de {#fiches}, remplis chaque rubrique et attends la validation d’un {@mj}.",
            fields: [
              { name: "Identité", value: "Nom, âge, peuple, classe, lieu d’origine." },
              { name: "Apparence", value: "Description physique (image facultative, crédits obligatoires)." },
              { name: "Caractère", value: "Qualités, défauts, peurs, ambitions." },
              { name: "Histoire", value: "Passé du personnage (15 lignes minimum), cohérent avec le {#lore}." },
              { name: "Compétences", value: "Trois compétences maîtrisées et une faiblesse marquée." },
            ],
          },
        ],
      },
      {
        id: "msg-roles",
        channelId: "roles",
        embeds: [{ title: "🔔 Tes notifications", description: "Clique pour être mentionné (ou ne plus l’être)." }],
        buttons: [
          { action: "role-toggle", roleId: "notif-quetes", label: "Appel aux quêtes", emoji: "⚔️", style: "primary" },
          { action: "role-toggle", roleId: "notif-annonces", label: "Annonces", emoji: "🔔", style: "primary" },
        ],
      },
      {
        id: "msg-quetes",
        channelId: "quetes",
        pin: true,
        embeds: [
          {
            title: "📯 Comment fonctionnent les quêtes",
            description: "Chaque quête est publiée ici par un MJ avec son niveau de danger, le nombre de places et la date de lancement. Inscris-toi en réagissant ou en répondant dans le fil de la quête. La quête se joue ensuite dans {#quete-en-cours}.",
          },
        ],
      },
      {
        id: "msg-support",
        channelId: "support",
        embeds: [{ title: "🎫 Besoin du staff ?", description: "Clique sur le bouton : un fil privé s’ouvre avec l’équipe. Idéal pour un conflit HRP, une question sur ta fiche ou un signalement." }],
        buttons: [{ action: "ticket-open", label: "Ouvrir un ticket", emoji: "🎫", style: "primary" }],
      },
      {
        id: "msg-suggestions",
        channelId: "suggestions",
        embeds: [{ title: "💡 Façonne l’univers", description: "Nouveau lieu, idée de quête, amélioration du serveur ? Clique sur le bouton : ta proposition sera publiée ici et soumise au vote." }],
        buttons: [{ action: "suggestion-open", label: "Proposer une idée", emoji: "💡" }],
      },
      {
        id: "msg-staff",
        channelId: "staff",
        pin: true,
        embeds: [
          {
            title: "🗂️ Mémo du conseil",
            fields: [
              { name: "Validation des fiches", value: "Prenez une fiche dans {#validation}, appliquez le tag « En attente », puis « Validée » ou « À corriger ». Après validation, attribuez {@valide}." },
              { name: "Quêtes", value: "Annoncez-les dans {#quetes} au moins 48 h à l’avance et mentionnez {@notif-quetes}. Résumez-les ensuite dans {#chroniques}." },
              { name: "Sanctions", value: "Rappel HRP → avertissement → retrait de {@valide} → exclusion. Toujours noter le motif ici." },
              { name: "AutoMod", value: "Les alertes arrivent dans {#alertes}. Vérifiez le contexte RP avant de sanctionner." },
            ],
          },
        ],
      },
    ],
    automod: [
      { id: "am-spam", name: "Anti-spam", trigger: { type: "spam" }, actions: [{ type: "block" }, { type: "alert", channelId: "alertes" }] },
      {
        id: "am-mentions",
        name: "Anti-raid de mentions",
        trigger: { type: "mention_spam", mentionLimit: 6, raidProtection: true },
        actions: [{ type: "block", customMessage: "Trop de mentions dans un seul message." }, { type: "alert", channelId: "alertes" }, { type: "timeout", durationSeconds: 900 }],
        exemptRoles: STAFF,
      },
      {
        id: "am-presets",
        name: "Insultes graves et contenu sexuel",
        trigger: { type: "keyword_preset", presets: ["slurs", "sexual_content"] },
        actions: [{ type: "block", customMessage: "Ce message enfreint la charte du royaume." }, { type: "alert", channelId: "alertes" }],
      },
      {
        id: "am-invitations",
        name: "Publicité pour d’autres serveurs",
        trigger: {
          type: "keyword",
          keywords: ["*nitro gratuit*", "*free nitro*", "*discord.gift*"],
          regexPatterns: ["(discord\\.gg|discord(app)?\\.com/invite)/[a-zA-Z0-9-]+"],
        },
        actions: [{ type: "block", customMessage: "La publicité pour d’autres serveurs est interdite." }, { type: "alert", channelId: "alertes" }],
        exemptRoles: STAFF,
      },
    ],
    features: {
      welcome: {
        enabled: true,
        channelId: "bienvenue",
        message: "Un nouveau voyageur franchit le portail : bienvenue {user} ! Lis la {#reglement} pour entrer dans le royaume.",
      },
      joinLogs: { enabled: true, channelId: "logs" },
      rulesGate: { enabled: true, roleId: "voyageur" },
      tickets: { enabled: true, channelId: "support", staffRoleIds: ["moderateur", "mj"], intro: "Salutations ! Explique ta demande ici : seul le staff peut lire ce fil." },
      suggestions: { enabled: true, channelId: "suggestions" },
    },
  },
};
