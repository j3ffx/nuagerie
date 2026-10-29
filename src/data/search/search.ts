import type { Place } from '../places/placeIndex.ts';
import { coordinateKey } from '../places/places.ts';
import type { MediaIndex, MediaItem } from '../model.ts';
import { fitsWords, inPeriod, nameWords, type ParsedQuery } from './query.ts';
import { locale } from '../../lib/i18n.ts';

/**
 * Search over the whole perimeter (hidden albums included: searching is how
 * one finds what is no longer shown). An item fits a query when it is in its
 * period and every other word starts the name of one of its albums (its own
 * or a parent), of its town or of its country. The words of the period also
 * count as names ("Printemps à Kyoto"), so an item fits either reading.
 */

/**
 * A place to search in: a town (`v:FR:Lyon`) or a country (`p:FR`). Towns of
 * the same name in a country are one: their photos are found by name anyway.
 */
export type PlaceKey = `v:${string}` | `p:${string}`;

export interface SearchPlace {
  key: PlaceKey;
  /** "Lyon" or "France". */
  name: string;
  /** For a town: its country ("France"); null for a country. */
  country: string | null;
}

interface ItemFacts {
  /** The album and its non-root parents, nearest first. */
  albums: readonly string[];
  town: SearchPlace | null;
  country: SearchPlace | null;
}

export interface SearchIndex {
  index: MediaIndex;
  facts: ReadonlyMap<string, ItemFacts>;
  /** Words of each folder's own name. */
  folderWords: ReadonlyMap<string, readonly string[]>;
  placeWords: ReadonlyMap<PlaceKey, readonly string[]>;
  places: ReadonlyMap<PlaceKey, SearchPlace>;
}

/** Filters chosen by tapping a suggestion, on top of the typed words. */
export interface SearchFilters {
  albumId?: string | null;
  place?: PlaceKey | null;
}

const countryNames = new Intl.DisplayNames([locale], { type: 'region' });
function countryName(code: string): string {
  try {
    return countryNames.of(code) ?? code;
  } catch {
    return code;
  }
}

export function buildSearchIndex(
  index: MediaIndex,
  known: ReadonlyMap<string, Place | null>,
): SearchIndex {
  const roots = new Set(index.rootFolderIds);
  const folderWords = new Map<string, string[]>();
  for (const folder of index.folders.values()) folderWords.set(folder.id, nameWords(folder.name));

  const trails = new Map<string, string[]>();
  const trailOf = (albumId: string) => {
    let trail = trails.get(albumId);
    if (trail) return trail;
    trail = [albumId];
    const seen = new Set(trail);
    let parentId = index.folders.get(albumId)?.parentId ?? null;
    while (parentId !== null && !roots.has(parentId) && !seen.has(parentId)) {
      seen.add(parentId);
      const parent = index.folders.get(parentId);
      if (!parent) break;
      if (!parent.technical) trail.push(parent.id);
      parentId = parent.parentId;
    }
    trails.set(albumId, trail);
    return trail;
  };

  const places = new Map<PlaceKey, SearchPlace>();
  const placeWords = new Map<PlaceKey, string[]>();
  const placeOf = (key: PlaceKey, make: () => SearchPlace) => {
    let place = places.get(key);
    if (!place) {
      place = make();
      places.set(key, place);
      placeWords.set(key, nameWords(place.name));
    }
    return place;
  };

  const facts = new Map<string, ItemFacts>();
  for (const item of index.items) {
    let town: SearchPlace | null = null;
    let country: SearchPlace | null = null;
    if (item.latitude !== null && item.longitude !== null) {
      const found = known.get(coordinateKey(item.latitude, item.longitude));
      if (found) {
        const name = countryName(found.country);
        country = placeOf(`p:${found.country}`, () => ({
          key: `p:${found.country}`,
          name,
          country: null,
        }));
        town = placeOf(`v:${found.country}:${found.town}`, () => ({
          key: `v:${found.country}:${found.town}`,
          name: found.town,
          country: name,
        }));
      }
    }
    facts.set(item.id, { albums: trailOf(item.albumId), town, country });
  }
  return { index, facts, folderWords, placeWords, places };
}

function fitsTerms(search: SearchIndex, facts: ItemFacts, terms: readonly string[]): boolean {
  return terms.every((term) => {
    const starts = (words: readonly string[] | undefined) =>
      words?.some((word) => word.startsWith(term)) ?? false;
    return (
      facts.albums.some((id) => starts(search.folderWords.get(id))) ||
      (facts.town !== null && starts(search.placeWords.get(facts.town.key))) ||
      (facts.country !== null && starts(search.placeWords.get(facts.country.key)))
    );
  });
}

function inFilters(facts: ItemFacts, filters: SearchFilters): boolean {
  if (filters.albumId && !facts.albums.includes(filters.albumId)) return false;
  if (filters.place) {
    const key = filters.place.startsWith('p:') ? facts.country?.key : facts.town?.key;
    if (key !== filters.place) return false;
  }
  return true;
}

/** Whether an item fits the typed words (either reading) and the chosen filters. */
export function fits(
  search: SearchIndex,
  item: MediaItem,
  query: ParsedQuery,
  filters: SearchFilters = {},
): boolean {
  const facts = search.facts.get(item.id);
  if (!facts || !inFilters(facts, filters)) return false;
  if (query.date && inPeriod(item.takenAt, query.date) && fitsTerms(search, facts, query.terms)) {
    return true;
  }
  return fitsTerms(search, facts, query.words);
}

/** The items that fit, in the index's order (most recent first, undated last). */
export function searchItems(
  search: SearchIndex,
  query: ParsedQuery,
  filters: SearchFilters = {},
): MediaItem[] {
  return search.index.items.filter((item) => fits(search, item, query, filters));
}

export interface AlbumHit {
  id: string;
  name: string;
  /** Parent albums, outermost first: ["Événements", "2025-08-23 - Mariage"]. */
  parents: string[];
  count: number;
  /** Most recent item, for the thumbnail. */
  cover: MediaItem;
}

export interface PlaceHit {
  place: SearchPlace;
  count: number;
  cover: MediaItem;
}

export interface Suggestions {
  /** Albums whose name fits the words. */
  albums: AlbumHit[];
  towns: PlaceHit[];
  countries: PlaceHit[];
  /** Whether those counts are within the period typed (the period's words were not names). */
  inPeriod: boolean;
}

const MAX_ALBUMS = 6;
const MAX_TOWNS = 6;
const MAX_COUNTRIES = 3;

/**
 * Albums, towns and countries whose name fits the words typed. With a period
 * typed, its words are tried as names first ("Printemps à Kyoto"); when no
 * name fits that way, the other words are, counting only the period's items
 * ("Lyon été 2023" → Lyon, in summer 2023).
 */
export function suggest(search: SearchIndex, query: ParsedQuery): Suggestions {
  const byName = collect(search, query.words, null);
  if (!query.date || byName.albums.length + byName.towns.length + byName.countries.length > 0) {
    return { ...byName, inPeriod: false };
  }
  if (query.terms.length === 0) return { albums: [], towns: [], countries: [], inPeriod: true };
  return { ...collect(search, query.terms, query), inPeriod: true };
}

function collect(
  search: SearchIndex,
  terms: readonly string[],
  query: ParsedQuery | null,
): Omit<Suggestions, 'inPeriod'> {
  if (terms.length === 0) return { albums: [], towns: [], countries: [] };
  const fitting = new Map<string, boolean>();
  const fitsName = (words: readonly string[] | undefined, key: string) => {
    let value = fitting.get(key);
    if (value === undefined) {
      value = words !== undefined && fitsWords(terms, words);
      fitting.set(key, value);
    }
    return value;
  };
  const albums = new Map<string, { count: number; cover: MediaItem }>();
  const places = new Map<PlaceKey, { count: number; cover: MediaItem }>();
  const add = <K>(map: Map<K, { count: number; cover: MediaItem }>, key: K, item: MediaItem) => {
    const hit = map.get(key);
    if (hit) hit.count++;
    else map.set(key, { count: 1, cover: item });
  };
  for (const item of search.index.items) {
    if (query?.date && !inPeriod(item.takenAt, query.date)) continue;
    const facts = search.facts.get(item.id);
    if (!facts) continue;
    for (const id of facts.albums) {
      if (fitsName(search.folderWords.get(id), id)) add(albums, id, item);
    }
    for (const place of [facts.town, facts.country]) {
      if (place && fitsName(search.placeWords.get(place.key), place.key)) {
        add(places, place.key, item);
      }
    }
  }

  const folders = search.index.folders;
  const roots = new Set(search.index.rootFolderIds);
  const parentsOf = (id: string) => {
    const names: string[] = [];
    let parentId = folders.get(id)?.parentId ?? null;
    while (parentId !== null && !roots.has(parentId) && names.length < 8) {
      const parent = folders.get(parentId);
      if (!parent) break;
      if (!parent.technical) names.unshift(parent.name);
      parentId = parent.parentId;
    }
    return names;
  };
  const byCount = <T extends { count: number }>(a: T, b: T) => b.count - a.count;
  const placeHits = [...places].map(([key, hit]) => ({
    place: search.places.get(key) as SearchPlace,
    ...hit,
  }));
  return {
    albums: [...albums]
      .map(([id, hit]) => ({
        id,
        name: folders.get(id)?.name ?? '',
        parents: parentsOf(id),
        ...hit,
      }))
      .sort(byCount)
      .slice(0, MAX_ALBUMS),
    towns: placeHits
      .filter((hit) => hit.place.country !== null)
      .sort(byCount)
      .slice(0, MAX_TOWNS),
    countries: placeHits
      .filter((hit) => hit.place.country === null)
      .sort(byCount)
      .slice(0, MAX_COUNTRIES),
  };
}

/** Towns and countries of a list of items, most items first ("Lieux dans ces résultats"). */
export function placesOf(
  search: SearchIndex,
  items: readonly MediaItem[],
): { towns: PlaceHit[]; countries: PlaceHit[] } {
  const towns = new Map<PlaceKey, PlaceHit>();
  const countries = new Map<PlaceKey, PlaceHit>();
  for (const item of items) {
    const facts = search.facts.get(item.id);
    for (const [map, place] of [
      [towns, facts?.town],
      [countries, facts?.country],
    ] as const) {
      if (!place) continue;
      const hit = map.get(place.key);
      if (hit) hit.count++;
      else map.set(place.key, { place, count: 1, cover: item });
    }
  }
  const byCount = (a: PlaceHit, b: PlaceHit) => b.count - a.count;
  return {
    towns: [...towns.values()].sort(byCount),
    countries: [...countries.values()].sort(byCount),
  };
}

/** Years with dated items, most recent first, with their count. */
export function yearsOf(items: readonly MediaItem[]): { year: number; count: number }[] {
  const years = new Map<number, number>();
  for (const item of items) {
    if (item.takenAt === null) continue;
    const year = new Date(item.takenAt).getUTCFullYear();
    years.set(year, (years.get(year) ?? 0) + 1);
  }
  return [...years].map(([year, count]) => ({ year, count })).sort((a, b) => b.year - a.year);
}
