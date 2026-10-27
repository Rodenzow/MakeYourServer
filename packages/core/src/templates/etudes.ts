import { BRAND, PERMS, adminPerms, announcement, forum, moderatorPerms, own, privateTo, readOnly, text, voice, type TemplateDefinition } from "./helpers";

const STAFF = ["admin", "delegues"];

export const etudes: TemplateDefinition = {
  slug: "etudes",
  name: "Promo & révisions",
  tagline: "Une promo organisée : cours, entraide, ressources et sessions de révision.",
  description:
    "Le serveur d’une classe, d’une promo ou d’un groupe de révision : un salon par matière, un forum d’entraide tagué par matière, des ressources et un planning d’examens tenus par les délégués, des salles d’étude vocales et un onboarding qui oriente chaque étudiant selon son année et ses matières.",
  theme: "etudes",
  size: "medium",
  audience: "Promotions universitaires, classes préparatoires, BTS, lycées ou groupes de révision de 15 à 500 étudiants, encadrés par des délégués ou des tuteurs.",
  highlights: [
    "Onboarding : chaque étudiant choisit son année, ses matières et ses rappels d’examens",
    "Forum d’entraide avec un tag par matière et un tag « Résolu » réservé à l’équipe",
    "Ressources et planning des examens publiés par les délégués, en lecture seule",
    "Salles d’étude vocales, dont une salle silencieuse pour travailler en mode concentration",
    "Tickets privés vers les délégués, suggestions et AutoMod contre le spam",
  ],
  popularity: 81,
  spec: {
    version: 1,
    meta: {
      name: "Promo & révisions",
      description: "Serveur de promotion étudiante : matières, entraide, ressources, planning et salles d’étude.",
      theme: "etudes",
      size: "medium",
      tone: "bienveillant et tutoiement",
      audience: "Étudiants d’une même promotion",
      accentColor: BRAND.periwinkle,
    },
    settings: {
      verificationLevel: "low",
      explicitContentFilter: "all_members",
      defaultNotifications: "only_mentions",
      community: true,
      description: "Le serveur de la promo : cours, entraide, ressources et révisions en groupe.",
      systemChannelId: "bienvenue",
      rulesChannelId: "reglement",
      publicUpdatesChannelId: "maj-discord",
      safetyAlertsChannelId: "alertes",
      suppressJoinNotifications: true,
      suppressSetupTips: true,
    },
    everyone: { permissions: PERMS.member },
    roles: [
      { id: "admin", name: "🛠️ Administration", color: 0xe5534b, hoist: true, mentionable: true, permissions: adminPerms(), staff: true, description: "Gère le serveur : salons, rôles et réglages." },
      { id: "delegues", name: "🎓 Délégués", color: BRAND.blue, hoist: true, mentionable: true, permissions: moderatorPerms(), staff: true, description: "Relaient les informations de l’administration, tiennent le planning et modèrent." },
      { id: "tuteur", name: "🧑‍🏫 Tuteur", color: 0x57c785, hoist: true, mentionable: true, permissions: [...PERMS.member, "PIN_MESSAGES"], description: "Étudiant·e plus avancé·e qui aide aux révisions et partage des ressources." },
      { id: "annee-1", name: "📗 1re année", color: 0x7ed6a5, selfAssignable: true, description: "Étudiants de première année." },
      { id: "annee-2", name: "📘 2e année", color: 0x83a8f3, selfAssignable: true, description: "Étudiants de deuxième année." },
      { id: "annee-3", name: "📙 3e année", color: 0xf5a25d, selfAssignable: true, description: "Étudiants de troisième année et plus." },
      { id: "notif-examens", name: "⏰ Rappels d’examens", selfAssignable: true, description: "Mentionné pour les rappels de partiels, rendus et inscriptions." },
    ],
    categories: [
      {
        id: "cat-accueil",
        name: "📌 Accueil",
        overwrites: readOnly(["delegues", "admin"]),
        channels: [
          text("bienvenue", "👋・bienvenue", "Bienvenue dans la promo ! Commence par le règlement puis présente-toi.", { purpose: "welcome" }),
          text("reglement", "📜・règlement", "Les règles du serveur de la promo.", { purpose: "rules" }),
          announcement("annonces", "📣・annonces", "Informations officielles : emplois du temps, changements de salle, administration.", { purpose: "announcements" }),
          announcement("planning", "🗓️・planning-examens", "Dates des partiels, rendus de projets et inscriptions, tenues à jour par les délégués.", { purpose: "events" }),
          text("roles", "🎭・rôles", "Indique ton année et active les rappels d’examens.", { purpose: "roles" }),
          text("faq", "❓・faq", "Questions fréquentes sur le serveur et la scolarité.", { purpose: "faq" }),
          text("support", "🎫・contacter-les-délégués", "Un souci personnel, une question délicate ? Ouvre un ticket privé avec les délégués.", { purpose: "support" }),
        ],
      },
      {
        id: "cat-promo",
        name: "💬 La promo",
        overwrites: [],
        channels: [
          text("general", "💬・général", "Discussions de la promo.", { purpose: "general" }),
          text("presentations", "🙋・présentations", "Présente-toi : prénom, parcours, ce que tu aimes (ou pas) dans les études.", { slowmode: 300, purpose: "introductions" }),
          text("objectifs", "🎯・objectifs-du-jour", "Annonce tes objectifs de travail de la journée et coche-les le soir. La motivation est contagieuse !"),
          text("detente", "☕・hors-cours", "Pauses, mèmes, sorties : tout ce qui n’est pas du travail.", { purpose: "media" }),
          text("suggestions", "💡・suggestions", "Une idée pour la promo ou le serveur ? Utilise le bouton.", {
            purpose: "suggestions",
            ...own([{ target: "everyone", allow: ["ADD_REACTIONS", "SEND_MESSAGES_IN_THREADS"], deny: ["SEND_MESSAGES", "CREATE_PUBLIC_THREADS"] }]),
          }),
        ],
      },
      {
        id: "cat-matieres",
        name: "📚 Matières",
        overwrites: [],
        channels: [
          forum("entraide", "🤝・entraide", "Une question = une publication. Choisis le tag de la matière, montre ce que tu as essayé, et remercie qui t’aide !", [
            { name: "Maths", emoji: "📐" },
            { name: "Informatique", emoji: "💻" },
            { name: "Langues", emoji: "🌍" },
            { name: "Lettres & SHS", emoji: "📖" },
            { name: "Méthodologie", emoji: "🧠" },
            { name: "Résolu", emoji: "✅", moderated: true },
          ], { defaultReaction: "🙏" }),
          text("maths", "📐・mathématiques", "Cours, exercices et astuces de maths. Écris les formules en LaTeX ou en photo lisible."),
          text("informatique", "💻・informatique", "Code, algorithmique, outils. Partage ton code entre ```blocs de code```."),
          text("langues", "🌍・langues", "Anglais, espagnol, allemand… Entraînement et ressources."),
          text("lettres", "📖・lettres-et-sciences-humaines", "Dissertations, lectures, histoire, philosophie, économie."),
          text("ressources", "🗃️・ressources", "Fiches, annales et liens utiles validés par les délégués et les tuteurs.", { purpose: "info", ...own(readOnly(["delegues", "tuteur", "admin"])) }),
        ],
      },
      {
        id: "cat-etude",
        name: "🔊 Salles d’étude",
        overwrites: [],
        channels: [
          voice("salle-1", "📚 Salle d’étude 1", { userLimit: 8 }),
          voice("salle-2", "📚 Salle d’étude 2", { userLimit: 8 }),
          voice("salle-silence", "🤫 Salle silencieuse (micro coupé)", {
            ...own([{ target: "everyone", allow: [], deny: ["SPEAK"] }]),
          }),
          voice("pause", "☕ Pause café"),
        ],
      },
      {
        id: "cat-staff",
        name: "🛡️ Délégués",
        overwrites: privateTo(STAFF),
        channels: [
          text("staff", "🗂️・délégués", "Coordination des délégués et de l’administration du serveur.", { purpose: "staff" }),
          text("maj-discord", "📢・mises-à-jour-discord", "Messages officiels de Discord pour les modérateurs.", { purpose: "updates" }),
          text("alertes", "🚨・alertes-automod", "Alertes AutoMod et alertes de sécurité.", { purpose: "mod-logs" }),
          text("logs", "📋・logs-arrivées", "Arrivées et départs.", { purpose: "logs" }),
          voice("staff-vocal", "🔇 Réunion des délégués"),
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
            title: "Bienvenue sur {server} ! 🎓",
            description:
              "Ce serveur est l’espace de travail et d’entraide de la promo.\n\n**Pour bien démarrer :**\n1. Lis le {#reglement}\n2. Indique ton année dans {#roles}\n3. Présente-toi dans {#presentations}\n4. Consulte le {#planning} pour ne rater aucune échéance",
            fields: [
              { name: "Une question de cours ?", value: "Crée une publication dans {#entraide} avec le tag de la matière." },
              { name: "Besoin des délégués ?", value: "{@delegues} te répondent dans {#support}." },
            ],
            footer: "Bon courage pour cette année !",
          },
        ],
      },
      {
        id: "msg-reglement",
        channelId: "reglement",
        pin: true,
        embeds: [
          {
            title: "📜 Règlement de la promo",
            description: "Ces règles complètent le règlement de ton établissement, les [Conditions d’utilisation](https://discord.com/terms) et les [Règles de la communauté](https://discord.com/guidelines) de Discord.",
            fields: [
              { name: "1. Respect", value: "On s’entraide, on ne juge pas. Aucune moquerie sur le niveau ou les questions de quelqu’un." },
              { name: "2. Intégrité académique", value: "Partager des méthodes et des corrections d’exercices, oui. Diffuser des sujets ou réponses d’examens en cours, ou faire le travail noté d’un autre, non." },
              { name: "3. Droits d’auteur", value: "Ne publie pas de manuels, cours payants ou supports protégés sans autorisation de leur auteur." },
              { name: "4. Bons salons", value: "Questions dans {#entraide}, ressources validées dans {#ressources}, détente dans {#detente}." },
              { name: "5. Pas de spam ni de publicité", value: "Pas de flood, de mentions inutiles ni de promotion de services de « devoirs faits »." },
              { name: "6. Vie privée", value: "Ne partage pas les coordonnées, photos ou notes d’autres étudiants ou enseignants." },
              { name: "7. Les délégués modèrent", value: "En cas de problème, ouvre un ticket dans {#support}. Les sanctions vont du rappel à l’exclusion du serveur." },
            ],
            footer: "En restant sur le serveur, tu acceptes ce règlement.",
          },
        ],
      },
      {
        id: "msg-roles-annee",
        channelId: "roles",
        embeds: [{ title: "🎓 Ton année", description: "Clique sur ton année (un clic de plus pour la retirer). Elle permet aux délégués de mentionner les bonnes personnes." }],
        buttons: [
          { action: "role-toggle", roleId: "annee-1", label: "1re année", emoji: "📗" },
          { action: "role-toggle", roleId: "annee-2", label: "2e année", emoji: "📘" },
          { action: "role-toggle", roleId: "annee-3", label: "3e année et +", emoji: "📙" },
        ],
      },
      {
        id: "msg-roles-notifs",
        channelId: "roles",
        embeds: [{ title: "⏰ Rappels d’examens", description: "Active ce rôle pour être mentionné à l’approche des partiels, des rendus et des inscriptions." }],
        buttons: [{ action: "role-toggle", roleId: "notif-examens", label: "Recevoir les rappels", emoji: "⏰", style: "primary" }],
      },
      {
        id: "msg-planning",
        channelId: "planning",
        pin: true,
        embeds: [
          {
            title: "🗓️ Planning des examens",
            description: "Les délégués mettent ce message à jour au fil du semestre. Vérifie toujours les dates sur l’ENT de ton établissement.",
            fields: [
              { name: "Partiels", value: "À compléter : matière — date — salle" },
              { name: "Rendus de projets", value: "À compléter : projet — date limite — modalités" },
              { name: "Inscriptions", value: "À compléter : stages, options, rattrapages" },
            ],
          },
        ],
      },
      {
        id: "msg-ressources",
        channelId: "ressources",
        pin: true,
        embeds: [
          {
            title: "🗃️ Comment sont organisées les ressources",
            description: "Seuls {@delegues} et {@tuteur} publient ici, pour garder une liste fiable. Tu as trouvé une ressource utile ? Propose-la dans {#entraide} avec le tag de la matière.",
          },
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
              { name: "Je ne vois pas le salon de ma matière", value: "Ajoute-le via « Salons et rôles » en haut de la liste des salons, ou parcours tous les salons." },
              { name: "Comment bien poser une question ?", value: "Donne l’énoncé, ce que tu as essayé et où tu bloques. Une photo lisible ou un extrait de code aide beaucoup." },
              { name: "Comment devenir tuteur ?", value: "Propose-toi auprès des délégués via {#support}." },
              { name: "On peut réviser ensemble ?", value: "Oui : rejoins une salle d’étude vocale et annonce-le dans {#general}." },
            ],
          },
        ],
      },
      {
        id: "msg-support",
        channelId: "support",
        embeds: [{ title: "🎫 Contacter les délégués", description: "Clique sur le bouton : un fil privé s’ouvre entre toi et les délégués. Personne d’autre ne peut le lire." }],
        buttons: [{ action: "ticket-open", label: "Ouvrir un ticket", emoji: "🎫", style: "primary" }],
      },
      {
        id: "msg-suggestions",
        channelId: "suggestions",
        embeds: [{ title: "💡 Boîte à idées de la promo", description: "Sortie de promo, séance de révision collective, nouveau salon… Clique sur le bouton pour proposer ton idée : elle sera publiée ici et soumise au vote." }],
        buttons: [{ action: "suggestion-open", label: "Proposer une idée", emoji: "💡" }],
      },
      {
        id: "msg-staff",
        channelId: "staff",
        pin: true,
        embeds: [
          {
            title: "🗂️ Mémo des délégués",
            fields: [
              { name: "Planning", value: "Mettez à jour le message de {#planning} dès qu’une date change, et mentionnez {@notif-examens} une semaine avant chaque échéance." },
              { name: "Ressources", value: "Vérifiez la source et les droits avant de publier dans {#ressources}." },
              { name: "Tickets", value: "Répondez sous 48 h. Les situations personnelles délicates sont orientées vers l’établissement." },
              { name: "Modération", value: "Les alertes AutoMod arrivent dans {#alertes}. Rappel à l’ordre d’abord, exclusion temporaire ensuite." },
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
        trigger: { type: "mention_spam", mentionLimit: 6, raidProtection: true },
        actions: [{ type: "block", customMessage: "Trop de mentions dans un seul message." }, { type: "alert", channelId: "alertes" }, { type: "timeout", durationSeconds: 600 }],
        exemptRoles: STAFF,
      },
      {
        id: "am-presets",
        name: "Insultes graves et contenu sexuel",
        trigger: { type: "keyword_preset", presets: ["slurs", "sexual_content"] },
        actions: [{ type: "block", customMessage: "Ce message enfreint le règlement de la promo." }, { type: "alert", channelId: "alertes" }],
      },
      {
        id: "am-triche",
        name: "Services de triche et liens suspects",
        trigger: {
          type: "keyword",
          keywords: ["*devoirs faits*", "*mémoire clé en main*", "*rédaction de mémoire payante*", "*nitro gratuit*", "*free nitro*"],
          regexPatterns: ["(discord\\.gg|discord(app)?\\.com/invite)/[a-zA-Z0-9-]+"],
        },
        actions: [{ type: "block", customMessage: "Ce type de lien ou de service n’est pas autorisé ici." }, { type: "alert", channelId: "alertes" }],
        exemptRoles: STAFF,
      },
    ],
    onboarding: {
      enabled: true,
      mode: "default",
      defaultChannelIds: ["bienvenue", "reglement", "annonces", "planning", "general", "presentations", "objectifs", "detente", "entraide"],
      prompts: [
        {
          id: "q-annee",
          title: "En quelle année es-tu ?",
          type: "multiple_choice",
          singleSelect: true,
          required: false,
          inOnboarding: true,
          options: [
            { id: "o-annee-1", title: "1re année", emoji: "📗", roleIds: ["annee-1"], channelIds: [] },
            { id: "o-annee-2", title: "2e année", emoji: "📘", roleIds: ["annee-2"], channelIds: [] },
            { id: "o-annee-3", title: "3e année et +", emoji: "📙", roleIds: ["annee-3"], channelIds: [] },
          ],
        },
        {
          id: "q-matieres",
          title: "Quelles matières veux-tu suivre ?",
          type: "multiple_choice",
          singleSelect: false,
          required: false,
          inOnboarding: true,
          options: [
            { id: "o-maths", title: "Mathématiques", emoji: "📐", roleIds: [], channelIds: ["maths"] },
            { id: "o-info", title: "Informatique", emoji: "💻", roleIds: [], channelIds: ["informatique"] },
            { id: "o-langues", title: "Langues", emoji: "🌍", roleIds: [], channelIds: ["langues"] },
            { id: "o-lettres", title: "Lettres & sciences humaines", emoji: "📖", roleIds: [], channelIds: ["lettres"] },
          ],
        },
        {
          id: "q-rappels",
          title: "Veux-tu des rappels d’examens ?",
          type: "multiple_choice",
          singleSelect: true,
          required: false,
          inOnboarding: true,
          options: [{ id: "o-rappels", title: "Oui, préviens-moi", emoji: "⏰", roleIds: ["notif-examens"], channelIds: ["ressources"] }],
        },
      ],
    },
    welcomeScreen: {
      enabled: true,
      description: "L’espace de travail et d’entraide de la promo : cours, ressources, planning et révisions.",
      channels: [
        { channelId: "reglement", description: "Lire le règlement", emoji: "📜" },
        { channelId: "general", description: "Discuter avec la promo", emoji: "💬" },
        { channelId: "entraide", description: "Poser une question de cours", emoji: "🤝" },
        { channelId: "ressources", description: "Trouver fiches et annales", emoji: "🗃️" },
        { channelId: "planning", description: "Voir les prochains examens", emoji: "🗓️" },
      ],
    },
    serverGuide: {
      welcomeMessage: "Bienvenue dans la promo ! Ici on s’entraide, on partage des ressources et on révise ensemble. Présente-toi et consulte le planning des examens.",
      newMemberActions: [
        { title: "Lire le règlement", channelId: "reglement", description: "Notamment la règle sur l’intégrité académique." },
        { title: "Se présenter", channelId: "presentations" },
        { title: "Consulter le planning", channelId: "planning", description: "Les prochaines échéances de la promo." },
      ],
      resourceChannels: [
        { title: "Ressources validées", channelId: "ressources" },
        { title: "Questions fréquentes", channelId: "faq" },
        { title: "Contacter les délégués", channelId: "support" },
      ],
    },
    features: {
      welcome: {
        enabled: true,
        channelId: "bienvenue",
        message: "Bienvenue {user} dans la promo ! 🎓 Présente-toi dans {#presentations} et jette un œil au {#planning}.",
      },
      joinLogs: { enabled: true, channelId: "logs" },
      tickets: { enabled: true, channelId: "support", staffRoleIds: ["delegues"], intro: "Merci pour ton message ! Explique ta situation ici : seuls les délégués peuvent lire ce fil." },
      suggestions: { enabled: true, channelId: "suggestions" },
    },
  },
};
