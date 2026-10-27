import type { PermissionKey } from "../permissions";
import { BRAND, PERMS, adminPerms, forum, moderatorPerms, own, privateTo, readOnly, text, voice, type TemplateDefinition } from "./helpers";

const INTERNE = ["direction", "chef-projet", "equipe", "stagiaire"];
const STAFF = ["direction", "chef-projet"];
const WRITE: PermissionKey[] = ["SEND_MESSAGES", "SEND_MESSAGES_IN_THREADS", "CREATE_PUBLIC_THREADS", "CREATE_PRIVATE_THREADS"];
type Ow = { target: string; allow: PermissionKey[]; deny: PermissionKey[] };

/** Lisible par toute l’équipe interne, rédigé uniquement par certains rôles. */
const interneReadOnly = (writers: string[]): Ow[] => [
  { target: "everyone", allow: [], deny: ["VIEW_CHANNEL", ...WRITE] },
  ...INTERNE.map((r) => ({
    target: r,
    allow: (writers.includes(r) ? ["VIEW_CHANNEL", "READ_MESSAGE_HISTORY", "SEND_MESSAGES", "SEND_MESSAGES_IN_THREADS"] : ["VIEW_CHANNEL", "READ_MESSAGE_HISTORY"]) as PermissionKey[],
    deny: [] as PermissionKey[],
  })),
];

/** Espace client : lisible par les clients, publication par la direction et les chefs de projet. */
const clientReadOnly = (): Ow[] => [
  { target: "everyone", allow: [], deny: ["VIEW_CHANNEL", ...WRITE] },
  { target: "client", allow: ["VIEW_CHANNEL", "READ_MESSAGE_HISTORY", "ADD_REACTIONS"], deny: [] },
  ...STAFF.map((r) => ({ target: r, allow: ["VIEW_CHANNEL", "SEND_MESSAGES", "SEND_MESSAGES_IN_THREADS", "ATTACH_FILES"] as PermissionKey[], deny: [] as PermissionKey[] })),
];

export const professionnel: TemplateDefinition = {
  slug: "projet-pro",
  name: "Équipe & projet professionnel",
  tagline: "Un espace de travail privé pour votre équipe, vos pôles et vos clients.",
  description:
    "Un serveur privé pour une startup, une agence, une équipe de freelances ou un projet professionnel : annonces internes, standup quotidien en forum, un salon par pôle (développement, design, marketing), documentation tenue à jour, espace client cloisonné, salles de réunion vocales et un espace de direction avec logs.",
  theme: "professionnel",
  size: "small",
  audience: "Startups, agences, collectifs de freelances et équipes projet de 3 à 100 personnes qui veulent un espace de travail structuré et un accès client contrôlé.",
  highlights: [
    "Serveur privé : un nouvel arrivant ne voit que l’accueil tant que la direction ne lui a pas attribué de rôle",
    "Standup quotidien en forum et un salon par pôle, mentionnables grâce aux rôles à boutons",
    "Espace client cloisonné : livrables et suivi de projet visibles uniquement par les clients invités",
    "AutoMod contre la fuite d’identifiants et de mots de passe dans les messages",
    "Support interne par tickets privés, boîte à idées et logs pour la direction",
  ],
  popularity: 69,
  spec: {
    version: 1,
    meta: {
      name: "Espace d’équipe",
      description: "Serveur privé d’équipe professionnelle : pôles, standup, documentation et espace client.",
      theme: "professionnel",
      size: "small",
      tone: "professionnel et vouvoiement",
      audience: "Équipe interne, stagiaires et clients invités",
      accentColor: BRAND.blue,
    },
    settings: {
      verificationLevel: "medium",
      explicitContentFilter: "all_members",
      defaultNotifications: "only_mentions",
      community: false,
      systemChannelId: "bienvenue",
      suppressJoinNotifications: true,
      suppressBoostNotifications: true,
      suppressSetupTips: true,
    },
    everyone: { permissions: PERMS.member },
    roles: [
      { id: "direction", name: "🏢 Direction", color: 0xf2c14e, hoist: true, mentionable: true, permissions: adminPerms(), staff: true, description: "Administre le serveur, attribue les rôles et gère les accès clients." },
      { id: "chef-projet", name: "🧭 Chef de projet", color: BRAND.blue, hoist: true, mentionable: true, permissions: moderatorPerms(), staff: true, description: "Pilote les projets, tient la documentation et anime l’espace client." },
      { id: "equipe", name: "👥 Équipe", color: BRAND.periwinkle, hoist: true, mentionable: true, permissions: PERMS.member, description: "Collaborateurs et collaboratrices : accès à tout l’espace interne." },
      { id: "stagiaire", name: "🌱 Stagiaire", color: 0x7ed6a5, hoist: true, mentionable: true, permissions: PERMS.member, description: "Accès à l’espace interne, sans l’espace client ni l’espace direction." },
      { id: "client", name: "🤝 Client (invité)", color: 0xb0b7c3, hoist: true, permissions: [], description: "Invité externe : ne voit que l’accueil et l’espace client." },
      { id: "pole-dev", name: "💻 Pôle Dev", selfAssignable: true, mentionable: true, description: "Développement, technique, infrastructure." },
      { id: "pole-design", name: "🎨 Pôle Design", selfAssignable: true, mentionable: true, description: "UX, UI, identité visuelle." },
      { id: "pole-marketing", name: "📈 Pôle Marketing", selfAssignable: true, mentionable: true, description: "Communication, contenus, acquisition." },
      { id: "notif-deploiements", name: "🚀 Notif déploiements", selfAssignable: true, description: "Mentionné à chaque mise en production." },
    ],
    categories: [
      {
        id: "cat-accueil",
        name: "📌 Accueil",
        overwrites: readOnly(["direction"]),
        channels: [
          text("bienvenue", "👋・bienvenue", "Bienvenue ! La direction vous attribuera vos accès sous peu.", { purpose: "welcome" }),
          text("charte", "📜・charte", "Charte d’utilisation du serveur : confidentialité, communication et bonnes pratiques.", { purpose: "rules" }),
          text("organisation", "🧭・qui-fait-quoi", "L’organisation de l’équipe et les bons interlocuteurs.", { purpose: "info" }),
        ],
      },
      {
        id: "cat-entreprise",
        name: "🏢 Entreprise",
        overwrites: privateTo(INTERNE),
        channels: [
          text("annonces", "📣・annonces-internes", "Informations officielles de la direction.", { purpose: "announcements", ...own(interneReadOnly(STAFF)) }),
          text("general", "💬・général", "Échanges de l’équipe.", { purpose: "general" }),
          forum("standup", "📝・standup", "Chaque matin : une publication par personne — hier, aujourd’hui, points bloquants. Tag « Bloquant » si vous avez besoin d’aide.", [
            { name: "Standup", emoji: "☀️" },
            { name: "Bloquant", emoji: "🚧" },
            { name: "Résolu", emoji: "✅", moderated: true },
          ]),
          text("planning", "🗓️・planning", "Jalons, sprints, congés et réunions importantes.", { purpose: "events", ...own(interneReadOnly(STAFF)) }),
          text("documentation", "📚・documentation", "Process, accès, conventions et liens vers les outils. Tenue à jour par les chefs de projet.", { purpose: "info", ...own(interneReadOnly(STAFF)) }),
          text("roles", "🎭・pôles-et-notifications", "Rejoignez votre pôle et activez les notifications utiles.", { purpose: "roles" }),
          text("support", "🎫・support-interne", "Accès, matériel, RH : ouvrez un ticket privé.", { purpose: "support" }),
          text("idees", "💡・boîte-à-idées", "Proposez une amélioration avec le bouton.", {
            purpose: "suggestions",
            ...own([
              { target: "everyone", allow: [], deny: ["VIEW_CHANNEL", "SEND_MESSAGES", "CREATE_PUBLIC_THREADS"] },
              ...INTERNE.map((r) => ({ target: r, allow: ["VIEW_CHANNEL", "ADD_REACTIONS", "SEND_MESSAGES_IN_THREADS"] as PermissionKey[], deny: [] as PermissionKey[] })),
            ]),
          }),
        ],
      },
      {
        id: "cat-poles",
        name: "🧩 Pôles",
        overwrites: privateTo(INTERNE),
        channels: [
          text("dev", "💻・développement", "Revues de code, architecture, incidents techniques."),
          text("design", "🎨・design", "Maquettes, retours et bibliothèque de composants."),
          text("marketing", "📈・marketing", "Campagnes, contenus, statistiques."),
          text("deploiements", "🚀・déploiements", "Journal des mises en production : version, contenu, responsable.", { ...own(interneReadOnly(["chef-projet", "direction", "equipe"])) }),
        ],
      },
      {
        id: "cat-clients",
        name: "🤝 Espace client",
        overwrites: privateTo(["client", ...STAFF]),
        channels: [
          text("espace-client", "🤝・échanges-client", "Questions et échanges avec nos clients. Réponse sous un jour ouvré."),
          text("livrables", "📦・livrables", "Livrables publiés par l’équipe projet.", { ...own(clientReadOnly()) }),
          text("suivi", "📅・suivi-de-projet", "Avancement, jalons et prochaines étapes.", { ...own(clientReadOnly()) }),
          voice("visio-client", "📞 Visio client"),
        ],
      },
      {
        id: "cat-vocaux",
        name: "🔊 Réunions",
        overwrites: privateTo(INTERNE),
        channels: [
          voice("reunion", "🎙️ Réunion d’équipe"),
          voice("focus", "🎧 Focus (micro coupé)", {
            ...own([
              { target: "everyone", allow: [], deny: ["VIEW_CHANNEL", "SPEAK"] },
              ...INTERNE.map((r) => ({ target: r, allow: ["VIEW_CHANNEL", "CONNECT"] as PermissionKey[], deny: [] as PermissionKey[] })),
            ]),
          }),
          voice("cafe", "☕ Machine à café"),
        ],
      },
      {
        id: "cat-direction",
        name: "🔒 Direction",
        overwrites: privateTo(STAFF),
        channels: [
          text("direction-discussion", "🗂️・direction", "Décisions, recrutements et sujets confidentiels.", { purpose: "staff" }),
          text("alertes", "🚨・alertes-automod", "Alertes de modération automatique.", { purpose: "mod-logs" }),
          text("logs", "📋・logs-arrivées", "Arrivées et départs du serveur : vérifiez chaque nouvel accès.", { purpose: "logs" }),
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
            title: "Bienvenue dans l’espace de {server} 👋",
            description:
              "Ce serveur est l’espace de travail de l’équipe. Il est privé : vos accès sont attribués par {@direction}.\n\n**En attendant :**\n1. Prenez connaissance de la {#charte}\n2. Consultez {#organisation} pour savoir à qui vous adresser\n3. Une fois vos accès ouverts, rejoignez votre pôle dans {#roles}",
            fields: [
              { name: "Vous êtes client ?", value: "Votre interlocuteur vous donnera accès à l’espace client, avec vos livrables et le suivi de votre projet." },
            ],
            footer: "Bonne collaboration !",
          },
        ],
      },
      {
        id: "msg-charte",
        channelId: "charte",
        pin: true,
        embeds: [
          {
            title: "📜 Charte d’utilisation",
            description: "Cette charte complète vos engagements contractuels, les [Conditions d’utilisation](https://discord.com/terms) et les [Règles de la communauté](https://discord.com/guidelines) de Discord.",
            fields: [
              { name: "1. Confidentialité", value: "Les informations échangées ici sont confidentielles. Aucune capture ni transfert à l’extérieur sans accord de la direction." },
              { name: "2. Données sensibles", value: "Ne partagez jamais de mot de passe, clé d’API ou donnée personnelle de client dans un salon : utilisez le gestionnaire de secrets de l’entreprise." },
              { name: "3. Données clients (RGPD)", value: "Les données personnelles de clients ne transitent que dans les outils prévus, jamais dans le chat." },
              { name: "4. Communication", value: "Un sujet = le bon salon. Utilisez les fils pour les discussions longues et mentionnez un pôle plutôt que tout le monde." },
              { name: "5. Horaires", value: "Personne n’est tenu de répondre en dehors de ses horaires de travail. Préférez les messages programmés." },
              { name: "6. Respect", value: "Courtoisie en toutes circonstances, en interne comme avec les clients." },
              { name: "7. Accès", value: "Les accès sont attribués et retirés par la direction. Signalez tout accès inhabituel via {#support}." },
            ],
            footer: "L’utilisation du serveur vaut acceptation de cette charte.",
          },
        ],
      },
      {
        id: "msg-organisation",
        channelId: "organisation",
        pin: true,
        embeds: [
          {
            title: "🧭 Qui fait quoi",
            description: "Complétez ce message avec les noms de chaque référent.",
            fields: [
              { name: "🏢 Direction", value: "Stratégie, recrutements, accès au serveur : {@direction}" },
              { name: "🧭 Chefs de projet", value: "Planning, priorités, relation client : {@chef-projet}" },
              { name: "💻 Développement", value: "Référent technique : {@pole-dev}" },
              { name: "🎨 Design", value: "Référent design : {@pole-design}" },
              { name: "📈 Marketing", value: "Référent marketing : {@pole-marketing}" },
            ],
          },
        ],
      },
      {
        id: "msg-roles",
        channelId: "roles",
        embeds: [{ title: "🎭 Pôles et notifications", description: "Rejoignez un ou plusieurs pôles pour être mentionné sur les sujets qui vous concernent. Un nouveau clic retire le rôle." }],
        buttons: [
          { action: "role-toggle", roleId: "pole-dev", label: "Développement", emoji: "💻" },
          { action: "role-toggle", roleId: "pole-design", label: "Design", emoji: "🎨" },
          { action: "role-toggle", roleId: "pole-marketing", label: "Marketing", emoji: "📈" },
          { action: "role-toggle", roleId: "notif-deploiements", label: "Déploiements", emoji: "🚀", style: "primary" },
        ],
      },
      {
        id: "msg-standup",
        channelId: "documentation",
        pin: true,
        embeds: [
          {
            title: "📚 Rituels de l’équipe",
            fields: [
              { name: "Standup quotidien", value: "Avant 10 h, une publication dans {#standup} : hier, aujourd’hui, points bloquants." },
              { name: "Mises en production", value: "Chaque déploiement est consigné dans {#deploiements} (version, contenu, responsable)." },
              { name: "Réunion d’équipe", value: "Chaque lundi dans le salon vocal Réunion d’équipe. Ordre du jour dans {#planning}." },
              { name: "Besoin d’aide ?", value: "Accès, matériel ou question RH : ouvrez un ticket dans {#support}." },
            ],
          },
        ],
      },
      {
        id: "msg-support",
        channelId: "support",
        embeds: [{ title: "🎫 Support interne", description: "Cliquez sur le bouton pour ouvrir un fil privé avec la direction et les chefs de projet : accès, matériel, congés ou toute question confidentielle." }],
        buttons: [{ action: "ticket-open", label: "Ouvrir une demande", emoji: "🎫", style: "primary" }],
      },
      {
        id: "msg-idees",
        channelId: "idees",
        embeds: [{ title: "💡 Boîte à idées", description: "Un outil, un process ou une habitude à améliorer ? Cliquez sur le bouton : votre idée sera publiée ici et soumise au vote de l’équipe." }],
        buttons: [{ action: "suggestion-open", label: "Proposer une idée", emoji: "💡" }],
      },
      {
        id: "msg-client",
        channelId: "espace-client",
        pin: true,
        embeds: [
          {
            title: "🤝 Bienvenue dans votre espace client",
            description: "Retrouvez ici vos échanges avec l’équipe projet. Les livrables sont publiés dans {#livrables} et l’avancement dans {#suivi}. Votre chef de projet ({@chef-projet}) vous répond sous un jour ouvré.",
          },
        ],
      },
      {
        id: "msg-direction",
        channelId: "direction-discussion",
        pin: true,
        embeds: [
          {
            title: "🗂️ Mémo de la direction",
            fields: [
              { name: "Arrivées", value: "Vérifiez chaque arrivée dans {#logs}, puis attribuez {@equipe}, {@stagiaire} ou {@client}." },
              { name: "Départs", value: "Retirez les rôles le jour du départ d’un collaborateur ou de la fin d’une mission client." },
              { name: "Alertes", value: "Une alerte dans {#alertes} concernant un identifiant ou un mot de passe impose de révoquer le secret immédiatement." },
            ],
          },
        ],
      },
    ],
    automod: [
      { id: "am-spam", name: "Anti-spam", trigger: { type: "spam" }, actions: [{ type: "block" }, { type: "alert", channelId: "alertes" }] },
      {
        id: "am-mentions",
        name: "Mentions excessives",
        trigger: { type: "mention_spam", mentionLimit: 8, raidProtection: true },
        actions: [{ type: "block", customMessage: "Trop de mentions dans un seul message." }, { type: "alert", channelId: "alertes" }],
        exemptRoles: STAFF,
      },
      {
        id: "am-secrets",
        name: "Fuite d’identifiants",
        trigger: {
          type: "keyword",
          keywords: ["*mot de passe :*", "*mdp :*", "*password:*"],
          regexPatterns: ["(?i)(api[_-]?key|secret|token)\\s*[:=]\\s*\\S{12,}", "-----BEGIN [A-Z ]*PRIVATE KEY-----"],
        },
        actions: [{ type: "block", customMessage: "Ce message semble contenir un secret. Utilisez le gestionnaire de mots de passe." }, { type: "alert", channelId: "alertes" }],
      },
    ],
    features: {
      welcome: {
        enabled: true,
        channelId: "bienvenue",
        message: "Bienvenue {user} ! Prenez connaissance de la {#charte} : la direction vous attribuera vos accès très prochainement.",
      },
      joinLogs: { enabled: true, channelId: "logs" },
      tickets: { enabled: true, channelId: "support", staffRoleIds: ["direction", "chef-projet"], intro: "Merci pour votre demande. Décrivez votre besoin : la direction ou un chef de projet vous répondra dans ce fil privé." },
      suggestions: { enabled: true, channelId: "idees" },
    },
  },
};
