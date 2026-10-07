import { readPersistent, writePersistent } from '../../lib/persistent.ts';
import type { DataMode, DataSource } from '../source.ts';
import { ThumbnailDiskCache, type CacheState } from './diskCache.ts';
import { ThumbnailStore } from './thumbnailStore.ts';

export const CACHE_SIZE_KEY = 'thumbnailCacheMB';
export const CACHE_SIZES_MB = [250, 500, 1000, 2000] as const;
export const DEFAULT_CACHE_MB = 500;
export const MB = 1024 * 1024;

export interface Thumbnails {
  store: ThumbnailStore;
  disk: ThumbnailDiskCache;
}

/** The thumbnail pipeline of a data source; demo and OneDrive images are kept apart. */
export function createThumbnails(mode: DataMode, source: DataSource): Thumbnails {
  const stateKey = `thumbnailCache.${mode}`;
  const disk = new ThumbnailDiskCache({
    caches: typeof caches === 'undefined' ? undefined : caches,
    prefix: `nuagerie-thumbnails-${mode}-`,
    capBytes: () => readPersistent(CACHE_SIZE_KEY, DEFAULT_CACHE_MB) * MB,
    loadState: () => readPersistent<CacheState | null>(stateKey, null),
    saveState: (state) => writePersistent(stateKey, state),
  });
  const store = new ThumbnailStore(source, disk);
  // Thumbnails that failed offline load as soon as the connection is back
  // (useThumbnailUrl asks again for those on screen).
  if (typeof window !== 'undefined')
    window.addEventListener('online', () => store.forgetFailures());
  return { disk, store };
}
