import { describe, expect, it, vi } from 'vitest';
import { createLimiter } from '../../lib/limiter.ts';
import type { MediaItem } from '../model.ts';
import type { DataSource } from '../source.ts';
import { ThumbnailDiskCache, type CacheState } from './diskCache.ts';
import { ThumbnailStore, thumbnailKey } from './thumbnailStore.ts';

/** In-memory CacheStorage: enough of the API for the disk cache. */
function fakeCaches() {
  const stores = new Map<string, Map<string, Blob>>();
  const storage = {
    async open(name: string) {
      let store = stores.get(name);
      if (!store) stores.set(name, (store = new Map()));
      const s = store;
      return {
        async match(url: string) {
          const blob = s.get(url);
          return blob ? new Response(blob) : undefined;
        },
        async put(url: string, response: Response) {
          s.set(url, await response.blob());
        },
      };
    },
    async delete(name: string) {
      return stores.delete(name);
    },
    async keys() {
      return [...stores.keys()];
    },
  };
  return { storage: storage as unknown as CacheStorage, stores };
}

function setupDisk(cap: number, initial: CacheState | null = null) {
  const { storage, stores } = fakeCaches();
  let saved = initial;
  const disk = new ThumbnailDiskCache({
    caches: storage,
    prefix: 'thumbs-',
    capBytes: () => cap,
    loadState: () => saved,
    saveState: (state) => {
      saved = state;
    },
    origin: 'https://app.test',
  });
  return { disk, stores, saved: () => saved };
}

const bytes = (n: number) => new Blob([new Uint8Array(n)], { type: 'image/jpeg' });

describe('ThumbnailDiskCache', () => {
  it('stores and reads images back', async () => {
    const { disk } = setupDisk(1000);
    expect(await disk.get('a')).toBeNull();
    await disk.put('a', bytes(10));
    expect((await disk.get('a'))?.size).toBe(10);
    expect(disk.usage()).toBe(10);
  });

  it('never grows past the cap, keeping what was used recently', async () => {
    const { disk, stores, saved } = setupDisk(100);
    await disk.put('old', bytes(30));
    await disk.put('kept', bytes(30)); // current reaches half the cap: rotation
    expect(saved()).toEqual({ generation: 2, current: 0, previous: 60 });

    // Reading from the previous generation copies the image forward.
    expect((await disk.get('kept'))?.size).toBe(30);
    await disk.put('new', bytes(30)); // rotation again: "old" goes away
    expect(await disk.get('old')).toBeNull();
    expect((await disk.get('kept'))?.size).toBe(30);
    expect((await disk.get('new'))?.size).toBe(30);
    expect(disk.usage()).toBeLessThanOrEqual(100);
    expect([...stores.keys()].sort()).toEqual(['thumbs-2', 'thumbs-3']);
  });

  it('drops the older half when the cap is lowered', async () => {
    let cap = 1000;
    const { storage } = fakeCaches();
    const disk = new ThumbnailDiskCache({
      caches: storage,
      prefix: 't-',
      capBytes: () => cap,
      loadState: () => ({ generation: 5, current: 100, previous: 300 }),
      saveState: () => undefined,
      origin: 'https://app.test',
    });
    cap = 300;
    await disk.put('x', bytes(10));
    expect(disk.usage()).toBe(110);
  });

  it('removes stray generations and can be emptied', async () => {
    const { storage, stores } = fakeCaches();
    await storage.open('thumbs-1');
    await storage.open('thumbs-7');
    await storage.open('other-cache');
    const disk = new ThumbnailDiskCache({
      caches: storage,
      prefix: 'thumbs-',
      capBytes: () => 1000,
      loadState: () => ({ generation: 7, current: 0, previous: 0 }),
      saveState: () => undefined,
      origin: 'https://app.test',
    });
    await disk.put('a', bytes(5));
    expect([...stores.keys()].sort()).toEqual(['other-cache', 'thumbs-7']);
    await disk.clear();
    expect(disk.usage()).toBe(0);
    expect(await disk.get('a')).toBeNull();
  });

  it('misses quietly when Cache Storage is unavailable', async () => {
    const disk = new ThumbnailDiskCache({
      caches: undefined,
      prefix: 't-',
      capBytes: () => 1000,
      loadState: () => null,
      saveState: () => undefined,
    });
    await disk.put('a', bytes(5));
    expect(await disk.get('a')).toBeNull();
  });
});

const item = (id: string) => ({ id, eTag: `"${id}-1"` }) as MediaItem;

function setupStore(
  fetchThumbnail: DataSource['fetchThumbnail'] = vi.fn(async () => ({ blob: bytes(4) })),
) {
  const disk = { get: vi.fn(async () => null as Blob | null), put: vi.fn(async () => undefined) };
  const store = new ThumbnailStore({ fetchThumbnail }, disk, 2);
  return { store, disk, fetchThumbnail };
}

describe('ThumbnailStore', () => {
  it('fetches once, caches on disk, then answers from memory', async () => {
    const { store, disk, fetchThumbnail } = setupStore();
    const first = store.acquire(item('a'), 'medium');
    const second = store.acquire(item('a'), 'medium');
    const url = await first.promise;
    expect(await second.promise).toBe(url);
    expect(url).toMatch(/^blob:/);
    expect(fetchThumbnail).toHaveBeenCalledTimes(1);
    expect(disk.put).toHaveBeenCalledWith(thumbnailKey(item('a'), 'medium'), expect.any(Blob));
    first.release();
    second.release();
    expect(store.peek(item('a'), 'medium')).toBe(url);
  });

  it('reads the disk cache before the network', async () => {
    const { store, disk, fetchThumbnail } = setupStore();
    disk.get.mockResolvedValueOnce(bytes(3));
    await store.acquire(item('a'), 'medium').promise;
    expect(fetchThumbnail).not.toHaveBeenCalled();
  });

  it('aborts a request nobody waits for, and starts afresh next time', async () => {
    let signal: AbortSignal | undefined;
    const fetchThumbnail = vi.fn(
      (_item: MediaItem, _size: string, s?: AbortSignal) =>
        new Promise<{ blob: Blob }>((resolve, reject) => {
          signal = s;
          s?.addEventListener('abort', () => reject(s.reason));
          setTimeout(() => resolve({ blob: bytes(1) }), 5);
        }),
    );
    const { store } = setupStore(fetchThumbnail);
    const handle = store.acquire(item('a'), 'medium');
    await Promise.resolve();
    await Promise.resolve();
    handle.release();
    expect(signal?.aborted).toBe(true);
    await expect(handle.promise).rejects.toBeDefined();
    // Remounted (e.g. React strict mode): a new request, which succeeds.
    await expect(store.acquire(item('a'), 'medium').promise).resolves.toMatch(/^blob:/);
    expect(fetchThumbnail).toHaveBeenCalledTimes(2);
  });

  it('keeps a few unused images, releasing the oldest object URLs', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const { store } = setupStore();
    for (const id of ['a', 'b', 'c']) {
      const handle = store.acquire(item(id), 'medium');
      await handle.promise;
      handle.release();
    }
    expect(store.peek(item('a'), 'medium')).toBeNull();
    expect(store.peek(item('c'), 'medium')).not.toBeNull();
    expect(revoke).toHaveBeenCalledTimes(1);
    revoke.mockRestore();
  });

  it('shows a direct URL when the bytes cannot be read, without caching it', async () => {
    const { store, disk } = setupStore(vi.fn(async () => ({ url: 'https://thumbs.test/a' })));
    await expect(store.acquire(item('a'), 'medium').promise).resolves.toBe('https://thumbs.test/a');
    expect(disk.put).not.toHaveBeenCalled();
  });

  it('does not ask again right away for a thumbnail that failed', async () => {
    const fetchThumbnail = vi.fn(async () => {
      throw new Error('no thumbnail');
    });
    const { store } = setupStore(fetchThumbnail);
    const first = store.acquire(item('a'), 'medium');
    await expect(first.promise).rejects.toThrow('no thumbnail');
    first.release();
    await expect(store.acquire(item('a'), 'medium').promise).rejects.toThrow();
    expect(fetchThumbnail).toHaveBeenCalledTimes(1);
  });

  it('asks again for failed thumbnails once failures are forgotten (back online)', async () => {
    const fetchThumbnail = vi
      .fn<DataSource['fetchThumbnail']>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ blob: bytes(2) });
    const { store } = setupStore(fetchThumbnail);
    const first = store.acquire(item('a'), 'medium');
    await expect(first.promise).rejects.toThrow('Failed to fetch');

    store.forgetFailures();
    await expect(store.acquire(item('a'), 'medium').promise).resolves.toMatch(/^blob:/);
    first.release();
    expect(fetchThumbnail).toHaveBeenCalledTimes(2);
  });
});

describe('createLimiter', () => {
  it('runs at most n tasks at once, in order, skipping aborted ones', async () => {
    const run = createLimiter(2);
    let active = 0;
    let peak = 0;
    const order: number[] = [];
    const task = (n: number) => async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 2));
      order.push(n);
      active--;
      return n;
    };
    const aborted = new AbortController();
    const results = [run(task(1)), run(task(2)), run(task(3), aborted.signal), run(task(4))];
    aborted.abort();
    await expect(results[2]).rejects.toBeDefined();
    await Promise.all([results[0], results[1], results[3]]);
    expect(peak).toBe(2);
    expect(order).toEqual([1, 2, 4]);
  });
});
