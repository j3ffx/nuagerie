import { describe, expect, it } from 'vitest';
import { buildIndex } from '../normalize.ts';
import { DEMO_ROOT_ID, generateDemoDataset, type DemoDriveItem } from './generator.ts';

const NOW = Date.UTC(2026, 9, 6, 12, 0, 0);
const dataset = generateDemoDataset({ nowWallClock: NOW });
const files = dataset.items.filter((item) => item.file);
const media = files.filter((item) => /^(image|video)\//.test(item.file?.mimeType ?? ''));
const folders = dataset.items.filter((item) => item.folder);
const index = buildIndex(
  dataset.items,
  dataset.rootFolderIds,
  (item) => (item as DemoDriveItem).demoExpectedDate ?? null,
);

const ratio = (predicate: (item: DemoDriveItem) => boolean) =>
  media.filter(predicate).length / media.length;

describe('generateDemoDataset', () => {
  it('produces exactly the requested number of photos and videos', () => {
    expect(media).toHaveLength(20_000);
    expect(index.items).toHaveLength(20_000);
  });

  it('is deterministic for a given seed', () => {
    const again = generateDemoDataset({ nowWallClock: NOW });
    expect(again.items).toEqual(dataset.items);
    const other = generateDemoDataset({ nowWallClock: NOW, seed: 1 });
    expect(other.items).not.toEqual(dataset.items);
  });

  it('matches the target proportions', () => {
    expect(ratio((item) => item.demoExpectedDate === null)).toBeGreaterThan(0.02);
    expect(ratio((item) => item.demoExpectedDate === null)).toBeLessThan(0.04);
    expect(ratio((item) => item.location !== undefined)).toBeGreaterThan(0.35);
    expect(ratio((item) => item.location !== undefined)).toBeLessThan(0.45);
    expect(ratio((item) => item.video !== undefined)).toBeGreaterThan(0.03);
    expect(ratio((item) => item.video !== undefined)).toBeLessThan(0.1);
  });

  it('never dates a file in the future or before 2016', () => {
    for (const item of media) {
      const takenAt = item.demoExpectedDate?.takenAt;
      if (takenAt === undefined) continue;
      expect(takenAt).toBeLessThanOrEqual(NOW);
      expect(takenAt).toBeGreaterThanOrEqual(Date.UTC(2016, 0, 1));
    }
  });

  it('reproduces the reference folder structure', () => {
    const topLevel = folders
      .filter((item) => item.parentReference?.id === DEMO_ROOT_ID)
      .map((item) => item.name)
      .sort();
    expect(topLevel).toEqual(
      [
        'Albums',
        'Ancien téléphone',
        'Applis',
        'Camera Roll',
        'Download',
        'Événements',
        'Messages',
        'Pictures',
        'Quick Share',
        'Screenshots',
        'Tapo',
      ].sort(),
    );
    const albumNames = new Set(
      [...index.folders.values()].filter((f) => !f.technical).map((f) => f.name),
    );
    for (const name of ['Camera Roll', 'WhatsApp', 'Animaux', 'Chat', '2016-2019', 'Mariage']) {
      if (name === 'Mariage') {
        expect([...albumNames].some((album) => album.endsWith('- Mariage'))).toBe(true);
      } else {
        expect(albumNames.has(name)).toBe(true);
      }
    }
  });

  it('assigns Camera Roll files (in AAAA/MM folders) to the Camera Roll album', () => {
    const cameraRoll = [...index.folders.values()].find((f) => f.name === 'Camera Roll');
    const sample = index.items.filter((item) => item.name.match(/^\d{8}_\d{6}/)).slice(0, 50);
    expect(sample.length).toBeGreaterThan(0);
    const albums = new Set(sample.map((item) => index.folders.get(item.albumId)?.name));
    expect(albums.has('Camera Roll')).toBe(true);
    expect(cameraRoll?.technical).toBe(false);
  });

  it('keeps file names unique within a folder', () => {
    const seen = new Set<string>();
    for (const item of files) {
      const key = `${item.parentReference?.id}/${item.name}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('includes non-media files, which the index ignores', () => {
    expect(files.length).toBeGreaterThan(media.length);
  });
});
