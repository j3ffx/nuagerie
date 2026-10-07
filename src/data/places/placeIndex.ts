/**
 * Names a photo's location from its coordinates, on the device: the nearest
 * place of the GeoNames list (public/places/, see scripts/build-places.mjs).
 * The coordinates are never sent anywhere.
 */

export interface Place {
  name: string;
  /** ISO 3166 country code, e.g. "FR". */
  country: string;
  /** Distance from the photo, in kilometres. */
  km: number;
}

export interface PlaceIndex {
  names: string[];
  countries: string[];
  lat: Float32Array;
  lon: Float32Array;
  /** Places by 1° cell: key = floor(lat) * 1000 + floor(lon). */
  cells: Map<number, number[]>;
}

/** Versioned file name: a new list gets a new name, so caches never serve a stale one. */
export const PLACES_URL = '/places/cities-v1.txt';

const cellKey = (lat: number, lon: number) => Math.floor(lat) * 1000 + Math.floor(lon);

/** Parses "name \t lat \t lon \t country" lines. */
export function buildPlaceIndex(text: string): PlaceIndex {
  const lines = text.split('\n');
  const names: string[] = [];
  const countries: string[] = [];
  const lat = new Float32Array(lines.length);
  const lon = new Float32Array(lines.length);
  const cells = new Map<number, number[]>();
  for (const line of lines) {
    const [name, la, lo, country] = line.split('\t');
    if (!name || !country) continue;
    const i = names.length;
    names.push(name);
    countries.push(country);
    lat[i] = Number(la);
    lon[i] = Number(lo);
    const key = cellKey(lat[i] ?? 0, lon[i] ?? 0);
    const cell = cells.get(key);
    if (cell) cell.push(i);
    else cells.set(key, [i]);
  }
  return { names, countries, lat, lon, cells };
}

/** Flat-earth distance: exact enough at the scale of a town. */
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const x = (lon2 - lon1) * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180)) * 111.32;
  const y = (lat2 - lat1) * 110.57;
  return Math.hypot(x, y);
}

/** Furthest search, in cells around the photo's (about 500 km). */
const MAX_RING = 5;

/** Nearest place, or null when none lies within a few hundred kilometres (open sea). */
export function nearestPlace(index: PlaceIndex, latitude: number, longitude: number): Place | null {
  let best = -1;
  let bestKm = Infinity;
  const baseLat = Math.floor(latitude);
  const baseLon = Math.floor(longitude);
  for (let ring = 0; ring <= MAX_RING; ring++) {
    for (let dLat = -ring; dLat <= ring; dLat++) {
      for (let dLon = -ring; dLon <= ring; dLon++) {
        // Only the cells on the ring's edge are new.
        if (Math.max(Math.abs(dLat), Math.abs(dLon)) !== ring) continue;
        const lonCell = ((baseLon + dLon + 180 + 360) % 360) - 180;
        for (const i of index.cells.get((baseLat + dLat) * 1000 + lonCell) ?? []) {
          const km = distanceKm(latitude, longitude, index.lat[i] ?? 0, index.lon[i] ?? 0);
          if (km < bestKm) {
            bestKm = km;
            best = i;
          }
        }
      }
    }
    // Every place nearer than the searched rings' width has been seen.
    const covered =
      ring * 111.32 * Math.cos(Math.min(Math.abs(latitude) + ring, 89) * (Math.PI / 180));
    if (best >= 0 && bestKm <= covered) break;
  }
  if (best < 0) return null;
  return { name: index.names[best] ?? '', country: index.countries[best] ?? '', km: bestKm };
}
