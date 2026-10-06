import type { MediaItem, ThumbnailSize } from '../model.ts';
import type { GraphClient } from './client.ts';

/**
 * Thumbnail URLs from Graph (pre-authenticated, short-lived). Grids get square
 * crops; "large" keeps the aspect ratio. URLs are kept in memory for a while,
 * keyed by id + size + eTag so a changed file gets a new thumbnail.
 * TODO: persistent cache of the images themselves (Cache Storage, LRU) and batching.
 */

const SELECTORS: Record<ThumbnailSize, string> = {
  small: 'c200x200_crop',
  medium: 'c360x360_crop',
  large: 'c1600x1600',
};
const URL_TTL_MS = 45 * 60_000;
const MAX_IN_FLIGHT = 6;

interface ThumbnailSet {
  value: Record<string, { url?: string } | string | undefined>[];
}

export function createThumbnailLoader(client: GraphClient) {
  const cache = new Map<string, { url: string; expires: number }>();
  const pending = new Map<string, Promise<string>>();
  const queue: (() => void)[] = [];
  let inFlight = 0;

  const acquire = () =>
    new Promise<void>((resolve) => {
      if (inFlight < MAX_IN_FLIGHT) {
        inFlight++;
        resolve();
      } else {
        queue.push(() => {
          inFlight++;
          resolve();
        });
      }
    });
  const release = () => {
    inFlight--;
    queue.shift()?.();
  };

  async function fetchUrl(item: MediaItem, selector: string): Promise<string> {
    await acquire();
    try {
      const set = await client.getJson<ThumbnailSet>(
        `/me/drive/items/${encodeURIComponent(item.id)}/thumbnails?select=${selector}`,
      );
      const entry = set.value[0]?.[selector];
      const url = typeof entry === 'object' ? entry?.url : undefined;
      if (!url) throw new Error('No thumbnail');
      return url;
    } finally {
      release();
    }
  }

  return function getThumbnailUrl(item: MediaItem, size: ThumbnailSize): Promise<string> {
    const selector = SELECTORS[size];
    const key = `${item.id}:${selector}:${item.eTag}`;
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) return Promise.resolve(cached.url);
    const running = pending.get(key);
    if (running) return running;

    const promise = fetchUrl(item, selector)
      .then((url) => {
        cache.set(key, { url, expires: Date.now() + URL_TTL_MS });
        return url;
      })
      .finally(() => pending.delete(key));
    pending.set(key, promise);
    return promise;
  };
}
