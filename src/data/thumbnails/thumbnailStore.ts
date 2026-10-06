import type { MediaItem, ThumbnailSize } from '../model.ts';
import type { DataSource } from '../source.ts';
import type { ThumbnailDiskCache } from './diskCache.ts';

/**
 * Where grids get their thumbnails: memory first (object URLs, instant when
 * a row scrolls back into view), then the disk cache, then the data source.
 * Each image is keyed by item id + size + eTag, so a changed file gets a new
 * thumbnail. Displayed images are reference-counted; unused ones stay in a
 * small LRU before their object URL is released. A request nobody waits for
 * any more (scrolled past) is aborted.
 */

const IDLE_ENTRIES = 400;
/** A failed thumbnail is not asked for again before this delay. */
const RETRY_AFTER_MS = 5 * 60_000;

interface Entry {
  url: string | null;
  /** Object URLs are ours to revoke; direct URLs are not. */
  objectUrl: boolean;
  refs: number;
  promise: Promise<string> | null;
  controller: AbortController | null;
  failedAt: number | null;
}

export interface ThumbnailHandle {
  promise: Promise<string>;
  release(): void;
}

export function thumbnailKey(item: Pick<MediaItem, 'id' | 'eTag'>, size: ThumbnailSize): string {
  return `${size}/${encodeURIComponent(item.id)}/${encodeURIComponent(item.eTag)}`;
}

export class ThumbnailStore {
  private readonly entries = new Map<string, Entry>();
  /** Loaded entries nobody displays, oldest first. */
  private readonly idle = new Set<string>();

  constructor(
    private readonly source: Pick<DataSource, 'fetchThumbnail'>,
    private readonly disk: Pick<ThumbnailDiskCache, 'get' | 'put'>,
    private readonly idleLimit = IDLE_ENTRIES,
  ) {}

  /** The URL when it is already in memory (first render, no placeholder flash). */
  peek(item: MediaItem, size: ThumbnailSize): string | null {
    const key = thumbnailKey(item, size);
    const entry = this.entries.get(key);
    if (entry?.url && this.idle.has(key)) {
      // Touched: it is about to be displayed again.
      this.idle.delete(key);
      this.idle.add(key);
    }
    return entry?.url ?? null;
  }

  acquire(item: MediaItem, size: ThumbnailSize): ThumbnailHandle {
    const key = thumbnailKey(item, size);
    let entry = this.entries.get(key);
    if (entry?.failedAt != null && Date.now() - entry.failedAt > RETRY_AFTER_MS) {
      this.entries.delete(key);
      entry = undefined;
    }
    if (!entry) {
      entry = {
        url: null,
        objectUrl: false,
        refs: 0,
        promise: null,
        controller: null,
        failedAt: null,
      };
      this.entries.set(key, entry);
    }
    entry.refs++;
    this.idle.delete(key);

    const current = entry;
    if (current.url) {
      current.promise ??= Promise.resolve(current.url);
    } else if (!current.promise) {
      current.controller = new AbortController();
      current.promise = this.load(item, size, key, current, current.controller.signal);
      current.promise.catch(() => undefined); // failures are reported to the holders
    }

    let released = false;
    return {
      promise: current.promise,
      release: () => {
        if (released) return;
        released = true;
        this.release(key, current);
      },
    };
  }

  private async load(
    item: MediaItem,
    size: ThumbnailSize,
    key: string,
    entry: Entry,
    signal: AbortSignal,
  ): Promise<string> {
    try {
      let blob = await this.disk.get(key);
      signal.throwIfAborted();
      if (!blob) {
        const data = await this.source.fetchThumbnail(item, size, signal);
        if ('url' in data) {
          entry.url = data.url;
          return data.url;
        }
        blob = data.blob;
        void this.disk.put(key, blob);
      }
      signal.throwIfAborted();
      entry.url = URL.createObjectURL(blob);
      entry.objectUrl = true;
      return entry.url;
    } catch (error) {
      if (signal.aborted) {
        if (this.entries.get(key) === entry) this.entries.delete(key);
      } else {
        entry.failedAt = Date.now();
      }
      throw error;
    } finally {
      entry.controller = null;
      if (entry.refs === 0 && this.entries.get(key) === entry) this.retire(key, entry);
    }
  }

  private release(key: string, entry: Entry) {
    entry.refs--;
    if (entry.refs > 0 || this.entries.get(key) !== entry) return;
    if (entry.controller) {
      // Still loading and nobody waits for it any more. The next request
      // for this image starts afresh.
      entry.controller.abort();
      this.entries.delete(key);
      return;
    }
    this.retire(key, entry);
  }

  /** An unused entry: kept for a while if loaded, forgotten otherwise. */
  private retire(key: string, entry: Entry) {
    if (!entry.url) {
      if (entry.failedAt === null) this.entries.delete(key);
      return;
    }
    this.idle.add(key);
    while (this.idle.size > this.idleLimit) {
      const oldest = this.idle.values().next().value as string;
      this.idle.delete(oldest);
      const evicted = this.entries.get(oldest);
      this.entries.delete(oldest);
      if (evicted?.objectUrl && evicted.url) URL.revokeObjectURL(evicted.url);
    }
  }

  /** Forgets every image in memory (after the disk cache is cleared). */
  clearMemory() {
    for (const key of this.idle) {
      const entry = this.entries.get(key);
      if (entry?.objectUrl && entry.url) URL.revokeObjectURL(entry.url);
      this.entries.delete(key);
    }
    this.idle.clear();
  }
}
