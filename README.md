# Nuagerie

**English** · [Français](README.fr.md)

A personal photo gallery for OneDrive, **read-only**: your photos and videos sorted by album,
found by date and by place. A PWA made for the phone, pleasant on a PC too.

- 100% client-side, no server, no tracking.
- Read-only: Microsoft Graph permissions limited to `Files.Read`, `User.Read`,
  `offline_access`. The one exception, to turn on yourself: the sync of favourites and
  preferences, kept in a folder of their own (`Apps/Nuagerie`), with a permission limited to that
  folder. Settings → Permissions shows what Microsoft really allows.
- A **demo mode** with ~20,000 made-up photos lets you try everything without an account.
- In **English** and **French**, following the phone's language or chosen in the settings.

## What Nuagerie does

- **Albums.** Every folder is a possible album. Technical folders (years, months, `Sans date`
  or `Undated`) never are: their files go to the album above. You choose the albums of the home
  screen, their sub-albums show on their page, and the home screen sorts by date or by name. A
  long press on an album opens its menu: hide it, see its photos on the map, keep it offline,
  open it in OneDrive.
- **All.** Every photo in one chronological grid, with a timeline on the side to jump to a
  month, and a filter to leave out albums.
- **Grids.** Pinch to change the number of columns. A long press selects photos (sliding takes
  several, tapping a month takes it whole) to share them, add them to the favourites or download
  them in one go.
- **Memories.** At the top of the home screen, the photos taken on the same day in earlier
  years ("3 years ago"). Closed, the section comes back the next day, on every synced device. A
  notification on memory days, to turn on in the settings (Chrome, installed app): at most one a
  day, never before 8 am, worked out on the device.
- **Search.** By album, by place (town or country) and by date in everyday words ("2019",
  "July 2024", "14 July", "summer 2023", "2019 to 2021"), in English or French, and all
  together: "Lyon summer 2023". The places in the results narrow them down. It covers the whole
  OneDrive looked through, hidden albums included.
- **Map.** The photos with a place, grouped by place; tapping a group zooms in, and a strip
  shows the photos of the area.
- **Viewer.** Full screen, swipe from one photo to the next, pinch to zoom, videos. Tapping the
  date opens the info: the date and where it comes from, album, folder, camera, size, place.
  HEIC photos show through OneDrive's large thumbnail. Sharing or downloading the original is
  done on demand.
- **Reliable dates.** The capture date comes from the EXIF data, else from the file name
  (`20261006_084759.jpg`, `IMG-20250914-WA0003.jpg`, `Screenshot_…`, timestamps…), else the
  photo goes to "Undated", always last. Never the date of the upload to OneDrive, which can be
  years late.
- **Offline.** The app installs on the phone. The photos' index and the thumbnails already seen
  stay on the device: without a network, everything seen stays at hand. The favourites and the
  chosen albums (long press → "Keep offline") are downloaded ahead, on Wi-Fi, with their large
  images: they open in full size without a network. A badge on the tile tells where it stands.
- **Favourites.** A heart in the viewer, and a "Favourites" album at the top of the home screen.
- **Sync.** Optional: the favourites, the preferences (albums shown, sorting, filter) and the
  folders looked through are kept in a folder of their own in OneDrive (`Apps/Nuagerie`), so
  they are never lost and follow from one device to another, with a copy of the index so that a
  new device opens in a few seconds. Turned on on one device, it turns on by itself on the
  others. Favourites need it.
- **Settings.** The OneDrive folders looked through (OneDrive's Pictures folder by default,
  whatever its name in the account's language, others to add), the choice of albums, the
  language, the sync, the light or dark theme, the size of the thumbnail cache, and the
  permissions granted to the app.

## Privacy

The details, readable without an account:
[nuagerie.pages.dev/confidentialite](https://nuagerie.pages.dev/confidentialite).

- The only network traffic goes to Microsoft (sign-in and Graph) and to the map backgrounds of
  [OpenStreetMap](https://www.openstreetmap.org/copyright).
- Place names are worked out on the device: the photos' coordinates are sent nowhere.
- The index, the thumbnails and the places of the photos are kept in the browser (IndexedDB,
  Cache Storage), and erased on sign-out, like the recent searches.
- The sync, once turned on, is the only content written to OneDrive, in the signed-in person's
  OneDrive: `Apps/Nuagerie/nuagerie.json` (favourites, preferences, folders) and
  `Apps/Nuagerie/index.json.gz`, a copy of the index (names, dates and places of the files,
  without the photos) that lets another device open in a few seconds.

## Try it

Online, with no account nor install: <https://nuagerie.pages.dev/?demo=1> (the demo, with its
made-up photos). Or locally:

```bash
npm install
npm run dev:demo
```

Then open <http://localhost:5173>. Detailed install, testing on a phone, deployment and the
connection to OneDrive: [docs/SETUP.md](docs/SETUP.md) (in French). The repository's rules for
contributing: [CLAUDE.md](CLAUDE.md).

## What's new, and problems

What each version brings: [CHANGELOG.en.md](CHANGELOG.en.md) ([in French](CHANGELOG.md)), also
shown in the app after an update. A problem or an idea: Settings → About → "Report a problem",
or straight in the [issues](https://github.com/j3ffx/nuagerie/issues).

## Stack

React, TypeScript (strict) and Vite; MSAL for the Microsoft sign-in; vite-plugin-pwa (Workbox)
for installing and offline use; `idb` for the local index; `@tanstack/react-virtual` for smooth
grids of tens of thousands of photos; Leaflet and supercluster for the map; wouter for
navigation. The interface texts are in plain modules next to their screens (`src/lib/i18n.ts`),
with no library. Tests: Vitest, Playwright and axe-core (accessibility).

## Credits

- Map backgrounds © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.
- Place names: [GeoNames](https://www.geonames.org/) (CC BY 4.0 licence), lists generated by
  `scripts/build-places.mjs`.
- [Nunito](https://fonts.google.com/specimen/Nunito) font (SIL Open Font licence).

## Licence

[GPL-3.0](LICENSE).
