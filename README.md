# Make Your Server

Plateforme web + bot Discord pour **concevoir, personnaliser, installer et sauvegarder** des serveurs Discord complets, sans connaissances techniques.

- **Template** : modèle public et réutilisable (structure, réglages, contenu). 8 templates officiels fournis.
- **Projet** : réalisation personnelle et privée, enregistrée sur le compte, modifiable dans l’éditeur.
- **Sauvegarde** : état réellement récupéré depuis un serveur existant (privé, versionné, supprimable).
- **Installation** : application d’un projet ou d’une sauvegarde sur un serveur autorisé, par le bot, étape par étape.

---

## 1. Contraintes Discord vérifiées (octobre 2026)

| Sujet | Constat (documentation officielle) | Conséquence dans le produit |
|---|---|---|
| Création de serveur par une application (`POST /guilds`) | Dépréciée (changelog du 28/07/2025, retirée de la doc et de l’OpenAPI) | L’utilisateur crée le serveur dans Discord (assistant guidé), puis invite le bot. |
| Onboarding (`PUT /guilds/{id}/onboarding`) | `MANAGE_GUILD` + `MANAGE_ROLES` ; ≥ 7 salons par défaut dont ≥ 5 où @everyone peut écrire ; nécessite la Communauté | Vérifié par le validateur et le planificateur. |
| Communauté (`features: ["COMMUNITY"]`) | Exige la permission **Administrateur** ; salon de règlement + salon des mises à jour | Activation automatique si le bot est admin, sinon étape manuelle guidée ; salons d’annonces créés en salon standard tant qu’elle est inactive. |
| Écran d’accueil | `PATCH /guilds/{id}/welcome-screen`, 5 salons max, Communauté requise | Automatisé. |
| **Guide du serveur** | Aucun endpoint public (seuls des drapeaux de membre en lecture) | **Non automatisé** : contenu préparé + assistant « à copier » après l’installation. Jamais présenté comme configuré. |
| Épingles | Permission dédiée `PIN_MESSAGES` obligatoire depuis le 23/02/2026 ; nouvel endpoint `/messages/pins` | Le bot épingle s’il a la permission, sinon l’étape l’indique. |
| Salons invisibles pour le bot | Données « obfusquées » (flag `CHANNEL_OBFUSCATED`), omis de la liste HTTP à partir du 16/11/2026 | Ignorés dans l’analyse et les sauvegardes. |
| AutoMod | 6 règles mots-clés max, 1 de chaque autre type ; exclusion temporaire seulement pour mots-clés / mentions | Contrôlé avant installation. |
| Permissions accordables | Un bot ne peut accorder (rôles, surcharges) que des permissions qu’il possède | Blocage explicite listant les permissions manquantes ; invitation « Administrateur » recommandée puis réductible. |
| Contenu des messages | Intention privilégiée `MESSAGE_CONTENT` (accès soumis à approbation au-delà d’un seuil d’utilisateurs, juin 2026) | Export de messages (Premium) honnêtement limité si l’intention n’est pas accordée. |
| Monétisation | Politique « Premium Apps Required Support » (oct. 2024) : une fonctionnalité payante vendue ailleurs doit aussi pouvoir s’acheter via Discord (là où c’est disponible), à un prix non supérieur | Double source d’abonnement : **Stripe** (site) et **Discord Premium Apps** (entitlements synchronisés par le bot). Avantages liés au **compte**. |

Sources : <https://docs.discord.com/developers/change-log>, <https://docs.discord.com/developers/resources/guild>, <https://docs.discord.com/developers/monetization/overview>, <https://support-dev.discord.com/hc/en-us/articles/23810643331735>.

---

## 2. Architecture

```
apps/
  web/        Next.js 16 (App Router) — site, API, OAuth2 Discord, éditeur, administration
  bot/        discord.js 14 — commandes /mys, boutons, événements + worker de la file de tâches
packages/
  core/       Modèle ServerSpec (zod), permissions, validation, simulation « Voir comme ce rôle »,
              planificateur (diff projet ↔ serveur réel), payloads Discord, templates, patchs IA
  db/         Drizzle ORM + PostgreSQL : schéma, migrations SQL, file de tâches, journaux, réglages
  engine/     Moteur d’installation : passerelle Discord (REST réelle, simulée, bac à sable),
              exécuteur reprenable, sauvegardes, restauration, contrôles d’accès, quotas, abonnements
scripts/      Tests de bout en bout, validation sur un vrai serveur Discord
```

**Flux d’une installation**

1. Le site (ou `/mys installer`) appelle `prepareInstallation` : revérification des droits de l’utilisateur **via le bot**, lecture de l’état réel du serveur, calcul du plan (créations, modifications, archivages, suppressions, conflits, blocages, étapes manuelles, aperçu avant/après). Rien n’est modifié.
2. `confirmInstallation` recalcule le plan sur l’état du moment, exige une confirmation écrite pour toute opération destructive, crée les étapes et met une tâche en file.
3. Le worker (processus du bot) réserve la tâche (`FOR UPDATE SKIP LOCKED` + bail), revérifie les droits, prend une **sauvegarde de sécurité**, puis exécute chaque étape. `@discordjs/rest` gère les limites de débit.
4. Chaque élément créé est enregistré dans `resource_mappings` (identifiant local → identifiant Discord) dans la même transaction que le succès de l’étape. Une étape interrompue (« running ») est **réconciliée** à la reprise (nom + date de création du snowflake ; `nonce` + `enforce_nonce` pour les messages) : aucun doublon.
5. Statut final honnête : `succeeded`, `partial` (relançable : seules les étapes en échec sont rejouées), `failed`, `cancelled`.

**Ce que fait le bot au quotidien** (fonctionnalités non natives) : boutons de rôles, validation du règlement, tickets privés (fils privés), suggestions avec votes (modale), message de bienvenue et logs d’arrivées. Le bot n’agit que sur les rôles enregistrés lors de l’installation et refuse tout rôle à permissions sensibles.

---

## 3. Lancer le projet

### Prérequis
- Node.js ≥ 22.12, pnpm 10 (`corepack enable`)
- PostgreSQL 16 (ou Docker)

### Installation
```bash
pnpm install
cp .env.example .env              # puis complétez (voir ci-dessous)
docker compose up -d              # PostgreSQL local (crée aussi la base mys_test)
pnpm db:migrate                   # applique packages/db/migrations
pnpm db:seed                      # offres par défaut + 8 templates officiels
```

### Créer l’application Discord
1. <https://discord.com/developers/applications> → **New Application**.
2. **OAuth2** : copiez *Client ID* → `DISCORD_CLIENT_ID`, *Client Secret* → `DISCORD_CLIENT_SECRET`. Ajoutez la redirection `APP_URL/api/auth/callback` (ex. `http://localhost:3000/api/auth/callback`).
3. **Bot** : *Reset Token* → `DISCORD_BOT_TOKEN`. Activez l’intention **Server Members** (bienvenue + logs) ; sinon mettez `BOT_MEMBER_EVENTS=false`.
4. **Installation** : contexte *Guild Install*, portées `bot` et `applications.commands`. Le site génère les liens d’invitation (Administrateur recommandé, ou permissions minimales).
5. Générez `APP_ENCRYPTION_KEY` : `openssl rand -base64 32`. Renseignez `ADMIN_DISCORD_IDS` avec votre identifiant Discord.

### Démarrer
```bash
pnpm bot:register      # enregistre /mys (instantané si DISCORD_DEV_GUILD_ID est défini)
pnpm dev:web           # site sur http://localhost:3000
pnpm dev:bot           # bot + worker de la file de tâches (processus persistant)
```

### Sans Discord : mode bac à sable
Pour tout tester sans application Discord :
```env
DISCORD_SANDBOX=true
DEV_LOGIN=true
AI_PROVIDER=mock
```
```bash
pnpm dev:web
pnpm --filter @mys/bot sandbox    # worker qui exécute les installations sur le serveur simulé
```
La page de connexion propose alors une connexion de test, et un « Serveur bac à sable » persistant (en base) apparaît. Le serveur simulé reproduit les contraintes importantes (permissions du bot, hiérarchie, limites, Communauté, nonce des messages). Il est toujours signalé comme simulation.

### Production
- Site : `pnpm build:web && pnpm start:web` (derrière un proxy HTTPS ; `APP_URL` en `https://…` active les cookies `Secure`).
- Bot : `pnpm start:bot` comme service persistant (systemd, PM2, conteneur). Plusieurs instances du worker peuvent tourner : la file est verrouillée ligne par ligne.
- Migrations à chaque déploiement : `pnpm db:migrate`.

### Paiements
- **Stripe** : créez un produit « Premium » avec un prix récurrent, saisissez l’identifiant `price_…` dans *Administration → Offres & quotas* et cochez « proposée à l’achat ». Webhook : `APP_URL/api/billing/webhook` avec les événements `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed` → secret dans `STRIPE_WEBHOOK_SECRET`. Activez le portail client Stripe.
- **Discord Premium Apps** : créez un SKU d’abonnement utilisateur dans le portail développeur (monétisation requise : équipe, application vérifiée…), saisissez son identifiant dans l’administration. Le bot synchronise les entitlements (événements + synchronisation horaire).
- Les prix affichés sont du texte saisi par l’administrateur : aucun prix n’est codé en dur.

### IA (Premium)
`ANTHROPIC_API_KEY` (clé API payante, distincte d’un abonnement Claude). Modèle, prix par million de jetons, plafond de sortie et **budget mensuel global** se règlent dans *Administration → IA & coûts* ; les quotas par offre (conceptions, modifications, plafond de coût par utilisateur) dans *Offres & quotas*. L’IA ne produit que des données validées par schéma (zod + validation sémantique, un tour de réparation) ; elle n’exécute jamais d’action Discord. Les modifications ciblées sont proposées changement par changement et peuvent être acceptées individuellement (« Conserver mes rôles actuels », « Ne rien supprimer »).

---

## 4. Fonctionnalités

**Site** : accueil animé (serveur qui se construit, « Voir comme ce rôle », avant/après, suivi d’installation) · bibliothèque de templates avec recherche et filtres (thème, taille, fonctionnalités, popularité) · fiches détaillées avec aperçu interactif · éditeur visuel (arborescence glisser-déposer + boutons clavier, rôles et hiérarchie, permissions et surcharges à trois états, messages/embeds/boutons, AutoMod, onboarding, écran d’accueil, Guide du serveur préparé, fonctionnalités du bot, annuler/rétablir, enregistrement automatique avec contrôle de version, validation en direct) · assistant d’installation (serveur, invitation du bot, mode vide / ajout / ciblé, archivage ou suppression confirmée, conflits, avant/après, simulation) · suivi en direct et assistant des étapes manuelles · sauvegardes manuelles, de sécurité et programmées, restauration complète ou sélective, republication honnête des messages exportés · tableau de bord (projets, favoris, générations IA, sauvegardes, serveurs, historique, abonnement et quotas) · administration (utilisateurs, suspensions, Premium manuel, templates et publication, offres et quotas, installations, sauvegardes, file et bot, IA et coûts, journaux filtrables, maintenance).

**Bot** : `/mys panneau`, `/mys installer`, `/mys sauvegarder`, `/mys sauvegardes`, `/mys restaurer`, `/mys statut`, `/mys annuler` — accusé de réception immédiat, traitement en arrière-plan, suivi mis à jour dans le message (jeton d’interaction de 15 min, puis `/mys statut`). Les mêmes contrôles d’accès que le site. Les opérations destructives se confirment uniquement sur le site.

**Gratuit / Premium** (valeurs par défaut, modifiables) : le gratuit inclut les templates complets, l’éditeur, l’installation et la sauvegarde de sécurité (5 projets, 2 sauvegardes manuelles + 3 de sécurité par serveur). Le Premium ajoute la conception et les modifications IA, 50 projets, 25 versions de sauvegarde, sauvegardes programmées, export de messages, restauration sélective. **Les avantages sont liés au compte**, sur tous les serveurs que l’utilisateur gère.

---

## 5. Tests

```bash
pnpm test           # unitaires + intégration (PostgreSQL requis : base mys_test)
pnpm test:e2e       # bout en bout HTTP : site + worker en bac à sable sur la base de test
pnpm test:discord   # validation sur un VRAI serveur de test (DISCORD_TEST_GUILD_ID) — modifie ce serveur
pnpm test:discord gaming --simulation   # même chose sans aucune écriture sur Discord
```

Couverture actuelle :
- **Templates** (8) : schéma, validation sémantique, richesse minimale.
- **Cœur** : simulation des permissions, suppressions en cascade, planificateur (suppression = destructive, bot sans droits, rôle au-dessus du bot, dépendances du mode ciblé), patchs IA avec contraintes.
- **Moteur** (PostgreSQL réel + serveur simulé) : installation des 8 templates sans erreur ni doublon, arrêt brutal après création d’un salon puis reprise sans doublon, message non republié après arrêt, erreur 500 temporaire, échec définitif → « partiel » → relance sans doublon, réinstallation sans création, mode ajout qui conserve l’existant, refus d’une suppression non confirmée, archivage, accès refusé sans « Gérer le serveur », projet d’autrui inaccessible, droits revérifiés à l’exécution, permissions non accordables, annulation, sauvegarde + restauration, quotas de sauvegarde, mode simulation isolé.
- **File de tâches** : déduplication, réservation exclusive, reprise après bail expiré, nouvelles tentatives puis échec définitif.
- **Bout en bout HTTP** : 401/403/redirections, administration réservée, isolation des projets et sauvegardes, recherche publique sans brouillons ni sauvegardes, CSRF, installation complète en bac à sable puis relance sans création, confirmation destructive obligatoire, serveur non géré refusé.

### Testé ici / reste à connecter
- ✅ Testé : tout le moteur, la base, la file, le site (build de production, parcours complet en navigateur sur le bac à sable), les contrôles d’accès, les réponses IA simulées.
- ⏳ À connecter avec vos identifiants : application Discord réelle (OAuth2, bot, commandes, boutons) — utilisez `pnpm test:discord` sur un serveur dédié ; clé API Anthropic ; Stripe (clés + webhook) ; SKU Discord Premium Apps. Ces intégrations sont implémentées mais n’ont pas pu être exécutées sans identifiants.

---

## 6. Sécurité et confidentialité
- Sessions : jeton aléatoire en cookie `HttpOnly`/`SameSite=Lax`, seul son SHA-256 est stocké ; jetons OAuth chiffrés AES-256-GCM.
- CSRF : toute requête modifiante doit porter l’en-tête `Origin` du site.
- Administration : `ADMIN_DISCORD_IDS` uniquement, vérifiée côté serveur sur chaque page et chaque route ; toutes les actions sont journalisées.
- Journaux nettoyés (jetons, secrets, clés masqués ; contenus tronqués).
- Les sauvegardes ne sont jamais publiées ni envoyées à l’IA ; la publication d’un template est une proposition volontaire, relue avant publication.
