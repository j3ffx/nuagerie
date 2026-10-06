# Nuagerie — mise en place

Guide pas à pas : installer le projet, le tester sur PC et sur téléphone,
le déployer sur Cloudflare Pages, et préparer la connexion à OneDrive.

## 1. Prérequis

- **Node.js 22** (la version est fixée dans `.node-version`) et npm.
- **Git**.
- Un téléphone Android sur **le même Wi-Fi** que le PC, pour les tests sur téléphone.

## 2. Installation

```bash
git clone https://github.com/j3ffx/nuagerie.git
cd nuagerie
npm install
```

`npm install` active aussi le hook git `pre-push` (voir §8).

Pour les vraies données, copier `.env.example` en `.env`
et y renseigner le Client ID (§7). Le mode démo n’a besoin d’aucune configuration.

## 3. Commandes

| Commande                                                | Rôle                                                                                              |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `npm run dev:demo`                                      | Interface avec ~20 000 photos factices, sans compte ni réseau. **Le mode de travail par défaut.** |
| `npm run dev`                                           | Serveur de développement sur <http://localhost:5173>, avec les vraies données.                    |
| `npm run dev:lan`                                       | Même chose en HTTPS sur le réseau local, avec un QR code pour le téléphone (§4).                  |
| `npm run build`                                         | Build de production dans `dist/`.                                                                 |
| `npm run preview`                                       | Sert le build de production sur <http://localhost:4173> (avec le service worker).                 |
| `npm test`                                              | Tests unitaires (Vitest).                                                                         |
| `npm run e2e`                                           | Tests de bout en bout en mode démo, écran de téléphone (Playwright).                              |
| `npm run typecheck` / `npm run lint` / `npm run format` | Types, lint, formatage.                                                                           |
| `npm run check:private`                                 | Vérifie qu’aucun fichier ou donnée personnelle n’est suivi par git (§8).                          |

La première fois, Playwright a besoin de son navigateur : `npx playwright install chromium`.

Le mode démo s’active aussi avec `?demo=1` dans l’URL (mémorisé sur l’appareil ;
`?demo=0` le désactive), et automatiquement quand aucun Client ID n’est configuré.

## 4. Tester sur le téléphone (mode démo)

1. Lancer `npm run dev:lan`.
2. La première fois, Windows demande d’autoriser Node.js sur le réseau :
   accepter pour les **réseaux privés**.
3. Scanner le QR code affiché dans le terminal avec l’appareil photo du téléphone.
4. Le certificat est local (auto-signé) : Chrome affiche un avertissement la première fois.
   Toucher **Paramètres avancés**, puis **Continuer vers le site**.
5. Chaque modification du code se recharge instantanément sur le téléphone.

Si la page ne s’ouvre pas :

- le terminal propose d’autres adresses sous le QR code ;
- certains réseaux (Wi-Fi invité, public ou d’entreprise) isolent les appareils entre eux ;
  utiliser alors le Wi-Fi de la maison ou le point d’accès du téléphone.

Le service worker (mode hors-ligne, installation) n’est pas actif en développement :
pour le tester, utiliser une URL Cloudflare Pages (§6) ou `npm run preview` sur le PC.

## 5. Vraies données sur le téléphone

La connexion Microsoft impose des **URL de redirection** déclarées à l’avance.
D’après la [documentation Microsoft](https://learn.microsoft.com/entra/identity-platform/reply-url) :

- HTTPS obligatoire, sauf pour `localhost` ;
- pour `localhost`, le port est ignoré ; pour toute autre adresse, il doit correspondre exactement ;
- **pas de jokers** (`https://*.exemple.fr`) ni de paramètres de requête pour les comptes personnels ;
- 256 caractères maximum par URL, 100 URL maximum.

Conséquence : l’adresse IP locale du PC (`https://192.168.x.x:5173`) n’est pas une bonne
URL de redirection (elle change, et son certificat n’est pas reconnu). Il faut une
**URL HTTPS à nom fixe** qui pointe vers le PC : un tunnel.

Les vraies données peuvent aussi être testées sur le téléphone via une URL
Cloudflare Pages stable (§6), sans rechargement instantané.

## 6. Déploiement sur Cloudflare Pages

Chaque push sur `main` met à jour l’URL de production, et chaque branche a sa propre
URL de prévisualisation. La CI GitHub Actions (types, lint, tests, e2e) tourne en parallèle.

1. Créer un compte gratuit sur <https://dash.cloudflare.com/sign-up>.
2. Dans le tableau de bord : **Workers & Pages** → **Créer** → onglet **Pages** →
   **Importer un dépôt Git existant** (l’intitulé exact peut varier).
3. Autoriser l’application GitHub de Cloudflare **sur le seul dépôt `nuagerie`**.
4. Réglages du build :
   - nom du projet : `nuagerie` (donne l’URL `https://nuagerie.pages.dev`, si le nom est libre) ;
   - branche de production : `main` ;
   - préréglage : **Aucun** (ou Vite) ;
   - commande de build : `npm run build` ;
   - dossier de sortie : `dist`.
5. Lancer le premier déploiement.

URL obtenues :

- production : `https://nuagerie.pages.dev` ;
- une branche `essai` : `https://essai.nuagerie.pages.dev` (adresse stable par branche) ;
- chaque déploiement a aussi une URL unique (`https://<hash>.nuagerie.pages.dev`).

Le mode démo marche sur toutes ces URL. La connexion OneDrive ne marchera que sur
les URL déclarées dans l’inscription Microsoft (§7) : la production et, au besoin,
quelques alias de branche stables, jamais les URL uniques par déploiement.

Pour relier OneDrive, ajouter la variable d’environnement `VITE_MSAL_CLIENT_ID`
(**Paramètres** → **Variables et secrets**, pour la production et les prévisualisations),
puis relancer un déploiement.

Les en-têtes HTTP (sécurité, cache) sont dans `public/_headers`. Comme il n’y a pas de
`404.html`, Cloudflare Pages sert `index.html` pour toutes les routes (application monopage).

## 7. Inscription de l’application Microsoft

Nuagerie lit OneDrive avec les droits de l’utilisateur connecté, en **lecture seule**.
Il faut déclarer l’application une fois auprès de Microsoft. **Aucun secret n’est créé** :
une application monopage n’en a pas besoin.

Prérequis indiqués par Microsoft : un compte Azure (l’offre gratuite suffit) et son
annuaire par défaut (**Default Directory**). L’inscription d’application elle-même est gratuite.

1. Se connecter au [centre d’administration Microsoft Entra](https://entra.microsoft.com)
   avec le compte Microsoft personnel.
2. **Entra ID** → **Inscriptions d’applications** → **Nouvelle inscription**.
3. Nom : `Nuagerie`.
4. Types de comptes pris en charge : **Comptes personnels uniquement**
   (_Personal accounts only_).
5. URI de redirection : plateforme **Application monopage (SPA)**, valeur `http://localhost:5173`.
6. **Inscrire**, puis noter l’**ID d’application (client)**.
7. **Authentification** → plateforme SPA → ajouter les autres URI de redirection :
   - `https://nuagerie.pages.dev` ;
   - l’URL du tunnel pour le téléphone (§5), quand elle sera choisie.
8. **Autorisations d’API** → **Microsoft Graph** → **Autorisations déléguées** :
   `Files.Read`, `User.Read`, `offline_access`, **et rien d’autre**.
9. Copier l’ID d’application dans `.env` (`VITE_MSAL_CLIENT_ID=…`) et dans
   la variable d’environnement Cloudflare (§6).

Le Client ID n’est pas un secret, mais il reste hors du dépôt (`.env` est ignoré par git).

## 8. Dépôt public : protection des données personnelles

Le dépôt est public : rien de personnel ne doit y entrer (noms de dossiers réels,
chemins locaux, adresses, vraies photos, identité).

- `.gitignore` exclut les notes de travail locales, les fichiers `.env` et le fichier local `.private-patterns`.
- `npm run check:private` échoue si :
  - un fichier interdit ou ignoré est suivi par git ;
  - un commit a une identité qui n’est pas une adresse _noreply_ ;
  - un fichier suivi ou un message de commit contient un motif listé dans `.private-patterns`.
- Ce contrôle tourne automatiquement **avant chaque push** (hook `.githooks/pre-push`,
  activé par `npm install`) et dans la CI.
- `.private-patterns` (jamais versionné) contient une expression régulière par ligne :
  noms propres, adresses e-mail, noms de dossiers personnels, chemins locaux…
  Chacun le remplit sur son propre poste.

Identité git conseillée pour ce dépôt : l’adresse _noreply_ fournie par GitHub
(**Settings** → **Emails** sur github.com).
