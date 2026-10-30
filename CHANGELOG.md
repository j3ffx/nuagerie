# Nouveautés

Les changements de chaque version de Nuagerie, la plus récente en premier. Les numéros suivent le
[versionnage sémantique](https://semver.org/lang/fr/) : tant qu’ils commencent par 0, l’application
évolue encore beaucoup.

## Depuis la dernière version

### Nouveautés

- Nuagerie parle anglais : elle suit la langue du téléphone, ou se choisit dans Réglages →
  Apparence. La recherche comprend les dates dans les deux langues (« juillet 2024 », « July
  2024 »), et la notification des souvenirs suit la langue choisie.
- Les villes étrangères ont leur nom français : Londres, Bruxelles, Genève, Séville…
- Par défaut, Nuagerie parcourt le dossier Images de OneDrive, quel que soit son nom dans la
  langue du compte. Les dossiers déjà choisis ne changent pas. Un dossier « Undated » est rangé
  comme « Sans date ».
- Une page Confidentialité (Réglages → À propos) dit ce que Nuagerie fait de tes données ; elle
  se lit aussi sans compte.
- Nuagerie a sa propre adresse : nuagerie.app. L’ancienne y envoie ; qui y a déjà ses photos
  voit un bandeau et peut s’y installer à son rythme.

### Corrections

- Se déconnecter efface aussi les choix liés au compte (dossiers, albums affichés, tris, dernière
  vue de la carte), comme le dit la page Confidentialité ; le thème et la langue restent.
- La recherche ne prend plus « Mar » ou « Jan » seuls pour des mois (« Viña del Mar ») ; « mar
  2024 » reste mars 2024.

## 0.6.0 — 2026-10-29

Tes albums, même sans réseau.

### Nouveautés

- Garder hors connexion : un appui long sur un album (ou sur Favoris) → « Garder hors
  connexion ». Ses photos sont téléchargées à l’avance, en Wi-Fi, avec leurs grandes images :
  sans réseau, elles s’ouvrent en grand. La taille est indiquée avant.
- Une pastille sur la tuile d’un album gardé dit où il en est : verte quand tout est là, bleue
  qui tourne pendant le téléchargement, rouge en cas de problème. Touche-la pour voir la place
  prise, l’état ou l’erreur.
- Réglages → Hors connexion : ce qui est gardé, la place prise et la place restante, la
  progression, et « Tout retirer ».
- La notification des souvenirs montre une de leurs photos, et le nuage de Nuagerie dans la
  barre d’état au lieu d’une cloche.

### Corrections

- Pas de notification des souvenirs quand tu les as déjà vus ou fermés ce jour-là (même sur un
  autre appareil) ; celle déjà affichée s’en va.

## 0.5.0 — 2026-10-28

Revoir tes souvenirs.

### Nouveautés

- Souvenirs : en haut des albums, les photos prises le même jour les années passées, une carte
  par année (« Il y a 3 ans »). « Tout voir » les montre ensemble. La croix les ferme jusqu’au
  lendemain, sur tous tes appareils si la synchronisation est activée.
- Une notification les jours de souvenirs, à activer dans Réglages → Souvenirs (Chrome, appli
  installée) : une fois par jour au plus, jamais avant 8 h. C’est le téléphone qui choisit
  l’heure.

## 0.4.0 — 2026-10-28

Retrouver tes photos.

### Nouveautés

- Recherche, dans un nouvel onglet : un album, une ville, un pays ou une date en mots de tous
  les jours (« 2019 », « juillet 2024 », « 14 juillet », « été 2023 », « 2019 à 2021 »), et
  même tout ensemble : « Lyon été 2023 ». Pendant que tu tapes, les albums et les lieux qui
  correspondent s’affichent avec leur nombre de photos. Dans les résultats, les lieux
  permettent d’affiner d’un toucher. Les dernières recherches restent sur l’appareil.
- La recherche trouve aussi les albums masqués de l’accueil.
- Les lieux de tes photos sont trouvés sur l’appareil la première fois, puis gardés : la
  recherche par lieu marche ensuite hors connexion.

### Corrections

- Les photos que certaines applis placent en 0, 0 (en mer, au large du Ghana) n’ont plus de
  lieu : elles ne sont plus sur la carte, ni dans la recherche par lieu.

## 0.3.1 — 2026-10-20

### Corrections

- Sur un Wi-Fi qui ne laisse rien passer (avion, hôtel) ou un très mauvais réseau, Nuagerie ne
  reste plus bloquée sur la connexion : elle s’ouvre avec les photos de l’appareil, et « Se
  connecter » attend que Microsoft réponde.
- L’écran « Connexion à OneDrive… » suit le thème choisi dans les réglages.
- Sans réseau, tes favoris restent affichés, même quand Nuagerie n’a pas pu joindre Microsoft.
- Le bandeau « Hors connexion » affiche son texte en entier, sur deux lignes s’il le faut.
- Avec un lecteur d’écran ou la commande vocale, les albums, la date d’une photo et les dossiers
  s’annoncent avec le texte affiché.

## 0.3.0 — 2026-10-10

Mieux voir tes photos.

### Nouveautés

- Infos d’une photo : touche la date en haut de la visionneuse (repère l’icône « i ») pour voir sa
  date et d’où elle vient, l’album (en entier, même long), le dossier, le nom du fichier,
  l’appareil photo, la taille, le lieu, et l’ouvrir dans OneDrive. Sur téléphone, le panneau prend
  le bas de l’écran et la photo reste entière au-dessus ; sur ordinateur, il s’affiche à côté.
- Pince une grille pour changer le nombre de colonnes (de 3 à 7 sur téléphone, Ctrl + molette sur
  ordinateur) ; le réglage est gardé sur l’appareil.
- Sélection de plusieurs photos : un appui long en sélectionne une, glisser le doigt en prend
  plusieurs, la case ronde d’un mois le prend en entier. Ensuite, partage-les d’un coup, ajoute-les
  aux favoris ou télécharge-les. Le bouton retour quitte la sélection. Sur ordinateur : Ctrl + clic,
  Maj + clic pour une suite, Échap pour quitter.
- Un appui long sur un album (clic droit sur ordinateur) ouvre son menu : le masquer, voir ses photos
  sur la carte, l’ouvrir dans OneDrive. Sur la tuile Favoris, « Voir sur la carte » montre tes
  favoris seuls.

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
