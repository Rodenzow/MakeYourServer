# Mettre Make Your Server en ligne sur Cloudflare

Ce guide met en ligne **le site** et **le bot Discord**, sans nom de domaine : le site sera servi sur une adresse gratuite `https://make-your-server.<votre-sous-domaine>.workers.dev`. Vous pourrez ajouter un nom de domaine plus tard sans rien reconstruire.

Le déploiement est **automatique** : vous configurez une seule fois vos comptes et vos secrets, puis GitHub publie tout à chaque mise à jour de la branche `main`.

Comptez environ **45 minutes** la première fois. Aucun outil n’est à installer sur votre ordinateur : tout se fait dans le navigateur.

---

## Vue d’ensemble

| Élément | Où il tourne | Rôle |
| --- | --- | --- |
| Site (`apps/web`) | Cloudflare Workers | Pages, connexion Discord, éditeur, administration |
| Bot (`apps/bot`) | Cloudflare Containers (1 instance permanente) | Commandes `/mys`, installations, sauvegardes |
| Base PostgreSQL | Supabase (offre gratuite) | Données partagées par le site et le bot |
| Déploiement | GitHub Actions | Migrations, publication du site et du bot |

### Coûts

- **Cloudflare Workers Paid : 5 $/mois** — obligatoire. Le site dépasse la taille autorisée par l’offre gratuite (3 Mio compressés) et le bot a besoin de Cloudflare Containers, réservé à l’offre payante.
- **Utilisation du conteneur du bot** : avec le type `lite` (256 Mio) allumé en permanence, comptez **environ 1,50 à 2,50 $/mois** en plus (mémoire et disque au-delà de ce qui est inclus ; le processeur n’est facturé qu’à l’usage réel). Tarifs : <https://developers.cloudflare.com/containers/pricing/>.
- **Supabase** : gratuit (500 Mo de base). Le bot interroge la base en continu, donc le projet ne se met jamais en pause.
- **GitHub Actions** : gratuit pour ce volume.
- **Facultatif** : IA (clé API Anthropic, facturée à l’usage) et Stripe (commission par paiement).

**Total de départ : environ 7 $/mois.**

---

## Étape 1 — Compte Cloudflare

1. Créez un compte sur <https://dash.cloudflare.com/sign-up>.
2. Dans le menu de gauche, ouvrez **Workers & Pages** (Compute). À la première visite, Cloudflare vous fait **choisir votre sous-domaine `workers.dev`** (par exemple `rodenzow`). Notez-le : votre site sera `https://make-your-server.rodenzow.workers.dev`.
3. Passez à l’offre payante : **Workers & Pages → Plans** (ou *Gérer le compte → Facturation*) → **Workers Paid** (5 $/mois).
4. Notez votre **Account ID** : il s’affiche dans la colonne de droite de la page **Workers & Pages** (ou dans l’URL `dash.cloudflare.com/<ACCOUNT_ID>/…`).

> 💡 Dans la suite, remplacez `<sous-domaine>` par le vôtre.

## Étape 2 — Jeton API Cloudflare (pour GitHub)

1. <https://dash.cloudflare.com/profile/api-tokens> → **Create Token**.
2. Choisissez le modèle **Edit Cloudflare Workers** → **Use template**.
3. Dans **Permissions**, ajoutez (bouton *+ Add more*) :
   - `Account` · `Containers` · `Edit`
   - `Account` · `Hyperdrive` · `Edit` *(le site se connecte à la base via Hyperdrive, créé automatiquement)*
4. **Account Resources** : *Include* → votre compte. **Zone Resources** : *All zones* (sans effet sans domaine).
5. **Continue to summary** → **Create Token**. Copiez le jeton **immédiatement** (il ne sera plus affiché) : c’est `CLOUDFLARE_API_TOKEN`.

## Étape 3 — Base de données Supabase

1. Créez un compte sur <https://supabase.com> → **New project**.
   - Nom : `make-your-server` · Mot de passe de base : générez-en un **sans caractères spéciaux** (bouton *Generate*, puis gardez-le) · Région : la plus proche de vos utilisateurs (ex. *West EU (Paris)* ou *Central EU (Frankfurt)*).
2. Une fois le projet prêt, cliquez sur **Connect** (en haut de la page du projet).
3. Choisissez **Session pooler** (pas *Direct connection*, qui n’est accessible qu’en IPv6). Copiez l’URI ; elle ressemble à :
   ```
   postgresql://postgres.abcdefghijkl:[YOUR-PASSWORD]@aws-0-eu-west-3.pooler.supabase.com:5432/postgres
   ```
4. Remplacez `[YOUR-PASSWORD]` par votre mot de passe et ajoutez `?sslmode=require` à la fin :
   ```
   postgresql://postgres.abcdefghijkl:MotDePasse@aws-0-eu-west-3.pooler.supabase.com:5432/postgres?sslmode=require
   ```
   C’est votre `DATABASE_URL`.

Vous n’avez rien à créer dans Supabase : les tables sont créées automatiquement au déploiement.

## Étape 4 — Application Discord

1. <https://discord.com/developers/applications> → **New Application** → nom `Make Your Server` (vous pouvez y mettre le logo).
2. **General Information** : copiez **Application ID** → `DISCORD_CLIENT_ID`.
3. **OAuth2** :
   - **Client Secret** → *Reset Secret* → copiez → `DISCORD_CLIENT_SECRET`.
   - **Redirects** → *Add Redirect* :
     ```
     https://make-your-server.<sous-domaine>.workers.dev/api/auth/callback
     ```
     puis **Save Changes**. L’adresse doit être **exactement** celle-ci (https, sans `/` final).
4. **Bot** :
   - **Reset Token** → copiez → `DISCORD_BOT_TOKEN`.
   - Activez **Server Members Intent** (messages de bienvenue et journal des arrivées), puis **Save Changes**. Si vous ne voulez pas l’activer, créez plus loin la variable `BOT_MEMBER_EVENTS` = `false`.
   - Décochez **Public Bot** si vous voulez être seul à pouvoir l’ajouter pendant vos essais.
5. **Installation** : *Installation Contexts* → gardez **Guild Install** ; *Install Link* → **None** (le site génère lui-même les bons liens d’invitation).
6. Votre identifiant Discord personnel (pour l’administration) : dans Discord, *Paramètres → Avancés → Mode développeur* activé, puis clic droit sur votre nom → **Copier l’identifiant de l’utilisateur** → `ADMIN_DISCORD_IDS`.

## Étape 5 — Secrets GitHub

Générez d’abord la clé de chiffrement `APP_ENCRYPTION_KEY` (32 octets en base64). Au choix :
- dans un terminal : `openssl rand -base64 32`
- ou dans la console de votre navigateur (F12 → Console) :
  ```js
  btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
  ```

Puis, sur GitHub : dépôt **rodenzow/makeyourserver** → **Settings → Secrets and variables → Actions**.

**Onglet *Secrets* → *New repository secret*** (un par ligne) :

| Nom | Valeur | Obligatoire |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | jeton de l’étape 2 | ✅ |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID de l’étape 1 | ✅ |
| `DATABASE_URL` | URI Supabase de l’étape 3 | ✅ |
| `APP_ENCRYPTION_KEY` | clé générée ci-dessus (ne la changez plus ensuite) | ✅ |
| `DISCORD_CLIENT_ID` | Application ID | ✅ |
| `DISCORD_CLIENT_SECRET` | Client Secret | ✅ |
| `DISCORD_BOT_TOKEN` | jeton du bot | ✅ |
| `ADMIN_DISCORD_IDS` | votre identifiant Discord (plusieurs : séparés par des virgules) | ✅ |
| `ANTHROPIC_API_KEY` | clé API <https://console.anthropic.com> (IA Premium) | facultatif |
| `STRIPE_SECRET_KEY` | clé secrète Stripe | facultatif |
| `STRIPE_WEBHOOK_SECRET` | secret du webhook Stripe | facultatif |

**Onglet *Variables* → *New repository variable*** (toutes facultatives) :

| Nom | Quand l’utiliser |
| --- | --- |
| `BOT_MEMBER_EVENTS` | `false` si vous n’avez pas activé *Server Members Intent* |
| `DISCORD_DEV_GUILD_ID` | identifiant d’un serveur de test : les commandes `/mys` y apparaissent instantanément (sinon jusqu’à 1 h) |
| `HYPERDRIVE_ID` | voir l’étape 9 |
| `APP_URL` | seulement quand vous aurez un nom de domaine (ex. `https://makeyourserver.fr`) |
| `AI_MODEL` | modèle d’IA par défaut (sinon celui réglé dans l’administration) |

> 🔒 Les secrets ne sont jamais affichés dans les journaux GitHub : le workflow les transmet directement à Cloudflare.

## Étape 6 — Lancer le déploiement

Le workflow `.github/workflows/deploy-cloudflare.yml` se déclenche à chaque mise à jour de `main`. Le code est actuellement sur la branche `claude/make-your-server-discord-mhiqgr` :

1. Sur GitHub : **Pull requests → New pull request** → *base* : `main`, *compare* : `claude/make-your-server-discord-mhiqgr` → **Create pull request** → **Merge pull request**.
2. Ouvrez l’onglet **Actions** : le workflow **Déploiement Cloudflare** démarre. Il enchaîne :
   1. vérification des secrets (message clair si l’un manque) ;
   2. création/mise à jour des tables et des 8 templates officiels ;
   3. publication du site ;
   4. construction de l’image du bot, publication et vérification qu’il est connecté à Discord.

La première fois, comptez 5 à 10 minutes. Ensuite, vous pouvez aussi le relancer à la main : **Actions → Déploiement Cloudflare → Run workflow**.

Le résumé du workflow affiche l’adresse du site et la redirection OAuth à déclarer chez Discord (vérifiez qu’elle est identique à celle de l’étape 4).

## Étape 7 — Vérifier

1. **Le bot** : ouvrez `https://make-your-server-bot.<sous-domaine>.workers.dev/sante`. Vous devez voir :
   ```json
   {"service":"make-your-server-bot","statut":"connecté","serveurs":0,…}
   ```
   Si `statut` vaut `erreur`, le champ `erreur` explique la cause en français (voir *Dépannage*).
2. **Le site** : ouvrez `https://make-your-server.<sous-domaine>.workers.dev` → **Se connecter avec Discord**.
3. **L’administration** : avec le compte dont l’identifiant est dans `ADMIN_DISCORD_IDS`, le lien **Administration** apparaît (`/admin`). Réglez-y les offres, quotas et l’IA.
4. **Un premier serveur** : créez un serveur Discord vide de test, puis sur le site choisissez un template → **Installer** → le site vous propose d’**inviter le bot** sur ce serveur → suivez l’assistant. Dans Discord, `/mys statut` répond.

🎉 Make Your Server est en ligne.

---

## Étape 8 — Mettre à jour

Chaque fois que `main` change, tout est republié automatiquement (migrations comprises). Pour changer un secret : modifiez-le sur GitHub, puis **Actions → Run workflow**.

## Étape 9 — Hyperdrive (automatique)

Sur Cloudflare Workers, une connexion chiffrée directe vers Supabase n’aboutit pas (certificat signé par l’autorité propre à Supabase). Le site passe donc par **Hyperdrive**, inclus dans Workers Paid : il gère le chiffrement vers Supabase et garde des connexions ouvertes, ce qui rend les pages bien plus rapides.

Rien à faire : à chaque déploiement, le workflow crée ou met à jour la configuration `make-your-server-db` à partir de `DATABASE_URL` (cache désactivé, pour toujours afficher l’état réel). Le jeton API doit seulement avoir la permission **Hyperdrive · Edit** (étape 2). Le bot, qui tourne dans un vrai Node.js, se connecte directement avec `DATABASE_URL`.

Pour utiliser une configuration existante, définissez la variable GitHub `HYPERDRIVE_ID`.

## Étape 10 — Facultatif : IA et paiements

- **IA Premium** : ajoutez `ANTHROPIC_API_KEY`, relancez le workflow, puis réglez modèle, prix et budget mensuel dans *Administration → IA & coûts*.
- **Stripe** : webhook à déclarer sur `https://make-your-server.<sous-domaine>.workers.dev/api/billing/webhook` (événements listés dans le README, section *Paiements*). L’identifiant de prix se saisit dans *Administration → Offres & quotas* : aucun prix n’est codé en dur.

## Plus tard : un nom de domaine

1. Achetez le domaine (chez Cloudflare Registrar, c’est le plus simple) ou ajoutez-le à Cloudflare.
2. **Workers & Pages → make-your-server → Settings → Domains & Routes → Add → Custom domain** → `votre-domaine.fr`.
3. Variable GitHub `APP_URL` = `https://votre-domaine.fr`, et ajoutez `https://votre-domaine.fr/api/auth/callback` aux redirections OAuth Discord.
4. **Run workflow**.

---

## Dépannage

| Symptôme | Cause et solution |
| --- | --- |
| Le workflow s’arrête sur « Secrets GitHub manquants » | Le message liste les noms manquants : ajoutez-les (étape 5), noms exactement identiques. |
| « Sous-domaine workers.dev introuvable » | Ouvrez une fois **Workers & Pages** dans Cloudflare pour choisir le sous-domaine (étape 1). |
| « cannot create applications with the "default" scheduling policy » | Déjà pris en charge : le bot utilise la politique `durable_object` exigée par Cloudflare pour les nouveaux comptes. Mettez le code à jour. |
| `Authentication error [code: 10000]` ou « Unauthorized » au déploiement du bot | Le jeton API n’a pas la permission **Containers · Edit** : modifiez-le (étape 2). Vérifiez aussi que l’offre **Workers Paid** est active. |
| Erreur de taille « exceeds the size limit » pour le site | L’offre Workers Paid n’est pas active. |
| Discord affiche « Invalid OAuth2 redirect_uri » | La redirection de l’étape 4 ne correspond pas exactement à l’adresse affichée dans le résumé du workflow. |
| `/sante` : « Jeton du bot invalide » | Régénérez le jeton (portail Discord → Bot), mettez à jour `DISCORD_BOT_TOKEN` sur GitHub, relancez le workflow. |
| `/sante` : « Intention refusée par Discord » | Activez *Server Members Intent* ou créez la variable `BOT_MEMBER_EVENTS` = `false`. |
| « Le jeton Cloudflare n’a pas accès à Hyperdrive » | Modifiez le jeton (étape 2) : ajoutez **Compte · Hyperdrive · Modifier**, puis relancez. |
| Les pages du site mettent 30 s puis affichent une erreur | Le site n’utilise pas Hyperdrive : vérifiez l’étape « Préparer Hyperdrive » du workflow. |
| `/sante` : « Base de données injoignable » | Vérifiez `DATABASE_URL` : *Session pooler*, port `5432`, mot de passe correct, `?sslmode=require`. |
| `/sante` ne répond pas juste après un déploiement | Le premier démarrage d’un conteneur prend quelques minutes ; un relanceur automatique le redémarre toutes les 5 minutes s’il s’est arrêté. |
| Les commandes `/mys` n’apparaissent pas | Les commandes globales mettent jusqu’à 1 h à se propager. Pour un essai immédiat, définissez `DISCORD_DEV_GUILD_ID`. |
| Le bot redémarre souvent (beaucoup de serveurs) | Le champ `memoireMo` de `/sante` approche 256 : dans `apps/bot-host/src/index.ts`, passez `BOT_INSTANCE` de `"lite"` à `"standard-1"` (4 Gio, plus cher : voir la grille tarifaire). |

**Journaux en direct** : Cloudflare → **Workers & Pages** → `make-your-server` (site) ou `make-your-server-bot` (bot) → **Logs**.

## Pour aller plus loin : déployer depuis son ordinateur

Sans GitHub Actions (nécessite Node.js 22, pnpm et Docker en marche) :

```bash
pnpm install
npx wrangler login
# Base
DATABASE_URL="postgresql://…" pnpm db:migrate && DATABASE_URL="postgresql://…" pnpm db:seed
# Site
cd apps/web && pnpm cf:deploy
npx wrangler secret put DATABASE_URL     # répétez pour chaque secret de l’étape 5 + APP_URL
# Bot
cd ../bot-host && npx wrangler deploy
npx wrangler secret put DATABASE_URL     # DATABASE_URL, DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, APP_URL
```
