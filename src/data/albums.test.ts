import { describe, expect, it } from 'vitest';
import {
  buildAlbums,
  defaultChecked,
  folderTree,
  orderItems,
  sortAlbums,
  type Album,
} from './albums.ts';
import type { GraphDriveItem } from './graph/types.ts';
import type { CaptureDate } from './model.ts';
import { buildIndex } from './normalize.ts';

const folder = (id: string, name: string, parent: string): GraphDriveItem => ({
  id,
  name,
  folder: {},
  parentReference: { id: parent },
});
/** A photo whose capture date is given as "2025-07-01" (or null). */
const photo = (id: string, parent: string, day: string | null): GraphDriveItem => ({
  id,
  name: `${id}.jpg`,
  file: { mimeType: 'image/jpeg' },
  parentReference: { id: parent },
  ...(day ? { photo: { takenDateTime: `${day}T12:00:00Z` } } : {}),
});

const date = (item: GraphDriveItem): CaptureDate | null =>
  item.photo?.takenDateTime
    ? { takenAt: Date.parse(item.photo.takenDateTime), source: 'exif' }
    : null;

/*
 * Pictures/
 *   Camera Roll/ 2026/10/ (c1, c2)   Sans date/ (c3)
 *   Albums/ (a0)  Animaux/ (p1)  Chat/ (p2)   Jardin/ (g1)
 *   Événements/  2024-05 - Vacances/ (v1)   2025-08 - Mariage/ (m1) Soirée/ (m2)
 */
const index = buildIndex(
  [
    folder('pics', 'Pictures', 'drive'),
    folder('cam', 'Camera Roll', 'pics'),
    folder('cam-y', '2026', 'cam'),
    folder('cam-m', '10', 'cam-y'),
    folder('cam-u', 'Sans date', 'cam'),
    folder('alb', 'Albums', 'pics'),
    folder('pets', 'Animaux', 'alb'),
    folder('cat', 'Chat', 'pets'),
    folder('garden', 'Jardin', 'alb'),
    folder('evt', 'Événements', 'pics'),
    folder('holiday', '2024-05 - Vacances', 'evt'),
    folder('wedding', '2025-08 - Mariage', 'evt'),
    folder('party', 'Soirée', 'wedding'),
    photo('c1', 'cam-m', '2026-10-06'),
    photo('c2', 'cam-m', '2026-10-01'),
    photo('c3', 'cam-u', null),
    photo('a0', 'alb', '2019-01-01'),
    photo('p1', 'pets', '2023-03-03'),
    photo('p2', 'cat', '2024-04-04'),
    photo('g1', 'garden', '2018-08-08'),
    photo('v1', 'holiday', '2024-05-05'),
    photo('m1', 'wedding', '2025-08-23'),
    photo('m2', 'party', '2025-08-24'),
  ],
  ['pics'],
  date,
);

const ids = (albums: readonly Album[]) => albums.map((album) => album.id);
const itemIds = (items: readonly { id: string }[] = []) => items.map((item) => item.id);

describe('folderTree', () => {
  it('lists non-technical folders under the root, by name', () => {
    const tree = folderTree(index);
    expect(tree.map((node) => node.folder.name)).toEqual(['Albums', 'Camera Roll', 'Événements']);
    expect(tree[1]?.children).toEqual([]); // 2026, 10 and Sans date are technical
    expect(tree[0]?.children.map((node) => node.folder.name)).toEqual(['Animaux', 'Jardin']);
  });

  it('checks the first-level folders by default', () => {
    expect(defaultChecked(index).sort()).toEqual(['alb', 'cam', 'evt']);
  });
});

describe('buildAlbums', () => {
  it('turns checked folders into home albums and their subfolders into sub-albums', () => {
    const { home, byId } = buildAlbums(index, { checked: ['cam', 'alb'], hidden: [] });
    expect(ids(home).sort()).toEqual(['alb', 'cam']);
    expect(byId.get('alb')?.subAlbumIds).toEqual(['pets', 'garden']);
    expect(byId.get('pets')?.subAlbumIds).toEqual(['cat']);
    expect(byId.get('pets')?.parentId).toBe('alb');
  });

  it('makes a checked subfolder a home album when its parent is not checked', () => {
    const { home } = buildAlbums(index, { checked: ['wedding', 'cat'], hidden: [] });
    expect(ids(home).sort()).toEqual(['cat', 'wedding']);
  });

  it('ignores a checked subfolder that is already a sub-album of a checked parent', () => {
    const { home } = buildAlbums(index, { checked: ['alb', 'cat'], hidden: [] });
    expect(ids(home)).toEqual(['alb']);
  });

  it('hides sub-albums one by one, keeping their count', () => {
    const { byId } = buildAlbums(index, { checked: ['alb'], hidden: ['garden'] });
    expect(byId.get('alb')?.subAlbumIds).toEqual(['pets']);
    expect(byId.get('alb')?.subAlbumCount).toBe(2);
  });

  it('shows the files of the album and its technical folders, never those of sub-albums', () => {
    const { byId } = buildAlbums(index, { checked: null, hidden: [] });
    expect(itemIds(byId.get('cam')?.items)).toEqual(['c1', 'c2', 'c3']);
    expect(itemIds(byId.get('alb')?.items)).toEqual(['a0']);
    expect(itemIds(byId.get('pets')?.items)).toEqual(['p1']);
  });

  it('uses the most recent dated photo as cover, with the date range', () => {
    const { byId } = buildAlbums(index, { checked: null, hidden: [] });
    const cam = byId.get('cam');
    expect(cam?.cover?.id).toBe('c1');
    expect(cam?.last).toBe(Date.parse('2026-10-06T12:00:00Z'));
    expect(cam?.first).toBe(Date.parse('2026-10-01T12:00:00Z'));
  });

  it('gives container albums the cover and range of their sub-albums', () => {
    const { byId } = buildAlbums(index, { checked: null, hidden: [] });
    const events = byId.get('evt');
    expect(events?.items).toEqual([]);
    expect(events?.subAlbumCount).toBe(2);
    expect(events?.cover?.id).toBe('m1');
    expect(events?.first).toBe(Date.parse('2024-05-05T12:00:00Z'));
    expect(events?.last).toBe(Date.parse('2025-08-23T12:00:00Z'));
  });
});

describe('sortAlbums', () => {
  const { home } = buildAlbums(index, { checked: ['cam', 'alb', 'evt', 'garden'], hidden: [] });

  it('sorts by most recent photo, first photo or name, both ways', () => {
    expect(ids(sortAlbums(home, { key: 'last', direction: 'desc' }))).toEqual([
      'cam',
      'evt',
      'alb',
    ]);
    expect(ids(sortAlbums(home, { key: 'last', direction: 'asc' }))).toEqual(['alb', 'evt', 'cam']);
    expect(ids(sortAlbums(home, { key: 'first', direction: 'asc' }))).toEqual([
      'alb',
      'evt',
      'cam',
    ]);
    expect(ids(sortAlbums(home, { key: 'name', direction: 'asc' }))).toEqual(['alb', 'cam', 'evt']);
    expect(ids(sortAlbums(home, { key: 'name', direction: 'desc' }))).toEqual([
      'evt',
      'cam',
      'alb',
    ]);
  });
});

describe('orderItems', () => {
  it('reverses dated items for the ascending order and keeps undated items last', () => {
    const { byId } = buildAlbums(index, { checked: null, hidden: [] });
    const items = byId.get('cam')?.items ?? [];
    expect(orderItems(items, 'desc').map((i) => i.id)).toEqual(['c1', 'c2', 'c3']);
    expect(orderItems(items, 'asc').map((i) => i.id)).toEqual(['c2', 'c1', 'c3']);
  });
});
