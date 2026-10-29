#!/usr/bin/env node
// Builds the place list used to name photo locations on the device (no network
// lookup: coordinates never leave the phone), and the French names of its places.
//
// Sources: GeoNames "cities1000" (places of 1,000 inhabitants or more) and
// "alternateNamesV2" (names in other languages), CC BY 4.0,
// https://download.geonames.org/export/dump/
//
//   node scripts/build-places.mjs path/to/cities1000.txt path/to/alternateNamesV2.txt
//
// Output:
// - public/places/cities-v2.txt, one place per line: name, latitude, longitude
//   (3 decimals, about 100 m) and ISO country code, tab-separated, sorted by
//   latitude;
// - public/places/names-v2-fr.txt: "line \t name" for each place whose name
//   differs in French ("Londres", "Venise", "La Haye"), lines of the list
//   counted from 0. Only for towns of 15,000 inhabitants or more, or names
//   GeoNames marks as preferred: below, its French names are mostly unsure
//   spellings. English needs none: the list's own names are the English ones.
// Bump the version in the file names (and in src/data/places/) when regenerating,
// so browsers fetch the new lists.
import { createReadStream, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

/** Languages with names of their own (PLACE_NAME_LANGUAGES in src/data/places/placeIndex.ts). */
const LANGUAGES = ['fr'];
const VERSION = 'v2';
/** Below this, only the names GeoNames marks as preferred. */
const TOWN = 15000;

const [source, alternates] = process.argv.slice(2);
if (!source || !alternates) {
  console.error(
    'usage: node scripts/build-places.mjs path/to/cities1000.txt path/to/alternateNamesV2.txt',
  );
  process.exit(1);
}

const places = readFileSync(source, 'utf8')
  .trim()
  .split('\n')
  .map((line) => line.split('\t'))
  .map((columns) => ({
    id: columns[0] ?? '',
    name: columns[1] ?? '',
    lat: Number(columns[4]),
    lon: Number(columns[5]),
    country: columns[8] ?? '',
    population: Number(columns[14]) || 0,
  }))
  .filter((p) => p.name && Number.isFinite(p.lat) && Number.isFinite(p.lon) && p.country)
  .sort((a, b) => a.lat - b.lat || a.lon - b.lon);

const byId = new Map(places.map((p) => [p.id, p]));
/** Lower case, no accents nor punctuation: "Souraïde" and "Souraide" are one name. */
const fold = (text) =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');

// alternateNamesV2 columns: alternateNameId, geonameid, isolanguage, alternate name,
// isPreferredName, isShortName, isColloquial, isHistoric, from, to.
/** geonameid → language → the best name seen so far, with its rank (lower is better). */
const best = new Map();
const lines = createInterface({ input: createReadStream(alternates, 'utf8'), crlfDelay: Infinity });
for await (const line of lines) {
  const [, id, language, name, preferred, short, colloquial, historic] = line.split('\t');
  const place = byId.get(id);
  if (!LANGUAGES.includes(language) || !place || !name) continue;
  if (colloquial === '1' || historic === '1') continue;
  if (place.population < TOWN && preferred !== '1') continue;
  // The same name without its accents, a district ("Lyon 05": its town is named instead), or
  // a description rather than a name.
  if (fold(name) === fold(place.name) || / \d{1,2}$/.test(place.name) || /[,()\t]/.test(name)) {
    continue;
  }
  // The preferred name first, then a full name, then a short one; the first seen among equals.
  const rank = preferred === '1' ? 0 : short === '1' ? 2 : 1;
  const names = best.get(id) ?? {};
  if (!names[language] || rank < names[language].rank) names[language] = { name, rank };
  best.set(id, names);
}

mkdirSync('public/places', { recursive: true });
writeFileSync(
  `public/places/cities-${VERSION}.txt`,
  places.map((p) => [p.name, p.lat.toFixed(3), p.lon.toFixed(3), p.country].join('\t')).join('\n') +
    '\n',
);
console.log(`${places.length} places written to public/places/cities-${VERSION}.txt`);
for (const language of LANGUAGES) {
  const named = places
    .map((p, line) => [line, best.get(p.id)?.[language]?.name])
    .filter(([, name]) => name)
    .map(([line, name]) => `${line}\t${name}`);
  writeFileSync(`public/places/names-${VERSION}-${language}.txt`, named.join('\n') + '\n');
  console.log(`${named.length} names written to public/places/names-${VERSION}-${language}.txt`);
}
