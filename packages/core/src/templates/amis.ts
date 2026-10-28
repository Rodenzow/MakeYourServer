import { PERMS, adminPerms, announcement, forum, moderatorPerms, own, privateTo, readOnly, text, voice, type TemplateDefinition } from "./helpers";

const STAFF = ["admin", "gardien"];

export const amis: TemplateDefinition = {
  slug: "entre-amis",
  name: "QG entre amis",
  tagline: "Le repaire de ta bande : on papote, on rigole et on cale les prochaines sorties.",
  description:
    "Un serveur chaleureux et sans prise de tête pour une bande d’amis : discussions, mèmes, photos et souvenirs, forum pour organiser les sorties, sondages, anniversaires, musique, soirées jeux en vocal et un coin calme. Règlement court, modération légère et rôles fun à choisir soi-même.",
  theme: "amis",
  size: "small",
  audience: "Bandes de potes, groupes de colocs, anciens camarades ou cousins (5 à 50 personnes) qui veulent un QG simple pour rester en contact et se voir plus souvent.",
  highlights: [
    "Forum « sorties & plans » avec tags resto, ciné, voyage, soirée jeux, sport…",
    "Salons photos & souvenirs, mèmes, bons plans et playlist partagée",
    "Onboarding : centres d’intérêt, notifications (sorties, soirées jeux, anniversaires) et ambiance",
    "Règlement court et bienveillant, un rôle « Gardien » pour une modération légère",
    "Vocaux pour traîner, jouer ensemble ou se poser dans le coin calme",
  ],
  popularity: 78,
  spec: {
    version: 1,
    meta: {
      name: "QG entre amis",
      description: "Serveur pour une bande d’amis : discussions, mèmes, souvenirs, sorties, sondages, anniversaires et vocaux.",
      theme: "amis",
      size: "small",
      tone: "complice, chaleureux, tutoiement",
      audience: "Bandes d’amis de 5 à 50 personnes",
      accentColor: 0xf4a261,
    },
    settings: {
      verificationLevel: "low",
      explicitContentFilter: "all_members",
      defaultNotifications: "only_mentions",
      community: true,
      description: "Le QG de la bande : on discute, on partage nos souvenirs et on organise nos sorties.",
      systemChannelId: "bienvenue",
      rulesChannelId: "reglement",
      publicUpdatesChannelId: "maj-discord",
      safetyAlertsChannelId: "alertes",
      suppressJoinNotifications: true,
      suppressSetupTips: true,
    },
    everyone: { permissions: PERMS.member },
    roles: [
      { id: "admin", name: "🔑 Admin du QG", color: 0xe76f51, hoist: true, mentionable: true, permissions: adminPerms(), staff: true, description: "Crée les salons, gère les rôles et garde les clés du QG." },
      { id: "gardien", name: "🛡️ Gardien", color: 0x2a9d8f, hoist: true, mentionable: true, permissions: moderatorPerms(), staff: true, description: "Veille à la bonne ambiance, calme le jeu si besoin et répond aux demandes d’aide." },
      { id: "jeux", name: "🎮 Gamer", color: 0x8ecae6, selfAssignable: true, description: "Jeux vidéo, jeux de société, soirées jeux en vocal." },
      { id: "cine", name: "🍿 Ciné & séries", color: 0xffb703, selfAssignable: true, description: "Films, séries, recommandations et soirées ciné." },
      { id: "sport", name: "⚽ Sportif", color: 0x90be6d, selfAssignable: true, description: "Matchs, footing, rando, foot du dimanche." },
      { id: "musique", name: "🎶 Mélomane", color: 0xcdb4db, selfAssignable: true, description: "Playlists, concerts et découvertes musicales." },
      { id: "cuisine", name: "🍳 Cuistot", color: 0xf4a261, selfAssignable: true, description: "Recettes, bons restos et apéros maison." },
      { id: "voyage", name: "✈️ Baroudeur", color: 0x219ebc, selfAssignable: true, description: "Week-ends, road trips et vacances entre potes." },
      { id: "notif-sorties", name: "📅 Notif sorties", selfAssignable: true, description: "Prévenu quand une sortie est proposée." },
      { id: "notif-jeux", name: "🎲 Notif soirées jeux", selfAssignable: true, description: "Prévenu quand une soirée jeux se lance en vocal." },
      { id: "notif-anniv", name: "🎂 Notif anniversaires", selfAssignable: true, description: "Prévenu le jour de l’anniversaire d’un membre de la bande." },
    ],
    categories: [
      {
        id: "cat-accueil",
        name: "🏠 Accueil",
        overwrites: readOnly(STAFF),
        channels: [
          text("bienvenue", "👋・bienvenue", "Les nouvelles têtes arrivent ici. Viens dire coucou dans #général !", { purpose: "welcome" }),
          text("reglement", "📜・règlement", "Quelques règles simples pour que tout le monde se sente bien.", { purpose: "rules" }),
          announcement("annonces", "📣・annonces", "Les infos importantes du QG et le mode d’emploi des sorties.", { purpose: "announcements" }),
          text("roles", "🎭・rôles", "Choisis tes centres d’intérêt et tes notifications.", { purpose: "roles" }),
          text("aide", "🆘・besoin-d-aide", "Un souci, une question ou un malaise ? Ouvre un fil privé avec les Gardiens.", { purpose: "support" }),
        ],
      },
      {
        id: "cat-qg",
        name: "💬 Le QG",
        overwrites: [],
        channels: [
          text("general", "💬・général", "On papote de tout et de rien.", { purpose: "general" }),
          text("memes", "😂・mèmes", "Mèmes, vidéos drôles et private jokes de la bande.", { purpose: "media" }),
          text("photos", "📸・photos-souvenirs", "Les photos de nos sorties, vacances et moments mémorables.", { purpose: "media" }),
          forum("sorties", "🗓️・sorties-et-plans", "Une publication = un plan. Indique quoi, où, quand et combien ça coûte, ajoute le bon tag, et réponds dans le fil si tu viens. Mets le tag « C’est calé » quand tout est organisé.", [
            { name: "Resto", emoji: "🍽️" },
            { name: "Ciné", emoji: "🎬" },
            { name: "Voyage", emoji: "✈️" },
            { name: "Soirée jeux", emoji: "🎲" },
            { name: "Sport", emoji: "⚽" },
            { name: "Concert", emoji: "🎤" },
            { name: "Balade", emoji: "🌳" },
            { name: "À la maison", emoji: "🏠" },
            { name: "C’est calé", emoji: "✅" },
          ], { defaultReaction: "🙋", purpose: "events" }),
          text("sondages", "📊・sondages", "Date, resto, film du soir : lance un sondage Discord et laisse la bande trancher."),
          text("anniversaires", "🎂・anniversaires", "Les dates d’anniversaire de chacun et les messages pour souhaiter."),
          text("bons-plans", "💸・bons-plans", "Promos, places pas chères, bonnes adresses : partage tes trouvailles.", { slowmode: 30 }),
          text("idees", "💡・idées-pour-le-qg", "Une idée de salon, de sortie récurrente ou de règle ? Propose-la avec le bouton.", {
            purpose: "suggestions",
            ...own([{ target: "everyone", allow: ["ADD_REACTIONS", "SEND_MESSAGES_IN_THREADS"], deny: ["SEND_MESSAGES", "CREATE_PUBLIC_THREADS"] }]),
          }),
        ],
      },
      {
        id: "cat-passions",
        name: "🎨 Nos passions",
        overwrites: [],
        channels: [
          text("salon-jeux", "🎮・jeux", "Jeux vidéo, jeux de société, qui est chaud pour une partie ce soir ?"),
          text("salon-cine", "🍿・ciné-et-séries", "Recommandations, avis et théories (spoilers masqués avec ||texte||)."),
          text("salon-musique", "🎶・musique-et-playlist", "Partage tes sons et alimente la playlist commune de la bande."),
          text("salon-cuisine", "🍳・cuisine-et-restos", "Recettes, photos de plats et bonnes adresses."),
        ],
      },
      {
        id: "cat-vocaux",
        name: "🔊 Vocaux & détente",
        overwrites: [],
        channels: [
          text("coin-calme", "🌿・coin-calme", "Un espace doux pour souffler, parler de sa journée ou partager un truc qui fait du bien.", { slowmode: 60 }),
          voice("vocal-salon", "🛋️ Le canapé"),
          voice("vocal-jeux", "🎮 Soirée jeux", { userLimit: 10 }),
          voice("vocal-calme", "🌙 Coin calme", { userLimit: 4 }),
        ],
      },
      {
        id: "cat-staff",
        name: "🛡️ Gardiens",
        overwrites: privateTo(STAFF),
        channels: [
          text("staff", "🗂️・entre-gardiens", "Coordination entre admins et Gardiens. Rien ne sort d’ici.", { purpose: "staff" }),
          text("maj-discord", "📢・mises-à-jour-discord", "Messages officiels de Discord destinés aux modérateurs.", { purpose: "updates" }),
          text("alertes", "🚨・alertes-automod", "Alertes AutoMod et alertes de sécurité.", { purpose: "mod-logs" }),
          text("logs", "📋・logs-arrivées", "Arrivées et départs des membres (bot Make Your Server).", { purpose: "logs" }),
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
            title: "Bienvenue au QG de {server} ! 🏠",
            description:
              "Ici c’est chez nous : on discute, on se marre et on organise nos prochaines retrouvailles.\n\n**Pour bien démarrer :**\n1. Jette un œil au {#reglement} (c’est court, promis)\n2. Choisis tes centres d’intérêt dans {#roles}\n3. Viens dire coucou dans {#general}\n4. Propose ou rejoins une sortie dans {#sorties}",
            fields: [
              { name: "Ton anniversaire", value: "Note ta date dans {#anniversaires} pour qu’on ne l’oublie jamais 🎂" },
              { name: "Un souci ?", value: "Les {@gardien} sont là pour toi : ouvre un fil privé dans {#aide}." },
            ],
            footer: "Fais comme chez toi !",
          },
        ],
      },
      {
        id: "msg-reglement",
        channelId: "reglement",
        pin: true,
        embeds: [
          {
            title: "📜 Les règles du QG",
            description:
              "On est entre amis, donc pas besoin d’un roman. Ces quelques règles s’ajoutent aux [Conditions d’utilisation](https://discord.com/terms) et aux [Règles de la communauté](https://discord.com/guidelines) de Discord.",
            fields: [
              { name: "1. Bienveillance avant tout", value: "On se taquine, mais on ne blesse pas. Si une blague met quelqu’un mal à l’aise, on arrête et on s’excuse." },
              { name: "2. Ce qui se passe au QG reste au QG", value: "Pas de captures d’écran ni de photos de quelqu’un partagées ailleurs sans son accord." },
              { name: "3. Contenu correct", value: "Rien de choquant ni de contenu pour adultes. Les spoilers se masquent avec ||texte||." },
              { name: "4. Chaque chose à sa place", value: "Les plans dans {#sorties}, les photos dans {#photos}, les mèmes dans {#memes}. Simple." },
              { name: "5. On en parle", value: "Un conflit ou un malaise ? Parles-en directement ou ouvre un fil dans {#aide} : un {@gardien} t’aidera à apaiser les choses." },
            ],
            footer: "En restant sur le serveur, tu acceptes ces règles. Merci d’être là ❤️",
          },
        ],
      },
      {
        id: "msg-roles-interets",
        channelId: "roles",
        embeds: [{ title: "🎨 Tes centres d’intérêt", description: "Clique pour prendre ou retirer un rôle : ça montre aux autres ce qui te branche et ça aide à monter des sorties." }],
        buttons: [
          { action: "role-toggle", roleId: "jeux", label: "Jeux", emoji: "🎮" },
          { action: "role-toggle", roleId: "cine", label: "Ciné & séries", emoji: "🍿" },
          { action: "role-toggle", roleId: "sport", label: "Sport", emoji: "⚽" },
          { action: "role-toggle", roleId: "musique", label: "Musique", emoji: "🎶" },
          { action: "role-toggle", roleId: "cuisine", label: "Cuisine", emoji: "🍳" },
        ],
      },
      {
        id: "msg-roles-notifs",
        channelId: "roles",
        embeds: [{ title: "🔔 Tes notifications", description: "Choisis pour quoi tu veux être mentionné. Tu peux tout retirer à tout moment." }],
        buttons: [
          { action: "role-toggle", roleId: "notif-sorties", label: "Sorties", emoji: "📅", style: "primary" },
          { action: "role-toggle", roleId: "notif-jeux", label: "Soirées jeux", emoji: "🎲", style: "primary" },
          { action: "role-toggle", roleId: "notif-anniv", label: "Anniversaires", emoji: "🎂", style: "primary" },
          { action: "role-toggle", roleId: "voyage", label: "Voyages", emoji: "✈️" },
        ],
      },
      {
        id: "msg-sorties",
        channelId: "annonces",
        pin: true,
        embeds: [
          {
            title: "🗓️ Comment organiser une sortie",
            description: "Toutes les sorties se proposent dans le forum {#sorties}. Une publication = un plan.",
            fields: [
              { name: "1. Propose", value: "Crée une publication avec le quoi, le où, le quand et le budget. Ajoute le bon tag (Resto, Ciné, Voyage, Soirée jeux…)." },
              { name: "2. Préviens", value: "Mentionne {@notif-sorties} (ou {@notif-jeux} pour une soirée jeux) pour prévenir celles et ceux que ça intéresse." },
              { name: "3. Choisis ensemble", value: "Pas d’accord sur la date ou le lieu ? Lance un sondage dans {#sondages}." },
              { name: "4. C’est calé !", value: "Ajoute le tag « C’est calé » et récapitule l’heure et le lieu dans le fil. Après la sortie, les photos vont dans {#photos} 📸" },
            ],
          },
        ],
      },
      {
        id: "msg-anniversaires",
        channelId: "anniversaires",
        pin: true,
        embeds: [
          {
            title: "🎂 Les anniversaires de la bande",
            description:
              "Écris ici ta date d’anniversaire (jour et mois suffisent) pour que personne ne l’oublie.\n\nLe jour J, on mentionne {@notif-anniv} et on inonde la personne de messages ! Pour organiser une fête, crée un plan dans {#sorties}.",
          },
        ],
      },
      {
        id: "msg-aide",
        channelId: "aide",
        embeds: [
          {
            title: "🆘 Besoin d’en parler ?",
            description: "Un malaise avec quelqu’un, une question sur le serveur, un truc qui te tracasse ? Clique sur le bouton : un fil privé s’ouvre entre toi et les Gardiens. Personne d’autre ne le voit.",
          },
        ],
        buttons: [{ action: "ticket-open", label: "Ouvrir un fil privé", emoji: "💬", style: "primary" }],
      },
      {
        id: "msg-idees",
        channelId: "idees",
        embeds: [{ title: "💡 Une idée pour le QG ?", description: "Nouveau salon, sortie récurrente, tradition de la bande ? Clique sur le bouton : ton idée sera publiée ici et soumise au vote 👍 / 👎." }],
        buttons: [{ action: "suggestion-open", label: "Proposer une idée", emoji: "💡" }],
      },
      {
        id: "msg-staff",
        channelId: "staff",
        pin: true,
        embeds: [
          {
            title: "🗂️ Mémo des Gardiens",
            fields: [
              { name: "Esprit", value: "On est entre amis : on privilégie toujours la discussion et l’apaisement avant toute sanction." },
              { name: "En cas de souci", value: "1. Un mot gentil en privé\n2. Rappel du règlement\n3. Exclusion temporaire si ça dégénère\n4. Bannissement en dernier recours, décidé avec {@admin}" },
              { name: "Fils d’aide", value: "Réponds aux fils ouverts depuis {#aide} dans la journée, avec douceur et discrétion." },
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
        name: "Trop de mentions",
        trigger: { type: "mention_spam", mentionLimit: 5, raidProtection: true },
        actions: [{ type: "block", customMessage: "Doucement sur les mentions !" }, { type: "alert", channelId: "alertes" }, { type: "timeout", durationSeconds: 300 }],
        exemptRoles: STAFF,
      },
      {
        id: "am-presets",
        name: "Insultes graves et contenu sexuel",
        trigger: { type: "keyword_preset", presets: ["slurs", "sexual_content"] },
        actions: [{ type: "block", customMessage: "Ce message enfreint les règles du QG." }, { type: "alert", channelId: "alertes" }],
      },
      {
        id: "am-arnaques",
        name: "Liens d’arnaque",
        trigger: {
          type: "keyword",
          keywords: ["*nitro gratuit*", "*free nitro*", "*discord.gift*", "*steam gift*", "*cadeau gratuit*"],
          regexPatterns: [],
        },
        actions: [{ type: "block", customMessage: "Ce lien ressemble à une arnaque : il a été bloqué." }, { type: "alert", channelId: "alertes" }],
        exemptRoles: STAFF,
      },
    ],
    onboarding: {
      enabled: true,
      mode: "default",
      defaultChannelIds: ["bienvenue", "reglement", "annonces", "general", "memes", "photos", "sorties", "sondages", "anniversaires", "bons-plans"],
      prompts: [
        {
          id: "q-interets",
          title: "Qu’est-ce qui te branche ?",
          type: "multiple_choice",
          singleSelect: false,
          required: false,
          inOnboarding: true,
          options: [
            { id: "o-jeux", title: "Jeux vidéo & jeux de société", description: "Parties en ligne, soirées jeux en vocal ou autour d’une table.", emoji: "🎮", roleIds: ["jeux"], channelIds: ["salon-jeux"] },
            { id: "o-cine", title: "Ciné & séries", description: "Recos, avis et soirées ciné.", emoji: "🍿", roleIds: ["cine"], channelIds: ["salon-cine"] },
            { id: "o-sport", title: "Sport", description: "Matchs, footing, rando et foot du dimanche.", emoji: "⚽", roleIds: ["sport"], channelIds: [] },
            { id: "o-musique", title: "Musique", description: "Playlists, concerts et découvertes.", emoji: "🎶", roleIds: ["musique"], channelIds: ["salon-musique"] },
            { id: "o-cuisine", title: "Cuisine & restos", description: "Recettes, bonnes adresses et apéros maison.", emoji: "🍳", roleIds: ["cuisine"], channelIds: ["salon-cuisine"] },
            { id: "o-voyage", title: "Voyages & week-ends", description: "Road trips et vacances entre potes.", emoji: "✈️", roleIds: ["voyage"], channelIds: [] },
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
            { id: "o-notif-sorties", title: "Les sorties proposées", description: "Resto, ciné, concert, voyage…", emoji: "📅", roleIds: ["notif-sorties"], channelIds: [] },
            { id: "o-notif-jeux", title: "Les soirées jeux", description: "Quand une partie se lance en vocal.", emoji: "🎲", roleIds: ["notif-jeux"], channelIds: ["salon-jeux"] },
            { id: "o-notif-anniv", title: "Les anniversaires", description: "Pour ne jamais rater celui d’un pote.", emoji: "🎂", roleIds: ["notif-anniv"], channelIds: [] },
          ],
        },
        {
          id: "q-ambiance",
          title: "Tu viens surtout pour…",
          type: "multiple_choice",
          singleSelect: false,
          required: false,
          inOnboarding: true,
          options: [
            { id: "o-rigoler", title: "Rigoler et partager des mèmes", emoji: "😂", roleIds: [], channelIds: ["memes"] },
            { id: "o-souvenirs", title: "Garder nos souvenirs", emoji: "📸", roleIds: [], channelIds: ["photos"] },
            { id: "o-bons-plans", title: "Dénicher des bons plans", emoji: "💸", roleIds: [], channelIds: ["bons-plans"] },
            { id: "o-calme", title: "Me poser au calme", description: "Un coin doux pour souffler et parler de sa journée.", emoji: "🌿", roleIds: [], channelIds: ["coin-calme"] },
          ],
        },
      ],
    },
    welcomeScreen: {
      enabled: true,
      description: "Le QG de la bande : on papote, on partage nos souvenirs et on organise nos sorties.",
      channels: [
        { channelId: "reglement", description: "Lire les règles (c’est court)", emoji: "📜" },
        { channelId: "general", description: "Dire coucou à la bande", emoji: "💬" },
        { channelId: "sorties", description: "Proposer ou rejoindre une sortie", emoji: "🗓️" },
        { channelId: "photos", description: "Voir nos souvenirs", emoji: "📸" },
        { channelId: "anniversaires", description: "Noter ton anniversaire", emoji: "🎂" },
      ],
    },
    serverGuide: {
      welcomeMessage: "Bienvenue au QG ! Choisis tes centres d’intérêt, viens dire coucou dans le général et rejoins la prochaine sortie.",
      newMemberActions: [
        { title: "Lire les règles", channelId: "reglement", description: "Cinq règles simples et bienveillantes." },
        { title: "Dire coucou", channelId: "general", description: "Viens papoter avec la bande." },
        { title: "Noter ton anniversaire", channelId: "anniversaires", description: "Pour qu’on te le souhaite le jour J." },
        { title: "Rejoindre une sortie", channelId: "sorties", description: "Propose un plan ou inscris-toi à un existant." },
      ],
      resourceChannels: [
        { title: "Organiser une sortie", channelId: "annonces" },
        { title: "Choisir ses rôles", channelId: "roles" },
        { title: "Lancer un sondage", channelId: "sondages" },
        { title: "Parler aux Gardiens", channelId: "aide" },
      ],
    },
    features: {
      welcome: {
        enabled: true,
        channelId: "bienvenue",
        message: "Hey {user}, bienvenue au QG de **{server}** ! On est maintenant {memberCount} dans la bande 🎉 Jette un œil au {#reglement}, choisis tes rôles dans {#roles} et viens dire coucou dans {#general}. Une question ? Les {@gardien} sont là pour toi.",
      },
      joinLogs: { enabled: true, channelId: "logs" },
      tickets: { enabled: true, channelId: "aide", staffRoleIds: ["gardien", "admin"], intro: "Merci de nous écrire ! Raconte-nous ce qui se passe, tranquillement : seuls les Gardiens lisent ce fil." },
      suggestions: { enabled: true, channelId: "idees" },
    },
  },
};
