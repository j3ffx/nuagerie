import { describe, expect, it } from 'vitest';
import { nameShape, summarize } from './diagnostics.ts';
import { buildIndex } from './normalize.ts';
import type { GraphDriveItem } from './graph/types.ts';

describe('nameShape', () => {
  it('hides letters and digits but keeps the structure and extension', () => {
    expect(nameShape('IMG_1234.JPG')).toBe('a_9999.jpg');
    expect(nameShape('Vacances à la mer (2).heic')).toBe('a a a a (9).heic');
    expect(nameShape('20261006_084759.jpg')).toBe('99999999_999999.jpg');
  });
});

describe('summarize', () => {
  it('counts facets and date sources without exposing names', () => {
    const raw: GraphDriveItem[] = [
      { id: 'root', name: 'Pictures', folder: {}, parentReference: { id: 'drive' } },
      {
        id: 'a',
        name: 'Secret place.jpg',
        file: { mimeType: 'image/jpeg' },
        parentReference: { id: 'root' },
        photo: { takenDateTime: '2025-01-01T10:00:00Z' },
        location: { latitude: 1, longitude: 2 },
        image: { width: 10, height: 10 },
      },
      {
        id: 'b',
        name: 'clip.mp4',
        file: { mimeType: 'video/mp4' },
        parentReference: { id: 'root' },
      },
    ];
    const index = buildIndex(raw, ['root'], (item) =>
      item.photo?.takenDateTime ? { takenAt: 1, source: 'exif' } : null,
    );
    const report = summarize(
      raw,
      index,
      { nowWallClock: Date.UTC(2026, 9, 6), timeZone: 'UTC' },
      { mode: 'test', channels: [], apiChecks: [], lastSyncAt: null, lastFullSync: null },
    );

    expect(report.counts).toMatchObject({
      indexedMedia: 2,
      images: 1,
      videos: 1,
      takenDateTime: 1,
      location: 1,
      dateSources: { exif: 1, filename: 0, none: 1 },
      mimeTypes: { 'image/jpeg': 1, 'video/mp4': 1 },
    });
    expect(report.undatedNameShapes).toEqual([{ shape: 'a.mp4', count: 1 }]);
    expect(JSON.stringify(report)).not.toContain('Secret');
  });

  it('compares EXIF dates with dates read from the name, per name shape', () => {
    const shot = (id: string, name: string, exif: string): GraphDriveItem => ({
      id,
      name,
      file: { mimeType: 'image/jpeg' },
      parentReference: { id: 'root' },
      photo: { takenDateTime: exif },
    });
    const raw: GraphDriveItem[] = [
      { id: 'root', name: 'Pictures', folder: {}, parentReference: { id: 'drive' } },
      shot('a', '20250701_100000.jpg', '2025-07-01T10:00:00Z'),
      shot('b', '20250701_080000123_iOS.jpg', '2025-07-01T10:00:00Z'),
      shot('c', '20250702_080000456_iOS.jpg', '2025-07-02T10:00:00Z'),
    ];
    const index = buildIndex(raw, ['root'], () => null);
    const report = summarize(
      raw,
      index,
      { nowWallClock: Date.UTC(2026, 9, 6), timeZone: 'UTC' },
      { mode: 'test', channels: [], apiChecks: [], lastSyncAt: null, lastFullSync: null },
    );
    expect(report.exifVersusName).toEqual([
      { shape: '99999999_999999999_a.jpg', count: 2, offsets: { '+120': 2 } },
      { shape: '99999999_999999.jpg', count: 1, offsets: { '0': 1 } },
    ]);
  });
});
