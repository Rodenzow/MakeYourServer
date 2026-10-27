import { BRAND, PERMS, adminPerms, announcement, forum, moderatorPerms, own, privateTo, readOnly, stage, text, voice, type TemplateDefinition } from "./helpers";

const STAFF = ["admin", "moderateur"];

export const communaute: TemplateDefinition = {
  slug: "communaute",
  name: "Communauté conviviale",
  tagline: "Un serveur communautaire prêt à accueillir, animer et modérer.",
  description:
    "Une communauté généraliste organisée autour d’un accueil clair, de discussions thématiques choisies par chaque membre grâce à l’onboarding, d’événements réguliers et d’une équipe de modération outillée (tickets, logs, AutoMod).",
  theme: "communaute",
  size: "medium",
  audience: "Groupes d’amis qui s’agrandissent, communautés francophones généralistes, serveurs de fans ou de quartier, de 20 à quelques milliers de membres.",
  highlights: [
    "Onboarding Discord : les membres choisissent leurs centres d’intérêt et leurs notifications",
    "Règlement, FAQ et message d’accueil déjà rédigés",
    "Tickets d’aide privés et boîte à suggestions avec boutons fonctionnels",
    "AutoMod : anti-spam, anti-raid de mentions, liens d’invitation et arnaques",
    "Espace staff privé avec logs d’arrivées et alertes AutoMod",
  ],
  popularity: 96,
  spec: {
    version: 1,
    meta: {
      name: "Communauté conviviale",
      description: "Serveur communautaire généraliste avec accueil, discussions thématiques et événements.",
      theme: "communaute",
      size: "medium",
      tone: "chaleureux et tutoiement",
      audience: "Communauté francophone généraliste",
      accentColor: BRAND.blue,
    },
    settings: {
      verificationLevel: "medium",
      explicitContentFilter: "all_members",
      defaultNotifications: "only_mentions",
      community: true,
      description: "Une communauté francophone conviviale : discussions, événements et entraide.",
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
      { id: "fondateur", name: "👑 Fondateur", color: 0xf2c14e, hoist: true, permissions: adminPerms(), staff: true, description: "Fondateurs du projet (le propriétaire du serveur garde de toute façon tous les droits)." },
      { id: "admin", name: "🛠️ Administration", color: 0xe5534b, hoist: true, mentionable: true, permissions: adminPerms(), staff: true, description: "Gère les salons, les rôles et les réglages du serveur." },
      { id: "moderateur", name: "🛡️ Modération", color: BRAND.blue, hoist: true, mentionable: true, permissions: moderatorPerms(), staff: true, description: "Fait respecter le règlement, traite les tickets et les signalements." },
      { id: "animateur", name: "🎉 Animation", color: BRAND.periwinkle, hoist: true, mentionable: true, permissions: [...PERMS.member, "MANAGE_EVENTS", "PIN_MESSAGES"], description: "Organise les événements et publie dans #événements." },
      { id: "habitue", name: "⭐ Habitué", color: BRAND.lightBlue, hoist: true, permissions: PERMS.member, description: "Membre actif de longue date, attribué par l’équipe." },
      { id: "jeux", name: "🎮 Jeux vidéo", selfAssignable: true, description: "Accès mis en avant au salon jeux vidéo." },
      { id: "creations", name: "🎨 Créations", selfAssignable: true, description: "Dessin, photo, écriture, montage…" },
      { id: "musique", name: "🎵 Musique", selfAssignable: true, description: "Partage et découverte musicale." },
      { id: "culture", name: "📚 Culture & séries", selfAssignable: true, description: "Films, séries, livres, mangas." },
      { id: "notif-annonces", name: "🔔 Notif annonces", selfAssignable: true, mentionable: false, description: "Mentionné lors des annonces importantes." },
      { id: "notif-events", name: "📅 Notif événements", selfAssignable: true, mentionable: false, description: "Mentionné au lancement des événements." },
    ],
    categories: [
      {
        id: "cat-bienvenue",
        name: "📌 Bienvenue",
        overwrites: readOnly(["admin"]),
        channels: [
          text("bienvenue", "👋・bienvenue", "Les nouveaux membres arrivent ici. Dis-leur bonjour dans #général !", { purpose: "welcome" }),
          text("reglement", "📜・règlement", "Les règles du serveur. En restant ici, tu t’engages à les respecter.", { purpose: "rules" }),
          announcement("annonces", "📣・annonces", "Les nouvelles importantes du serveur.", { purpose: "announcements" }),
          text("roles", "🎭・rôles", "Choisis tes centres d’intérêt et tes notifications avec les boutons.", { purpose: "roles" }),
          text("faq", "❓・faq", "Les réponses aux questions fréquentes.", { purpose: "faq" }),
          text("support", "🎫・support", "Un souci, une question pour l’équipe ? Ouvre un ticket privé avec le bouton.", { purpose: "support" }),
        ],
      },
      {
        id: "cat-discussions",
        name: "💬 Discussions",
        overwrites: [],
        channels: [
          text("general", "💬・général", "Le salon principal : discussions libres et bonne humeur.", { purpose: "general" }),
          text("presentations", "🙋・présentations", "Présente-toi en quelques lignes : prénom ou pseudo, passions, ce qui t’amène.", { slowmode: 300, purpose: "introductions" }),
          text("medias", "📸・médias", "Photos, vidéos, mèmes (sans contenu choquant).", { slowmode: 10, purpose: "media" }),
          text("hors-sujet", "🎲・hors-sujet", "Tout ce qui ne rentre nulle part ailleurs."),
          forum("entraide", "🤝・entraide", "Pose une question en créant une publication. Indique le tag adapté et marque ta publication « Résolu » quand c’est réglé.", [
            { name: "Question", emoji: "❓" },
            { name: "Conseil", emoji: "💡" },
            { name: "Résolu", emoji: "✅", moderated: true },
          ], { defaultReaction: "👍" }),
          text("suggestions", "💡・suggestions", "Propose une idée avec le bouton : elle sera publiée ici et soumise au vote.", {
            purpose: "suggestions",
            ...own([{ target: "everyone", allow: ["ADD_REACTIONS", "SEND_MESSAGES_IN_THREADS"], deny: ["SEND_MESSAGES", "CREATE_PUBLIC_THREADS"] }]),
          }),
        ],
      },
      {
        id: "cat-interets",
        name: "🧩 Centres d’intérêt",
        overwrites: [],
        channels: [
          text("salon-jeux", "🎮・jeux-vidéo", "Vos jeux du moment, recherches de coéquipiers et découvertes."),
          text("salon-creations", "🎨・créations", "Partagez vos créations et donnez des retours bienveillants.", { slowmode: 30 }),
          text("salon-musique", "🎵・musique", "Partage de morceaux, playlists et découvertes."),
          text("salon-culture", "📚・culture", "Films, séries, livres, mangas : attention aux spoilers ! (||texte||)"),
        ],
      },
      {
        id: "cat-events",
        name: "🎉 Événements",
        overwrites: [],
        channels: [
          announcement("evenements", "📅・événements", "Programme des soirées, tournois et animations.", { purpose: "events", ...own(readOnly(["animateur", "admin"])) }),
          stage("scene", "🎤 Scène communautaire", "Conférences, quiz et soirées animées."),
        ],
      },
      {
        id: "cat-vocaux",
        name: "🔊 Vocaux",
        overwrites: [],
        channels: [
          voice("vocal-detente", "🛋️ Détente"),
          voice("vocal-jeux", "🎮 Session jeux", { userLimit: 6 }),
          voice("vocal-musique", "🎧 Écoute ensemble"),
          voice("afk", "🌙 AFK", { purpose: "afk" }),
        ],
      },
      {
        id: "cat-staff",
        name: "🛡️ Équipe",
        overwrites: privateTo(["admin", "moderateur", "animateur"]),
        channels: [
          text("staff-discussion", "🗂️・staff-discussion", "Coordination de l’équipe. Rien ne sort d’ici.", { purpose: "staff" }),
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
            title: "Bienvenue sur {server} ! 👋",
            description:
              "Nous sommes ravis de t’accueillir. Ici, on discute, on s’entraide et on organise des événements dans la bonne humeur.\n\n**Pour bien commencer :**\n1. Lis le {#reglement}\n2. Choisis tes centres d’intérêt dans {#roles}\n3. Présente-toi dans {#presentations}\n4. Viens dire bonjour dans {#general}",
            fields: [
              { name: "Besoin d’aide ?", value: "Pose ta question dans {#entraide} ou ouvre un ticket privé dans {#support}.", inline: false },
              { name: "L’équipe", value: "{@admin} et {@moderateur} veillent au bon fonctionnement du serveur.", inline: false },
            ],
            footer: "Bonne visite !",
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
              { name: "1. Respect avant tout", value: "Aucune insulte, moquerie, discrimination ni harcèlement. Les désaccords se règlent calmement ou en privé." },
              { name: "2. Pas de spam", value: "Pas de flood, de messages en majuscules répétés ni de mentions inutiles." },
              { name: "3. Pas de publicité", value: "Pas de lien d’invitation ni de promotion sans l’accord de l’équipe, y compris en messages privés." },
              { name: "4. Contenu approprié", value: "Aucun contenu choquant, sexuel ou illégal. Les spoilers sont masqués avec ||texte||." },
              { name: "5. Bons salons", value: "Utilise le salon adapté à chaque sujet : cela aide tout le monde à s’y retrouver." },
              { name: "6. Vie privée", value: "Ne partage jamais d’informations personnelles (les tiennes ou celles des autres)." },
              { name: "7. Pseudos et avatars", value: "Ils doivent rester lisibles et respectueux." },
              { name: "8. L’équipe a le dernier mot", value: "En cas de problème, ouvre un ticket dans {#support}. Les sanctions vont de l’avertissement au bannissement selon la gravité." },
            ],
            footer: "En restant sur le serveur, tu acceptes ce règlement.",
          },
        ],
      },
      {
        id: "msg-roles-interets",
        channelId: "roles",
        embeds: [
          {
            title: "🧩 Tes centres d’intérêt",
            description: "Clique sur un bouton pour prendre ou retirer un rôle. Il met en avant les salons correspondants et te permet d’être mentionné pour les activités qui te plaisent.",
          },
        ],
        buttons: [
          { action: "role-toggle", roleId: "jeux", label: "Jeux vidéo", emoji: "🎮" },
          { action: "role-toggle", roleId: "creations", label: "Créations", emoji: "🎨" },
          { action: "role-toggle", roleId: "musique", label: "Musique", emoji: "🎵" },
          { action: "role-toggle", roleId: "culture", label: "Culture & séries", emoji: "📚" },
        ],
      },
      {
        id: "msg-roles-notifs",
        channelId: "roles",
        embeds: [{ title: "🔔 Tes notifications", description: "Choisis ce pour quoi tu veux être prévenu. Tu peux changer d’avis à tout moment." }],
        buttons: [
          { action: "role-toggle", roleId: "notif-annonces", label: "Annonces", emoji: "🔔", style: "primary" },
          { action: "role-toggle", roleId: "notif-events", label: "Événements", emoji: "📅", style: "primary" },
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
              { name: "Comment changer mes rôles ?", value: "Rends-toi dans {#roles} et clique sur les boutons, ou ouvre le menu du serveur → « Salons et rôles »." },
              { name: "Je ne vois pas certains salons", value: "Certains salons s’affichent selon tes centres d’intérêt. Choisis-les dans {#roles} ou via « Parcourir les salons »." },
              { name: "Comment devenir Habitué ?", value: "Le rôle {@habitue} est attribué par l’équipe aux membres actifs et bienveillants. Inutile de le demander !" },
              { name: "Comment signaler un problème ?", value: "Ouvre un ticket dans {#support} : seule l’équipe pourra le lire." },
              { name: "Puis-je proposer un événement ?", value: "Oui ! Utilise le bouton de {#suggestions} et l’équipe d’animation te recontactera." },
            ],
          },
        ],
      },
      {
        id: "msg-support",
        channelId: "support",
        embeds: [
          {
            title: "🎫 Besoin de l’équipe ?",
            description: "Clique sur le bouton ci-dessous : un fil privé sera créé entre toi et l’équipe de modération. Explique ton souci, avec des captures si nécessaire.",
          },
        ],
        buttons: [{ action: "ticket-open", label: "Ouvrir un ticket", emoji: "🎫", style: "primary" }],
      },
      {
        id: "msg-suggestions",
        channelId: "suggestions",
        embeds: [
          {
            title: "💡 Une idée pour le serveur ?",
            description: "Clique sur le bouton, décris ton idée : elle sera publiée ici avec des votes 👍 / 👎. Discute-en dans le fil créé sous chaque suggestion.",
          },
        ],
        buttons: [{ action: "suggestion-open", label: "Proposer une idée", emoji: "💡" }],
      },
      {
        id: "msg-staff",
        channelId: "staff-discussion",
        pin: true,
        embeds: [
          {
            title: "🗂️ Mémo de l’équipe",
            fields: [
              { name: "Échelle des sanctions", value: "1. Rappel à l’ordre\n2. Avertissement écrit\n3. Exclusion temporaire (1 h à 1 semaine)\n4. Bannissement (cas graves ou récidive)" },
              { name: "Tickets", value: "Répondez dans les 24 h. Une fois le problème réglé, remerciez le membre puis archivez le fil." },
              { name: "AutoMod", value: "Les alertes arrivent dans {#alertes}. Vérifiez le contexte avant de sanctionner." },
              { name: "Logs", value: "Les arrivées et départs sont consignés dans {#logs}." },
            ],
          },
        ],
      },
    ],
    automod: [
      {
        id: "am-spam",
        name: "Anti-spam",
        trigger: { type: "spam" },
        actions: [{ type: "block" }, { type: "alert", channelId: "alertes" }],
      },
      {
        id: "am-mentions",
        name: "Anti-raid de mentions",
        trigger: { type: "mention_spam", mentionLimit: 6, raidProtection: true },
        actions: [
          { type: "block", customMessage: "Trop de mentions dans un seul message." },
          { type: "alert", channelId: "alertes" },
          { type: "timeout", durationSeconds: 600 },
        ],
        exemptRoles: STAFF,
      },
      {
        id: "am-presets",
        name: "Insultes graves et contenu sexuel",
        trigger: { type: "keyword_preset", presets: ["slurs", "sexual_content"] },
        actions: [{ type: "block", customMessage: "Ce message enfreint le règlement." }, { type: "alert", channelId: "alertes" }],
      },
      {
        id: "am-invitations",
        name: "Liens d’invitation et arnaques",
        trigger: {
          type: "keyword",
          keywords: ["*nitro gratuit*", "*free nitro*", "*steam gift*", "*cadeau steam*", "*discord.gift*"],
          regexPatterns: ["(discord\\.gg|discord(app)?\\.com/invite)/[a-zA-Z0-9-]+"],
        },
        actions: [{ type: "block", customMessage: "Les invitations et liens suspects sont interdits. Demande à l’équipe." }, { type: "alert", channelId: "alertes" }],
        exemptRoles: STAFF,
      },
    ],
    onboarding: {
      enabled: true,
      mode: "default",
      defaultChannelIds: ["bienvenue", "reglement", "annonces", "general", "presentations", "medias", "hors-sujet", "entraide", "evenements"],
      prompts: [
        {
          id: "q-interets",
          title: "Qu’est-ce qui t’intéresse ?",
          type: "multiple_choice",
          singleSelect: false,
          required: false,
          inOnboarding: true,
          options: [
            { id: "o-jeux", title: "Jeux vidéo", emoji: "🎮", roleIds: ["jeux"], channelIds: ["salon-jeux", "vocal-jeux"] },
            { id: "o-creations", title: "Créations", emoji: "🎨", roleIds: ["creations"], channelIds: ["salon-creations"] },
            { id: "o-musique", title: "Musique", emoji: "🎵", roleIds: ["musique"], channelIds: ["salon-musique", "vocal-musique"] },
            { id: "o-culture", title: "Culture & séries", emoji: "📚", roleIds: ["culture"], channelIds: ["salon-culture"] },
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
            { id: "o-notif-annonces", title: "Annonces importantes", emoji: "🔔", roleIds: ["notif-annonces"], channelIds: [] },
            { id: "o-notif-events", title: "Lancement des événements", emoji: "📅", roleIds: ["notif-events"], channelIds: [] },
          ],
        },
      ],
    },
    welcomeScreen: {
      enabled: true,
      description: "Une communauté conviviale pour discuter, s’entraider et participer à des événements.",
      channels: [
        { channelId: "reglement", description: "Lire le règlement", emoji: "📜" },
        { channelId: "general", description: "Discuter avec tout le monde", emoji: "💬" },
        { channelId: "presentations", description: "Se présenter", emoji: "🙋" },
        { channelId: "entraide", description: "Poser une question", emoji: "🤝" },
        { channelId: "evenements", description: "Voir les prochains événements", emoji: "📅" },
      ],
    },
    serverGuide: {
      welcomeMessage: "Bienvenue ! Ici on discute, on s’entraide et on organise des événements. Commence par te présenter, puis viens dire bonjour.",
      newMemberActions: [
        { title: "Lire le règlement", channelId: "reglement", description: "Deux minutes pour connaître les règles de vie." },
        { title: "Se présenter", channelId: "presentations", description: "Quelques lignes pour faire connaissance." },
        { title: "Dire bonjour", channelId: "general" },
      ],
      resourceChannels: [
        { title: "Questions fréquentes", channelId: "faq" },
        { title: "Choisir ses rôles", channelId: "roles" },
        { title: "Contacter l’équipe", channelId: "support" },
      ],
    },
    features: {
      welcome: {
        enabled: true,
        channelId: "bienvenue",
        message: "Bienvenue {user} sur **{server}** ! Tu es notre {memberCount}e membre. Jette un œil au {#reglement} puis viens te présenter dans {#presentations} 🙌",
      },
      joinLogs: { enabled: true, channelId: "logs" },
      tickets: { enabled: true, channelId: "support", staffRoleIds: ["moderateur", "admin"], intro: "Merci pour ton message ! Explique ton besoin ici : seule l’équipe de modération peut lire ce fil." },
      suggestions: { enabled: true, channelId: "suggestions" },
    },
  },
};
