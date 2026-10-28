import { BRAND, PERMS, adminPerms, announcement, forum, moderatorPerms, own, privateTo, readOnly, text, voice, type TemplateDefinition } from "./helpers";

const STAFF = ["createur", "moderateur"];

export const createur: TemplateDefinition = {
  slug: "createur",
  name: "Communauté de créateur",
  tagline: "Rassemble ta communauté YouTube, Twitch ou TikTok autour de tes vidéos et de tes lives.",
  description:
    "Un serveur pour créateur de contenu : annonces automatiques de vidéos et de lives lisibles par tous, notifications à la carte, fan-arts en forum, clips, boîte à idées de vidéos, questions pour les FAQ, chat de live et watch parties, coulisses pour les soutiens et une équipe de modération outillée.",
  theme: "createur",
  size: "large",
  audience: "Vidéastes, streameurs et créateurs TikTok qui veulent fidéliser leur audience, de quelques centaines à plusieurs milliers de membres.",
  highlights: [
    "Salons d’annonces de vidéos et de lives réservés au créateur et à son équipe",
    "Onboarding : notifications à la carte (lives, vidéos, événements), envies et plateforme préférée",
    "Forum de fan-arts avec tags et boîte à idées de vidéos soumise au vote",
    "Coulisses réservées aux soutiens (rôle attribué par l’équipe)",
    "Modération pensée pour les grosses audiences : anti-raid, anti-arnaques, tickets",
  ],
  popularity: 90,
  spec: {
    version: 1,
    meta: {
      name: "Communauté de créateur",
      description: "Serveur communautaire d’un créateur de contenu : annonces, lives, fan-arts, idées de vidéos et coulisses.",
      theme: "createur",
      size: "large",
      tone: "proche de la communauté, tutoiement",
      audience: "Abonnés et viewers d’un créateur de contenu",
      accentColor: BRAND.periwinkle,
    },
    settings: {
      verificationLevel: "medium",
      explicitContentFilter: "all_members",
      defaultNotifications: "only_mentions",
      community: true,
      description: "La communauté officielle : vidéos, lives, fan-arts et discussions entre abonnés.",
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
      { id: "createur", name: "🎬 Créateur", color: 0xff5c7a, hoist: true, mentionable: false, permissions: adminPerms(), staff: true, description: "Le créateur et ses associés (le propriétaire du serveur garde tous les droits)." },
      { id: "moderateur", name: "🛡️ Modération", color: BRAND.blue, hoist: true, mentionable: true, permissions: moderatorPerms(), staff: true, description: "Modère le serveur et le chat des lives, traite les tickets." },
      { id: "equipe", name: "🛠️ Équipe contenu", color: 0xf2a65a, hoist: true, mentionable: true, permissions: [...PERMS.member, "MANAGE_EVENTS", "PIN_MESSAGES", "MOVE_MEMBERS"], description: "Monteurs, managers : publient les annonces et organisent les watch parties." },
      { id: "soutien", name: "💎 Soutien", color: 0x7fd1ff, hoist: true, permissions: PERMS.member, description: "Abonnés payants ou membres de la chaîne, attribué par l’équipe. Accès aux coulisses." },
      { id: "notif-lives", name: "🔴 Notif lives", selfAssignable: true, description: "Mentionné au lancement de chaque live." },
      { id: "notif-videos", name: "🎬 Notif vidéos", selfAssignable: true, description: "Mentionné à chaque nouvelle vidéo." },
      { id: "notif-events", name: "📅 Notif événements", selfAssignable: true, description: "Mentionné pour les watch parties et événements." },
      { id: "fan-youtube", name: "▶️ Viewer YouTube", selfAssignable: true, description: "Suit surtout la chaîne sur YouTube." },
      { id: "fan-twitch", name: "🟣 Viewer Twitch", selfAssignable: true, description: "Suit surtout les lives sur Twitch." },
      { id: "fan-tiktok", name: "📱 Viewer TikTok", selfAssignable: true, description: "Suit surtout les formats courts (TikTok, Shorts, Reels)." },
    ],
    categories: [
      {
        id: "cat-accueil",
        name: "📌 Accueil",
        overwrites: readOnly(["createur"]),
        channels: [
          text("bienvenue", "👋・bienvenue", "Les nouveaux arrivent ici. Passe dire bonjour dans #général !", { purpose: "welcome" }),
          text("reglement", "📜・règlement", "Les règles de la communauté.", { purpose: "rules" }),
          announcement("videos", "🎬・nouvelles-vidéos", "Chaque nouvelle vidéo est annoncée ici.", { purpose: "announcements", ...own(readOnly(["createur", "equipe"])) }),
          announcement("lives", "🔴・lives", "Annonce des lives et du planning de stream.", own(readOnly(["createur", "equipe"]))),
          text("roles", "🎭・notifications", "Choisis pour quoi tu veux être prévenu.", { purpose: "roles" }),
          text("faq", "❓・faq", "Les réponses aux questions fréquentes.", { purpose: "faq" }),
          text("support", "🎫・support", "Une question pour l’équipe, un signalement ? Ouvre un ticket privé.", { purpose: "support" }),
        ],
      },
      {
        id: "cat-commu",
        name: "💬 Communauté",
        overwrites: [],
        channels: [
          text("general", "💬・général", "Discussions libres entre abonnés.", { purpose: "general", slowmode: 3 }),
          text("presentations", "🙋・présentations", "Présente-toi et dis-nous depuis quand tu suis la chaîne !", { slowmode: 300, purpose: "introductions" }),
          text("clips", "✂️・clips", "Les meilleurs moments des lives et vidéos (lien du clip + timecode).", { slowmode: 30, purpose: "media" }),
          forum("fan-art", "🎨・fan-art", "Partage tes créations inspirées de la chaîne (une publication par œuvre, crédite-toi). Le créateur passe régulièrement !", [
            { name: "Dessin", emoji: "✏️" },
            { name: "Montage", emoji: "🎞️" },
            { name: "Mème", emoji: "😂" },
            { name: "3D / animation", emoji: "🧊" },
            { name: "Coup de cœur", emoji: "💖", moderated: true },
          ], { defaultReaction: "💖" }),
          forum("questions", "🎤・questions", "Pose ta question au créateur : les plus votées seront traitées en FAQ vidéo ou en live.", [
            { name: "Vie perso", emoji: "🙂" },
            { name: "Matériel", emoji: "🎥" },
            { name: "Chaîne", emoji: "📈" },
            { name: "Répondu", emoji: "✅", moderated: true },
          ], { slowmode: 600 }),
          text("idees-videos", "💡・idées-vidéos", "Propose une idée de vidéo ou de live avec le bouton : la communauté vote.", {
            purpose: "suggestions",
            ...own([{ target: "everyone", allow: ["ADD_REACTIONS", "SEND_MESSAGES_IN_THREADS"], deny: ["SEND_MESSAGES", "CREATE_PUBLIC_THREADS"] }]),
          }),
          text("hors-sujet", "🎲・hors-sujet", "Tout ce qui ne parle pas de la chaîne."),
        ],
      },
      {
        id: "cat-live",
        name: "🔴 Live & watch party",
        overwrites: [],
        channels: [
          text("chat-live", "💬・chat-du-live", "Discute pendant les lives et les premières. Mode lent actif pour rester lisible.", { slowmode: 5 }),
          voice("watch-party", "🍿 Watch party"),
          voice("vocal-detente", "🛋️ Détente"),
          text("coulisses", "💎・coulisses", "Coulisses, avant-premières et sondages réservés aux soutiens.", own(privateTo(["soutien", "createur", "equipe", "moderateur"]))),
          voice("afk", "🌙 AFK", { purpose: "afk" }),
        ],
      },
      {
        id: "cat-staff",
        name: "🛡️ Équipe",
        overwrites: privateTo(["createur", "moderateur", "equipe"]),
        channels: [
          text("staff-discussion", "🗂️・staff-discussion", "Coordination de l’équipe de modération. Rien ne sort d’ici.", { purpose: "staff" }),
          text("planning", "🗓️・planning-contenus", "Planning des vidéos, lives et watch parties."),
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
            title: "Bienvenue sur {server} ! 🎬",
            description:
              "Tu es dans la communauté officielle : ici on parle des vidéos, on suit les lives ensemble et on partage ses créations.\n\n**Pour bien commencer :**\n1. Lis le {#reglement}\n2. Choisis tes notifications dans {#roles}\n3. Présente-toi dans {#presentations}\n4. Viens discuter dans {#general}",
            fields: [
              { name: "Ne rate rien", value: "Les vidéos arrivent dans {#videos} et les lives dans {#lives}." },
              { name: "Une question pour le créateur ?", value: "Publie-la dans {#questions} : les plus votées passent en FAQ !" },
            ],
            footer: "Merci d’être là ❤️",
          },
        ],
      },
      {
        id: "msg-reglement",
        channelId: "reglement",
        pin: true,
        embeds: [
          {
            title: "📜 Règlement de la communauté",
            description: "Ces règles s’ajoutent aux [Conditions d’utilisation](https://discord.com/terms) et aux [Règles de la communauté](https://discord.com/guidelines) de Discord.",
            fields: [
              { name: "1. Bienveillance", value: "Aucune insulte, moquerie ou harcèlement, envers les membres comme envers le créateur ou d’autres créateurs." },
              { name: "2. Pas de drama", value: "Les conflits avec d’autres communautés restent en dehors du serveur. Pas de raid, pas d’appel au harcèlement." },
              { name: "3. Vie privée", value: "Ne partage aucune information personnelle sur le créateur, son entourage ou les membres. Les MP non sollicités au créateur ne sont pas acceptés." },
              { name: "4. Pas d’autopromo", value: "Pas de lien vers ta chaîne ou ton serveur sans accord de l’équipe." },
              { name: "5. Spoilers", value: "Les vidéos et lives non sortis pour tout le monde ne se partagent pas hors des {#coulisses}. Masque les spoilers avec ||texte||." },
              { name: "6. Contenu approprié", value: "Aucun contenu choquant, sexuel ou illégal, y compris dans les fan-arts." },
              { name: "7. Chat du live", value: "Pas de spam ni de messages répétés pendant les lives : le mode lent est là pour que tout le monde soit lu." },
              { name: "8. Sanctions", value: "De l’avertissement au bannissement selon la gravité. Contestation via {#support}." },
            ],
            footer: "En restant sur le serveur, tu acceptes ce règlement.",
          },
        ],
      },
      {
        id: "msg-notifs",
        channelId: "roles",
        embeds: [{ title: "🔔 Tes notifications", description: "Clique sur un bouton pour être prévenu (ou ne plus l’être). Tu peux changer d’avis à tout moment." }],
        buttons: [
          { action: "role-toggle", roleId: "notif-lives", label: "Lives", emoji: "🔴", style: "danger" },
          { action: "role-toggle", roleId: "notif-videos", label: "Nouvelles vidéos", emoji: "🎬", style: "primary" },
          { action: "role-toggle", roleId: "notif-events", label: "Watch parties & événements", emoji: "📅", style: "secondary" },
        ],
      },
      {
        id: "msg-plateformes",
        channelId: "roles",
        embeds: [{ title: "📺 Où nous suis-tu ?", description: "Indique ta plateforme préférée : ça aide l’équipe à savoir où publier en priorité. Un nouveau clic retire le rôle." }],
        buttons: [
          { action: "role-toggle", roleId: "fan-youtube", label: "YouTube", emoji: "▶️" },
          { action: "role-toggle", roleId: "fan-twitch", label: "Twitch", emoji: "🟣" },
          { action: "role-toggle", roleId: "fan-tiktok", label: "TikTok & formats courts", emoji: "📱" },
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
              { name: "Quand sortent les vidéos ?", value: "Elles sont annoncées dans {#videos}. Active la notification avec {#roles}." },
              { name: "Comment obtenir le rôle Soutien ?", value: "Le rôle {@soutien} est attribué par l’équipe aux abonnés et membres de la chaîne. Ouvre un ticket dans {#support} avec une preuve d’abonnement." },
              { name: "Le créateur lit-il le serveur ?", value: "Oui, régulièrement ! Les questions de {#questions} et les idées de {#idees-videos} sont consultées par l’équipe." },
              { name: "Comment proposer une collaboration ?", value: "Ouvre un ticket dans {#support} : les demandes professionnelles sont transmises." },
              { name: "Puis-je partager un clip ?", value: "Oui, dans {#clips}, avec le lien et le timecode." },
            ],
          },
        ],
      },
      {
        id: "msg-support",
        channelId: "support",
        embeds: [{ title: "🎫 Besoin de l’équipe ?", description: "Signalement, demande de rôle Soutien, proposition pro… Clique sur le bouton : un fil privé s’ouvre entre toi et l’équipe de modération." }],
        buttons: [{ action: "ticket-open", label: "Ouvrir un ticket", emoji: "🎫", style: "primary" }],
      },
      {
        id: "msg-idees",
        channelId: "idees-videos",
        embeds: [{ title: "💡 Une idée de vidéo ?", description: "Concept, défi, invité, sujet de live : clique sur le bouton. Ton idée sera publiée ici et la communauté votera 👍 / 👎." }],
        buttons: [{ action: "suggestion-open", label: "Proposer une idée", emoji: "💡" }],
      },
      {
        id: "msg-coulisses",
        channelId: "coulisses",
        pin: true,
        embeds: [
          {
            title: "💎 Bienvenue dans les coulisses",
            description: "Merci pour ton soutien ! Ici tu trouveras des avant-premières, des sondages sur les prochains contenus et des moments plus détendus avec l’équipe. Ce qui est partagé ici reste ici.",
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
              { name: "Échelle des sanctions", value: "1. Rappel à l’ordre\n2. Avertissement\n3. Exclusion temporaire\n4. Bannissement (harcèlement, doxxing, raid)" },
              { name: "Pendant les lives", value: "Au moins un modérateur sur {#chat-live}. Activez un mode lent plus long en cas d’afflux." },
              { name: "Rôle Soutien", value: "Vérifier la preuve d’abonnement avant d’attribuer {@soutien}." },
              { name: "AutoMod et logs", value: "Alertes dans {#alertes}, arrivées et départs dans {#logs}. Planning dans {#planning}." },
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
        trigger: { type: "mention_spam", mentionLimit: 4, raidProtection: true },
        actions: [{ type: "block", customMessage: "Trop de mentions dans un seul message." }, { type: "alert", channelId: "alertes" }, { type: "timeout", durationSeconds: 1800 }],
        exemptRoles: ["createur", "moderateur", "equipe"],
      },
      {
        id: "am-presets",
        name: "Insultes graves et contenu sexuel",
        trigger: { type: "keyword_preset", presets: ["slurs", "sexual_content"] },
        actions: [{ type: "block", customMessage: "Ce message enfreint le règlement." }, { type: "alert", channelId: "alertes" }],
      },
      {
        id: "am-arnaques",
        name: "Arnaques, faux concours et invitations",
        trigger: {
          type: "keyword",
          keywords: ["*nitro gratuit*", "*free nitro*", "*discord.gift*", "*concours officiel*", "*tu as gagné*", "*giveaway gratuit*", "*steam gift*"],
          regexPatterns: ["(discord\\.gg|discord(app)?\\.com/invite)/[a-zA-Z0-9-]+"],
        },
        actions: [{ type: "block", customMessage: "Liens suspects et faux concours interdits. Les vrais concours sont annoncés par l’équipe." }, { type: "alert", channelId: "alertes" }],
        exemptRoles: ["createur", "moderateur", "equipe"],
      },
    ],
    onboarding: {
      enabled: true,
      mode: "default",
      defaultChannelIds: ["bienvenue", "reglement", "videos", "lives", "general", "presentations", "clips", "fan-art", "questions", "hors-sujet"],
      prompts: [
        {
          id: "q-notifs",
          title: "Pour quoi veux-tu être prévenu ?",
          type: "multiple_choice",
          singleSelect: false,
          required: false,
          inOnboarding: true,
          options: [
            { id: "o-notif-lives", title: "Les lives", emoji: "🔴", roleIds: ["notif-lives"], channelIds: ["chat-live"] },
            { id: "o-notif-videos", title: "Les nouvelles vidéos", emoji: "🎬", roleIds: ["notif-videos"], channelIds: [] },
            { id: "o-notif-events", title: "Watch parties et événements", emoji: "📅", roleIds: ["notif-events"], channelIds: ["watch-party"] },
          ],
        },
        {
          id: "q-envies",
          title: "Qu’as-tu envie de faire ici ?",
          type: "multiple_choice",
          singleSelect: false,
          required: false,
          inOnboarding: true,
          options: [
            { id: "o-creer", title: "Partager mes créations", emoji: "🎨", roleIds: [], channelIds: ["fan-art", "clips"] },
            { id: "o-idees", title: "Proposer des idées de vidéos", emoji: "💡", roleIds: [], channelIds: ["idees-videos"] },
            { id: "o-discuter", title: "Discuter pendant les lives", emoji: "💬", roleIds: [], channelIds: ["chat-live", "vocal-detente"] },
          ],
        },
        {
          id: "q-plateforme",
          title: "Où suis-tu la chaîne le plus souvent ?",
          type: "multiple_choice",
          singleSelect: false,
          required: false,
          inOnboarding: true,
          options: [
            { id: "o-youtube", title: "YouTube", description: "Vidéos longues et premières", emoji: "▶️", roleIds: ["fan-youtube"], channelIds: ["videos"] },
            { id: "o-twitch", title: "Twitch", description: "Lives et rediffusions", emoji: "🟣", roleIds: ["fan-twitch"], channelIds: ["lives", "chat-live"] },
            { id: "o-tiktok", title: "TikTok & formats courts", description: "TikTok, Shorts et Reels", emoji: "📱", roleIds: ["fan-tiktok"], channelIds: ["clips"] },
          ],
        },
      ],
    },
    welcomeScreen: {
      enabled: true,
      description: "La communauté officielle : vidéos, lives, fan-arts et discussions entre abonnés.",
      channels: [
        { channelId: "reglement", description: "Lire le règlement", emoji: "📜" },
        { channelId: "videos", description: "Les dernières vidéos", emoji: "🎬" },
        { channelId: "general", description: "Discuter avec la commu", emoji: "💬" },
        { channelId: "fan-art", description: "Partager tes fan-arts", emoji: "🎨" },
        { channelId: "questions", description: "Poser une question", emoji: "🎤" },
      ],
    },
    serverGuide: {
      welcomeMessage: "Bienvenue dans la communauté officielle ! Active tes notifications pour ne rater aucune vidéo ni aucun live, puis viens discuter.",
      newMemberActions: [
        { title: "Lire le règlement", channelId: "reglement", description: "Bienveillance et pas de drama." },
        { title: "Se présenter", channelId: "presentations", description: "Depuis quand suis-tu la chaîne ?" },
        { title: "Poser une question", channelId: "questions", description: "Elle sera peut-être dans la prochaine FAQ." },
      ],
      resourceChannels: [
        { title: "Nouvelles vidéos", channelId: "videos" },
        { title: "Planning des lives", channelId: "lives" },
        { title: "Questions fréquentes", channelId: "faq" },
        { title: "Contacter l’équipe", channelId: "support" },
      ],
    },
    features: {
      welcome: {
        enabled: true,
        channelId: "bienvenue",
        message: "Bienvenue {user} dans la communauté **{server}** ! Tu es notre {memberCount}e membre 🎉 Active tes notifications dans {#roles} pour ne rater aucun live.",
      },
      joinLogs: { enabled: true, channelId: "logs" },
      tickets: { enabled: true, channelId: "support", staffRoleIds: ["moderateur", "createur"], intro: "Merci pour ton message ! Explique ta demande ici : seule l’équipe de modération lit ce fil." },
      suggestions: { enabled: true, channelId: "idees-videos" },
    },
  },
};
