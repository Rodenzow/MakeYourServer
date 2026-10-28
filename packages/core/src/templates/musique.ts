import { BRAND, PERMS, adminPerms, announcement, forum, moderatorPerms, own, privateTo, readOnly, stage, text, voice, type TemplateDefinition } from "./helpers";

const STAFF = ["admin", "moderateur"];

export const musique: TemplateDefinition = {
  slug: "musique-rap",
  name: "Scène rap & musique",
  tagline: "Un QG pour artistes, beatmakers et auditeurs : sorties, collabs, feedback et open mics.",
  description:
    "Un serveur pensé pour la scène rap et musique francophone : espace artistes pour présenter ses sorties, forum de collaborations par métier (beatmaker, topliner, ingé son, clippeur), feedback encadré, partage d’instrus, sessions studio en vocal et événements live (open mic, battles) sur une scène.",
  theme: "musique",
  size: "medium",
  audience: "Collectifs, labels indépendants, communautés de rappeurs, beatmakers et passionnés de rap francophone qui veulent créer, se faire écouter et collaborer.",
  highlights: [
    "Onboarding « Tu es plutôt… » : profil (artiste, beatmaker, ingé son, auditeur), niveau et notifications, avec rôles et salons adaptés",
    "Forum de collaborations avec tags Beatmaker, Topliner, Ingé son, Clip et Featuring",
    "Forum « sorties » réservé aux artistes, commentaires ouverts à tous",
    "Feedback encadré (mode lent, règle « je donne avant de recevoir »)",
    "Scène pour les open mics et salon dédié aux battles",
  ],
  popularity: 88,
  spec: {
    version: 1,
    meta: {
      name: "Scène rap & musique",
      description: "Serveur pour artistes, beatmakers et auditeurs de rap francophone : sorties, collabs, feedback et événements.",
      theme: "musique",
      size: "medium",
      tone: "direct, bienveillant, tutoiement",
      audience: "Artistes, beatmakers, ingés son et auditeurs de rap francophone",
      accentColor: 0xa7bdff,
    },
    settings: {
      verificationLevel: "medium",
      explicitContentFilter: "all_members",
      defaultNotifications: "only_mentions",
      community: true,
      description: "La scène rap francophone : sorties, collabs, feedback, open mics et battles.",
      systemChannelId: "bienvenue",
      rulesChannelId: "reglement",
      publicUpdatesChannelId: "maj-discord",
      safetyAlertsChannelId: "alertes",
      afkChannelId: "afk",
      afkTimeout: 900,
      suppressJoinNotifications: true,
      suppressSetupTips: true,
    },
    everyone: { permissions: PERMS.member },
    roles: [
      { id: "fondateur", name: "👑 Fondateur", color: 0xf2c14e, hoist: true, permissions: adminPerms(), staff: true, description: "Fondateurs du collectif (le propriétaire du serveur garde tous les droits)." },
      { id: "admin", name: "🛠️ Administration", color: 0xe5534b, hoist: true, mentionable: true, permissions: adminPerms(), staff: true, description: "Gère le serveur, les partenariats et les rôles vérifiés." },
      { id: "moderateur", name: "🛡️ Modération", color: BRAND.blue, hoist: true, mentionable: true, permissions: moderatorPerms(), staff: true, description: "Veille au respect, au feedback constructif et traite les tickets." },
      { id: "programmation", name: "🎧 Programmation", color: 0xff7a59, hoist: true, mentionable: true, permissions: [...PERMS.member, "MANAGE_EVENTS", "PIN_MESSAGES", "MUTE_MEMBERS", "MOVE_MEMBERS"], description: "Organise les open mics, battles et écoutes ; anime la scène." },
      { id: "artiste-verifie", name: "💿 Artiste vérifié", color: 0xc792ea, hoist: true, permissions: PERMS.member, description: "Artiste dont les projets sont validés par l’équipe. Attribué par l’équipe." },
      { id: "artiste", name: "🎙️ Artiste", color: 0xb8d7ff, selfAssignable: true, description: "Rappeur, chanteur, topliner : peut publier ses sorties." },
      { id: "beatmaker", name: "🥁 Beatmaker", color: 0x83a8f3, selfAssignable: true, description: "Compose des instrus et cherche des voix." },
      { id: "inge-son", name: "🎚️ Ingé son", color: 0x9ad1d4, selfAssignable: true, description: "Mix, mastering, enregistrement." },
      { id: "auditeur", name: "🎧 Auditeur", selfAssignable: true, description: "Passionné qui écoute, découvre et donne son avis." },
      { id: "notif-sorties", name: "🔔 Notif sorties", selfAssignable: true, description: "Prévenu des sorties mises en avant." },
      { id: "notif-events", name: "📅 Notif événements", selfAssignable: true, description: "Prévenu des open mics, battles et écoutes." },
      { id: "niveau-debutant", name: "🌱 Je débute", selfAssignable: true, description: "Premiers textes, premières prods : en recherche de conseils." },
      { id: "niveau-progression", name: "📈 En progression", selfAssignable: true, description: "Quelques sons sortis, envie de passer un cap." },
      { id: "niveau-confirme", name: "💼 Confirmé", selfAssignable: true, description: "Projets réguliers, ouvert aux collaborations sérieuses." },
    ],
    categories: [
      {
        id: "cat-accueil",
        name: "📌 Accueil",
        overwrites: readOnly(["admin"]),
        channels: [
          text("bienvenue", "👋・bienvenue", "Les nouveaux arrivent ici. Passe saluer dans #général !", { purpose: "welcome" }),
          text("reglement", "📜・règlement", "Les règles du serveur, du feedback et des collabs.", { purpose: "rules" }),
          announcement("annonces", "📣・annonces", "Infos importantes, sorties mises en avant et nouveautés.", { purpose: "announcements" }),
          text("roles", "🎭・rôles", "Dis-nous qui tu es et choisis tes notifications.", { purpose: "roles" }),
          text("faq", "❓・faq", "Les réponses aux questions fréquentes.", { purpose: "faq" }),
          text("support", "🎫・support", "Une question pour l’équipe, un litige de collab, une demande de vérification ? Ouvre un ticket.", { purpose: "support" }),
        ],
      },
      {
        id: "cat-discussions",
        name: "💬 Discussions",
        overwrites: [],
        channels: [
          text("general", "💬・général", "Discussions libres entre passionnés.", { purpose: "general" }),
          text("presentations", "🙋・présentations", "Blaze, ville, style, influences, liens : présente-toi.", { slowmode: 300, purpose: "introductions" }),
          text("actus-rap", "📰・actus-rap", "Sorties du moment, clips, débats sur la scène. Respect des goûts de chacun."),
          text("hors-sujet", "🎲・hors-sujet", "Tout ce qui ne parle pas de musique."),
          text("suggestions", "💡・suggestions", "Propose une idée (événement, salon, format) avec le bouton : elle sera soumise au vote.", {
            purpose: "suggestions",
            ...own([{ target: "everyone", allow: ["ADD_REACTIONS", "SEND_MESSAGES_IN_THREADS"], deny: ["SEND_MESSAGES", "CREATE_PUBLIC_THREADS"] }]),
          }),
        ],
      },
      {
        id: "cat-artistes",
        name: "🎙️ Espace artistes",
        overwrites: [],
        channels: [
          forum("sorties", "🚀・sorties", "Les artistes publient ici leurs sons, EP et clips (un post par projet, avec lien et crédits). Tout le monde peut commenter dans les publications.", [
            { name: "Single", emoji: "🎵" },
            { name: "EP / Album", emoji: "💿" },
            { name: "Clip", emoji: "🎬" },
            { name: "Freestyle", emoji: "🎤" },
          ], {
            defaultReaction: "🔥",
            ...own([
              { target: "everyone", allow: ["SEND_MESSAGES_IN_THREADS"], deny: ["SEND_MESSAGES"] },
              { target: "artiste", allow: ["SEND_MESSAGES"], deny: [] },
              { target: "artiste-verifie", allow: ["SEND_MESSAGES"], deny: [] },
              { target: "beatmaker", allow: ["SEND_MESSAGES"], deny: [] },
            ]),
          }),
          forum("collabs", "🤝・collabs", "Cherche un beatmaker, une voix, un ingé son ou un clippeur. Précise ton style, tes références, ton budget éventuel et tes délais.", [
            { name: "Beatmaker", emoji: "🥁" },
            { name: "Topliner", emoji: "🎙️" },
            { name: "Ingé son", emoji: "🎚️" },
            { name: "Clip", emoji: "🎬" },
            { name: "Featuring", emoji: "🤝" },
            { name: "Trouvé", emoji: "✅", moderated: true },
          ]),
          text("feedback", "🎧・feedback", "Un son par message, avec ce sur quoi tu veux un avis. Règle d’or : donne un retour avant d’en demander un.", { slowmode: 600 }),
          text("instrus", "🥁・beats-instrus", "Partage tes instrus (préviens si elles sont libres, en lease ou exclusives).", { slowmode: 120 }),
          text("ecriture", "✍️・écriture", "Textes, punchlines, toplines : partage et fais-toi relire.", { slowmode: 30 }),
        ],
      },
      {
        id: "cat-events",
        name: "🎤 Événements",
        overwrites: [],
        channels: [
          announcement("evenements", "📅・événements", "Programme des open mics, battles et écoutes.", { purpose: "events", ...own(readOnly(["programmation", "admin"])) }),
          stage("open-mic", "🎤 Open mic", "Scène ouverte : inscris-toi auprès de la programmation et lève la main."),
          text("battles", "⚔️・battles", "Règles, thèmes et résultats des battles. Clash les textes, jamais les personnes."),
        ],
      },
      {
        id: "cat-studio",
        name: "🎚️ Studio & vocaux",
        overwrites: [],
        channels: [
          voice("studio-1", "🎙️ Session studio 1", { userLimit: 4 }),
          voice("studio-2", "🎙️ Session studio 2", { userLimit: 4 }),
          voice("ecoute", "🎧 Écoute commune"),
          voice("afk", "🌙 AFK", { purpose: "afk" }),
        ],
      },
      {
        id: "cat-staff",
        name: "🛡️ Équipe",
        overwrites: privateTo(["admin", "moderateur", "programmation"]),
        channels: [
          text("staff-discussion", "🗂️・staff-discussion", "Coordination de l’équipe et de la programmation. Rien ne sort d’ici.", { purpose: "staff" }),
          text("maj-discord", "📢・mises-à-jour-discord", "Messages officiels de Discord destinés aux modérateurs.", { purpose: "updates", ...own(privateTo(STAFF)) }),
          text("alertes", "🚨・alertes-automod", "Alertes AutoMod et alertes de sécurité.", { purpose: "mod-logs", ...own(privateTo(STAFF)) }),
          text("logs", "📋・logs-arrivées", "Arrivées et départs des membres (bot Make Your Server).", { purpose: "logs", ...own(privateTo(STAFF)) }),
          voice("staff-vocal", "🔇 Réunion staff"),
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
            title: "Bienvenue sur {server} ! 🎤",
            description:
              "Ici, artistes, beatmakers, ingés son et auditeurs se rencontrent pour créer, s’écouter et progresser.\n\n**Pour bien démarrer :**\n1. Lis le {#reglement}\n2. Dis-nous qui tu es dans {#roles}\n3. Présente-toi dans {#presentations}\n4. Fais écouter ton travail dans {#feedback} ou trouve une collab dans {#collabs}",
            fields: [
              { name: "Événements", value: "Open mics, battles et écoutes sont annoncés dans {#evenements}." },
              { name: "Un souci ?", value: "Ouvre un ticket privé dans {#support}." },
            ],
            footer: "Bonne écoute !",
          },
        ],
      },
      {
        id: "msg-reglement",
        channelId: "reglement",
        pin: true,
        embeds: [
          {
            title: "📜 Règlement du serveur",
            description: "Ces règles s’ajoutent aux [Conditions d’utilisation](https://discord.com/terms) et aux [Règles de la communauté](https://discord.com/guidelines) de Discord.",
            fields: [
              { name: "1. Respect des artistes", value: "On critique un son, jamais une personne. Pas d’insulte, de mépris ni de harcèlement, même en battle." },
              { name: "2. Feedback constructif", value: "Dans {#feedback}, explique ce qui marche et ce qui peut être amélioré. Donne un retour avant d’en demander un." },
              { name: "3. Droits d’auteur", value: "Ne publie que ta musique ou celle que tu as le droit de partager. Crédite toujours les beatmakers, ingés son et featurings." },
              { name: "4. Collabs claires", value: "Précise dès le départ le partage des droits, les délais et l’éventuel budget. Les litiges passent par un ticket." },
              { name: "5. Autopromo encadrée", value: "Tes sorties vont dans {#sorties}, une publication par projet. Pas de spam de liens dans les autres salons ni en MP." },
              { name: "6. Pas d’arnaque", value: "Aucune vente de streams, de faux abonnés ou de « placements playlist » payants." },
              { name: "7. Contenu", value: "Les paroles explicites sont acceptées dans les sons, mais aucun contenu haineux, discriminatoire ou illégal." },
              { name: "8. Sanctions", value: "De l’avertissement au bannissement selon la gravité. Contestation via {#support}." },
            ],
            footer: "En restant sur le serveur, tu acceptes ce règlement.",
          },
        ],
      },
      {
        id: "msg-roles-profil",
        channelId: "roles",
        embeds: [{ title: "🎙️ Tu es plutôt…", description: "Clique sur un ou plusieurs boutons. Ton rôle indique aux autres ce que tu fais et débloque la publication dans {#sorties} pour les artistes et beatmakers." }],
        buttons: [
          { action: "role-toggle", roleId: "artiste", label: "Artiste", emoji: "🎙️" },
          { action: "role-toggle", roleId: "beatmaker", label: "Beatmaker", emoji: "🥁" },
          { action: "role-toggle", roleId: "inge-son", label: "Ingé son", emoji: "🎚️" },
          { action: "role-toggle", roleId: "auditeur", label: "Auditeur", emoji: "🎧" },
        ],
      },
      {
        id: "msg-roles-notifs",
        channelId: "roles",
        embeds: [{ title: "🔔 Tes notifications", description: "Choisis ce pour quoi tu veux être prévenu." }],
        buttons: [
          { action: "role-toggle", roleId: "notif-sorties", label: "Sorties", emoji: "🔔", style: "primary" },
          { action: "role-toggle", roleId: "notif-events", label: "Événements", emoji: "📅", style: "primary" },
        ],
      },
      {
        id: "msg-roles-niveau",
        channelId: "roles",
        embeds: [{ title: "📈 Où en es-tu dans ta musique ?", description: "Prends un seul niveau : il aide les autres à te proposer des conseils ou des collabs adaptés. Un nouveau clic retire le rôle." }],
        buttons: [
          { action: "role-toggle", roleId: "niveau-debutant", label: "Je débute", emoji: "🌱" },
          { action: "role-toggle", roleId: "niveau-progression", label: "En progression", emoji: "📈" },
          { action: "role-toggle", roleId: "niveau-confirme", label: "Confirmé", emoji: "💼" },
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
              { name: "Où poster mon son ?", value: "Pour un avis : {#feedback}. Pour une sortie officielle : une publication dans {#sorties}." },
              { name: "Comment obtenir « Artiste vérifié » ?", value: "Ouvre un ticket dans {#support} avec tes liens (plateformes, réseaux). Le rôle {@artiste-verifie} est attribué par l’équipe." },
              { name: "Comment participer à un open mic ?", value: "Surveille {#evenements}, inscris-toi auprès de {@programmation} puis rejoins la scène et lève la main." },
              { name: "Les instrus partagées sont-elles libres ?", value: "Pas forcément : vérifie toujours les conditions indiquées par le beatmaker dans {#instrus}." },
              { name: "Un problème dans une collab ?", value: "Ouvre un ticket : l’équipe peut servir de médiateur." },
            ],
          },
        ],
      },
      {
        id: "msg-support",
        channelId: "support",
        embeds: [{ title: "🎫 Besoin de l’équipe ?", description: "Demande de vérification, litige de collab, signalement… Clique sur le bouton : un fil privé s’ouvre entre toi et l’équipe." }],
        buttons: [{ action: "ticket-open", label: "Ouvrir un ticket", emoji: "🎫", style: "primary" }],
      },
      {
        id: "msg-suggestions",
        channelId: "suggestions",
        embeds: [{ title: "💡 Une idée pour la scène ?", description: "Thème de battle, format d’écoute, nouveau salon ? Clique sur le bouton : ton idée sera publiée ici et soumise au vote." }],
        buttons: [{ action: "suggestion-open", label: "Proposer une idée", emoji: "💡" }],
      },
      {
        id: "msg-battles",
        channelId: "battles",
        pin: true,
        embeds: [
          {
            title: "⚔️ Règles des battles",
            fields: [
              { name: "Format", value: "Deux couplets de 16 mesures maximum, sur l’instru imposée annoncée dans {#evenements}." },
              { name: "Respect", value: "Clash les textes, pas la vie privée. Aucune attaque sur l’origine, la religion, le genre ou l’apparence." },
              { name: "Vote", value: "Le public vote par réaction, la programmation tranche en cas d’égalité." },
            ],
          },
        ],
      },
      {
        id: "msg-staff",
        channelId: "staff-discussion",
        pin: true,
        embeds: [
          {
            title: "🗂️ Mémo de l’équipe",
            fields: [
              { name: "Échelle des sanctions", value: "1. Rappel à l’ordre\n2. Avertissement\n3. Exclusion temporaire\n4. Bannissement (haine, arnaque, vol de son)" },
              { name: "Vérification artistes", value: "Vérifier au moins un lien officiel et l’activité sur le serveur avant d’attribuer {@artiste-verifie}." },
              { name: "Événements", value: "Annonce une semaine avant dans {#evenements}. Un modérateur présent sur la scène pendant chaque open mic." },
              { name: "AutoMod et logs", value: "Alertes dans {#alertes}, arrivées et départs dans {#logs}." },
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
        trigger: { type: "mention_spam", mentionLimit: 5, raidProtection: true },
        actions: [{ type: "block", customMessage: "Trop de mentions dans un seul message." }, { type: "alert", channelId: "alertes" }, { type: "timeout", durationSeconds: 600 }],
        exemptRoles: STAFF,
      },
      {
        id: "am-presets",
        name: "Insultes haineuses",
        trigger: { type: "keyword_preset", presets: ["slurs"] },
        actions: [{ type: "block", customMessage: "Les propos haineux sont interdits, même en battle." }, { type: "alert", channelId: "alertes" }],
      },
      {
        id: "am-arnaques",
        name: "Faux streams, arnaques et invitations",
        trigger: {
          type: "keyword",
          keywords: ["*achat de streams*", "*buy streams*", "*placement playlist garanti*", "*nitro gratuit*", "*free nitro*", "*discord.gift*"],
          regexPatterns: ["(discord\\.gg|discord(app)?\\.com/invite)/[a-zA-Z0-9-]+"],
        },
        actions: [{ type: "block", customMessage: "Liens suspects et services de faux streams interdits." }, { type: "alert", channelId: "alertes" }],
        exemptRoles: STAFF,
      },
    ],
    onboarding: {
      enabled: true,
      mode: "default",
      defaultChannelIds: ["bienvenue", "reglement", "annonces", "general", "presentations", "actus-rap", "hors-sujet", "collabs", "evenements"],
      prompts: [
        {
          id: "q-profil",
          title: "Tu es plutôt…",
          type: "multiple_choice",
          singleSelect: false,
          required: false,
          inOnboarding: true,
          options: [
            { id: "o-artiste", title: "Artiste", description: "Rappeur, chanteur, topliner", emoji: "🎙️", roleIds: ["artiste"], channelIds: ["sorties", "ecriture", "feedback"] },
            { id: "o-beatmaker", title: "Beatmaker", description: "Je compose des instrus", emoji: "🥁", roleIds: ["beatmaker"], channelIds: ["instrus", "sorties"] },
            { id: "o-inge-son", title: "Ingé son", description: "Mix, mastering, enregistrement", emoji: "🎚️", roleIds: ["inge-son"], channelIds: ["feedback"] },
            { id: "o-auditeur", title: "Auditeur", description: "J’écoute et je découvre", emoji: "🎧", roleIds: ["auditeur"], channelIds: ["sorties"] },
          ],
        },
        {
          id: "q-notifs",
          title: "Quelles notifications veux-tu recevoir ?",
          type: "multiple_choice",
          singleSelect: false,
          required: false,
          inOnboarding: true,
          options: [
            { id: "o-notif-sorties", title: "Sorties mises en avant", emoji: "🔔", roleIds: ["notif-sorties"], channelIds: [] },
            { id: "o-notif-events", title: "Open mics et battles", emoji: "📅", roleIds: ["notif-events"], channelIds: ["battles", "open-mic"] },
          ],
        },
        {
          id: "q-niveau",
          title: "Où en es-tu dans ta musique ?",
          type: "multiple_choice",
          singleSelect: true,
          required: false,
          inOnboarding: true,
          options: [
            { id: "o-debutant", title: "Je débute", description: "Premiers textes, premières prods", emoji: "🌱", roleIds: ["niveau-debutant"], channelIds: ["feedback", "ecriture"] },
            { id: "o-progression", title: "Je progresse", description: "Quelques sons sortis, envie de passer un cap", emoji: "📈", roleIds: ["niveau-progression"], channelIds: ["feedback", "collabs"] },
            { id: "o-confirme", title: "Je suis confirmé", description: "Projets réguliers, collabs sérieuses", emoji: "💼", roleIds: ["niveau-confirme"], channelIds: ["collabs", "studio-1"] },
            { id: "o-ecoute", title: "Je ne fais pas de musique", description: "Je viens écouter et découvrir", emoji: "🎧", roleIds: [], channelIds: ["ecoute"] },
          ],
        },
      ],
    },
    welcomeScreen: {
      enabled: true,
      description: "Artistes, beatmakers et auditeurs : crée, fais-toi écouter et collabore.",
      channels: [
        { channelId: "reglement", description: "Lire le règlement", emoji: "📜" },
        { channelId: "presentations", description: "Se présenter", emoji: "🙋" },
        { channelId: "feedback", description: "Faire écouter un son", emoji: "🎧" },
        { channelId: "collabs", description: "Trouver une collab", emoji: "🤝" },
        { channelId: "evenements", description: "Open mics et battles", emoji: "🎤" },
      ],
    },
    serverGuide: {
      welcomeMessage: "Bienvenue sur la scène ! Présente-toi, fais écouter ton travail et trouve tes prochaines collabs.",
      newMemberActions: [
        { title: "Lire le règlement", channelId: "reglement", description: "Respect et feedback constructif." },
        { title: "Se présenter", channelId: "presentations", description: "Blaze, style et influences." },
        { title: "Donner un premier avis", channelId: "feedback", description: "Écoute un son et laisse un retour." },
      ],
      resourceChannels: [
        { title: "Questions fréquentes", channelId: "faq" },
        { title: "Choisir son profil", channelId: "roles" },
        { title: "Collaborations", channelId: "collabs" },
        { title: "Contacter l’équipe", channelId: "support" },
      ],
    },
    features: {
      welcome: {
        enabled: true,
        channelId: "bienvenue",
        message: "Bienvenue {user} sur **{server}** 🎤 Tu es notre {memberCount}e membre ! Présente-toi dans {#presentations} et fais-nous écouter ton univers.",
      },
      joinLogs: { enabled: true, channelId: "logs" },
      tickets: { enabled: true, channelId: "support", staffRoleIds: ["moderateur", "admin"], intro: "Merci pour ton message ! Explique ta demande (liens, captures, personnes concernées) : seule l’équipe lit ce fil." },
      suggestions: { enabled: true, channelId: "suggestions" },
    },
  },
};
