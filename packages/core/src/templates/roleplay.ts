import type { PermissionKey } from "../permissions";
import { BRAND, PERMS, adminPerms, announcement, forum, moderatorPerms, own, privateTo, readOnly, text, voice, type TemplateDefinition } from "./helpers";

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
    "Un serveur de roleplay écrit, adaptable à tout univers : onboarding (profil de joueur, scènes préférées, disponibilités, notifications), lore et espaces hors-RP ouverts aux visiteurs, acceptation de la charte pour créer sa fiche, fiches de personnages en forum avec validation par les maîtres du jeu, lieux RP réservés aux personnages validés, tableau des quêtes et équipe dédiée à la validation.",
  theme: "roleplay",
  size: "medium",
  audience: "Créateurs d’univers et communautés de roleplay écrit (médiéval-fantastique, mais adaptable), de 10 à 1 000 joueurs encadrés par des maîtres du jeu.",
  highlights: [
    "Onboarding : profil de joueur, scènes préférées (combat, exploration, intrigue…), disponibilités et notifications",
    "Accès par acceptation de la charte : les visiteurs découvrent le lore et le hors-RP, la charte ouvre les fiches, les lieux et les quêtes",
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
      community: true,
      description: "Roleplay écrit médiéval-fantastique : lore, fiches validées, lieux RP et quêtes animées par des MJ.",
      systemChannelId: "bienvenue",
      rulesChannelId: "reglement",
      publicUpdatesChannelId: "maj-discord",
      safetyAlertsChannelId: "alertes",
      suppressJoinNotifications: true,
      suppressSetupTips: true,
    },
    everyone: { permissions: PERMS.member },
    roles: [
      { id: "fondateur", name: "👑 Fondateur", color: 0xf2c14e, hoist: true, mentionable: true, permissions: adminPerms(), staff: true, description: "Créateur de l’univers et administrateur du serveur." },
      { id: "moderateur", name: "🛡️ Modération", color: 0xe5534b, hoist: true, mentionable: true, permissions: moderatorPerms(), staff: true, description: "Fait respecter la charte HRP et traite les tickets." },
      { id: "mj", name: "🎲 Maître du jeu", color: 0x9b6dff, hoist: true, mentionable: true, permissions: [...PERMS.member, "MANAGE_THREADS", "PIN_MESSAGES", "MANAGE_EVENTS"], staff: true, description: "Anime les quêtes, valide les fiches et fait évoluer le lore." },
      { id: "valide", name: "📜 Personnage validé", color: 0xc9a86a, hoist: true, permissions: [], description: "Attribué par un MJ quand la fiche est validée : permet d’écrire dans les lieux RP." },
      { id: "voyageur", name: "🧭 Voyageur", color: BRAND.lightBlue, permissions: [], description: "Obtenu en acceptant la charte : donne accès aux fiches, aux lieux RP, aux quêtes et aux vocaux de session." },
      { id: "joueur-debutant", name: "🌱 Nouveau en RP", selfAssignable: true, description: "Découvre le roleplay écrit : les joueurs expérimentés et les MJ peuvent l’épauler." },
      { id: "joueur-confirme", name: "🪶 Rôliste confirmé", selfAssignable: true, description: "A déjà l’habitude du roleplay écrit." },
      { id: "apprenti-mj", name: "🎲 Apprenti MJ", selfAssignable: true, description: "Aimerait animer des scènes ou des quêtes un jour (aucun pouvoir de MJ)." },
      { id: "pref-combat", name: "⚔️ Scènes de combat", selfAssignable: true, description: "Aime les affrontements, duels et batailles." },
      { id: "pref-exploration", name: "🧭 Exploration", selfAssignable: true, description: "Aime les voyages, les ruines et les terres inconnues." },
      { id: "pref-intrigue", name: "🎭 Intrigues & politique", selfAssignable: true, description: "Aime les complots, la diplomatie et les secrets de cour." },
      { id: "pref-social", name: "🍺 Scènes sociales", selfAssignable: true, description: "Aime les scènes de taverne, de vie quotidienne et de relations." },
      { id: "dispo-semaine", name: "🌙 Dispo en semaine", selfAssignable: true, description: "Joue plutôt en soirée en semaine." },
      { id: "dispo-weekend", name: "☀️ Dispo le week-end", selfAssignable: true, description: "Joue plutôt le week-end." },
      { id: "dispo-libre", name: "🕰️ Rythme libre", selfAssignable: true, description: "Répond au fil de l’eau, sans horaire fixe." },
      { id: "notif-quetes", name: "⚔️ Appel aux quêtes", selfAssignable: true, description: "Mentionné lorsqu’une quête recrute des aventuriers." },
      { id: "notif-sessions", name: "🎲 Sessions vocales", selfAssignable: true, description: "Mentionné quand un MJ lance une session en vocal." },
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
        overwrites: readOnly(STAFF),
        channels: [
          announcement("annonces", "📣・annonces", "Annonces du staff : mises à jour, événements, recrutements.", { purpose: "announcements" }),
          text("lore", "📖・lore", "Histoire, cosmologie et grandes époques du royaume.", { purpose: "info" }),
          text("carte", "🗺️・carte-et-lieux", "Géographie du royaume et description des lieux jouables.", { purpose: "info" }),
          text("peuples", "⚔️・peuples-et-classes", "Races jouables, classes, magie et limites de puissance.", { purpose: "info" }),
          text("chroniques", "📜・chroniques", "Résumés des quêtes passées et événements marquants, rédigés par les MJ."),
          text("roles", "🎭・rôles-et-notifications", "Ton profil de joueur, tes scènes préférées, tes disponibilités et tes notifications.", { purpose: "roles" }),
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
        overwrites: [],
        channels: [
          text("general", "💬・hrp-général", "Discussions hors-roleplay entre joueurs.", { purpose: "general" }),
          text("presentations", "🙋・présentations-joueurs", "Présente-toi en tant que joueur ou joueuse (pas ton personnage !).", { slowmode: 300, purpose: "introductions" }),
          text("aide-nouveaux", "🧭・aide-aux-nouveaux", "Questions sur l’univers, la charte ou la création de ta fiche : les joueurs et les MJ te répondent."),
          text("atelier-mj", "🎲・atelier-des-mj", "Tu aimerais animer ? Idées de quêtes, conseils de narration et échanges avec les maîtres du jeu."),
          text("fan-art", "🎨・fan-art-et-inspirations", "Illustrations, musiques d’ambiance, inspirations.", { purpose: "media" }),
          text("suggestions", "💡・suggestions", "Une idée pour l’univers ou le serveur ? Utilise le bouton.", {
            purpose: "suggestions",
            ...own([
              { target: "everyone", allow: [], deny: ["VIEW_CHANNEL", "SEND_MESSAGES", "CREATE_PUBLIC_THREADS"] },
              { target: "voyageur", allow: ["VIEW_CHANNEL", "ADD_REACTIONS", "SEND_MESSAGES_IN_THREADS"], deny: [] },
              ...STAFF.map((r) => ({ target: r, allow: ["VIEW_CHANNEL", "SEND_MESSAGES"] as PermissionKey[], deny: [] as PermissionKey[] })),
            ]),
          }),
          text("support", "🎫・support", "Une question, un conflit HRP ? Ouvre un ticket privé avec le staff.", { purpose: "support", ...own(readOnly(STAFF)) }),
        ],
      },
      {
        id: "cat-vocaux",
        name: "🔊 Vocaux",
        overwrites: voyageurs(),
        channels: [voice("vocal-taverne", "🍺 Taverne (vocal HRP)", own([])), voice("vocal-session", "🎲 Session MJ", { userLimit: 8 }), voice("vocal-ecriture", "✍️ Écriture en silence")],
      },
      {
        id: "cat-staff",
        name: "🛡️ Conseil des MJ",
        overwrites: privateTo(STAFF),
        channels: [
          text("staff", "🗂️・conseil", "Coordination du staff, décisions sur l’univers et les sanctions.", { purpose: "staff" }),
          text("validation", "✅・validation-fiches", "Suivi des fiches à relire : une ligne par fiche, avec le MJ responsable."),
          text("maj-discord", "📢・mises-à-jour-discord", "Messages officiels de Discord destinés au staff.", { purpose: "updates" }),
          text("alertes", "🚨・alertes-automod", "Alertes de modération automatique et alertes de sécurité.", { purpose: "mod-logs" }),
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
              "Ici, nous écrivons ensemble une histoire médiévale-fantastique où chaque personnage compte.\n\n**Pour entrer :**\n1. Lis la {#reglement} et accepte-la avec le bouton\n2. Découvre le {#lore} et la {#carte}\n3. Rédige ta fiche dans {#fiches} à partir du {#modele-fiche}\n4. Une fois validée par un {@mj}, rejoins l’aventure à la {#taverne} !\n\nUne question avant de te lancer ? Passe par {#aide-nouveaux}.",
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
            footer: "Cliquer sur le bouton signifie que tu acceptes la charte : les fiches, les lieux RP et les quêtes s’ouvrent à toi.",
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
        id: "msg-roles-profil",
        channelId: "roles",
        embeds: [{ title: "🪶 Ton profil de joueur", description: "Dis-nous où tu en es : les MJ adaptent leur accompagnement. « Apprenti MJ » ne donne aucun pouvoir, il ouvre l’{#atelier-mj}." }],
        buttons: [
          { action: "role-toggle", roleId: "joueur-debutant", label: "Nouveau en RP", emoji: "🌱" },
          { action: "role-toggle", roleId: "joueur-confirme", label: "Rôliste confirmé", emoji: "🪶" },
          { action: "role-toggle", roleId: "apprenti-mj", label: "Apprenti MJ", emoji: "🎲" },
        ],
      },
      {
        id: "msg-roles-scenes",
        channelId: "roles",
        embeds: [{ title: "🎭 Tes scènes préférées", description: "Les MJ et les autres joueurs mentionnent ces rôles pour recruter des partenaires de scène." }],
        buttons: [
          { action: "role-toggle", roleId: "pref-combat", label: "Combat", emoji: "⚔️" },
          { action: "role-toggle", roleId: "pref-exploration", label: "Exploration", emoji: "🧭" },
          { action: "role-toggle", roleId: "pref-intrigue", label: "Intrigues & politique", emoji: "🎭" },
          { action: "role-toggle", roleId: "pref-social", label: "Scènes sociales", emoji: "🍺" },
        ],
      },
      {
        id: "msg-roles-dispos",
        channelId: "roles",
        embeds: [{ title: "🕰️ Tes disponibilités", description: "Indique quand tu joues le plus souvent : pratique pour caler les quêtes et les sessions." }],
        buttons: [
          { action: "role-toggle", roleId: "dispo-semaine", label: "En semaine (soir)", emoji: "🌙" },
          { action: "role-toggle", roleId: "dispo-weekend", label: "Le week-end", emoji: "☀️" },
          { action: "role-toggle", roleId: "dispo-libre", label: "Rythme libre", emoji: "🕰️" },
        ],
      },
      {
        id: "msg-roles",
        channelId: "roles",
        embeds: [{ title: "🔔 Tes notifications", description: "Clique pour être mentionné (ou ne plus l’être)." }],
        buttons: [
          { action: "role-toggle", roleId: "notif-quetes", label: "Appel aux quêtes", emoji: "⚔️", style: "primary" },
          { action: "role-toggle", roleId: "notif-sessions", label: "Sessions vocales", emoji: "🎲", style: "primary" },
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
              { name: "Quêtes", value: "Annoncez-les dans {#quetes} au moins 48 h à l’avance et mentionnez {@notif-quetes} (ou les préférences de scène, ex. {@pref-combat}). Résumez-les ensuite dans {#chroniques}." },
              { name: "Accueil des nouveaux", value: "Gardez un œil sur {#aide-nouveaux} et {@joueur-debutant}. Les {@apprenti-mj} échangent dans {#atelier-mj} : proposez-leur de co-animer une scène." },
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
    onboarding: {
      enabled: true,
      mode: "default",
      defaultChannelIds: ["bienvenue", "reglement", "annonces", "lore", "carte", "peuples", "general", "presentations", "aide-nouveaux", "fan-art", "vocal-taverne"],
      prompts: [
        {
          id: "q-profil",
          title: "Quel joueur es-tu ?",
          type: "multiple_choice",
          singleSelect: true,
          required: false,
          inOnboarding: true,
          options: [
            { id: "o-debutant", title: "Je découvre le RP écrit", description: "On t’aide à créer ta première fiche", emoji: "🌱", roleIds: ["joueur-debutant"], channelIds: ["aide-nouveaux"] },
            { id: "o-confirme", title: "Rôliste confirmé", description: "Tu as déjà l’habitude du roleplay écrit", emoji: "🪶", roleIds: ["joueur-confirme"], channelIds: ["chroniques"] },
            { id: "o-apprenti-mj", title: "Futur maître du jeu", description: "Tu aimerais animer des scènes un jour (aucun pouvoir de MJ)", emoji: "🎲", roleIds: ["apprenti-mj"], channelIds: ["atelier-mj", "chroniques"] },
          ],
        },
        {
          id: "q-scenes",
          title: "Quelles scènes préfères-tu jouer ?",
          type: "multiple_choice",
          singleSelect: false,
          required: false,
          inOnboarding: true,
          options: [
            { id: "o-combat", title: "Combat & aventure", description: "Duels, batailles, créatures", emoji: "⚔️", roleIds: ["pref-combat"], channelIds: [] },
            { id: "o-exploration", title: "Exploration", description: "Voyages, ruines et terres inconnues", emoji: "🧭", roleIds: ["pref-exploration"], channelIds: [] },
            { id: "o-intrigue", title: "Intrigues & politique", description: "Complots, diplomatie, secrets de cour", emoji: "🎭", roleIds: ["pref-intrigue"], channelIds: [] },
            { id: "o-social", title: "Scènes sociales", description: "Taverne, vie quotidienne, relations", emoji: "🍺", roleIds: ["pref-social"], channelIds: [] },
          ],
        },
        {
          id: "q-dispos",
          title: "Quand es-tu disponible pour jouer ?",
          type: "multiple_choice",
          singleSelect: false,
          required: false,
          inOnboarding: true,
          options: [
            { id: "o-semaine", title: "En semaine, le soir", emoji: "🌙", roleIds: ["dispo-semaine"], channelIds: [] },
            { id: "o-weekend", title: "Le week-end", emoji: "☀️", roleIds: ["dispo-weekend"], channelIds: [] },
            { id: "o-libre", title: "Au fil de l’eau", description: "Tu réponds quand tu peux, sans horaire fixe", emoji: "🕰️", roleIds: ["dispo-libre"], channelIds: [] },
          ],
        },
        {
          id: "q-notifs",
          title: "Pour quoi veux-tu être prévenu ?",
          type: "multiple_choice",
          singleSelect: false,
          required: false,
          inOnboarding: true,
          options: [
            { id: "o-notif-quetes", title: "Appels aux quêtes", description: "Quand une quête recrute des aventuriers", emoji: "⚔️", roleIds: ["notif-quetes"], channelIds: [] },
            { id: "o-notif-sessions", title: "Sessions vocales des MJ", description: "Quand un MJ lance une session en vocal", emoji: "🎲", roleIds: ["notif-sessions"], channelIds: [] },
            { id: "o-notif-annonces", title: "Annonces importantes", description: "Mises à jour du serveur et événements", emoji: "🔔", roleIds: ["notif-annonces"], channelIds: ["chroniques"] },
          ],
        },
      ],
    },
    welcomeScreen: {
      enabled: true,
      description: "Un royaume médiéval-fantastique à écrire ensemble : découvre le lore, crée ton personnage, vis des quêtes.",
      channels: [
        { channelId: "reglement", description: "Lire et accepter la charte", emoji: "📜" },
        { channelId: "lore", description: "Découvrir l’univers", emoji: "📖" },
        { channelId: "carte", description: "Explorer la carte du royaume", emoji: "🗺️" },
        { channelId: "aide-nouveaux", description: "Poser une question", emoji: "🧭" },
        { channelId: "general", description: "Discuter hors-RP", emoji: "💬" },
      ],
    },
    serverGuide: {
      welcomeMessage: "Bienvenue au royaume ! Accepte la charte, découvre le lore puis rédige ta fiche : un maître du jeu la validera.",
      newMemberActions: [
        { title: "Accepter la charte", channelId: "reglement", description: "Elle ouvre les fiches, les lieux RP et les quêtes." },
        { title: "Découvrir le lore", channelId: "lore", description: "Histoire et grandes époques du royaume." },
        { title: "Se présenter", channelId: "presentations", description: "En tant que joueur, pas en tant que personnage." },
      ],
      resourceChannels: [
        { title: "Peuples et classes", channelId: "peuples" },
        { title: "Aide aux nouveaux", channelId: "aide-nouveaux" },
        { title: "Choisir ses rôles", channelId: "roles" },
        { title: "Contacter le staff", channelId: "support" },
      ],
    },
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
