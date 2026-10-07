#!/usr/bin/env node
// Builds the place list used to name photo locations on the device (no network
// lookup: coordinates never leave the phone).
//
// Source: GeoNames "cities1000" (places of 1,000 inhabitants or more),
// CC BY 4.0, https://download.geonames.org/export/dump/cities1000.zip
//
//   node scripts/build-places.mjs path/to/cities1000.txt
//
// Output: public/places/cities-v1.txt, one place per line: name, latitude,
// longitude (3 decimals, about 100 m) and ISO country code, tab-separated,
// sorted by latitude. Bump the version in the file name (and in
// src/data/places/) when regenerating, so browsers fetch the new list.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const source = process.argv[2];
if (!source) {
  console.error('usage: node scripts/build-places.mjs path/to/cities1000.txt');
  process.exit(1);
}

const places = readFileSync(source, 'utf8')
  .trim()
  .split('\n')
  .map((line) => line.split('\t'))
  .map((columns) => ({
    name: columns[1] ?? '',
    lat: Number(columns[4]),
    lon: Number(columns[5]),
    country: columns[8] ?? '',
  }))
  .filter((p) => p.name && Number.isFinite(p.lat) && Number.isFinite(p.lon) && p.country)
  .sort((a, b) => a.lat - b.lat || a.lon - b.lon);

mkdirSync('public/places', { recursive: true });
writeFileSync(
  'public/places/cities-v1.txt',
  places.map((p) => [p.name, p.lat.toFixed(3), p.lon.toFixed(3), p.country].join('\t')).join('\n') +
    '\n',
);
console.log(`${places.length} places written to public/places/cities-v1.txt`);
