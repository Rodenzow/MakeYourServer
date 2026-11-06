/**
 * Contenu du centre d’aide (/aide).
 *
 * Chaque réponse est une suite de blocs : un paragraphe (texte), une liste à puces
 * ({ list }) ou des étapes numérotées ({ steps }). Dans le texte :
 *   - [libellé](/lien) crée un lien ;
 *   - {{id|libellé}} affiche un mot du glossaire avec sa définition (voir lib/glossary.ts).
 *
 * Tout ce qui est écrit ici doit correspondre au fonctionnement réel du site :
 * vérifiez dans le code (planner, engine, pages) avant d’ajouter une réponse.
 */

export type HelpBlock = string | { list: string[] } | { steps: string[] };

export interface HelpCategory {
  id: string;
  title: string;
  description: string;
}

export interface HelpQuestion {
  /** Ancre partageable : /aide#id */
  id: string;
  category: string;
  question: string;
  answer: HelpBlock[];
  /** Mots supplémentaires pour la recherche (synonymes, fautes courantes). */
  keywords?: string[];
}

export const HELP_CATEGORIES: HelpCategory[] = [
  { id: "bien-demarrer", title: "Bien démarrer", description: "Ce que fait le site, et par où commencer." },
  { id: "templates-editeur", title: "Templates et éditeur", description: "Choisir un modèle et le modifier à votre goût." },
  { id: "installation", title: "Installation par le bot", description: "Mettre votre projet sur un vrai serveur Discord." },
  { id: "sauvegardes", title: "Sauvegardes et restauration", description: "Garder une copie de votre serveur et la remettre en place." },
  { id: "publier", title: "Publier dans la bibliothèque", description: "Partager votre serveur avec tout le monde." },
  { id: "premium", title: "Premium et paiement", description: "Ce que change l’offre payante, et comment la gérer." },
  { id: "securite", title: "Sécurité et confidentialité", description: "Vos données, vos droits et votre compte." },
  { id: "problemes", title: "Problèmes fréquents", description: "Les blocages les plus courants, et comment les résoudre." },
];

export const HELP_QUESTIONS: HelpQuestion[] = [
  /* ------------------------------- Bien démarrer ------------------------------ */
  {
    id: "c-est-quoi",
    category: "bien-demarrer",
    question: "À quoi sert Make Your Server ?",
    answer: [
      "Make Your Server vous aide à créer un {{serveur|serveur}} Discord complet sans rien connaître à la technique.",
      {
        list: [
          "Vous choisissez un {{template|modèle}} gratuit (gaming, études, entreprise…).",
          "Vous le modifiez dans un éditeur visuel, si vous le souhaitez.",
          "Notre {{bot|bot}} l’installe sur votre serveur Discord : salons, rôles, permissions, messages et règles de modération.",
          "Vous pouvez ensuite sauvegarder votre serveur et le restaurer en cas de problème.",
        ],
      },
    ],
    keywords: ["présentation", "but", "principe"],
  },
  {
    id: "premiers-pas",
    category: "bien-demarrer",
    question: "Par où commencer ?",
    answer: [
      "Comptez une dizaine de minutes pour votre premier serveur.",
      {
        steps: [
          "Choisissez un modèle dans la [bibliothèque de templates](/templates), puis cliquez sur « Utiliser ce template ».",
          "Personnalisez-le dans l’éditeur (facultatif). Tout est enregistré automatiquement.",
          "Créez un serveur dans Discord si vous n’en avez pas, puis invitez notre bot (le site vous guide).",
          "Cliquez sur « Installer » : le site analyse votre serveur, vous vérifiez, puis vous confirmez.",
        ],
      },
      "Le détail de chaque étape est expliqué sur la page [Comment ça marche](/fonctionnement).",
    ],
    keywords: ["débuter", "commencer", "tutoriel", "démarrage"],
  },
  {
    id: "gratuit",
    category: "bien-demarrer",
    question: "Est-ce que c’est gratuit ?",
    answer: [
      "Oui. Tous les templates, l’éditeur, l’installation par le bot et la {{sauvegarde-securite|sauvegarde de sécurité}} sont gratuits, sans limite de temps.",
      "Le [Premium](/abonnement) ajoute la conception par intelligence artificielle et des sauvegardes avancées. Il n’est pas nécessaire pour installer un serveur complet.",
    ],
    keywords: ["prix", "payant", "coût", "tarif"],
  },
  {
    id: "compte",
    category: "bien-demarrer",
    question: "Faut-il créer un compte ?",
    answer: [
      "Vous pouvez parcourir les templates sans compte. Pour enregistrer un projet ou installer un serveur, connectez-vous avec votre compte Discord : il n’y a pas de mot de passe à créer.",
      "Nous recevons seulement votre identité Discord (pseudo, avatar) et la liste de vos serveurs. Nous ne lisons jamais vos messages. Voir [la page de connexion](/connexion).",
    ],
    keywords: ["inscription", "connexion", "login", "s’inscrire"],
  },
  {
    id: "template-projet-sauvegarde",
    category: "bien-demarrer",
    question: "Quelle différence entre un template, un projet et une sauvegarde ?",
    answer: [
      {
        list: [
          "Un {{template|template}} est un modèle public, le même pour tout le monde.",
          "Un {{projet|projet}} est votre copie personnelle et privée d’un template (ou d’un serveur vierge). Vous la modifiez librement.",
          "Une {{sauvegarde|sauvegarde}} est une photo de la structure d’un vrai serveur Discord, prise par le bot.",
        ],
      },
      "Le bot peut installer un projet ou restaurer une sauvegarde sur un serveur que vous gérez.",
    ],
    keywords: ["différence", "vocabulaire"],
  },
  {
    id: "debutant-discord",
    category: "bien-demarrer",
    question: "Je ne connais pas bien Discord. Est-ce un problème ?",
    answer: [
      "Non. Les templates sont déjà configurés : rôles, droits d’accès et messages d’accueil sont prêts. Vous pouvez installer sans rien modifier.",
      "Si un mot vous bloque ({{role|rôle}}, {{permission|permission}}, {{onboarding|onboarding}}…), consultez le [glossaire](/aide/glossaire) : chaque terme y est expliqué simplement.",
    ],
    keywords: ["novice", "débutant", "aide", "comprendre"],
  },

  /* ---------------------------- Templates et éditeur --------------------------- */
  {
    id: "choisir-template",
    category: "templates-editeur",
    question: "Comment choisir un template ?",
    answer: [
      "Dans la [bibliothèque](/templates), filtrez par thème, par taille de communauté ou par fonctionnalité. Chaque fiche montre un aperçu interactif : cliquez sur un salon pour lire ses messages, et choisissez un rôle pour voir ce qu’il voit.",
      "Les templates officiels sont faits par notre équipe. Les templates de la communauté sont proposés par des membres et relus par notre équipe avant publication.",
    ],
    keywords: ["modèle", "bibliothèque", "catalogue"],
  },
  {
    id: "modifier-template",
    category: "templates-editeur",
    question: "Puis-je modifier un template avant de l’installer ?",
    answer: [
      "Oui. Sur la fiche du template, cliquez sur « Utiliser ce template ». Un {{projet|projet}} est créé sur votre compte et s’ouvre dans l’éditeur.",
      "Vous pouvez renommer, ajouter, déplacer ou supprimer des salons, des {{categorie|catégories}} et des {{role|rôles}}, changer les droits d’accès, les messages et les règles de modération. Le template d’origine n’est pas modifié.",
    ],
    keywords: ["personnaliser", "éditer", "changer"],
  },
  {
    id: "enregistrement",
    category: "templates-editeur",
    question: "Mes modifications sont-elles enregistrées ?",
    answer: [
      "Oui, automatiquement, quelques instants après chaque changement. L’indicateur en haut de l’éditeur affiche « Brouillon enregistré » quand tout est à jour.",
      "Vous pouvez aussi annuler ou rétablir vos dernières actions avec les boutons de l’éditeur.",
    ],
    keywords: ["sauvegarder projet", "perdu", "annuler"],
  },
  {
    id: "voir-comme",
    category: "templates-editeur",
    question: "Comment vérifier qui voit quel salon ?",
    answer: [
      "Dans l’aperçu de l’éditeur, choisissez « Voir comme » puis un {{role|rôle}}. L’aperçu montre exactement les salons que ce rôle pourra voir et où il pourra écrire.",
      "C’est la meilleure façon de vérifier qu’un salon réservé à l’équipe est bien caché aux membres.",
    ],
    keywords: ["voir comme ce rôle", "aperçu", "visibilité", "caché", "privé"],
  },
  {
    id: "erreurs-editeur",
    category: "templates-editeur",
    question: "Pourquoi l’éditeur me signale-t-il une erreur ?",
    answer: [
      "L’éditeur vérifie en continu que votre projet respecte les règles de Discord. Par exemple :",
      {
        list: [
          "500 salons au maximum par serveur, et 50 salons par {{categorie|catégorie}} ;",
          "250 {{role|rôles}} au maximum ;",
          "6 règles {{automod|AutoMod}} par mots-clés au maximum ;",
          "l’{{onboarding|onboarding}} demande au moins 7 salons par défaut, dont 5 où tout le monde peut écrire.",
        ],
      },
      "Le message indique l’élément concerné. Un projet qui contient une erreur ne peut pas être installé tant qu’elle n’est pas corrigée.",
    ],
    keywords: ["limite", "trop de salons", "validation", "problème projet"],
  },
  {
    id: "supprimer-role-editeur",
    category: "templates-editeur",
    question: "Que se passe-t-il si je supprime un rôle dans l’éditeur ?",
    answer: [
      "Le rôle est aussi retiré partout où il était utilisé : droits des salons, boutons de rôles, questions de l’{{onboarding|onboarding}}. Votre projet reste cohérent.",
      "Cela ne touche que votre projet. Rien ne change sur Discord avant une installation confirmée.",
    ],
  },
  {
    id: "projet-vierge",
    category: "templates-editeur",
    question: "Puis-je partir de zéro, sans template ?",
    answer: [
      "Oui. Depuis [Mes projets](/projets), créez un nouveau projet. Vous pouvez aussi créer un projet à partir d’une sauvegarde de votre serveur, pour le modifier puis le réinstaller.",
      "Avec le Premium, vous pouvez aussi décrire votre communauté : l’IA propose un serveur complet que vous relisez avant toute installation.",
    ],
    keywords: ["vierge", "vide", "nouveau projet", "ia"],
  },

  /* ------------------------------- Installation ------------------------------ */
  {
    id: "creer-serveur",
    category: "installation",
    question: "Le bot peut-il créer le serveur à ma place ?",
    answer: [
      "Non. Discord ne permet plus aux applications de créer un serveur. C’est vous qui le créez, en 30 secondes :",
      {
        steps: [
          "Dans Discord, cliquez sur le « + » en bas de la liste de vos serveurs.",
          "Choisissez « Créer le mien », puis « Pour moi et mes amis ».",
          "Donnez-lui un nom et validez.",
          "Revenez sur le site et cliquez sur « Actualiser » dans l’assistant d’installation.",
        ],
      },
    ],
    keywords: ["nouveau serveur", "créer un serveur"],
  },
  {
    id: "droits-necessaires",
    category: "installation",
    question: "Quels droits faut-il avoir sur le serveur ?",
    answer: [
      "Pour installer un projet, vous devez avoir la permission {{gerer-serveur|« Gérer le serveur »}} sur ce serveur. Seuls ces serveurs apparaissent dans la liste.",
      "Certaines actions demandent d’être {{administrateur|Administrateur}} ou propriétaire du serveur : restaurer une sauvegarde, supprimer des salons ou des rôles, ou activer la {{communaute|Communauté Discord}}.",
      "Vos droits sont revérifiés par le bot au moment de l’analyse, puis au moment de l’installation.",
    ],
    keywords: ["permission", "accès refusé", "propriétaire", "admin"],
  },
  {
    id: "inviter-bot",
    category: "installation",
    question: "Comment inviter le bot, et quelles permissions lui donner ?",
    answer: [
      "Dans l’assistant d’installation, cliquez sur « Inviter le bot » à côté de votre serveur. Discord vous demande de confirmer.",
      "Le lien demande la permission {{administrateur|Administrateur}}. C’est le seul moyen d’activer la {{communaute|Communauté}} et d’accorder toutes les permissions prévues par vos rôles : Discord interdit à un bot de donner un droit qu’il n’a pas lui-même.",
      "Après l’installation, vous pouvez retirer « Administrateur » au bot. Les boutons, tickets et messages continueront de fonctionner avec « Gérer les rôles », « Gérer les fils » et « Envoyer des messages ».",
      "Vous préférez des permissions limitées ? L’assistant propose aussi une « invitation minimale » : l’analyse vous dira alors ce qui manque.",
    ],
    keywords: ["invitation", "ajouter le bot", "administrateur"],
  },
  {
    id: "modes",
    category: "installation",
    question: "Quel mode d’installation choisir ?",
    answer: [
      {
        list: [
          "{{mode-serveur-vide|Serveur vide}} : pour un serveur tout neuf. C’est le choix le plus simple.",
          "{{mode-fusion|Ajout à un serveur existant}} : pour un serveur déjà utilisé. Votre projet s’ajoute, et tout ce qui existe est conservé.",
          "{{mode-cible|Modification ciblée}} : pour n’installer que quelques éléments choisis (une catégorie, un rôle…).",
        ],
      },
      "Dans tous les cas, rien n’est supprimé si vous ne le demandez pas expressément.",
    ],
    keywords: ["mode fusion", "serveur vide", "ajout", "ciblé", "merge"],
  },
  {
    id: "deja-existant",
    category: "installation",
    question: "Mon serveur a déjà des salons et des rôles. Vont-ils disparaître ?",
    answer: [
      "Non, par défaut tout est conservé. Si un salon ou un rôle porte déjà le même nom qu’un élément du projet, l’analyse vous le signale. Pour chacun, vous choisissez :",
      {
        list: ["le réutiliser sans le modifier (choix par défaut en mode « Ajout ») ;", "le réutiliser et le configurer comme dans le projet ;", "créer un nouvel élément à côté."],
      },
      "Dans les options avancées, vous pouvez aussi demander d’{{archivage|archiver}} ou de supprimer les salons qui ne font pas partie du projet. La suppression demande de retaper le nom du serveur.",
    ],
    keywords: ["conflit", "doublon", "existant", "écraser"],
  },
  {
    id: "analyse",
    category: "installation",
    question: "Que vérifie l’analyse avant l’installation ?",
    answer: [
      "L’{{analyse|analyse}} lit l’état réel de votre serveur grâce au bot. Rien n’est modifié à ce stade. Elle vérifie :",
      {
        list: [
          "vos droits et ceux du bot ;",
          "la place du rôle du bot dans la {{hierarchie|hiérarchie des rôles}} ;",
          "les limites de Discord (nombre de salons, de rôles, règles AutoMod…) ;",
          "ce qui existe déjà et ce qui sera créé, modifié, archivé ou supprimé.",
        ],
      },
      "Vous voyez un aperçu « avant / après » et la liste de toutes les opérations. S’il y a un blocage, il est expliqué et l’installation ne peut pas démarrer.",
    ],
  },
  {
    id: "simulation",
    category: "installation",
    question: "Puis-je tester sans rien changer sur mon serveur ?",
    answer: [
      "Oui. Cochez « Faire d’abord une simulation » avant l’analyse. La {{simulation|simulation}} rejoue toute l’installation sur une copie de votre serveur, avec les mêmes contrôles. Aucune modification n’est envoyée à Discord.",
      "Quand le résultat vous convient, relancez sans la simulation pour installer réellement.",
    ],
    keywords: ["test", "essai", "dry run", "simuler"],
  },
  {
    id: "duree",
    category: "installation",
    question: "Combien de temps dure une installation ? Puis-je fermer la page ?",
    answer: [
      "En général, quelques minutes. Cela dépend de la taille du projet : Discord limite le nombre d’actions qu’un bot peut faire par seconde.",
      "Vous pouvez fermer la page : l’installation continue. Vous retrouvez son suivi dans « Installations » de votre espace, ou dans Discord avec la commande /mys statut.",
    ],
    keywords: ["temps", "durée", "long", "attendre"],
  },
  {
    id: "automatique-ou-pas",
    category: "installation",
    question: "Qu’est-ce qui est installé automatiquement, et qu’est-ce qui reste à faire ?",
    answer: [
      "Le bot installe automatiquement : catégories, salons, rôles, permissions, messages, épingles, réglages du serveur, {{automod|AutoMod}}, et, si la {{communaute|Communauté}} est active, l’{{onboarding|onboarding}} et l’{{ecran-accueil|écran d’accueil}}.",
      "Restent à faire vous-même :",
      {
        list: [
          "le {{guide-serveur|Guide du serveur}}, que Discord ne permet pas de remplir par un bot (le contenu est préparé, prêt à copier) ;",
          "l’activation de la Communauté, si le bot n’est pas Administrateur (un guide vous l’explique) ;",
          "l’icône, la bannière, les émojis et les autocollants, qui ne font pas partie des projets pour l’instant.",
        ],
      },
      "Après l’installation, un assistant liste ces étapes avec le texte à copier. Le tableau complet est sur la page [Comment ça marche](/fonctionnement#limites).",
    ],
    keywords: ["manuel", "guide du serveur", "icône", "émoji", "limites"],
  },
  {
    id: "installation-partielle",
    category: "installation",
    question: "L’installation est « partielle ». Que faire ?",
    answer: [
      "Certaines étapes ont échoué, mais tout ce qui a réussi est en place. Chaque étape en échec affiche sa cause (une permission manquante, par exemple).",
      "Corrigez la cause, puis cliquez sur « Relancer les étapes en échec ». Seules ces étapes sont rejouées : rien n’est créé en double.",
    ],
    keywords: ["échec", "erreur", "relancer", "partiel"],
  },
  {
    id: "annuler",
    category: "installation",
    question: "Puis-je arrêter une installation en cours ?",
    answer: [
      "Oui, avec le bouton « Annuler » de la page de suivi, ou la commande /mys annuler dans Discord. Les étapes déjà faites restent en place ; les suivantes ne sont pas exécutées.",
      "Pour revenir en arrière, utilisez la {{sauvegarde-securite|sauvegarde de sécurité}} prise juste avant l’installation.",
    ],
    keywords: ["stop", "arrêter", "interrompre"],
  },
  {
    id: "bot-apres",
    category: "installation",
    question: "Dois-je garder le bot sur le serveur après l’installation ?",
    answer: [
      "Les salons, rôles, permissions et règles AutoMod restent en place même si vous retirez le bot.",
      "Mais certaines fonctions sont assurées par notre bot et s’arrêtent sans lui : boutons de rôles, validation du règlement, {{ticket|tickets}} privés, suggestions avec votes, message de bienvenue et journal des arrivées. Gardez-le si vous les utilisez.",
    ],
    keywords: ["retirer le bot", "expulser", "garder"],
  },

  /* ------------------------------- Sauvegardes ------------------------------- */
  {
    id: "faire-sauvegarde",
    category: "sauvegardes",
    question: "Comment sauvegarder mon serveur ?",
    answer: [
      "Le bot doit être présent sur le serveur. Ensuite, au choix :",
      {
        list: ["sur le site, dans [Sauvegardes](/sauvegardes), choisissez le serveur puis cliquez sur « Sauvegarder maintenant » ;", "dans Discord, tapez la commande /mys sauvegarder."],
      },
      "Avec le Premium, vous pouvez aussi programmer des sauvegardes régulières.",
    ],
    keywords: ["backup", "copie", "sauvegarder"],
  },
  {
    id: "contenu-sauvegarde",
    category: "sauvegardes",
    question: "Que contient une sauvegarde ?",
    answer: [
      "La structure du serveur : {{categorie|catégories}}, salons, {{role|rôles}}, {{permission|permissions}}, réglages, règles {{automod|AutoMod}} et {{onboarding|onboarding}}.",
      "Elle ne contient pas l’historique des messages. Avec le Premium, vous pouvez ajouter les derniers messages de quelques salons choisis.",
      "Les salons que le bot ne peut pas voir ne sont pas sauvegardés.",
    ],
    keywords: ["messages", "historique", "contenu"],
  },
  {
    id: "sauvegarde-securite",
    category: "sauvegardes",
    question: "Qu’est-ce que la sauvegarde de sécurité ?",
    answer: [
      "Avant chaque installation ou restauration, le bot enregistre automatiquement la configuration actuelle du serveur. C’est la {{sauvegarde-securite|sauvegarde de sécurité}}. Elle est gratuite.",
      "Un lien vers elle apparaît sur la page de suivi de l’installation. Les plus anciennes sont remplacées automatiquement par les nouvelles.",
      "Elle permet de remettre en place la structure, mais pas l’historique d’un salon supprimé.",
    ],
    keywords: ["sécurité", "automatique", "retour arrière"],
  },
  {
    id: "restaurer",
    category: "sauvegardes",
    question: "Comment restaurer une sauvegarde ?",
    answer: [
      "Ouvrez la sauvegarde dans [Sauvegardes](/sauvegardes), puis cliquez sur « Restaurer… ». Vous pouvez aussi utiliser /mys restaurer dans Discord.",
      "Comme pour une installation, une analyse vous montre ce qui va changer avant toute modification. Il faut être {{administrateur|Administrateur}} ou propriétaire du serveur.",
      {
        list: [
          "« Restaurer l’ensemble » : les éléments encore présents reprennent leurs réglages sauvegardés, et ceux qui ont disparu sont recréés. Rien n’est supprimé.",
          "« Restauration sélective » (Premium) : vous choisissez précisément les salons, catégories et rôles à restaurer.",
        ],
      },
    ],
    keywords: ["récupérer", "restore", "remettre"],
  },
  {
    id: "restauration-identique",
    category: "sauvegardes",
    question: "Une restauration remet-elle tout à l’identique ?",
    answer: [
      "Pas tout à fait. Discord ne permet pas de réutiliser l’identifiant d’un élément supprimé : un salon ou un rôle recréé est un nouvel élément. L’historique des messages d’un salon supprimé ne peut pas être récupéré.",
      "Avec le Premium, les messages exportés peuvent être republiés par un {{webhook|webhook}}, avec le nom de leur auteur et leur date d’origine indiquée. Il s’agit d’une republication, pas des messages d’origine.",
    ],
    keywords: ["identique", "messages perdus", "historique"],
  },
  {
    id: "archiver-ou-supprimer",
    category: "sauvegardes",
    question: "Quelle différence entre archiver et supprimer un salon ?",
    answer: [
      "{{archivage|Archiver}} un salon le range dans une catégorie « 📦 Archives » cachée aux membres. Ses messages restent intacts et vous pouvez le ressortir plus tard.",
      "Supprimer un salon efface définitivement ses messages. C’est pourquoi toute suppression vous demande de retaper le nom du serveur pour confirmer.",
    ],
    keywords: ["archive", "effacer", "supprimer salon"],
  },
  {
    id: "duree-conservation",
    category: "sauvegardes",
    question: "Combien de sauvegardes puis-je garder, et combien de temps ?",
    answer: [
      "Le nombre de sauvegardes par serveur et leur durée de conservation dépendent de votre offre. Les valeurs exactes sont affichées sur la page [Offres](/abonnement) et dans votre tableau de bord.",
      "Une sauvegarde arrivée au bout de sa durée de conservation est supprimée automatiquement. Vous pouvez aussi la supprimer vous-même à tout moment.",
    ],
    keywords: ["limite", "quota", "nombre", "expiration"],
  },

  /* --------------------------------- Publier --------------------------------- */
  {
    id: "publier",
    category: "publier",
    question: "Comment partager mon serveur dans la bibliothèque ?",
    answer: [
      "Depuis l’éditeur, cliquez sur « Publier ». Depuis une sauvegarde, cliquez sur « Publier comme template ».",
      "Votre proposition est relue par un administrateur avant d’apparaître dans la [bibliothèque](/templates). Vous suivez son état, ses vues et ses installations dans [Mes publications](/publications).",
    ],
    keywords: ["partager", "communauté", "proposer"],
  },
  {
    id: "ce-qui-est-publie",
    category: "publier",
    question: "Qu’est-ce qui est rendu public quand je publie ?",
    answer: [
      "Seule la structure : salons, rôles, permissions, AutoMod et onboarding. Les messages exportés et les identifiants Discord de votre serveur ne sont jamais publiés.",
      "Votre pseudo n’apparaît sur la publication que si vous l’avez accepté.",
      "Les modifications que vous faites ensuite dans votre projet ne changent pas la version publiée.",
    ],
    keywords: ["public", "anonyme", "pseudo", "vie privée"],
  },
  {
    id: "relecture",
    category: "publier",
    question: "Pourquoi ma publication a-t-elle été refusée ?",
    answer: [
      "Le motif du refus est affiché dans [Mes publications](/publications). Vous pouvez corriger le projet, puis le proposer à nouveau.",
      "Les règles à respecter sont détaillées dans les [règles de publication](/conditions#publication) : pas de contenu contraire aux règles de Discord, pas de données personnelles, pas de lien d’invitation ni de publicité, pas de copie d’une autre communauté sans son accord, et une description honnête.",
    ],
    keywords: ["refus", "refusé", "rejet", "règles"],
  },
  {
    id: "retirer-publication",
    category: "publier",
    question: "Puis-je retirer un template que j’ai publié ?",
    answer: ["Oui, à tout moment, depuis [Mes publications](/publications). Le template disparaît alors de la bibliothèque."],
    keywords: ["supprimer publication", "dépublier"],
  },
  {
    id: "signaler",
    category: "publier",
    question: "Comment signaler un template qui pose problème ?",
    answer: [
      "Connectez-vous, ouvrez la fiche du template, puis cliquez sur « Signaler ce template ». Choisissez la raison : contenu inapproprié, copie d’un serveur sans accord, description trompeuse, ou autre.",
      "L’équipe examine chaque signalement et peut retirer le template.",
    ],
    keywords: ["signalement", "abus", "report", "contenu choquant"],
  },

  /* --------------------------------- Premium --------------------------------- */
  {
    id: "premium-contenu",
    category: "premium",
    question: "Que m’apporte le Premium ?",
    answer: [
      {
        list: [
          "La conception complète d’un serveur par l’intelligence artificielle, à partir de votre description.",
          "Des modifications par IA, proposées une par une : vous gardez seulement celles qui vous plaisent.",
          "Plus de projets et plus de sauvegardes conservées.",
          "Les sauvegardes programmées et la restauration sélective.",
          "L’export des derniers messages de salons choisis.",
        ],
      },
      "Le détail et le prix sont sur la page [Offres](/abonnement).",
    ],
    keywords: ["avantages", "ia", "intelligence artificielle", "abonnement"],
  },
  {
    id: "premium-serveurs",
    category: "premium",
    question: "Le Premium vaut-il pour tous mes serveurs ?",
    answer: ["Oui. Les avantages sont liés à votre compte, pas à un serveur. Tous vos projets et tous les serveurs que vous gérez en profitent."],
  },
  {
    id: "paiement",
    category: "premium",
    question: "Comment payer, et où gérer mon abonnement ?",
    answer: [
      "Sur le site, le paiement par carte passe par notre prestataire Stripe : nous ne voyons jamais vos coordonnées bancaires. Quand l’achat dans Discord est ouvert, l’abonnement y est aussi proposé, au même prix au maximum.",
      "Un abonnement pris sur le site se gère depuis la page [Offres](/abonnement). Un abonnement acheté dans Discord se gère dans Discord : Paramètres utilisateur → Abonnements.",
    ],
    keywords: ["carte", "stripe", "facture", "payer"],
  },
  {
    id: "resilier",
    category: "premium",
    question: "Puis-je résilier à tout moment ?",
    answer: [
      "Oui, sans engagement. Le Premium reste actif jusqu’à la fin de la période déjà payée, et vos projets sont conservés.",
      "Pour un achat sur le site, vous disposez aussi d’un droit de rétractation de 14 jours, sauf si vous avez demandé à utiliser le Premium immédiatement et renoncé à ce droit lors de l’achat.",
    ],
    keywords: ["annuler abonnement", "résiliation", "rembourser", "rétractation"],
  },
  {
    id: "ia-actions",
    category: "premium",
    question: "L’IA peut-elle modifier mon serveur toute seule ?",
    answer: [
      "Non. L’IA propose seulement un projet ou des modifications de projet. Elle n’agit jamais directement sur Discord.",
      "Vous relisez ses propositions, puis vous lancez vous-même l’installation, avec la même analyse et la même confirmation que d’habitude.",
    ],
    keywords: ["intelligence artificielle", "sécurité ia"],
  },

  /* --------------------------------- Sécurité -------------------------------- */
  {
    id: "donnees",
    category: "securite",
    question: "Quelles données enregistrez-vous ?",
    answer: [
      "Votre identifiant, pseudo et avatar Discord, la liste des serveurs que vous gérez, vos projets, installations et sauvegardes. Nous ne lisons ni vos messages privés ni votre adresse e-mail.",
      "Rien n’est vendu ni utilisé pour de la publicité. Tout le détail est dans la [politique de confidentialité](/confidentialite).",
    ],
    keywords: ["rgpd", "vie privée", "données personnelles", "cookies"],
  },
  {
    id: "bot-lit-messages",
    category: "securite",
    question: "Le bot lit-il les messages de mon serveur ?",
    answer: [
      "Non. Le bot ne lit pas vos messages en continu et n’envoie pas de messages privés.",
      "Il lit des messages seulement si vous lui demandez d’exporter certains salons dans une sauvegarde Premium. Ces messages servent uniquement à la restauration et sont supprimés avec la sauvegarde.",
    ],
    keywords: ["espion", "lecture", "messages privés"],
  },
  {
    id: "securite-installation",
    category: "securite",
    question: "Comment être sûr de ne rien casser ?",
    answer: [
      {
        list: [
          "Rien n’est modifié avant que vous ayez vu l’analyse et confirmé.",
          "Une {{sauvegarde-securite|sauvegarde de sécurité}} est prise juste avant les modifications.",
          "Toute suppression vous demande de retaper le nom du serveur.",
          "Vous pouvez faire une {{simulation|simulation}} d’abord.",
          "Une installation interrompue reprend sans créer de doublon.",
        ],
      },
    ],
    keywords: ["risque", "casser", "danger", "sûr"],
  },
  {
    id: "supprimer-compte",
    category: "securite",
    question: "Comment supprimer mon compte ou télécharger mes données ?",
    answer: [
      "Dans votre [tableau de bord](/tableau-de-bord), section « Mes données » :",
      {
        list: [
          "« Exporter mes données (JSON) » télécharge une copie de tout ce qui est enregistré ;",
          "« Supprimer mon compte… » efface définitivement vos projets, sauvegardes, installations, générations IA et publications. Tapez SUPPRIMER pour confirmer.",
        ],
      },
      "Si vous avez un abonnement Premium actif, résiliez-le d’abord. Vos serveurs Discord ne sont pas modifiés : retirez le bot depuis Discord si vous le souhaitez.",
      "Vous pouvez aussi retirer l’accès de l’application dans Discord : Paramètres → Applications autorisées.",
    ],
    keywords: ["effacer", "rgpd", "export", "suppression"],
  },

  /* ----------------------------- Problèmes fréquents ---------------------------- */
  {
    id: "serveur-absent",
    category: "problemes",
    question: "Mon serveur n’apparaît pas dans la liste.",
    answer: [
      {
        list: [
          "Vérifiez que vous avez la permission {{gerer-serveur|« Gérer le serveur »}} sur ce serveur (ou que vous en êtes le propriétaire).",
          "Si vous venez de le créer, cliquez sur « Actualiser ».",
          "Si le site vous demande de vous reconnecter, faites-le : votre autorisation Discord a expiré.",
        ],
      },
    ],
    keywords: ["liste vide", "introuvable", "pas de serveur"],
  },
  {
    id: "bot-absent",
    category: "problemes",
    question: "Le site indique « bot absent » alors que je l’ai invité.",
    answer: [
      "Après l’invitation, revenez sur le site et cliquez sur « J’ai invité le bot » (ou « Actualiser ») pour mettre la liste à jour.",
      "Vérifiez aussi dans Discord que vous avez bien choisi le bon serveur dans la fenêtre d’invitation, et que vous avez cliqué sur « Autoriser ».",
    ],
    keywords: ["invitation", "bot introuvable"],
  },
  {
    id: "permissions-manquantes",
    category: "problemes",
    question: "L’analyse dit que le bot n’a pas assez de permissions.",
    answer: [
      "Discord interdit à un bot de donner une permission qu’il n’a pas. Le plus simple : donnez au bot la permission {{administrateur|Administrateur}} le temps de l’installation, puis relancez l’analyse.",
      "Dans Discord : Paramètres du serveur → Rôles → rôle du bot → Permissions → activez « Administrateur ».",
    ],
    keywords: ["permission manquante", "droits du bot", "bloqué"],
  },
  {
    id: "role-au-dessus",
    category: "problemes",
    question: "L’analyse dit qu’un rôle est placé au-dessus du bot.",
    answer: [
      "Un bot ne peut modifier que les rôles placés en dessous du sien : c’est la {{hierarchie|hiérarchie des rôles}}.",
      "Dans Discord : Paramètres du serveur → Rôles, puis faites glisser le rôle du bot tout en haut de la liste. Relancez ensuite l’analyse.",
    ],
    keywords: ["hiérarchie", "position", "rôle trop haut"],
  },
  {
    id: "annonces-standard",
    category: "problemes",
    question: "Mes salons d’annonces sont devenus des salons normaux.",
    answer: [
      "Les {{salon-annonces|salons d’annonces}} et de conférence n’existent que si la {{communaute|Communauté Discord}} est activée. Sans elle, le bot crée un salon textuel classique à la place.",
      "Le bot active la Communauté automatiquement s’il est Administrateur. Sinon, activez-la dans Discord (Paramètres du serveur → Activer la Communauté), puis réinstallez le projet : rien ne sera créé en double.",
    ],
    keywords: ["annonce", "communauté", "onboarding absent"],
  },
  {
    id: "bienvenue-absent",
    category: "problemes",
    question: "Le message de bienvenue ne s’affiche pas.",
    answer: [
      "Le message de bienvenue et le journal des arrivées sont envoyés par notre bot. Vérifiez qu’il est toujours sur le serveur et qu’il peut écrire dans le salon choisi.",
      "Ces fonctions demandent aussi que l’application ait accès aux arrivées de membres côté Discord (intention « Server Members »). Si ce n’est pas le cas sur cette instance, elles restent inactives.",
    ],
    keywords: ["bienvenue", "arrivée", "logs"],
  },
  {
    id: "epingles",
    category: "problemes",
    question: "Les messages n’ont pas été épinglés.",
    answer: [
      "Depuis 2026, Discord demande une permission dédiée, « Épingler des messages ». Donnez-la au bot (ou la permission Administrateur), puis relancez l’installation : seules les étapes manquantes seront rejouées.",
    ],
    keywords: ["épingle", "pin"],
  },
  {
    id: "messages-vides",
    category: "problemes",
    question: "Les messages exportés dans ma sauvegarde sont incomplets.",
    answer: [
      "Discord ne donne le contenu des messages des membres qu’aux applications autorisées pour cela (intention « Message Content »). Sans cette autorisation, seuls les messages du bot et ceux qui le mentionnent sont complets.",
      "La page de la sauvegarde indique combien de messages n’ont pas pu être lus.",
    ],
    keywords: ["export", "messages manquants", "vide"],
  },
];

/** Texte brut d’une réponse (liens et termes réduits à leur libellé), pour la recherche et le référencement. */
export function blockText(block: HelpBlock): string {
  const raw = typeof block === "string" ? block : "list" in block ? block.list.join(" ") : block.steps.join(" ");
  return raw.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\{\{[^|}]+\|([^}]+)\}\}/g, "$1");
}

export function answerText(q: HelpQuestion): string {
  return q.answer.map(blockText).join(" ");
}
