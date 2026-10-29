import { describe, expect, it, vi } from 'vitest';
import type { GraphDriveItem } from '../graph/types.ts';
import type { CaptureDate, MediaItem } from '../model.ts';
import { buildIndex } from '../normalize.ts';
import { thumbnailKey } from '../thumbnails/thumbnailStore.ts';
import {
  createOfflineManager,
  ESTIMATED_BYTES_PER_ITEM,
  estimateBytes,
  keptItems,
  keptStatus,
  offlinePlan,
  type ManagerDeps,
} from './offline.ts';
import type { OfflineStorage } from './offlineCache.ts';

const folder = (id: string, name: string, parent: string): GraphDriveItem => ({
  id,
  name,
  folder: {},
  parentReference: { id: parent },
});
const photo = (id: string, parent: string, day: string): GraphDriveItem => ({
  id,
  name: `${id}.jpg`,
  eTag: `e-${id}`,
  file: { mimeType: 'image/jpeg' },
  parentReference: { id: parent },
  photo: { takenDateTime: `${day}T12:00:00Z` },
});
const date = (item: GraphDriveItem): CaptureDate | null =>
  item.photo?.takenDateTime
    ? { takenAt: Date.parse(item.photo.takenDateTime), source: 'exif' }
    : null;

// Pictures/ Événements/ (e1)  Mariage/ (m1)  Soirée/ (s1)   Animaux/ (a1)
const index = buildIndex(
  [
    folder('pics', 'Pictures', 'drive'),
    folder('evt', 'Événements', 'pics'),
    folder('wed', 'Mariage', 'evt'),
    folder('party', 'Soirée', 'wed'),
    folder('pets', 'Animaux', 'pics'),
    photo('e1', 'evt', '2024-01-01'),
    photo('m1', 'wed', '2025-08-23'),
    photo('s1', 'party', '2025-08-24'),
    photo('a1', 'pets', '2023-03-03'),
  ],
  ['pics'],
  date,
);
const byId = (id: string) => index.items.find((item) => item.id === id) as MediaItem;
const ids = (items: readonly MediaItem[]) => items.map((item) => item.id);

describe('keptItems', () => {
  it('keeps the chosen albums with their sub-albums, and the favourites, once each', () => {
    expect(ids(keptItems(index, { favorites: false, albums: ['wed'] }, []))).toEqual(['s1', 'm1']);
    expect(
      ids(keptItems(index, { favorites: true, albums: ['evt', 'wed'] }, [byId('a1'), byId('m1')])),
    ).toEqual(['a1', 'm1', 's1', 'e1']);
    expect(keptItems(index, { favorites: false, albums: [] }, [byId('a1')])).toEqual([]);
  });

  it('forgets an album that is no longer on the drive', () => {
    expect(keptItems(index, { favorites: false, albums: ['gone'] }, [])).toEqual([]);
  });
});

describe('offlinePlan', () => {
  it('downloads the grid and viewer images missing, and drops what is not kept', () => {
    const m1 = byId('m1');
    const present = new Set([thumbnailKey(m1, 'medium'), 'large/old/e']);
    const { downloads, drops } = offlinePlan([m1, byId('s1')], present);
    expect(downloads.map((d) => `${d.item.id}:${d.size}`)).toEqual([
      'm1:large',
      's1:medium',
      's1:large',
    ]);
    expect(drops).toEqual(['large/old/e']);
  });

  it('downloads a changed file again (new eTag) and drops its old images', () => {
    const before = byId('a1');
    const after = { ...before, eTag: 'e-a1-v2' };
    const present = new Set([thumbnailKey(before, 'medium'), thumbnailKey(before, 'large')]);
    const { downloads, drops } = offlinePlan([after], present);
    expect(downloads).toHaveLength(2);
    expect(drops).toHaveLength(2);
  });
});

describe('estimateBytes', () => {
  it('starts from a typical weight, then from what the kept images weigh', () => {
    expect(estimateBytes(10, 0, 0)).toBe(10 * ESTIMATED_BYTES_PER_ITEM);
    // 40 images of 100 kB: 200 kB a photo (two images each).
    expect(estimateBytes(10, 40 * 100_000, 40)).toBe(2_000_000);
  });
});

function memoryStorage(initial: [string, number][] = []) {
  const kept = new Map(initial);
  const storage: OfflineStorage = {
    get: (key) => Promise.resolve(kept.has(key) ? new Blob(['x']) : null),
    put: vi.fn((key: string, blob: Blob) => {
      kept.set(key, blob.size);
      return Promise.resolve();
    }),
    delete: vi.fn((keys: readonly string[]) => {
      for (const key of keys) kept.delete(key);
      return Promise.resolve();
    }),
    list: () => Promise.resolve(new Map(kept)),
    clear: vi.fn(() => {
      kept.clear();
      return Promise.resolve();
    }),
  };
  return { kept, storage };
}

function manager(overrides: Partial<ManagerDeps> = {}) {
  const { kept, storage } = memoryStorage();
  const fetch = vi.fn<ManagerDeps['fetch']>((_item, size) =>
    Promise.resolve({ blob: new Blob([size === 'large' ? 'large!' : 'm']) }),
  );
  const deps: ManagerDeps = {
    storage,
    fetch,
    isOnline: () => true,
    onMobileData: () => false,
    ...overrides,
  };
  return { offline: createOfflineManager(deps), kept, fetch, storage };
}

describe('createOfflineManager', () => {
  it('downloads every image of the kept photos, and counts them', async () => {
    const { offline, kept, fetch } = manager();
    await offline.sync([byId('m1'), byId('s1')]);
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(kept.size).toBe(4);
    expect(offline.getSnapshot()).toMatchObject({
      images: 4,
      bytes: 14,
      total: 4,
      done: 4,
      failed: 0,
      running: false,
      pause: null,
    });
    // Nothing new: nothing downloaded again.
    await offline.sync([byId('m1'), byId('s1')]);
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('drops the images of photos no longer kept', async () => {
    const { offline, kept } = manager();
    await offline.sync([byId('m1'), byId('s1')]);
    await offline.sync([byId('m1')]);
    expect([...kept.keys()].every((key) => key.includes('m1'))).toBe(true);
    expect(offline.getSnapshot().images).toBe(2);
  });

  it('waits for the network, then goes on', async () => {
    let online = false;
    const { offline, fetch } = manager({ isOnline: () => online });
    await offline.sync([byId('m1')]);
    expect(fetch).not.toHaveBeenCalled();
    expect(offline.getSnapshot()).toMatchObject({ pause: 'offline', total: 2 });
    online = true;
    await offline.resume();
    expect(offline.getSnapshot()).toMatchObject({ pause: null, done: 2, images: 2 });
  });

  it('waits for Wi-Fi on mobile data, unless allowed', async () => {
    const { offline, fetch } = manager({ onMobileData: () => true });
    await offline.sync([byId('m1')]);
    expect(offline.getSnapshot().pause).toBe('mobile-data');
    expect(fetch).not.toHaveBeenCalled();
    await offline.allowMobileData();
    expect(offline.getSnapshot()).toMatchObject({ pause: null, images: 2 });
  });

  it('counts the images it cannot keep, and tries them again next time', async () => {
    const { offline, fetch } = manager();
    fetch.mockImplementation((item: MediaItem) =>
      item.id === 's1'
        ? Promise.resolve({ url: 'https://thumbnails.example/s1' })
        : Promise.resolve({ blob: new Blob(['m']) }),
    );
    await offline.sync([byId('m1'), byId('s1')]);
    expect(offline.getSnapshot()).toMatchObject({ done: 2, failed: 2, images: 2 });
    fetch.mockImplementation(() => Promise.resolve({ blob: new Blob(['m']) }));
    await offline.resume();
    expect(offline.getSnapshot()).toMatchObject({ total: 2, done: 2, failed: 0, images: 4 });
  });

  it('pauses when the network goes in the middle', async () => {
    let online = true;
    const { offline, fetch } = manager({ isOnline: () => online });
    fetch.mockImplementation(() => {
      online = false;
      return Promise.reject(new TypeError('Failed to fetch'));
    });
    await offline.sync([byId('m1'), byId('s1'), byId('e1')]);
    expect(offline.getSnapshot().pause).toBe('offline');
    expect(fetch.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it('gives way to a new list while downloading', async () => {
    const { offline, kept, fetch } = manager();
    let first = true;
    fetch.mockImplementation((item, _size, signal) => {
      if (first) {
        first = false;
        // The list changes while this download is under way.
        void offline.sync([byId('a1')]);
      }
      return signal.aborted
        ? Promise.reject(new DOMException('aborted', 'AbortError'))
        : Promise.resolve({ blob: new Blob([item.id]) });
    });
    await offline.sync([byId('m1'), byId('s1'), byId('e1')]);
    await offline.resume();
    expect([...kept.keys()].every((key) => key.includes('a1'))).toBe(true);
    expect(kept.size).toBe(2);
  });

  it('forgets everything on clear', async () => {
    const { offline, kept, storage } = manager();
    await offline.sync([byId('m1')]);
    await offline.clear();
    expect(storage.clear).toHaveBeenCalled();
    expect(kept.size).toBe(0);
    expect(offline.getSnapshot()).toMatchObject({ images: 0, bytes: 0 });
  });
});

describe('keptStatus', () => {
  const m1 = byId('m1');
  const s1 = byId('s1');
  const sizes = new Map([
    [thumbnailKey(m1, 'medium'), 10],
    [thumbnailKey(m1, 'large'), 90],
    [thumbnailKey(s1, 'medium'), 10],
  ]);
  const view = (failures = new Map<string, 'unreadable' | 'missing'>()) => ({
    size: (key: string) => sizes.get(key) ?? null,
    failure: (key: string) => failures.get(key) ?? null,
  });

  it('counts the photos with both images, and their bytes', () => {
    expect(keptStatus([m1], view(), { running: false })).toMatchObject({
      photos: 1,
      keptPhotos: 1,
      bytes: 100,
      phase: 'done',
    });
    expect(keptStatus([m1, s1], view(), { running: true })).toMatchObject({
      keptPhotos: 1,
      bytes: 110,
      phase: 'downloading',
    });
    expect(keptStatus([m1, s1], view(), { running: false }).phase).toBe('waiting');
  });

  it('tells the failures and why, the most frequent first', () => {
    const status = keptStatus(
      [m1, s1, byId('e1'), byId('a1')],
      view(
        new Map([
          [thumbnailKey(s1, 'large'), 'missing'],
          [thumbnailKey(byId('e1'), 'medium'), 'unreadable'],
          [thumbnailKey(byId('a1'), 'large'), 'unreadable'],
        ]),
      ),
      { running: false },
    );
    expect(status).toMatchObject({
      failedPhotos: 3,
      reasons: ['unreadable', 'missing'],
      phase: 'error',
    });
  });
});

describe('createOfflineManager: failures', () => {
  it('remembers why an image failed, until it is kept', async () => {
    const { offline, fetch } = manager();
    fetch.mockImplementation((item) =>
      item.id === 's1'
        ? Promise.reject(Object.assign(new Error('Not found'), { status: 404 }))
        : Promise.resolve({ blob: new Blob(['m']) }),
    );
    await offline.sync([byId('m1'), byId('s1')]);
    expect(offline.view.failure(thumbnailKey(byId('s1'), 'large'))).toBe('missing');
    fetch.mockImplementation(() => Promise.resolve({ blob: new Blob(['m']) }));
    await offline.resume();
    expect(offline.view.failure(thumbnailKey(byId('s1'), 'large'))).toBeNull();
  });

  it('stops when the device is full', async () => {
    const { offline, storage } = manager();
    vi.mocked(storage.put).mockImplementation(() =>
      Promise.reject(new DOMException('full', 'QuotaExceededError')),
    );
    await offline.sync([byId('m1'), byId('s1'), byId('e1'), byId('a1')]);
    expect(offline.getSnapshot().failed).toBeLessThanOrEqual(3);
    expect(offline.view.failure(thumbnailKey(byId('m1'), 'medium'))).toBe('full');
  });

  it('does not count what the network going away stopped', async () => {
    let online = true;
    const { offline, fetch } = manager({ isOnline: () => online });
    fetch.mockImplementation(() => {
      online = false;
      return Promise.reject(new TypeError('Failed to fetch'));
    });
    await offline.sync([byId('m1')]);
    expect(offline.getSnapshot()).toMatchObject({ failed: 0, pause: 'offline' });
    expect(offline.view.failure(thumbnailKey(byId('m1'), 'medium'))).toBeNull();
  });
});

describe('createOfflineManager: on a real phone', () => {
  it('stops on mobile data in the middle, and waits for Wi-Fi', async () => {
    let cellular = false;
    const { offline, fetch } = manager({ onMobileData: () => cellular });
    fetch.mockImplementation(() => {
      cellular = true; // the user walks out of the Wi-Fi
      return Promise.resolve({ blob: new Blob(['m']) });
    });
    await offline.sync([byId('m1'), byId('s1'), byId('e1'), byId('a1')]);
    expect(offline.getSnapshot().pause).toBe('mobile-data');
    // Only those already under way went on.
    expect(fetch.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it('stops asking when the network lets nothing through', async () => {
    const { offline, fetch } = manager();
    fetch.mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')));
    const many = Array.from({ length: 20 }, (_, i) => ({ ...byId('m1'), id: `m${i}` }));
    await offline.sync(many);
    expect(offline.getSnapshot().pause).toBe('offline');
    expect(fetch.mock.calls.length).toBeLessThan(10);
  });

  it('keeps going through a few failures that are not the network', async () => {
    const { offline, fetch } = manager();
    fetch.mockImplementation((item) =>
      item.id.endsWith('1') && item.id !== 'm1'
        ? Promise.reject(Object.assign(new Error('Not found'), { status: 404 }))
        : Promise.resolve({ blob: new Blob(['m']) }),
    );
    const many = Array.from({ length: 12 }, (_, i) => ({ ...byId('m1'), id: `x${i}1` }));
    await offline.sync(many);
    expect(offline.getSnapshot()).toMatchObject({ pause: null, failed: 24 });
  });

  it('gives way to a new list given while old images are dropped', async () => {
    const { storage } = memoryStorage([['large/old/e', 1]]);
    let dropped: () => void = () => undefined;
    storage.delete = () => new Promise((resolve) => (dropped = resolve));
    const fetch = vi.fn<ManagerDeps['fetch']>(() => Promise.resolve({ blob: new Blob(['m']) }));
    const offline = createOfflineManager({
      storage,
      fetch,
      isOnline: () => true,
      onMobileData: () => false,
    });
    const first = offline.sync([byId('m1'), byId('s1')]);
    await vi.waitFor(() => expect(dropped).not.toBe(undefined));
    await new Promise((resolve) => setTimeout(resolve, 0));
    const second = offline.sync([byId('a1')]);
    dropped();
    await Promise.all([first, second]);
    // Nothing of the first list was downloaded.
    expect(new Set(fetch.mock.calls.map(([item]) => item.id))).toEqual(new Set(['a1']));
  });

  it('lists what is kept again when the app comes back (the browser may have cleared it)', async () => {
    const { offline, kept, fetch } = manager();
    await offline.sync([byId('m1')]);
    kept.clear(); // evicted under storage pressure
    await offline.refresh();
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(kept.size).toBe(2);
  });

  it('starts no new round for the same photos', async () => {
    const { offline, fetch } = manager();
    const releases: (() => void)[] = [];
    fetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          releases.push(() => resolve({ blob: new Blob(['m']) }));
        }),
    );
    const first = offline.sync([byId('m1')]);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    // A refreshed index: new objects, same photos and versions.
    const again = offline.sync([{ ...byId('m1') }]);
    fetch.mockImplementation(() => Promise.resolve({ blob: new Blob(['m']) }));
    releases.forEach((release) => release());
    await Promise.all([first, again]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
