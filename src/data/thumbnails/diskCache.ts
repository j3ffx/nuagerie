/**
 * Persistent thumbnail cache in Cache Storage, capped in size, with
 * least-recently-used eviction approximated by two generations:
 * - new images go into the current generation;
 * - an image read from the previous generation is copied into the current one;
 * - when the current generation reaches half the cap, the previous one is
 *   deleted at once and a new current one starts.
 * So the cache never exceeds the cap, everything used since the last
 * rotation survives, and there is no per-image bookkeeping to write.
 * Byte counts are kept in a small state object (localStorage).
 */

export interface CacheState {
  generation: number;
  /** Bytes in the current and the previous generation. */
  current: number;
  previous: number;
}

export interface DiskCacheOptions {
  /** Unavailable (old browser, insecure context): every read misses, writes are dropped. */
  caches: CacheStorage | undefined;
  /** Cache names start with it; one prefix per data mode. */
  prefix: string;
  capBytes: () => number;
  loadState: () => CacheState | null;
  saveState: (state: CacheState) => void;
  /** Base URL of the cache keys (keys must be URLs). */
  origin?: string;
}

const EMPTY: CacheState = { generation: 1, current: 0, previous: 0 };

export class ThumbnailDiskCache {
  private state: CacheState;
  private readonly opened = new Map<number, Promise<Cache>>();
  private writes: Promise<void> = Promise.resolve();
  private readonly listeners = new Set<() => void>();
  private readonly ready: Promise<void>;

  constructor(private readonly options: DiskCacheOptions) {
    this.state = { ...EMPTY, ...options.loadState() };
    this.ready = this.removeStrayCaches();
  }

  private name(generation: number) {
    return `${this.options.prefix}${generation}`;
  }

  private open(generation: number): Promise<Cache> | null {
    const storage = this.options.caches;
    if (!storage) return null;
    let cache = this.opened.get(generation);
    if (!cache) {
      cache = storage.open(this.name(generation));
      this.opened.set(generation, cache);
    }
    return cache;
  }

  private url(key: string) {
    return new URL(`/__thumbnails/${key}`, this.options.origin ?? globalThis.location.origin).href;
  }

  /** Generations other than the current and previous ones: left by a crash or another cap. */
  private async removeStrayCaches() {
    const storage = this.options.caches;
    if (!storage) return;
    const keep = new Set([this.name(this.state.generation), this.name(this.state.generation - 1)]);
    const names = await storage.keys().catch(() => [] as string[]);
    await Promise.all(
      names
        .filter((name) => name.startsWith(this.options.prefix) && !keep.has(name))
        .map((name) => storage.delete(name)),
    );
  }

  /** Bytes stored (both generations). */
  usage(): number {
    return this.state.current + this.state.previous;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private commit(state: CacheState) {
    this.state = state;
    this.options.saveState(state);
    this.listeners.forEach((notify) => notify());
  }

  async get(key: string): Promise<Blob | null> {
    const current = this.open(this.state.generation);
    if (!current) return null;
    try {
      await this.ready;
      const url = this.url(key);
      const hit = await (await current).match(url);
      if (hit) return await hit.blob();
      if (this.state.previous === 0) return null;
      const old = await (await this.open(this.state.generation - 1))?.match(url);
      if (!old) return null;
      const blob = await old.blob();
      void this.put(key, blob); // still in use: keep it through the next rotation
      return blob;
    } catch {
      return null; // a cache is a cache: any failure is a miss
    }
  }

  /** Writes are queued one after the other, so the byte counts stay exact. */
  put(key: string, blob: Blob): Promise<void> {
    this.writes = this.writes.then(() => this.write(key, blob)).catch(() => undefined);
    return this.writes;
  }

  private async write(key: string, blob: Blob) {
    const cache = this.open(this.state.generation);
    if (!cache) return;
    await this.ready;
    await (
      await cache
    ).put(
      this.url(key),
      new Response(blob, { headers: { 'Content-Type': blob.type || 'image/jpeg' } }),
    );
    let next = { ...this.state, current: this.state.current + blob.size };
    const cap = this.options.capBytes();
    if (next.current >= cap / 2) {
      await this.drop(next.generation - 1);
      next = { generation: next.generation + 1, current: 0, previous: next.current };
    } else if (next.current + next.previous > cap && next.previous > 0) {
      // The cap was lowered: the older half goes first.
      await this.drop(next.generation - 1);
      next = { ...next, previous: 0 };
    }
    this.commit(next);
  }

  private async drop(generation: number) {
    this.opened.delete(generation);
    await this.options.caches?.delete(this.name(generation));
  }

  /** Empties the cache. */
  clear(): Promise<void> {
    this.writes = this.writes.then(async () => {
      const generation = this.state.generation;
      await Promise.all([this.drop(generation), this.drop(generation - 1)]);
      this.commit({ generation: generation + 1, current: 0, previous: 0 });
    });
    return this.writes;
  }
}
