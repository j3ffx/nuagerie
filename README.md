# Nuagerie

Galerie photo personnelle pour OneDrive, en **lecture seule** : les photos et vidéos
rangées par albums, retrouvées par date et par lieu. Une PWA pensée pour le téléphone,
agréable aussi sur PC.

- 100 % côté client, sans serveur, sans suivi.
- Permissions Microsoft Graph limitées à `Files.Read`, `User.Read`, `offline_access` :
  l’application ne peut rien modifier dans OneDrive.
- Un **mode démo** avec ~20 000 photos factices permet de tout essayer sans compte.

> Projet personnel, en cours de construction.

## Essayer

```bash
npm install
npm run dev:demo
```

Puis ouvrir <http://localhost:5173>. Installation détaillée, test sur téléphone,
déploiement et connexion à OneDrive : [docs/SETUP.md](docs/SETUP.md).

## Stack

React, TypeScript, Vite, vite-plugin-pwa, Vitest, Playwright.
