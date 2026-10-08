import { describe, expect, it } from 'vitest';
import type { GraphDriveItem } from './graph/types.ts';
import { buildIndex, cameraName, type DateResolver } from './normalize.ts';

const folder = (id: string, name: string, parentId: string): GraphDriveItem => ({
  id,
  name,
  folder: { childCount: 0 },
  parentReference: { id: parentId },
});

const file = (
  id: string,
  name: string,
  parentId: string,
  mimeType: string,
  takenDateTime?: string,
): GraphDriveItem => ({
  id,
  name,
  file: { mimeType },
  parentReference: { id: parentId },
  ...(takenDateTime ? { photo: { takenDateTime } } : {}),
});

const exifOnly: DateResolver = (item) =>
  item.photo?.takenDateTime
    ? { takenAt: Date.parse(item.photo.takenDateTime), source: 'exif' }
    : null;

const tree: GraphDriveItem[] = [
  folder('root', 'Pictures', 'drive-root'),
  folder('cam', 'Camera Roll', 'root'),
  folder('cam-2026', '2026', 'cam'),
  folder('cam-2026-10', '10', 'cam-2026'),
  folder('cam-undated', 'Sans date', 'cam'),
  folder('albums', 'Albums', 'root'),
  folder('pets', 'Animaux', 'albums'),
  folder('outside', 'Documents', 'drive-root'),
  file('a', '20261006_084759.jpg', 'cam-2026-10', 'image/jpeg', '2026-10-06T08:47:59Z'),
  file('b', '20261001_120000.mp4', 'cam-2026-10', 'video/mp4', '2026-10-01T12:00:00Z'),
  file('c', 'IMG_0001.JPG', 'cam-undated', 'image/jpeg'),
  file('d', 'chat.heic', 'pets', 'image/heic', '2025-05-01T10:00:00Z'),
  file('e', 'notes.pdf', 'pets', 'application/pdf'),
  file('f', 'secret.jpg', 'outside', 'image/jpeg', '2026-01-01T00:00:00Z'),
  { ...file('g', 'gone.jpg', 'pets', 'image/jpeg'), deleted: { state: 'deleted' } },
];

describe('buildIndex', () => {
  const index = buildIndex(tree, ['root'], exifOnly);

  it('keeps only image and video files under the roots', () => {
    expect(index.items.map((item) => item.id).sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(index.folders.has('outside')).toBe(false);
  });

  it('flags technical folders', () => {
    expect(index.folders.get('cam-2026')?.technical).toBe(true);
    expect(index.folders.get('cam-2026-10')?.technical).toBe(true);
    expect(index.folders.get('cam-undated')?.technical).toBe(true);
    expect(index.folders.get('cam')?.technical).toBe(false);
    expect(index.folders.get('root')?.parentId).toBeNull();
  });

  it('assigns files of technical folders to the nearest named parent', () => {
    const albumOf = Object.fromEntries(index.items.map((item) => [item.id, item.albumId]));
    expect(albumOf).toEqual({ a: 'cam', b: 'cam', c: 'cam', d: 'pets' });
  });

  it('sorts by capture date, most recent first, undated last', () => {
    expect(index.items.map((item) => item.id)).toEqual(['a', 'b', 'd', 'c']);
    expect(index.items.at(-1)?.takenAt).toBeNull();
  });

  it('keeps the wall-clock capture time without shifting it', () => {
    const a = index.items.find((item) => item.id === 'a');
    expect(new Date(a?.takenAt ?? 0).toISOString()).toBe('2026-10-06T08:47:59.000Z');
    expect(a?.dateSource).toBe('exif');
    expect(a?.kind).toBe('image');
  });
});

describe('cameraName', () => {
  it('joins the make and the model, without saying the make twice', () => {
    expect(cameraName('samsung', 'Galaxy S23')).toBe('samsung Galaxy S23');
    expect(cameraName('Canon', 'Canon EOS R6')).toBe('Canon EOS R6');
    expect(cameraName(' Apple ', 'iPhone 12 ')).toBe('Apple iPhone 12');
  });

  it('keeps what there is, and nothing when the file says nothing', () => {
    expect(cameraName(undefined, 'Pixel 7')).toBe('Pixel 7');
    expect(cameraName('Google', '')).toBe('Google');
    expect(cameraName(undefined, undefined)).toBeNull();
  });
});
