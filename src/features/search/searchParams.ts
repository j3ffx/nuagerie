import { normalize, parseQuery } from '../../data/search/query.ts';
import type { PlaceKey, SearchIndex } from '../../data/search/search.ts';

/** A search as it is in the URL: `/recherche?q=…&album=…&lieu=…`. */
export interface SearchTarget {
  q: string;
  album: string | null;
  place: PlaceKey | null;
}

export const SEARCH_PATH = '/recherche';

const isPlaceKey = (value: string | null): value is PlaceKey =>
  value !== null && /^(v:[A-Z]{2}:.+|p:[A-Z]{2})$/.test(value);

export function readTarget(params: URLSearchParams): SearchTarget {
  const lieu = params.get('lieu');
  return {
    q: params.get('q')?.trim() ?? '',
    album: params.get('album') || null,
    place: isPlaceKey(lieu) ? lieu : null,
  };
}

export function isEmptyTarget(target: SearchTarget): boolean {
  return target.q === '' && target.album === null && target.place === null;
}

export function targetHref(target: SearchTarget): string {
  const params = new URLSearchParams();
  if (target.q) params.set('q', target.q);
  if (target.album) params.set('album', target.album);
  if (target.place) params.set('lieu', target.place);
  const query = params.toString();
  return query ? `${SEARCH_PATH}?${query}` : SEARCH_PATH;
}

export const sameTarget = (a: SearchTarget, b: SearchTarget) =>
  a.q === b.q && a.album === b.album && a.place === b.place;

/** "Lyon · Été 2023": what a search was, from its album, place and words. */
export function describeTarget(search: SearchIndex, target: SearchTarget): string {
  const parts: string[] = [];
  if (target.album) {
    const name = search.index.folders.get(target.album)?.name;
    if (!name) return ''; // the album is gone
    parts.push(name);
  }
  if (target.place) {
    const place = search.places.get(target.place);
    parts.push(place ? place.name : 'Lieu');
  }
  if (target.q) {
    const query = parseQuery(target.q);
    const words = query.date ? query.terms.join(' ') : target.q;
    // "Lyon", picked among the results of "lyon été 2023", says the same as "lyon".
    if (words && !parts.some((part) => normalize(part) === normalize(words))) parts.push(words);
    if (query.date) parts.push(query.date.label);
  }
  return parts.join(' · ');
}
