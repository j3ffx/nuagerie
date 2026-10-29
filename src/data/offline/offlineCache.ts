/**
 * The images kept for offline use, in a Cache Storage of their own: the
 * thumbnail cache (src/data/thumbnails/diskCache.ts) evicts by size, this one
 * never does. Keys are the thumbnail keys (id + size + eTag), so a changed
 * file is a new image. What it holds is chosen by the user (src/data/offline/).
 */

export interface OfflineStorage {
  get(key: string): Promise<Blob | null>;
  put(key: string, blob: Blob): Promise<void>;
  delete(keys: readonly string[]): Promise<void>;
  /** Every key kept, with its size in bytes. */
  list(): Promise<Map<string, number>>;
  clear(): Promise<void>;
}

const SIZE_HEADER = 'X-Nuagerie-Bytes';

export function createOfflineCache(
  name: string,
  storage: CacheStorage | undefined = typeof caches === 'undefined' ? undefined : caches,
  origin: string = globalThis.location?.origin ?? 'http://localhost',
): OfflineStorage {
  let opened: Promise<Cache> | null = null;
  const open = () => (storage ? (opened ??= storage.open(name)) : null);
  const url = (key: string) => new URL(`/__offline/${key}`, origin).href;
  const prefix = new URL('/__offline/', origin).href;

  return {
    async get(key) {
      try {
        const hit = await (await open())?.match(url(key));
        return hit ? await hit.blob() : null;
      } catch {
        return null;
      }
    },
    async put(key, blob) {
      const cache = await open();
      await cache?.put(
        url(key),
        new Response(blob, {
          headers: { 'Content-Type': blob.type || 'image/jpeg', [SIZE_HEADER]: String(blob.size) },
        }),
      );
    },
    async delete(keys) {
      const cache = await open();
      if (cache) await Promise.all(keys.map((key) => cache.delete(url(key))));
    },
    async list() {
      const cache = await open();
      const kept = new Map<string, number>();
      if (!cache) return kept;
      for (const request of await cache.keys()) {
        if (!request.url.startsWith(prefix)) continue;
        const response = await cache.match(request);
        kept.set(request.url.slice(prefix.length), Number(response?.headers.get(SIZE_HEADER)) || 0);
      }
      return kept;
    },
    async clear() {
      opened = null;
      await storage?.delete(name);
    },
  };
}
