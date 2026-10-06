# Nuagerie — contributor notes

Read-only photo gallery for a personal OneDrive, as a PWA (React, strict TypeScript, Vite; no backend).
This file is the contributor guide for humans and AI assistants alike. Read first:

- `README.md` covers what it does.
- `docs/SETUP.md` covers install, phone testing, deployment and the Microsoft app registration (in French).

## Commands

```bash
npm run dev:demo     # ~20,000 synthetic photos, no account, no network: the default way to work
npm run dev          # real data on http://localhost:5173
npm run dev:lan      # HTTPS on the LAN + QR code, to test on a phone
npm run typecheck && npm run lint && npm test && npm run e2e
npm run deploy       # build + check:dist + Cloudflare Pages
```

`npm install` points git at `.githooks/`:

- `commit-msg` rejects messages that don't follow the commit rules below;
- `post-commit` re-dates each commit at noon UTC (see Privacy);
- `pre-push` runs `check:private`, the date check and the commit check.

## Commits

Follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) strictly:

```
type(scope)!: imperative description, lowercase, no trailing period

Body explaining *why* (the diff already shows what).
```

- **Types:** `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `ci`, `chore`, `style`, `revert`.
- **Scope** is optional; `scripts/check-commits.mjs` holds the authoritative list of types and scopes.
- Header of 72 characters or fewer. One logical change and one type per commit.
- Code, comments and commit messages are in English; the UI and the user docs are in French.

## Privacy of the public repository

The repository is public. Nothing personal goes into code, tests, fixtures, docs, commit messages or
commit metadata.

- **No personal data:** real folder names, local paths, addresses, real photos, names, e-mail addresses.
  Demo data and tests use generic names only ("Camera Roll", "Albums/Animaux"…).
- **Identity:** commit with a GitHub `noreply` address. `check:private` rejects any other.
- **Times:** commit times show when someone works. The `post-commit` hook keeps only the day (noon UTC);
  `npm run fix:dates` re-dates unpushed commits made without the hook (rebases, other machines).
- **Docs only when they belong in public:** no personal to-do lists, plans or notes. Local working notes
  stay out of git (they are ignored).
- **Secrets:** none. A SPA needs no secret; configuration goes in `.env` (ignored), documented in
  `.env.example`.
- `.private-patterns` (ignored, one regex per line) lists your own private strings: `check:private` scans
  tracked files and commit messages for them, and `check:dist` scans what `npm run deploy` publishes.

## Invariants (discuss before changing)

- **Read-only.** Microsoft Graph delegated scopes are `Files.Read`, `User.Read`, `offline_access` and
  nothing else. The app never creates, changes, moves or deletes anything in OneDrive.
- **No backend, no tracking.** The only network calls go to Microsoft (sign-in, Graph) and to the map tile
  provider. No analytics.
- **Demo mode works with no account and no network** (`?demo=1`, `npm run dev:demo`, or no Client ID).
  The demo source goes through the same normalization as real data (`src/data/normalize.ts`).
- **Capture dates** (`MediaItem.takenAt`): `photo.takenDateTime` (EXIF) first, kept as wall-clock time
  and never shifted; otherwise a date read from the file name; otherwise none ("Sans date"). Never
  `createdDateTime` or `lastModifiedDateTime` (upload or export dates). A date is accepted only if it is
  real and between 2000 and today + 1 day. Undated items always come last, whatever the sort.
  Measured on a real drive (diagnostic "EXIF minus name"): videos take the name first, because their
  `takenDateTime` is the MP4 container time in UTC; OneDrive iPhone uploads (`…_iOS`) and 13-digit
  timestamps are UTC instants, shown in the device's time zone. Any new rule gets a unit test and a
  case in the demo generator, whose expected dates are checked for all 20,000 files.
- **Albums:** a folder is a potential album. Technical folders are never albums: years (`^\d{4}$`),
  months under a year (`^(0[1-9]|1[0-2])$`) and `Sans date`; their files belong to the nearest
  non-technical parent (`src/data/technical.ts`). An album shows only its own files, not its sub-albums'.
- **Grids show Graph thumbnails only**, never the original file.
- **Accessibility:** contrast ≥ 4.5:1 (tokens in `src/styles/tokens.css`), visible focus, touch targets
  ≥ 44 px, `alt` text, `prefers-reduced-motion` respected.

## Layout

- `src/data/`: model, Graph types, normalization, data sources (`demo/` is the synthetic OneDrive).
- `src/features/<screen>/`: one folder per screen. `src/ui/`: shared components. `src/lib/`: helpers.
- `src/sw.ts`: service worker (vite-plugin-pwa, `injectManifest`).
- `e2e/`: Playwright tests in demo mode on a phone-sized screen, against the production build.
- `scripts/`: repository checks and git hook helpers. `build/`: Vite plugins for development.

## Deployment

`npm run deploy` builds, runs `check:dist` (no source maps, no private pattern), then uploads `dist/` to
the Cloudflare Pages project with wrangler. The production branch is `main`; other branches get
`<branch>.<project>.pages.dev`. When creating a project, pass `--force` to
`wrangler pages project create`: without it, recent wrangler versions create a Workers project instead
and edit `vite.config.ts`.
