# Nouveautés

Les changements de chaque version de Nuagerie, la plus récente en premier. Les numéros suivent le
[versionnage sémantique](https://semver.org/lang/fr/) : tant qu’ils commencent par 0, l’application
évolue encore beaucoup.

## 0.2.1 — 2026-10-08

### Nouveautés

- Avec la synchronisation, une copie de l’index de tes photos est rangée dans Applis/Nuagerie : un
  nouvel appareil (ou après une déconnexion) s’ouvre en quelques secondes au lieu de tout relister.
- Dans l’album Favoris, une photo retirée des favoris reste ouverte : un second appui sur le cœur
  la remet, en cas d’erreur.
- Le bouton « Se déconnecter » est rouge, comme ce qu’il efface.

## 0.2.0 — 2026-10-08

Favoris, et synchronisation entre tes appareils.

### Nouveautés

- Favoris : un cœur dans la visionneuse, et un album « Favoris » en tête de l’accueil.
- Synchronisation (Réglages → Synchronisation), à activer toi-même : tes favoris, tes préférences
  (albums affichés, tris, ordre et filtre de « Tout ») et tes dossiers se rangent dans ton OneDrive,
  dans un dossier à part (Applis/Nuagerie). Rien ne se perd, et une fois activée sur un appareil,
  elle s’active toute seule sur les autres, qui suivent tes changements en une minute environ.
  Nuagerie demande à Microsoft le droit d’écrire dans ce seul dossier : tes photos restent en
  lecture seule.
- Réglages → Permissions montre ce que Microsoft autorise vraiment à Nuagerie, avec un lien pour
  le retirer.
- En thème clair, la visionneuse est claire tant que ses barres sont affichées ; un toucher les
  masque et passe le fond en noir pour regarder la photo.
- Un nom d’album trop long se lit en entier : touche la date et l’album dans la visionneuse, ou
  fais un appui long sur la tuile d’un album.
- Quand une nouvelle version est prête, son numéro s’affiche dans le bandeau et dans Réglages → À
  propos.

### Corrections

- La flèche des listes déroulantes (tri des albums, taille du cache) n’apparaît plus coupée en deux.

## 0.1.2 — 2026-10-08

### Nouveautés

- Les confirmations (réindexer, se déconnecter, enregistrer les dossiers, revenir au choix d’albums
  par défaut) s’affichent dans une fenêtre de l’application, plus lisible que celle du navigateur.
- Un appui long n’ouvre plus le menu du navigateur (copier le lien, télécharger l’image) et ne
  sélectionne plus le texte.

### Corrections

- Carte : une photo pile sur le bord du bas ne fait plus clignoter la carte.

## 0.1.1 — 2026-10-08

Petites améliorations du quotidien.

### Nouveautés

- Toucher un bouton, un album ou une photo l’assombrit légèrement le temps de l’appui (l’éclaircit
  en thème sombre) : on voit tout de suite que le geste est pris en compte.
- Choisir les dossiers : chaque dossier indique combien d’éléments il contient et son poids, et un
  dossier sans sous-dossier dit combien de fichiers il contient.

## 0.1.0 — 2026-10-07

Première version : toutes les photos et vidéos de OneDrive, rangées par albums, retrouvées par date
et par lieu, sur le téléphone comme sur PC.

### Nouveautés

- Albums tirés des dossiers OneDrive, avec sous-albums ; les dossiers d’années, de mois et « Sans
  date » n’en sont jamais. Choix des albums de l’accueil, tri par date ou par nom.
- « Tout » : toutes les photos dans une seule grille, avec une frise de dates pour sauter à un mois et
  un filtre pour écarter des albums.
- Carte des photos géolocalisées, regroupées par lieu, avec les photos de la zone affichée et un lien
  vers l’application de cartes du téléphone.
- Visionneuse plein écran : glisser, pincer pour zoomer, vidéos, photos HEIC, lieu de la photo,
  partager et télécharger l’original.
- Dates de prise de vue fiables : données de l’appareil photo, sinon nom du fichier, sinon « Sans
  date », toujours en dernier. Jamais la date d’envoi dans OneDrive.
- Hors connexion : l’application s’installe et s’ouvre sans réseau, avec les photos déjà vues.
- Réglages : dossiers OneDrive parcourus, choix des albums, thème clair ou sombre, cache des
  miniatures, réindexation, compte. La déconnexion efface les données gardées sur l’appareil.
- Mode démo avec 20 000 photos factices, sans compte.
- Lecture seule : Nuagerie ne peut rien modifier dans OneDrive.
