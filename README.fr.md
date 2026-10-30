# Nuagerie

[English](README.md) · **Français**

Galerie photo personnelle pour OneDrive, en **lecture seule par défaut** : les photos et vidéos
rangées par albums, retrouvées par date et par lieu. Une PWA pensée pour le téléphone,
agréable aussi sur PC.

- 100 % côté client, sans serveur, sans suivi.
- Lecture seule par défaut : permissions Microsoft Graph limitées à `Files.Read`, `User.Read`,
  `offline_access`. Deux exceptions, chacune à activer soi-même : la synchronisation des favoris
  et des préférences, rangés dans un dossier à part (`Applis/Nuagerie`), avec une permission
  limitée à ce dossier ; et les modifications (supprimer, déplacer et restaurer des photos, gérer
  les albums), qui demandent le droit de modifier les fichiers. Réglages → Permissions montre ce
  que Microsoft autorise réellement.
- Un **mode démo** avec ~20 000 photos factices permet de tout essayer sans compte.
- En **français** et en **anglais**, selon la langue du téléphone ou au choix dans les réglages.

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
- **Modifications.** Désactivées par défaut ; une fois activées dans les réglages, supprimer
  des photos (elles vont dans la corbeille de OneDrive), les déplacer dans un album, créer,
  renommer ou supprimer des albums vides, depuis la visionneuse, une sélection ou le menu d’un
  album. Chaque modification dit ce qu’elle a fait, avec « Annuler », et un écran Corbeille
  liste ce que l’appli a supprimé, pour le restaurer pendant 30 jours.
- **Souvenirs.** En haut de l’accueil, les photos prises le même jour les années passées
  (« Il y a 3 ans »). Fermée, la section revient le lendemain, sur tous les appareils
  synchronisés. Une notification les jours de souvenirs, à activer dans les réglages (Chrome,
  application installée) : au plus une par jour, jamais avant 8 h, calculée sur l’appareil.
- **Recherche.** Par album, par lieu (ville ou pays) et par date en langage courant
  (« 2019 », « juillet 2024 », « 14 juillet », « été 2023 », « 2019 à 2021 »), et tout
  ensemble : « Lyon été 2023 ». Les lieux des résultats permettent d’affiner. Elle porte sur
  tout le OneDrive parcouru, albums masqués compris.
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
  consultable. Les favoris et les albums choisis (appui long → « Garder hors connexion ») sont
  téléchargés à l’avance, en Wi-Fi, avec leurs grandes images : ils s’ouvrent en grand sans
  réseau. Une pastille sur la tuile dit où ça en est.
- **Favoris.** Un cœur dans la visionneuse, et un album « Favoris » en tête de l’accueil.
- **Synchronisation.** Optionnelle : les favoris, les préférences (albums affichés, tris,
  filtre) et les dossiers parcourus se rangent dans un dossier à part de OneDrive
  (`Applis/Nuagerie`), pour ne jamais être perdus et suivre d’un appareil à l’autre, avec une
  copie de l’index pour qu’un nouvel appareil s’ouvre en quelques secondes. Activée sur un
  appareil, elle s’active toute seule sur les autres. Les favoris en ont besoin.
- **Réglages.** Les dossiers OneDrive parcourus (le dossier Images de OneDrive par défaut,
  quel que soit son nom dans la langue du compte, d’autres à ajouter), le choix des albums, la langue, la synchronisation, le thème clair ou sombre, la taille du cache des
  miniatures, et les permissions accordées à l’application.

## Vie privée

Le détail, lisible sans compte : [nuagerie.app/confidentialite](https://nuagerie.app/confidentialite).

- Les seuls échanges réseau vont vers Microsoft (connexion et Graph) et vers les fonds de
  carte d’[OpenStreetMap](https://www.openstreetmap.org/copyright).
- Les noms de lieux sont calculés sur l’appareil : les coordonnées des photos ne sont
  envoyées nulle part.
- L’index, les miniatures et les lieux des photos sont gardés dans le navigateur (IndexedDB,
  Cache Storage), et effacés à la déconnexion, comme les recherches récentes.
- La synchronisation, une fois activée, est le seul contenu écrit dans OneDrive, dans le
  OneDrive de la personne connectée : `Applis/Nuagerie/nuagerie.json` (favoris, préférences,
  dossiers) et `Applis/Nuagerie/index.json.gz`, une copie de l’index (noms, dates et lieux des
  fichiers, sans les photos) qui permet à un autre appareil de s’ouvrir en quelques secondes.

## Essayer

En ligne, sans compte ni installation : <https://nuagerie.app/?demo=1> (la démo,
avec ses photos factices). Ou en local :

```bash
npm install
npm run dev:demo
```

Puis ouvrir <http://localhost:5173>. Installation détaillée, test sur téléphone,
déploiement et connexion à OneDrive : [docs/SETUP.md](docs/SETUP.md). Les règles du dépôt
pour contribuer : [CLAUDE.md](CLAUDE.md).

## Nouveautés et problèmes

Ce que chaque version apporte : [CHANGELOG.md](CHANGELOG.md) ([en anglais](CHANGELOG.en.md)), aussi affiché dans l’application après
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
