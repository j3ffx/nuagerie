import { describe, expect, it } from 'vitest';
import type { GraphDriveItem } from '../graph/types.ts';
import type { CaptureDate } from '../model.ts';
import { buildIndex } from '../normalize.ts';
import type { Place } from '../places/placeIndex.ts';
import { coordinateKey } from '../places/places.ts';
import { parseQuery } from './query.ts';
import { buildSearchIndex, placesOf, searchItems, suggest, yearsOf } from './search.ts';

const folder = (id: string, name: string, parent: string): GraphDriveItem => ({
  id,
  name,
  folder: {},
  parentReference: { id: parent },
});
const LYON = { latitude: 45.764, longitude: 4.836 };
const PARIS = { latitude: 48.857, longitude: 2.352 };
const KYOTO = { latitude: 35.012, longitude: 135.768 };
/** A photo taken on "2025-07-01" (or undated), maybe somewhere. */
const photo = (
  id: string,
  parent: string,
  day: string | null,
  location?: { latitude: number; longitude: number },
): GraphDriveItem => ({
  id,
  name: `${id}.jpg`,
  file: { mimeType: 'image/jpeg' },
  parentReference: { id: parent },
  ...(day ? { photo: { takenDateTime: `${day}T12:00:00Z` } } : {}),
  ...(location ? { location } : {}),
});
const date = (item: GraphDriveItem): CaptureDate | null =>
  item.photo?.takenDateTime
    ? { takenAt: Date.parse(item.photo.takenDateTime), source: 'exif' }
    : null;

/*
 * Pictures/ (r1)
 *   Camera Roll/ 2023/07/ (c1 Lyon, c2 Paris)  2024/01/ (c3 Lyon)  Sans date/ (c4 Lyon)
 *   Événements/  2017-04 - Printemps à Kyoto/ (k1 Kyoto, k2)
 *                2023-07-14 - Feu d'artifice/ (f1 Paris)  Soirée/ (s1 Paris)
 */
const index = buildIndex(
  [
    folder('pics', 'Pictures', 'drive'),
    folder('cam', 'Camera Roll', 'pics'),
    folder('cam-23', '2023', 'cam'),
    folder('cam-23-07', '07', 'cam-23'),
    folder('cam-24', '2024', 'cam'),
    folder('cam-24-01', '01', 'cam-24'),
    folder('cam-u', 'Sans date', 'cam'),
    folder('evt', 'Événements', 'pics'),
    folder('kyoto', '2017-04 - Printemps à Kyoto', 'evt'),
    folder('fire', '2023-07-14 - Feu d’artifice', 'evt'),
    folder('party', 'Soirée', 'fire'),
    photo('r1', 'pics', '2022-02-02'),
    photo('c1', 'cam-23-07', '2023-07-02', LYON),
    photo('c2', 'cam-23-07', '2023-07-01', PARIS),
    photo('c3', 'cam-24-01', '2024-01-05', LYON),
    photo('c4', 'cam-u', null, LYON),
    photo('k1', 'kyoto', '2017-04-08', KYOTO),
    photo('k2', 'kyoto', '2017-04-09'),
    photo('f1', 'fire', '2023-07-14', PARIS),
    photo('s1', 'party', '2023-07-14', PARIS),
  ],
  ['pics'],
  date,
);

const place = (name: string, country: string): Place => ({ name, town: name, country, km: 1 });
const known = new Map<string, Place | null>([
  [coordinateKey(LYON.latitude, LYON.longitude), place('Lyon', 'FR')],
  [coordinateKey(PARIS.latitude, PARIS.longitude), place('Paris', 'FR')],
  [coordinateKey(KYOTO.latitude, KYOTO.longitude), place('Kyōto', 'JP')],
]);
const search = buildSearchIndex(index, known);

const NOW = Date.UTC(2026, 9, 28);
const find = (text: string, filters = {}) =>
  searchItems(search, parseQuery(text, NOW), filters).map((item) => item.id);

describe('searchItems', () => {
  it('finds everything for an empty search, in the index order', () => {
    expect(find('')).toEqual(index.items.map((item) => item.id));
  });

  it('finds by town, country and album, sub-albums included, accents aside', () => {
    expect(find('lyon')).toEqual(['c3', 'c1', 'c4']);
    expect(find('kyoto')).toEqual(['k2', 'k1']); // the town, and the album's other photo
    expect(find('japon')).toEqual(['k1']);
    expect(find('france').sort()).toEqual(['c1', 'c2', 'c3', 'c4', 'f1', 's1']);
    expect(find('feu')).toEqual(['s1', 'f1']);
    expect(find('soiree')).toEqual(['s1']);
    expect(find('evenements')).toEqual(['s1', 'f1', 'k2', 'k1']);
    expect(find('camera roll')).toEqual(['c3', 'c1', 'c2', 'c4']);
  });

  it('never makes an album of the perimeter root nor of technical folders', () => {
    expect(find('pictures')).toEqual(['r1']); // the root's own photo, as its own album
    expect(find('sans')).toEqual([]);
    expect(find('07')).toEqual(['s1', 'f1']); // "2023-07-14 - Feu…", not the month folder
  });

  it('crosses a period with places and albums', () => {
    expect(find('lyon 2023')).toEqual(['c1']);
    expect(find('juillet 2023')).toEqual(['s1', 'f1', 'c1', 'c2']);
    expect(find('paris été 2023')).toEqual(['s1', 'f1', 'c2']);
    expect(find('14 juillet')).toEqual(['s1', 'f1']);
    expect(find('2024')).toEqual(['c3']);
  });

  it('keeps undated items out of every period', () => {
    expect(find('lyon')).toContain('c4');
    expect(find('lyon 2000 a 2026')).not.toContain('c4');
  });

  it('reads the words of a period as names too: "printemps" is also an album', () => {
    const spring = find('printemps');
    expect(spring).toEqual(['k2', 'k1']);
    // Spring 2023 has nothing; the album name does not have "2023".
    expect(find('printemps 2023')).toEqual([]);
  });

  it('wants every word to fit', () => {
    expect(find('lyon paris')).toEqual([]);
    expect(find('feu paris')).toEqual(['s1', 'f1']);
    expect(find('zanzibar')).toEqual([]);
  });

  it('applies the chosen album and place', () => {
    expect(find('', { albumId: 'fire' })).toEqual(['s1', 'f1']);
    expect(find('', { place: 'v:FR:Lyon' })).toEqual(['c3', 'c1', 'c4']);
    expect(find('', { place: 'p:FR' })).toHaveLength(6);
    expect(find('2023', { place: 'v:FR:Paris' })).toEqual(['s1', 'f1', 'c2']);
    expect(find('', { albumId: 'cam', place: 'v:FR:Paris' })).toEqual(['c2']);
  });

  it('has no place for photos whose place is not known yet', () => {
    const early = buildSearchIndex(index, new Map());
    expect(searchItems(early, parseQuery('lyon', NOW))).toEqual([]);
    expect(searchItems(early, parseQuery('feu', NOW))).toHaveLength(2);
  });
});

describe('suggest', () => {
  const hits = (text: string) => {
    const found = suggest(search, parseQuery(text, NOW));
    return {
      albums: found.albums.map((hit) => [hit.name, hit.count]),
      towns: found.towns.map((hit) => [hit.place.name, hit.count]),
      countries: found.countries.map((hit) => [hit.place.name, hit.count]),
      inPeriod: found.inPeriod,
    };
  };

  it('suggests albums, towns and countries by name, most items first', () => {
    expect(hits('ky')).toEqual({
      albums: [['2017-04 - Printemps à Kyoto', 2]],
      towns: [['Kyōto', 1]],
      countries: [],
      inPeriod: false,
    });
    expect(hits('fr')).toMatchObject({ countries: [['France', 6]], towns: [] });
    expect(hits('p')).toMatchObject({
      albums: [
        ['2017-04 - Printemps à Kyoto', 2],
        ['Pictures', 1],
      ],
      towns: [['Paris', 3]],
    });
  });

  it('gives an album its parents, for the subtitle', () => {
    const [hit] = suggest(search, parseQuery('soirée', NOW)).albums;
    expect(hit).toMatchObject({
      name: 'Soirée',
      parents: ['Événements', '2023-07-14 - Feu d’artifice'],
    });
  });

  it('counts within the period when its words are not names', () => {
    expect(hits('lyon 2023')).toEqual({
      albums: [],
      towns: [['Lyon', 1]],
      countries: [],
      inPeriod: true,
    });
    expect(hits('2023')).toMatchObject({
      albums: [['2023-07-14 - Feu d’artifice', 2]],
      inPeriod: false,
    });
    expect(hits('juillet')).toEqual({ albums: [], towns: [], countries: [], inPeriod: true });
  });
});

describe('placesOf and yearsOf', () => {
  it('counts the towns and countries of a result, most first', () => {
    const items = searchItems(search, parseQuery('2023', NOW));
    const { towns, countries } = placesOf(search, items);
    expect(towns.map((hit) => [hit.place.key, hit.count])).toEqual([
      ['v:FR:Paris', 3],
      ['v:FR:Lyon', 1],
    ]);
    expect(countries.map((hit) => [hit.place.name, hit.count])).toEqual([['France', 4]]);
  });

  it('lists the years with their count, most recent first', () => {
    expect(yearsOf(index.items).slice(0, 3)).toEqual([
      { year: 2024, count: 1 },
      { year: 2023, count: 4 },
      { year: 2022, count: 1 },
    ]);
  });
});
