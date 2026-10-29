# What’s new

The changes of each Nuagerie version, the most recent first. The numbers follow
[semantic versioning](https://semver.org/): while they start with 0, the app still changes a lot.
The French notes ([CHANGELOG.md](CHANGELOG.md)) come first; these say the same.

## Since the last version

### New

- Nuagerie speaks English: it follows the phone's language, or is chosen in Settings →
  Appearance. The search understands dates in both languages (“July 2024”, “juillet 2024”), and
  the memories notification follows the chosen language.
- Foreign towns have their French names in French: Londres, Bruxelles, Genève, Séville…
- By default, Nuagerie looks through OneDrive's Pictures folder, whatever its name in the
  account's language. Folders already chosen do not change. A folder named “Undated” is treated
  like “Sans date”.
- A Privacy page (Settings → About) tells what Nuagerie does with your data; it can be read
  without an account too.

## 0.6.0 — 2026-10-29

Your albums, even without a network.

### New

- Keep offline: long-press an album (or Favourites) → “Keep offline”. Its photos are downloaded
  ahead, on Wi-Fi, with their large images: without a network, they open in full size. The size
  is shown first.
- A badge on the tile of a kept album tells where it stands: green when everything is there, blue
  and turning while downloading, red when something went wrong. Tap it to see the space taken,
  the state or the error.
- Settings → Offline: what is kept, the space taken and the space left, the progress, and
  “Remove all”.
- The memories notification shows one of their photos, and Nuagerie’s cloud in the status bar
  instead of a bell.

### Fixes

- No memories notification when you already saw or closed them that day (even on another
  device); the one already shown goes away.

## 0.5.0 — 2026-10-28

See your memories again.

### New

- Memories: above the albums, the photos taken on the same day in earlier years, one card per
  year (“3 years ago”). “See all” shows them together. The cross closes them until the next day,
  on all your devices when the sync is on.
- A notification on memory days, to turn on in Settings → Memories (Chrome, installed app): at
  most once a day, never before 8 am. The phone chooses the time.

## 0.4.0 — 2026-10-28

Find your photos.

### New

- Search, in a new tab: an album, a town, a country or a date in everyday words (“2019”,
  “July 2024”, “14 July”, “summer 2023”, “2019 to 2021”), and even all together: “Lyon summer
  2023”. While you type, the matching albums and places show with their number of photos. In the
  results, the places narrow them down with one tap. The latest searches stay on the device.
- The search also finds the albums hidden from the home screen.
- The places of your photos are found on the device the first time, then kept: searching by
  place then works offline.

### Fixes

- The photos that some apps put at 0, 0 (at sea, off Ghana) no longer have a place: they are no
  longer on the map, nor in the search by place.

## 0.3.1 — 2026-10-20

### Fixes

- On a Wi-Fi that lets nothing through (plane, hotel) or a very bad network, Nuagerie no longer
  stays stuck on signing in: it opens with the photos on the device, and “Sign in” waits for
  Microsoft to answer.
- The “Connecting to OneDrive…” screen follows the theme chosen in the settings.
- Without a network, your favourites stay shown, even when Nuagerie could not reach Microsoft.
- The “Offline” banner shows its whole text, on two lines if need be.
- With a screen reader or voice control, the albums, the date of a photo and the folders are
  announced with the text shown.

## 0.3.0 — 2026-10-10

See your photos better.

### New

- A photo’s info: tap the date at the top of the viewer (look for the “i” icon) to see its date
  and where it comes from, the album (in full, even a long one), the folder, the file name, the
  camera, the size, the place, and open it in OneDrive. On a phone, the panel takes the bottom of
  the screen and the photo stays whole above it; on a computer, it shows beside it.
- Pinch a grid to change the number of columns (3 to 7 on a phone, Ctrl + wheel on a computer);
  the setting is kept on the device.
- Selecting several photos: a long press selects one, sliding the finger takes several, a month’s
  round box takes it whole. Then share them in one go, add them to the favourites or download
  them. The back button leaves the selection. On a computer: Ctrl + click, Shift + click for a
  run, Escape to leave.
- A long press on an album (right click on a computer) opens its menu: hide it, see its photos on
  the map, open it in OneDrive. On the Favourites tile, “See on the map” shows your favourites
  alone.

## 0.2.1 — 2026-10-08

### New

- With the sync, a copy of your photos’ index is kept in Apps/Nuagerie: a new device (or after
  signing out) opens in a few seconds instead of listing everything again.
- In the Favourites album, a photo removed from the favourites stays open: a second tap on the
  heart puts it back, in case of a mistake.
- The “Sign out” button is red, like what it erases.

## 0.2.0 — 2026-10-08

Favourites, and sync between your devices.

### New

- Favourites: a heart in the viewer, and a “Favourites” album at the top of the home screen.
- Sync (Settings → Sync), to turn on yourself: your favourites, your preferences (albums shown,
  sorting, order and filter of “All”) and your folders are kept in your OneDrive, in a folder of
  their own (Apps/Nuagerie). Nothing gets lost, and once turned on on one device, it turns on by itself
  on the others, which follow your changes within about a minute. Nuagerie asks Microsoft for the
  right to write in that one folder: your photos stay read-only.
- Settings → Permissions shows what Microsoft really allows Nuagerie, with a link to withdraw it.
- In the light theme, the viewer is light while its bars show; a tap hides them and turns the
  background black to look at the photo.
- An album name too long reads in full: tap the date and the album in the viewer, or long-press
  an album’s tile.
- When a new version is ready, its number shows in the banner and in Settings → About.

### Fixes

- The arrow of drop-down lists (album sorting, cache size) no longer shows cut in two.

## 0.1.2 — 2026-10-08

### New

- Confirmations (reindex, sign out, save the folders, go back to the default albums) show in a
  window of the app, easier to read than the browser’s.
- A long press no longer opens the browser’s menu (copy the link, download the image) and no
  longer selects the text.

### Fixes

- Map: a photo right on the bottom edge no longer makes the map flicker.

## 0.1.1 — 2026-10-08

Small everyday improvements.

### New

- Touching a button, an album or a photo darkens it slightly while pressed (lightens it in the
  dark theme): you see at once that the gesture is taken.
- Choose the folders: each folder tells how many items it holds and their weight, and a folder
  without subfolders tells how many files it holds.

## 0.1.0 — 2026-10-07

First version: all the photos and videos of OneDrive, sorted by album, found by date and by
place, on the phone as on a PC.

### New

- Albums drawn from the OneDrive folders, with sub-albums; folders of years, months and “Sans
  date” never are. Choice of the home screen’s albums, sorting by date or by name.
- “All”: every photo in one grid, with a timeline to jump to a month and a filter to leave out
  albums.
- Map of the photos with a place, grouped by place, with the photos of the area shown and a link
  to the phone’s maps app.
- Full-screen viewer: swipe, pinch to zoom, videos, HEIC photos, the photo’s place, share and
  download the original.
- Reliable capture dates: the camera’s data, else the file name, else “Undated”, always last.
  Never the date of the upload to OneDrive.
- Offline: the app installs and opens without a network, with the photos already seen.
- Settings: OneDrive folders looked through, choice of albums, light or dark theme, thumbnail
  cache, reindexing, account. Signing out erases the data kept on the device.
- Demo mode with 20,000 made-up photos, no account.
- Read-only: Nuagerie cannot change anything in OneDrive.
