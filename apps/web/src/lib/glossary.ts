/**
 * Glossaire : définitions simples du vocabulaire Discord et Make Your Server.
 * Utilisé par la page /aide/glossaire et par le composant <Term id="…">.
 * Règles d’écriture : phrases courtes, vouvoiement, aucun mot technique non expliqué.
 */

export interface GlossaryEntry {
  /** Identifiant stable, utilisé comme ancre (#role) et par <Term id="role">. */
  id: string;
  /** Le mot tel qu’il s’affiche en titre. */
  term: string;
  /** Définition courte (une ou deux phrases), affichée dans l’infobulle. */
  short: string;
  /** Explication complémentaire, affichée sur la page du glossaire. */
  more?: string;
  /** Exemple concret. */
  example?: string;
  /** Autres termes utiles (identifiants). */
  related?: string[];
  /** Regroupement sur la page du glossaire. */
  group: GlossaryGroup;
}

export type GlossaryGroup = "discord" | "droits" | "accueil" | "mys";

export const GLOSSARY_GROUPS: Array<{ id: GlossaryGroup; title: string; intro: string }> = [
  { id: "discord", title: "Les bases de Discord", intro: "Ce qui compose un serveur Discord." },
  { id: "droits", title: "Rôles et droits", intro: "Qui peut voir quoi, et qui peut faire quoi." },
  { id: "accueil", title: "Accueil et modération", intro: "Les outils de Discord pour accueillir et protéger vos membres." },
  { id: "mys", title: "Make Your Server", intro: "Le vocabulaire de notre site." },
];

export const GLOSSARY: GlossaryEntry[] = [
  /* ------------------------------ Bases Discord ------------------------------ */
  {
    id: "serveur",
    term: "Serveur",
    group: "discord",
    short: "Un espace de discussion sur Discord, avec ses membres, ses salons et ses règles. C’est ce que Make Your Server installe pour vous.",
    more: "Un serveur appartient à une personne (le propriétaire). Vous pouvez en créer un gratuitement dans Discord, en quelques secondes.",
    example: "Le serveur de votre club de jeux, de votre classe ou de votre communauté.",
    related: ["salon", "role"],
  },
  {
    id: "salon",
    term: "Salon",
    group: "discord",
    short: "Un espace de discussion à l’intérieur d’un serveur. Il peut être écrit (textuel) ou vocal.",
    more: "Chaque salon a un nom, un sujet et ses propres règles d’accès. Les salons textuels commencent par le symbole #.",
    example: "#règlement, #discussion-générale, 🔊 Salon vocal.",
    related: ["categorie", "vocal", "forum", "salon-annonces"],
  },
  {
    id: "categorie",
    term: "Catégorie",
    group: "discord",
    short: "Un dossier qui regroupe plusieurs salons sous un même titre, pour ranger le serveur.",
    more: "Une catégorie peut transmettre ses droits d’accès aux salons qu’elle contient. Discord limite chaque catégorie à 50 salons.",
    example: "La catégorie « Bienvenue » regroupe #règlement et #présentations.",
    related: ["salon"],
  },
  {
    id: "salon-annonces",
    term: "Salon d’annonces",
    group: "discord",
    short: "Un salon où seuls certains rôles publient. Les autres serveurs peuvent « suivre » ses messages.",
    more: "Ce type de salon n’existe que si la Communauté Discord est activée. Sinon, Make Your Server crée un salon textuel classique à la place.",
    related: ["communaute", "salon"],
  },
  {
    id: "forum",
    term: "Forum",
    group: "discord",
    short: "Un salon organisé en sujets : chaque membre ouvre un sujet, et les réponses restent rangées dessous.",
    example: "Un forum « Entraide » où chaque question devient un sujet séparé.",
    related: ["salon", "fil"],
  },
  {
    id: "vocal",
    term: "Salon vocal",
    group: "discord",
    short: "Un salon où l’on parle à voix haute, avec ou sans caméra, au lieu d’écrire.",
    related: ["salon", "conference"],
  },
  {
    id: "conference",
    term: "Salon de conférence",
    group: "discord",
    short: "Un salon vocal fait pour les événements : quelques personnes parlent sur scène, les autres écoutent.",
    more: "Comme le salon d’annonces, il demande que la Communauté Discord soit activée.",
    related: ["vocal", "communaute"],
  },
  {
    id: "fil",
    term: "Fil",
    group: "discord",
    short: "Une petite conversation ouverte à partir d’un message, pour discuter d’un sujet sans encombrer le salon.",
    more: "Les tickets de Make Your Server utilisent des fils privés.",
    related: ["ticket", "forum"],
  },
  {
    id: "embed",
    term: "Message enrichi (embed)",
    group: "discord",
    short: "Un message mis en forme dans un encadré coloré, avec un titre, du texte et parfois une image.",
    example: "Le règlement de votre serveur, présenté dans un encadré bleu avec un titre.",
  },
  {
    id: "webhook",
    term: "Webhook",
    group: "discord",
    short: "Une adresse qui permet de publier un message dans un salon sous un nom et un avatar choisis.",
    more: "Make Your Server s’en sert pour republier des messages sauvegardés (Premium), en indiquant leur auteur et leur date d’origine.",
    related: ["restauration"],
  },

  /* ------------------------------ Rôles et droits ----------------------------- */
  {
    id: "role",
    term: "Rôle",
    group: "droits",
    short: "Une étiquette donnée à des membres (par exemple « Modérateur »). Elle fixe ce qu’ils peuvent voir et faire.",
    more: "Un membre peut avoir plusieurs rôles. Le rôle peut aussi colorer son pseudo et le classer dans la liste des membres.",
    example: "« Membre », « Modérateur », « Administrateur ».",
    related: ["permission", "hierarchie", "everyone"],
  },
  {
    id: "permission",
    term: "Permission",
    group: "droits",
    short: "Un droit précis accordé à un rôle : lire un salon, écrire, supprimer des messages, exclure un membre…",
    more: "Une permission peut être donnée à tout le serveur, ou seulement dans un salon (on parle alors de permission particulière).",
    related: ["role", "surcharge", "administrateur"],
  },
  {
    id: "surcharge",
    term: "Permission particulière d’un salon",
    group: "droits",
    short: "Une règle qui change les droits d’un rôle dans un seul salon. Par exemple : cacher le salon du staff aux membres.",
    more: "Dans l’éditeur, chaque permission a trois états : autorisée, refusée, ou « comme le reste du serveur ».",
    related: ["permission", "role"],
  },
  {
    id: "everyone",
    term: "@everyone",
    group: "droits",
    short: "Le rôle que tout le monde possède automatiquement. Ses droits s’appliquent à chaque membre du serveur.",
    more: "Pour cacher un salon à tous, on retire « Voir le salon » à @everyone, puis on le rend à certains rôles.",
    related: ["role", "permission"],
  },
  {
    id: "hierarchie",
    term: "Hiérarchie des rôles",
    group: "droits",
    short: "L’ordre des rôles, du plus haut au plus bas. Un rôle ne peut gérer que les rôles placés en dessous de lui.",
    more: "Le bot suit la même règle : son rôle doit être placé au-dessus des rôles qu’il doit créer ou modifier. Vous pouvez le remonter dans Paramètres du serveur → Rôles.",
    related: ["role", "bot"],
  },
  {
    id: "administrateur",
    term: "Administrateur (permission)",
    group: "droits",
    short: "La permission qui donne tous les droits sur le serveur. Elle est nécessaire pour activer la Communauté Discord.",
    more: "Nous conseillons de la donner au bot le temps de l’installation, puis de la retirer si vous le souhaitez.",
    related: ["permission", "communaute", "gerer-serveur"],
  },
  {
    id: "gerer-serveur",
    term: "Gérer le serveur (permission)",
    group: "droits",
    short: "La permission qui autorise à modifier les réglages d’un serveur. Il vous la faut pour installer un projet.",
    more: "Restaurer une sauvegarde, supprimer des éléments ou activer la Communauté demandent en plus d’être Administrateur ou propriétaire du serveur.",
    related: ["permission", "administrateur"],
  },

  /* --------------------------- Accueil et modération -------------------------- */
  {
    id: "communaute",
    term: "Communauté Discord",
    group: "accueil",
    short: "Une option gratuite de Discord pour les serveurs publics. Elle débloque l’onboarding, l’écran d’accueil, les salons d’annonces et de conférence.",
    more: "Elle demande un salon de règlement et un salon de mises à jour. Le bot l’active automatiquement s’il est Administrateur ; sinon, un guide vous explique comment faire.",
    related: ["onboarding", "ecran-accueil", "salon-annonces"],
  },
  {
    id: "onboarding",
    term: "Onboarding",
    group: "accueil",
    short: "Les questions que Discord pose aux nouveaux membres à leur arrivée. Leurs réponses leur donnent des rôles et ouvrent des salons.",
    more: "L’onboarding demande la Communauté Discord et au moins 7 salons par défaut, dont 5 où tout le monde peut écrire.",
    example: "« À quels jeux jouez-vous ? » → le membre coche « Minecraft » et voit les salons Minecraft.",
    related: ["communaute", "ecran-accueil"],
  },
  {
    id: "ecran-accueil",
    term: "Écran d’accueil",
    group: "accueil",
    short: "La fenêtre de bienvenue que Discord montre aux nouveaux membres, avec une courte description et jusqu’à 5 salons conseillés.",
    related: ["communaute", "onboarding"],
  },
  {
    id: "guide-serveur",
    term: "Guide du serveur",
    group: "accueil",
    short: "Une page de Discord qui présente le serveur et ses premières actions. Discord ne permet pas aux bots de la remplir.",
    more: "Make Your Server prépare son contenu ; vous le copiez vous-même en quelques minutes grâce à l’assistant affiché après l’installation.",
    related: ["communaute"],
  },
  {
    id: "automod",
    term: "AutoMod",
    group: "accueil",
    short: "Le filtre automatique de Discord. Il bloque des mots interdits, le spam ou les mentions en masse, même quand personne ne modère.",
    more: "Discord limite à 6 règles de mots-clés par serveur, et à une règle de chaque autre type.",
    related: ["permission"],
  },
  {
    id: "ticket",
    term: "Ticket",
    group: "accueil",
    short: "Une conversation privée entre un membre et l’équipe, ouverte d’un clic sur un bouton. Utile pour une question ou un signalement.",
    more: "Les tickets sont assurés par notre bot : ils fonctionnent tant que le bot reste sur votre serveur.",
    related: ["bot", "fil"],
  },
  {
    id: "bot",
    term: "Bot",
    group: "accueil",
    short: "Un compte automatique qui agit sur un serveur. Le bot Make Your Server crée vos salons et rôles, puis gère les boutons, tickets et messages de bienvenue.",
    more: "Un bot ne fait que ce que ses permissions autorisent. Vous pouvez le retirer du serveur à tout moment.",
    related: ["permission", "hierarchie", "ticket"],
  },

  /* ------------------------------ Make Your Server ---------------------------- */
  {
    id: "template",
    term: "Template",
    group: "mys",
    short: "Un modèle de serveur prêt à l’emploi : salons, rôles, permissions et messages déjà pensés pour un usage.",
    more: "Les templates sont publics et gratuits. Quand vous en choisissez un, une copie personnelle est créée : votre projet.",
    example: "Le template « Gaming » pour une communauté de joueurs.",
    related: ["projet"],
  },
  {
    id: "projet",
    term: "Projet",
    group: "mys",
    short: "Votre version personnelle d’un serveur, privée et modifiable dans l’éditeur. C’est ce que le bot installe.",
    more: "Un projet est enregistré automatiquement sur votre compte. Vous pouvez l’installer sur plusieurs serveurs.",
    related: ["template", "installation"],
  },
  {
    id: "installation",
    term: "Installation",
    group: "mys",
    short: "Le moment où le bot applique votre projet sur un vrai serveur Discord, étape par étape, après votre confirmation.",
    related: ["analyse", "projet", "sauvegarde-securite"],
  },
  {
    id: "analyse",
    term: "Analyse",
    group: "mys",
    short: "La vérification faite avant toute installation : le site lit votre serveur et vous montre ce qui va changer. Rien n’est modifié à ce stade.",
    related: ["installation", "simulation"],
  },
  {
    id: "simulation",
    term: "Simulation",
    group: "mys",
    short: "Une installation « pour de faux », sur une copie de votre serveur. Vous voyez le résultat sans rien changer sur Discord.",
    related: ["analyse", "installation"],
  },
  {
    id: "mode-serveur-vide",
    term: "Mode « Serveur vide »",
    group: "mys",
    short: "Le mode à choisir pour un serveur tout neuf. Si un salon créé par Discord au départ porte le même nom qu’un salon du projet, il est réutilisé et configuré.",
    more: "Les autres éléments déjà présents sont conservés, sauf si vous choisissez de les archiver ou de les supprimer dans les options avancées.",
    related: ["mode-fusion", "installation"],
  },
  {
    id: "mode-fusion",
    term: "Mode fusion (« Ajout à un serveur existant »)",
    group: "mys",
    short: "Le mode à choisir pour un serveur déjà utilisé. Votre projet s’ajoute à ce qui existe. Rien n’est supprimé ni modifié sans votre accord.",
    more: "Si un salon ou un rôle porte déjà le même nom, il est réutilisé tel quel. Vous pouvez choisir un autre comportement pendant l’analyse.",
    related: ["mode-serveur-vide", "mode-cible"],
  },
  {
    id: "mode-cible",
    term: "Mode « Modification ciblée »",
    group: "mys",
    short: "Le mode qui n’installe que les éléments que vous cochez, plus ce dont ils ont besoin pour fonctionner.",
    example: "Ajouter seulement la catégorie « Événements » à un serveur déjà prêt.",
    related: ["mode-fusion"],
  },
  {
    id: "archivage",
    term: "Archivage d’un salon",
    group: "mys",
    short: "Ranger un salon dans une catégorie « 📦 Archives » cachée aux membres. Ses messages sont conservés, contrairement à une suppression.",
    related: ["restauration"],
  },
  {
    id: "sauvegarde",
    term: "Sauvegarde",
    group: "mys",
    short: "Une photo de la structure de votre serveur à un instant donné : salons, rôles, permissions, réglages. Elle reste privée.",
    more: "Elle ne contient pas l’historique des messages. Avec le Premium, vous pouvez y ajouter les derniers messages de quelques salons choisis.",
    related: ["sauvegarde-securite", "restauration"],
  },
  {
    id: "sauvegarde-securite",
    term: "Sauvegarde de sécurité",
    group: "mys",
    short: "Une sauvegarde prise automatiquement par le bot juste avant chaque installation ou restauration. Elle est gratuite.",
    related: ["sauvegarde", "restauration"],
  },
  {
    id: "restauration",
    term: "Restauration",
    group: "mys",
    short: "Remettre en place la structure enregistrée dans une sauvegarde : les éléments disparus sont recréés, les autres reprennent leurs réglages.",
    more: "Ce n’est pas une remise à l’identique : un salon recréé est un nouveau salon, et l’historique d’un salon supprimé est perdu.",
    related: ["sauvegarde", "webhook"],
  },
  {
    id: "premium",
    term: "Premium",
    group: "mys",
    short: "L’offre payante de Make Your Server : conception par IA, plus de projets et de sauvegardes, sauvegardes programmées et restauration sélective.",
    more: "Tout ce qu’il faut pour installer un serveur complet reste gratuit. Le Premium est lié à votre compte et vaut pour tous vos serveurs.",
    related: ["sauvegarde"],
  },
];

const BY_ID = new Map(GLOSSARY.map((e) => [e.id, e]));

export function getGlossaryEntry(id: string): GlossaryEntry | undefined {
  return BY_ID.get(id);
}
