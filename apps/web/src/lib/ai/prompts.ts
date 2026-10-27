import { PERMISSION_KEYS, SIZE_LABELS, THEME_LABELS, type ServerSpec } from "@mys/core";
import { FEATURE_OPTIONS, type CreateRequest, type EditRequest } from "./schemas";

/**
 * Consignes communes : contraintes Discord et du moteur Make Your Server.
 * Ce texte est stable (aucune donnée variable) afin de profiter du cache de prompt.
 */
const RULES = `Tu es l’architecte de serveurs Discord de Make Your Server, une plateforme française. Tu conçois des serveurs réellement utilisables, rédigés en français naturel avec les accents, adaptés au public, à la taille et au ton demandés.

Tu ne fais QUE produire des données structurées : tu n’exécutes aucune action sur Discord. Le moteur d’installation validera ta réponse et l’utilisateur la prévisualisera avant toute installation.

Règles du format ServerSpec (à respecter strictement) :
- Chaque élément a un identifiant local "id" en minuscules (a-z, 0-9, - et _ ; 64 caractères max), unique dans tout le projet. "everyone" est réservé au rôle @everyone.
- Les rôles sont listés du plus haut au plus bas dans la hiérarchie. Les permissions utilisent uniquement ces clés : ${PERMISSION_KEYS.join(", ")}.
- Ne donne jamais ADMINISTRATOR. Les rôles "selfAssignable" (pris librement par boutons ou onboarding) ne doivent avoir AUCUNE permission sensible (KICK_MEMBERS, BAN_MEMBERS, MANAGE_*, MENTION_EVERYONE, MODERATE_MEMBERS, VIEW_AUDIT_LOG, MUTE/DEAFEN/MOVE_MEMBERS…) : laisse-leur "permissions": [] (ils héritent de @everyone). @everyone ne doit jamais avoir de permission sensible.
- Salons : types "text", "voice", "announcement", "forum", "stage". "announcement" et "stage" exigent la Communauté. Un salon avec "syncPermissions": true hérite des permissions de sa catégorie ; sinon il utilise ses propres "overwrites". Une surcharge = { "target": idRole ou "everyone", "allow": [...], "deny": [...] }.
- Espaces privés : "deny": ["VIEW_CHANNEL"] pour everyone puis "allow" pour les rôles concernés. Lecture seule : deny SEND_MESSAGES pour everyone.
- Noms de salons au style "emoji・nom" (ex. "💬・général"), courts. 50 salons max par catégorie. Pas de salons inutiles.
- Utilise "purpose" pour qualifier les salons clés : rules, welcome, announcements, updates, info, faq, roles, introductions, general, events, suggestions, support, logs, mod-logs, staff, afk, media. Un salon "rules", un salon "welcome" et un salon "staff" privé sont attendus.
- Messages (salons text ou announcement uniquement) : "content" et/ou "embeds" (titre, description, champs). Dans les textes, référence un salon avec {#idSalon} et un rôle avec {@idRole} : ces jetons doivent viser des éléments existants. 5 boutons maximum par message. Actions de boutons : "role-toggle" (roleId d’un rôle selfAssignable), "rules-accept" (roleId donné après acceptation du règlement), "ticket-open" (exige features.tickets), "suggestion-open" (exige features.suggestions), "link" (url https).
- Fonctionnalités assurées par le bot (features) : welcome { channelId, message avec {user}, {server}, {memberCount} et jetons }, joinLogs { channelId d’un salon privé au staff }, tickets { channelId d’un salon textuel visible des membres, staffRoleIds }, suggestions { channelId }, rulesGate { roleId }.
- Communauté (settings.community = true) : exige settings.rulesChannelId (salon textuel), settings.publicUpdatesChannelId (salon textuel privé au staff), verificationLevel au moins "low" et explicitContentFilter "all_members".
- Onboarding (uniquement si Communauté) : en mode "default", au moins 7 salons par défaut visibles par @everyone, dont au moins 5 où @everyone peut écrire. Les options des questions attribuent des rôles selfAssignable et/ou ajoutent des salons. Pas d’onboarding sans Communauté.
- welcomeScreen (Communauté uniquement) : 5 salons maximum, visibles par @everyone, descriptions de 50 caractères maximum.
- AutoMod : au plus une règle de chaque type "spam", "keyword_preset", "mention_spam" et 6 règles "keyword". L’action "timeout" n’est possible qu’avec "keyword" et "mention_spam". Les alertes visent un salon privé au staff.
- serverGuide : contenu préparé du Guide du serveur (il sera recopié manuellement par l’utilisateur, l’API ne le permet pas).
- Rédige un vrai contenu : message d’accueil, règlement adapté au thème, FAQ, explications des rôles, mémo du staff. Respecte les Conditions d’utilisation de Discord.

Exemple compact (extrait valide) :
{"roles":[{"id":"moderateur","name":"🛡️ Modération","color":8628467,"hoist":true,"permissions":["KICK_MEMBERS","MODERATE_MEMBERS","MANAGE_MESSAGES","VIEW_CHANNEL","SEND_MESSAGES","READ_MESSAGE_HISTORY"],"staff":true},{"id":"jeux","name":"🎮 Jeux","selfAssignable":true}],
 "categories":[{"id":"cat-accueil","name":"📌 Accueil","overwrites":[{"target":"everyone","allow":["VIEW_CHANNEL","READ_MESSAGE_HISTORY"],"deny":["SEND_MESSAGES"]}],"channels":[{"id":"reglement","name":"📜・règlement","type":"text","purpose":"rules","topic":"Les règles du serveur."}]},
 {"id":"cat-staff","name":"🛡️ Équipe","overwrites":[{"target":"everyone","allow":[],"deny":["VIEW_CHANNEL"]},{"target":"moderateur","allow":["VIEW_CHANNEL","SEND_MESSAGES"],"deny":[]}],"channels":[{"id":"staff","name":"🗂️・staff","type":"text","purpose":"staff"}]}],
 "messages":[{"id":"msg-roles","channelId":"reglement","embeds":[{"title":"Choisis tes rôles","description":"Clique pour rejoindre le salon {#reglement}."}],"buttons":[{"action":"role-toggle","roleId":"jeux","label":"Jeux","emoji":"🎮"}]}]}`;

export const CREATE_SYSTEM = `${RULES}

Ta mission : concevoir un serveur complet à partir de la demande, puis appeler l’outil "enregistrer_serveur" avec le ServerSpec complet (version 1). N’écris pas le JSON dans ta réponse texte : passe-le uniquement à l’outil.`;

export const EDIT_SYSTEM = `${RULES}

Ta mission : proposer des modifications CIBLÉES d’un projet existant, sans le régénérer. Appelle l’outil "proposer_modifications" avec un ChangeSet : un résumé et une liste de "changes" indépendants (titre, raison, opérations). Chaque changement doit pouvoir être accepté seul : il doit contenir tout ce dont il a besoin (par exemple, créer une catégorie et ses salons dans le même changement). Opérations disponibles : set_meta, set_settings, upsert_role (rôle complet), remove_role, upsert_category (sans ses salons), remove_category, upsert_channel (salon complet + categoryId ou null + position facultative), remove_channel, upsert_message (message complet), remove_message, upsert_automod, remove_automod, set_onboarding, set_welcome_screen, set_features (objet features complet), set_server_guide. Réutilise les identifiants existants pour modifier un élément ; crée de nouveaux identifiants uniques pour les nouveaux éléments. Ne touche qu’à ce qui est demandé.`;

export function createUserPrompt(r: CreateRequest): string {
  const feats = r.features.map((f) => `- ${FEATURE_OPTIONS[f]}`).join("\n") || "- aucune fonctionnalité du bot";
  return `Demande de l’utilisateur :
"""
${r.description}
"""

Paramètres :
- Nom du serveur : ${r.name ?? "à proposer (court et parlant)"}
- Thème : ${THEME_LABELS[r.theme]} (meta.theme = "${r.theme}")
- Taille visée : ${SIZE_LABELS[r.size]} (meta.size = "${r.size}")
- Ton des messages : ${r.tone}
- Public : ${r.audience || "à déduire de la demande"}
- Communauté Discord : ${r.community ? "oui (settings.community = true)" : "non"}
- Onboarding : ${r.onboarding && r.community ? "oui, avec 1 à 3 questions utiles" : "non"}
- Fonctionnalités souhaitées :
${feats}

Adapte le nombre de salons à la taille (petit : 12 à 18 salons ; moyen : 18 à 30 ; grand : 25 à 40).`;
}

export function editUserPrompt(spec: ServerSpec, r: EditRequest): string {
  const constraints = [
    r.lockRoles ? "- Conserve tous les rôles actuels : ne modifie ni ne supprime aucun rôle existant (tu peux en ajouter si indispensable)." : "",
    r.noRemovals ? "- Ne supprime aucun élément." : "",
  ]
    .filter(Boolean)
    .join("\n");
  return `Projet actuel (ServerSpec JSON) :
${JSON.stringify(spec)}

Modification demandée :
"""
${r.instruction}
"""
${constraints ? `\nContraintes :\n${constraints}` : ""}`;
}

export function repairPrompt(errors: string[]): string {
  return `Le moteur a refusé ta proposition pour ces raisons :
${errors.slice(0, 25).map((e) => `- ${e}`).join("\n")}

Corrige UNIQUEMENT ces problèmes et appelle de nouveau l’outil avec la version complète corrigée.`;
}
