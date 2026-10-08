# Nuagerie

Galerie photo personnelle pour OneDrive, en **lecture seule** : les photos et vidéos
rangées par albums, retrouvées par date et par lieu. Une PWA pensée pour le téléphone,
agréable aussi sur PC.

- 100 % côté client, sans serveur, sans suivi.
- Lecture seule : permissions Microsoft Graph limitées à `Files.Read`, `User.Read`,
  `offline_access`. Seule exception, à activer soi-même : la synchronisation des favoris et des
  préférences, rangés dans un dossier à part (`Applis/Nuagerie`), avec une permission limitée à ce
  dossier. Réglages → Permissions montre ce
  que Microsoft autorise réellement.
- Un **mode démo** avec ~20 000 photos factices permet de tout essayer sans compte.

## Ce que fait Nuagerie

- **Albums.** Chaque dossier est un album possible. Les dossiers techniques (années,
  mois, `Sans date`) n’en sont jamais : leurs fichiers vont à l’album au-dessus. On choisit
  les albums de l’accueil, leurs sous-albums s’affichent dans leur page, et l’accueil se
  trie par date ou par nom. Un appui long sur un album ouvre son menu : le masquer, voir ses
  photos sur la carte, l’ouvrir dans OneDrive.
- **Tout.** Toutes les photos dans une seule grille chronologique, avec une frise de dates
  sur le côté pour sauter à un mois, et un filtre pour écarter des albums.
- **Grilles.** Pincer change le nombre de colonnes. Un appui long sélectionne des photos
  (glisser en prend plusieurs, toucher un mois le prend en entier) pour les partager, les
  mettre en favoris ou les télécharger d’un coup.
- **Carte.** Les photos géolocalisées, regroupées par lieu ; toucher un groupe zoome dessus,
  et un bandeau montre les photos de la zone.
- **Visionneuse.** Plein écran, glisser pour passer d’une photo à l’autre, pincer pour
  zoomer, lecture des vidéos. Toucher la date ouvre les infos : date et son origine, album,
  dossier, appareil photo, taille, lieu. Les photos HEIC s’affichent via la grande miniature de
  OneDrive. Partager ou télécharger l’original se fait à la demande.
- **Dates fiables.** La date de prise de vue vient des données EXIF, sinon du nom du fichier
  (`20261006_084759.jpg`, `IMG-20250914-WA0003.jpg`, `Screenshot_…`, horodatages…), sinon
  la photo est rangée dans « Sans date », toujours en dernier. Jamais la date d’envoi dans
  OneDrive, qui peut avoir des années de retard.
- **Hors connexion.** L’application s’installe sur le téléphone. L’index des photos et les
  miniatures déjà vues restent sur l’appareil : sans réseau, tout ce qui a été vu reste
  consultable.
- **Favoris.** Un cœur dans la visionneuse, et un album « Favoris » en tête de l’accueil.
- **Synchronisation.** Optionnelle : les favoris, les préférences (albums affichés, tris,
  filtre) et les dossiers parcourus se rangent dans un dossier à part de OneDrive
  (`Applis/Nuagerie`), pour ne jamais être perdus et suivre d’un appareil à l’autre, avec une
  copie de l’index pour qu’un nouvel appareil s’ouvre en quelques secondes. Activée sur un
  appareil, elle s’active toute seule sur les autres. Les favoris en ont besoin.
- **Réglages.** Les dossiers OneDrive parcourus (`/Pictures` par défaut, d’autres à
  ajouter), le choix des albums, la synchronisation, le thème clair ou sombre, la taille du cache des
  miniatures, et les permissions accordées à l’application.

## Vie privée

- Les seuls échanges réseau vont vers Microsoft (connexion et Graph) et vers les fonds de
  carte d’[OpenStreetMap](https://www.openstreetmap.org/copyright).
- Les noms de lieux sont calculés sur l’appareil : les coordonnées des photos ne sont
  envoyées nulle part.
- L’index et les miniatures sont gardés dans le navigateur (IndexedDB, Cache Storage), et
  effacés à la déconnexion.
- La synchronisation, une fois activée, est le seul contenu écrit dans OneDrive, dans le
  OneDrive de la personne connectée : `Applis/Nuagerie/nuagerie.json` (favoris, préférences,
  dossiers) et `Applis/Nuagerie/index.json.gz`, une copie de l’index (noms, dates et lieux des
  fichiers, sans les photos) qui permet à un autre appareil de s’ouvrir en quelques secondes.

## Essayer

En ligne, sans compte ni installation : <https://nuagerie.pages.dev/?demo=1> (la démo,
avec ses photos factices). Ou en local :

```bash
npm install
npm run dev:demo
```

Puis ouvrir <http://localhost:5173>. Installation détaillée, test sur téléphone,
déploiement et connexion à OneDrive : [docs/SETUP.md](docs/SETUP.md). Les règles du dépôt
pour contribuer : [CLAUDE.md](CLAUDE.md).

## Nouveautés et problèmes

Ce que chaque version apporte : [CHANGELOG.md](CHANGELOG.md), aussi affiché dans l’application après
une mise à jour. Un problème ou une idée : Réglages → À propos → « Signaler un problème », ou
directement dans les [issues](https://github.com/j3ffx/nuagerie/issues).

## Stack

React, TypeScript (strict) et Vite ; MSAL pour la connexion Microsoft ; vite-plugin-pwa
(Workbox) pour l’installation et le hors-ligne ; `idb` pour l’index local ;
`@tanstack/react-virtual` pour des grilles fluides de dizaines de milliers de photos ;
Leaflet et supercluster pour la carte ; wouter pour la navigation. Tests : Vitest,
Playwright et axe-core (accessibilité).

## Crédits

- Fonds de carte © les contributeurs d’[OpenStreetMap](https://www.openstreetmap.org/copyright).
- Noms de lieux : [GeoNames](https://www.geonames.org/) (licence CC BY 4.0), liste générée
  par `scripts/build-places.mjs`.
- Police [Nunito](https://fonts.google.com/specimen/Nunito) (licence SIL Open Font).

## Licence

[GPL-3.0](LICENSE).
