# Nuagerie — mise en place

Installer le projet, le tester sur PC et sur téléphone, déployer sa propre instance
sur Cloudflare Pages et la relier à OneDrive.

## 1. Prérequis

- **Node.js 22** (version fixée dans `.node-version`) et npm.
- **Git**.
- Pour tester sur téléphone : un téléphone Android sur **le même Wi-Fi** que le PC.

## 2. Installation

```bash
git clone https://github.com/j3ffx/nuagerie.git
cd nuagerie
npm install
```

`npm install` active aussi les hooks git du dépôt (voir [CLAUDE.md](../CLAUDE.md)).

Pour les vraies données, copier `.env.example` en `.env` et y renseigner le Client ID
(§6). Le mode démo n’a besoin d’aucune configuration.

## 3. Commandes

| Commande                                                | Rôle                                                                                          |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `npm run dev:demo`                                      | Interface avec ~20 000 photos factices, sans compte ni réseau. Le mode de travail par défaut. |
| `npm run dev`                                           | Serveur de développement sur <http://localhost:5173>, avec les vraies données.                |
| `npm run dev:lan`                                       | Même chose en HTTPS sur le réseau local, avec un QR code pour le téléphone (§4).              |
| `npm run build`                                         | Build de production dans `dist/`.                                                             |
| `npm run preview`                                       | Sert le build de production sur <http://localhost:4173> (avec le service worker).             |
| `npm test`                                              | Tests unitaires (Vitest).                                                                     |
| `npm run e2e`                                           | Tests de bout en bout en mode démo, sur un écran de téléphone (Playwright).                   |
| `npm run typecheck` / `npm run lint` / `npm run format` | Types, lint, formatage.                                                                       |
| `npm run deploy`                                        | Build, vérification du contenu publié, puis mise en ligne sur Cloudflare Pages (§5).          |

La première fois, Playwright a besoin de son navigateur : `npx playwright install chromium`.
`npm run e2e` construit l’application puis la sert sur le port 4173. Si un serveur y tourne
déjà (`npm run preview`, ou un ancien lancement resté ouvert), Playwright le réutilise sans
reconstruire : lancer `npm run build` avant, ou arrêter ce serveur. Un autre projet peut aussi
occuper ce port (c’est celui de Vite) : `E2E_PORT=4183 npm run e2e` en prend un autre.

Le mode démo s’active aussi avec `?demo=1` dans l’URL (mémorisé sur l’appareil ;
`?demo=0` le désactive), et automatiquement quand aucun Client ID n’est configuré.

## 4. Tester sur le téléphone

1. Lancer `npm run dev:lan`.
2. La première fois, Windows demande d’autoriser Node.js sur le réseau :
   accepter pour les **réseaux privés**.
3. Scanner le QR code affiché dans le terminal avec l’appareil photo du téléphone.
4. Le certificat est local (auto-signé) : Chrome affiche un avertissement la première fois.
   Toucher **Paramètres avancés**, puis **Continuer vers le site**.
5. Chaque modification du code se recharge instantanément sur le téléphone.

Si la page ne s’ouvre pas :

- le terminal propose d’autres adresses sous le QR code ;
- certains réseaux (Wi-Fi invité, public ou d’entreprise) isolent les appareils entre eux.

Le service worker (hors-ligne, installation) n’est pas actif en développement :
pour le tester, utiliser l’instance déployée (§5) ou `npm run preview` sur le PC.

### Vraies données sur le téléphone

La connexion Microsoft impose des **URL de redirection** déclarées à l’avance.
D’après la [documentation Microsoft](https://learn.microsoft.com/entra/identity-platform/reply-url) :

- HTTPS obligatoire, sauf pour `localhost` ;
- pour `localhost`, le port est ignoré ; pour toute autre adresse, il doit correspondre exactement ;
- **pas de jokers** (`https://*.exemple.fr`) ni de paramètres de requête pour les comptes personnels ;
- 256 caractères maximum par URL, 100 URL maximum.

L’adresse IP locale du PC n’est donc pas une bonne URL de redirection : elle change, et
son certificat n’est pas reconnu. Les vraies données se testent sur le téléphone via
l’instance déployée (§5), ou via un tunnel HTTPS à nom fixe vers le PC.

## 5. Déploiement sur Cloudflare Pages

Le déploiement se fait depuis le PC avec `wrangler`, l’outil en ligne de commande de Cloudflare.

Une seule fois :

1. Créer un compte gratuit sur <https://dash.cloudflare.com/sign-up>.
2. `npx wrangler login`, puis autoriser l’accès dans la page qui s’ouvre.
3. Créer le projet Pages :
   `npx wrangler pages project create nuagerie --production-branch main --force`.
   `--force` crée un projet **Pages** : sans lui, les versions récentes de wrangler
   créent un projet Workers et modifient la configuration Vite.
   Si le nom est pris, en choisir un autre et l’utiliser aussi dans le script `deploy`
   de `package.json`.

Ensuite, à chaque mise en ligne : `npm run deploy`. Le script vérifie d’abord le
contenu de `dist/` : pas de source map, aucun motif listé dans `.private-patterns`.

URL obtenues :

- production (branche `main`) : `https://nuagerie.pages.dev`, et le domaine `https://nuagerie.app` (voir « Domaine à soi ») ;
- une autre branche, par exemple `essai` : `https://essai.nuagerie.pages.dev` ;
- chaque déploiement a aussi une URL unique (`https://<hash>.nuagerie.pages.dev`).

Le mode démo marche sur toutes ces URL. La connexion OneDrive ne marche que sur les URL
déclarées dans l’inscription Microsoft (§6) : la production et, au besoin, quelques
alias de branche stables, jamais les URL uniques par déploiement.

Pour relier une instance à OneDrive, le Client ID doit être présent **au moment du build**
(`.env` sur la machine qui lance `npm run deploy`).

### Déploiement automatique (GitHub Actions)

Une fois configuré, chaque push est déployé par la CI, **seulement si tous les contrôles passent** :
`main` en production, les autres branches sur leur URL de branche. Sans configuration,
l’étape de déploiement est simplement sautée.

1. Cloudflare → icône du profil → **Profil** → **Jetons d’API** → **Créer un jeton** →
   **Créer un jeton personnalisé** :
   - autorisation : **Compte** → **Cloudflare Pages** → **Modifier** ;
   - ressources du compte : son propre compte ;
   - **Continuer**, **Créer le jeton**, puis copier le jeton (il ne s’affiche qu’une fois).
2. Sur le PC, dans le dossier du projet, enregistrer le jeton comme secret GitHub
   (la commande demande de le coller) :

   ```bash
   gh secret set CLOUDFLARE_API_TOKEN
   ```

3. Enregistrer aussi l’identifiant de compte Cloudflare (affiché par `npx wrangler whoami`)
   comme secret `CLOUDFLARE_ACCOUNT_ID`, et le Client ID comme variable :
   `gh variable set VITE_MSAL_CLIENT_ID`.

Les en-têtes HTTP (sécurité, cache) sont dans `public/_headers`. Sans `404.html`,
Cloudflare Pages sert `index.html` pour toutes les routes (application monopage).

### Domaine à soi

Une adresse à soi (par exemple `nuagerie.app`) plutôt que `<projet>.pages.dev`. À faire avant de
partager l’application : les données d’un appareil (index, miniatures, application installée)
appartiennent à une adresse, et en changer plus tard oblige chacun à réinstaller.

1. **Acheter le domaine** : Cloudflare → **Domain Registration** → **Register Domains**, chercher
   le nom, payer. Chez Cloudflare, le prix est celui du registre, et le DNS est déjà au bon
   endroit. Les domaines `.app` imposent le HTTPS, ce que Pages fait de toute façon.
2. **Le brancher sur Pages** : **Workers & Pages** → le projet → **Custom domains** →
   **Set up a custom domain** → le nom → **Activate domain**. Cloudflare crée l’enregistrement DNS
   et le certificat ; compter quelques minutes, jusqu’à ce que l’état passe à **Active**.
3. **Microsoft** (section 6) : dans **Authentification**, ajouter `https://<domaine>/redirect`
   aux URI SPA, sans retirer celle de `pages.dev` (les appareils qui y ont leurs photos s’y
   connectent encore) ; dans **Personnalisation et propriétés**, mettre
   `https://<domaine>/confidentialite` comme déclaration de confidentialité.
4. **Le déménagement** : enregistrer l’adresse comme variable GitHub, puis pousser (ou relancer
   la CI) :

   ```bash
   gh variable set VITE_HOME_URL --body https://nuagerie.app
   ```

   L’adresse `pages.dev` envoie alors aussitôt vers la nouvelle quiconque n’y a encore rien, en
   gardant la page demandée (`?demo=1` compris). Qui s’y est déjà connecté voit un bandeau
   « Nuagerie a déménagé », avec un lien : ses photos restent là jusqu’à sa déconnexion. Avec la
   synchronisation, la nouvelle adresse s’ouvre en quelques secondes grâce à la copie de l’index ;
   le thème, la langue, les albums gardés hors connexion et les recherches récentes, propres à
   chaque appareil, sont à refaire. Les aperçus de branches et `localhost` ne déménagent jamais
   (`src/app/home.ts`).

5. Remplacer `nuagerie.pages.dev` par le nouveau domaine dans les README et ce fichier.

## 6. Inscription de l’application Microsoft

Nuagerie lit OneDrive avec les droits de l’utilisateur connecté, en **lecture seule**.
L’application se déclare une fois auprès de Microsoft. **Aucun secret n’est créé** :
une application monopage n’en a pas besoin.

Prérequis indiqués par Microsoft : un compte Azure (l’offre gratuite suffit) et son
annuaire par défaut (**Default Directory**). L’inscription d’application est gratuite.

1. Se connecter au [centre d’administration Microsoft Entra](https://entra.microsoft.com)
   avec le compte Microsoft personnel.
2. **Entra ID** → **Inscriptions d’applications** → **Nouvelle inscription**.
3. Nom : `Nuagerie`.
4. Types de comptes pris en charge : **Comptes personnels uniquement**
   (_Personal accounts only_).
5. URI de redirection : plateforme **Application monopage (SPA)**, valeur
   `http://localhost:5173/redirect` (page « pont » exigée par MSAL v5).
6. **Inscrire**, puis noter l’**ID d’application (client)**.
7. **Authentification** → plateforme SPA → ajouter l’URL de l’instance déployée suivie de
   `/redirect`, par exemple `https://nuagerie.app/redirect`.
8. **Autorisations d’API** → **Microsoft Graph** → **Autorisations déléguées** :
   `Files.Read`, `User.Read`, `offline_access`. La synchronisation (favoris, préférences, dossiers)
   demande en plus, au moment où on l’active, `Files.ReadWrite.AppFolder` (écriture dans le seul dossier `Applis/Nuagerie`) : Microsoft
   accepte cette demande sans qu’elle soit déclarée ici, mais on peut l’ajouter à la liste pour la
   transparence. Aucune autre permission.
9. **Personnalisation et propriétés** (_Branding & properties_) → **URL de la déclaration de
   confidentialité** : l’adresse de l’instance suivie de `/confidentialite`, par exemple
   `https://nuagerie.app/confidentialite`. La page se lit sans être connecté, en français
   ou en anglais selon la langue du navigateur.
10. Copier l’ID d’application dans `.env` : `VITE_MSAL_CLIENT_ID=…`.

Le Client ID n’est pas un secret, mais il reste hors du dépôt (`.env` est ignoré par git).
