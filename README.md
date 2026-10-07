# Nuagerie

Galerie photo personnelle pour OneDrive, en **lecture seule** : les photos et vidéos
rangées par albums, retrouvées par date et par lieu. Une PWA pensée pour le téléphone,
agréable aussi sur PC.

- 100 % côté client, sans serveur, sans suivi.
- Permissions Microsoft Graph limitées à `Files.Read`, `User.Read`, `offline_access` :
  l’application ne peut rien modifier dans OneDrive.
- Un **mode démo** avec ~20 000 photos factices permet de tout essayer sans compte.

## Ce que fait Nuagerie

- **Albums.** Chaque dossier est un album possible. Les dossiers techniques (années,
  mois, `Sans date`) n’en sont jamais : leurs fichiers vont à l’album au-dessus. On choisit
  les albums de l’accueil, leurs sous-albums s’affichent dans leur page, et l’accueil se
  trie par date ou par nom.
- **Tout.** Toutes les photos dans une seule grille chronologique, avec une frise de dates
  sur le côté pour sauter à un mois, et un filtre pour écarter des albums.
- **Carte.** Les photos géolocalisées, regroupées par lieu ; toucher un groupe zoome dessus,
  et un bandeau montre les photos de la zone.
- **Visionneuse.** Plein écran, glisser pour passer d’une photo à l’autre, pincer pour
  zoomer, lecture des vidéos. Les photos HEIC s’affichent via la grande miniature de
  OneDrive. Partager ou télécharger l’original se fait à la demande.
- **Dates fiables.** La date de prise de vue vient des données EXIF, sinon du nom du fichier
  (`20261006_084759.jpg`, `IMG-20250914-WA0003.jpg`, `Screenshot_…`, horodatages…), sinon
  la photo est rangée dans « Sans date », toujours en dernier. Jamais la date d’envoi dans
  OneDrive, qui peut avoir des années de retard.
- **Hors connexion.** L’application s’installe sur le téléphone. L’index des photos et les
  miniatures déjà vues restent sur l’appareil : sans réseau, tout ce qui a été vu reste
  consultable.
- **Réglages.** Les dossiers OneDrive parcourus (`/Pictures` par défaut, d’autres à
  ajouter), le choix des albums, le thème clair ou sombre, la taille du cache des
  miniatures.

## Vie privée

- Les seuls échanges réseau vont vers Microsoft (connexion et Graph) et vers les fonds de
  carte d’[OpenStreetMap](https://www.openstreetmap.org/copyright).
- Les noms de lieux sont calculés sur l’appareil : les coordonnées des photos ne sont
  envoyées nulle part.
- L’index et les miniatures sont gardés dans le navigateur (IndexedDB, Cache Storage), sur
  l’appareil uniquement, et effacés à la déconnexion.

## Essayer

```bash
npm install
npm run dev:demo
```

Puis ouvrir <http://localhost:5173>. Installation détaillée, test sur téléphone,
déploiement et connexion à OneDrive : [docs/SETUP.md](docs/SETUP.md). Les règles du dépôt
pour contribuer : [CLAUDE.md](CLAUDE.md).

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
