import type { MediaItem } from '../model.ts';
import type { ContentEngine, EngineDevice } from './engine.ts';
import {
  awayFromCaptures,
  CAPTURE_PHRASE,
  closest,
  DIMENSIONS,
  toBytes,
  wantsCaptures,
  type VectorTable,
} from './rank.ts';
import type { VectorSnapshots } from './vectorSnapshot.ts';
import type { VectorStore } from './vectorStore.ts';

export interface ContentState {
  enabled: boolean;
  /** The text side of the model is being downloaded or loaded. */
  preparing: boolean;
  download: { loaded: number; total: number } | null;
  analysing: boolean;
  /** Where the analysis runs, once it has started. */
  device: EngineDevice | null;
  /** Photos of the index with a vector, out of `total`. */
  done: number;
  total: number;
  /** Photos of the index the last analysis could not read. They do not count as left to do. */
  unreadable: readonly MediaItem[];
  /** This device ran an analysis: it can try those again, and follows new photos. */
  analysedHere: boolean;
  /** A copy of the vectors is coming from OneDrive. */
  fetching: boolean;
  /** What went wrong last, to show as is. */
  error: string | null;
}

/** Every photo that can be analysed has been. */
export const analysisComplete = (state: ContentState) =>
  state.total > 0 && state.done + state.unreadable.length >= state.total;

export interface ContentSearch {
  subscribe(listener: () => void): () => void;
  getSnapshot(): ContentState;
  /** The index changed: follows it, and brings the vectors up to date where this device can. */
  update(items: readonly MediaItem[]): void;
  /** Turns the search on: downloads the text side, and looks for another device's vectors. */
  enable(): Promise<void>;
  /** Turns it off: the vectors and the model leave the device. */
  disable(): Promise<void>;
  /** Analyses the photos without a vector, until done, stopped, or out of network. */
  analyse(): Promise<void>;
  stop(): void;
  /** The ids of the photos closest to the words, among those given, closest first. */
  find(text: string, among: readonly MediaItem[]): Promise<string[]>;
}

/** The analysis was started where it cannot go on what another kind of device began. */
export const ANALYSED_ELSEWHERE = 'analysed-elsewhere';

export interface ContentDeps {
  engine: ContentEngine;
  store: VectorStore;
  snapshots: VectorSnapshots | null;
  image(item: MediaItem, signal: AbortSignal): Promise<Blob>;
  isOnline(): boolean;
  onMobileData(): boolean;
  /** Keeps the screen on; the function it returns lets it go. */
  keepAwake(): () => void;
  read(key: 'enabled' | 'analysed'): boolean;
  write(key: 'enabled' | 'analysed', value: boolean): void;
  /**
   * Where this device's vectors were computed. The graphics card's half floats and the
   * processor's bytes do not give comparable vectors (each works, not together), so a table
   * never mixes them.
   */
  readDevice(): EngineDevice | null;
  writeDevice(device: EngineDevice | null): void;
  /** The ids of the photos the last analysis could not read, kept so as not to try on every start. */
  readUnreadable(): readonly string[];
  writeUnreadable(ids: readonly string[]): void;
  /** Waits between two passes over what failed. */
  pause(ms: number, signal: AbortSignal): Promise<void>;
}

/** Enough for a few screens of results, few enough that the last ones still mean something. */
export const RESULTS = 120;
const PARALLEL_DOWNLOADS = 6;
const IMAGE_TIMEOUT_MS = 120_000;
/** Microsoft slows down whoever asks too much: what failed waits, then goes again. */
const PASSES = 4;
const PASS_PAUSE_MS = 60_000;
/** A vector is written at once; the screen hears of it this often. */
const NOTIFY_MS = 300;
const STORE_BATCH = 2_000;

export function createContentSearch(deps: ContentDeps): ContentSearch {
  const { engine, store, snapshots } = deps;
  let state: ContentState = {
    enabled: deps.read('enabled'),
    preparing: false,
    download: null,
    analysing: false,
    device: null,
    done: 0,
    total: 0,
    unreadable: [],
    analysedHere: deps.read('analysed'),
    fetching: false,
    error: null,
  };
  const listeners = new Set<() => void>();
  let items: readonly MediaItem[] = [];
  let known: Set<string> | null = null;
  let table: VectorTable | null = null;
  let controller: AbortController | null = null;
  let textReady: Promise<void> | null = null;
  let capture: Promise<Float32Array> | null = null;
  let snapshotTried = false;
  let lastNotify = 0;

  const set = (next: Partial<ContentState>) => {
    state = { ...state, ...next };
    listeners.forEach((listener) => listener());
  };
  const count = () => {
    const ids = known;
    return ids ? items.filter((item) => ids.has(item.id)).length : 0;
  };
  const unreadable = () => {
    const ids = new Set(deps.readUnreadable());
    return items.filter((item) => ids.has(item.id) && !known?.has(item.id));
  };
  /** Photos neither analysed nor known to be unreadable: something is left to do. */
  const leftToDo = () => items.length - count() - unreadable().length;
  const counts = () => ({ done: count(), unreadable: unreadable() });
  const progress = (loaded: number, total: number) => set({ download: { loaded, total } });
  const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

  const prepareText = () => {
    textReady ??= (async () => {
      set({ preparing: true, error: null });
      try {
        await engine.prepareText(progress);
      } catch (error) {
        textReady = null;
        throw error;
      } finally {
        set({ preparing: false, download: null });
      }
    })();
    return textReady;
  };

  async function fromAnotherDevice(): Promise<void> {
    if (!snapshots || snapshotTried || !deps.isOnline()) return;
    snapshotTried = true;
    set({ fetching: true });
    try {
      const copy = await snapshots.load();
      if (!copy) return;
      const ids = (known ??= await store.ids());
      if (ids.size > 0 && deps.readDevice() !== copy.device) return;
      deps.writeDevice(copy.device);
      const wanted = new Set(items.map((item) => item.id));
      const missing: (readonly [string, Int8Array])[] = [];
      copy.ids.forEach((id, row) => {
        if (ids.has(id) || !wanted.has(id)) return;
        const start = row * DIMENSIONS;
        missing.push([id, copy.bytes.slice(start, start + DIMENSIONS)]);
      });
      for (let i = 0; i < missing.length; i += STORE_BATCH) {
        await store.putMany(missing.slice(i, i + STORE_BATCH));
      }
      for (const [id] of missing) ids.add(id);
      deps.writeUnreadable(copy.unreadable);
      table = null;
    } catch {
      // The copy only saves time: without it, the device can analyse.
    } finally {
      set({ fetching: false, ...counts() });
    }
  }

  /** The photos without a vector, a few at a time; what failed stays out, for another pass. */
  async function pass(signal: AbortSignal): Promise<string[]> {
    const ids = known ?? new Set<string>();
    const todo = items.filter((item) => !ids.has(item.id));
    let next = 0;
    const failed: string[] = [];
    const worker = async () => {
      while (next < todo.length && !signal.aborted) {
        const item = todo[next++];
        if (!item) return;
        let image: Blob;
        try {
          image = await deps.image(
            item,
            AbortSignal.any([signal, AbortSignal.timeout(IMAGE_TIMEOUT_MS)]),
          );
        } catch {
          if (!signal.aborted) failed.push(item.id);
          continue;
        }
        // Past this point, a failure is the model's: no use going on.
        const vector = toBytes(await engine.encodeImage(image));
        await store.put(item.id, vector);
        ids.add(item.id);
        const now = Date.now();
        if (now - lastNotify >= NOTIFY_MS) {
          lastNotify = now;
          set({ done: count() });
        }
      }
    };
    await Promise.all(Array.from({ length: PARALLEL_DOWNLOADS }, worker));
    return failed;
  }

  async function shareVectors(device: EngineDevice): Promise<void> {
    if (!snapshots || !deps.isOnline()) return;
    try {
      await snapshots.save(await store.table(DIMENSIONS), device, deps.readUnreadable());
    } catch {
      // Next time: the other devices can wait, or analyse.
    }
  }

  const search: ContentSearch = {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => state,

    update(next) {
      items = next;
      set({ total: items.length, ...counts() });
      if (!state.enabled) return;
      void (async () => {
        known ??= await store.ids();
        set(counts());
        if (leftToDo() > 0) await fromAnotherDevice();
        // Where the photos were analysed, the new ones follow, unless on mobile data.
        if (leftToDo() > 0 && deps.read('analysed') && deps.isOnline() && !deps.onMobileData()) {
          await search.analyse();
        }
      })();
    },

    async enable() {
      deps.write('enabled', true);
      set({ enabled: true, error: null });
      known ??= await store.ids();
      set(counts());
      try {
        await prepareText();
      } catch (error) {
        set({ error: message(error) });
        return;
      }
      await fromAnotherDevice();
    },

    async disable() {
      search.stop();
      // Nothing written after the store is cleared.
      const never = new AbortController().signal;
      while (state.analysing) await deps.pause(50, never);
      deps.write('enabled', false);
      deps.write('analysed', false);
      deps.writeDevice(null);
      deps.writeUnreadable([]);
      await Promise.all([store.clear(), engine.erase()]);
      known = new Set();
      table = null;
      textReady = null;
      capture = null;
      snapshotTried = false;
      set({
        enabled: false,
        done: 0,
        unreadable: [],
        analysedHere: false,
        device: null,
        error: null,
        download: null,
      });
    },

    async analyse() {
      if (state.analysing) return;
      const release = deps.keepAwake();
      controller = new AbortController();
      const { signal } = controller;
      set({ analysing: true, error: null });
      try {
        known ??= await store.ids();
        const device = await engine.prepareImages(progress);
        if (known.size > 0 && deps.readDevice() !== device) {
          set({ error: ANALYSED_ELSEWHERE });
          return;
        }
        deps.writeDevice(device);
        set({ device, download: null });
        for (let round = 0; round < PASSES && !signal.aborted; round++) {
          const before = new Set(deps.readUnreadable());
          const failed = await pass(signal);
          if (signal.aborted) break;
          deps.writeUnreadable(failed);
          set(counts());
          // A photo that failed last time too will not be helped by waiting.
          if (failed.every((id) => before.has(id)) || round === PASSES - 1) break;
          await deps.pause(PASS_PAUSE_MS, signal);
        }
        table = null;
        // Vectors of photos no longer here go; only a whole pass is worth sharing.
        const here = new Set(items.map((item) => item.id));
        const gone = [...known].filter((id) => !here.has(id));
        if (gone.length > 0) {
          await store.remove(gone);
          for (const id of gone) known.delete(id);
        }
        if (!signal.aborted) {
          deps.write('analysed', true);
          set({ analysedHere: true });
          await shareVectors(device);
        }
      } catch (error) {
        if (!signal.aborted) set({ error: message(error) });
      } finally {
        release();
        engine.releaseImages();
        controller = null;
        set({ analysing: false, download: null, ...counts() });
      }
    },

    stop() {
      controller?.abort();
    },

    async find(text, among) {
      await prepareText();
      table ??= await store.table(DIMENSIONS);
      const query = await engine.encodeText(text);
      capture ??= engine.encodeText(CAPTURE_PHRASE);
      const aimed = wantsCaptures(text) ? query : awayFromCaptures(query, await capture);
      return closest(table, aimed, new Set(among.map((item) => item.id)), RESULTS);
    },
  };
  return search;
}
