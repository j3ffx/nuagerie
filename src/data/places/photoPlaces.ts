import { openDB, type DBSchema } from 'idb';
import { language } from '../../lib/i18n.ts';
import type { MediaItem } from '../model.ts';
import { PLACES_URL, type Place } from './placeIndex.ts';
import { coordinateKey, lookupPlaces } from './places.ts';

/**
 * The place of every geotagged photo, for the search: found on the device by
 * the place worker, then kept in IndexedDB by rounded coordinates, so that
 * the next search (offline too) needs neither the place list nor the worker.
 * Only the coordinates never seen before are looked up.
 */

export interface PhotoPlaces {
  /** Place by rounded coordinates (coordinateKey); null: none near (open sea). */
  known: ReadonlyMap<string, Place | null>;
  /** Some photos still have no place: being looked up. */
  pending: boolean;
  /** The last lookup failed (offline before the place list was ever loaded). */
  failed: boolean;
}

export interface PlaceStorage {
  load(): Promise<Map<string, Place | null>>;
  save(entries: readonly (readonly [string, Place | null])[]): Promise<void>;
  clear(): Promise<void>;
}

export type PlaceLookup = (
  points: readonly (readonly [number, number])[],
) => Promise<(Place | null)[]>;

/** Points per message to the worker: the first places show before the last are found. */
const CHUNK = 4000;

export function createPhotoPlaces(lookup: PlaceLookup, storage: PlaceStorage) {
  let snapshot: PhotoPlaces = { known: new Map(), pending: false, failed: false };
  let loaded: Promise<void> | null = null;
  let running: Promise<void> | null = null;
  let again = false;
  /** Bumped by clear(): a lookup still running then keeps nothing. */
  let generation = 0;
  let latest: readonly MediaItem[] = [];
  const listeners = new Set<() => void>();

  const update = (next: Partial<PhotoPlaces>) => {
    snapshot = { ...snapshot, ...next };
    listeners.forEach((notify) => notify());
  };

  const load = () =>
    (loaded ??= storage.load().then(
      (saved) => update({ known: new Map([...saved, ...snapshot.known]) }),
      () => undefined, // no storage (private mode): look everything up again
    ));

  const missing = (items: readonly MediaItem[]) => {
    const points = new Map<string, readonly [number, number]>();
    for (const item of items) {
      if (item.latitude === null || item.longitude === null) continue;
      const key = coordinateKey(item.latitude, item.longitude);
      if (!snapshot.known.has(key) && !points.has(key)) {
        points.set(key, [item.latitude, item.longitude]);
      }
    }
    return [...points];
  };

  const run = async () => {
    const started = generation;
    await load();
    do {
      again = false;
      const todo = missing(latest);
      if (todo.length === 0) break;
      update({ pending: true });
      for (let start = 0; start < todo.length; start += CHUNK) {
        const chunk = todo.slice(start, start + CHUNK);
        let places: (Place | null)[];
        try {
          places = await lookup(chunk.map(([, point]) => point));
        } catch {
          update({ pending: false, failed: true });
          return;
        }
        if (generation !== started) return;
        const entries = chunk.map(([key], i) => [key, places[i] ?? null] as const);
        const known = new Map(snapshot.known);
        for (const [key, place] of entries) known.set(key, place);
        update({ known, failed: false });
        await storage.save(entries).catch(() => undefined);
      }
    } while (again);
    update({ pending: false });
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** Finds the places of these items that are not known yet (the latest list wins). */
    ensure(items: readonly MediaItem[]): Promise<void> {
      latest = items;
      if (running) {
        again = true;
        return running;
      }
      running = run().finally(() => {
        running = null;
      });
      return running;
    },
    /** Signing out: nothing of where the photos were taken stays on the device. */
    async clear(): Promise<void> {
      generation++;
      loaded = Promise.resolve();
      update({ known: new Map(), pending: false, failed: false });
      await storage.clear();
    },
  };
}

export type PhotoPlacesStore = ReturnType<typeof createPhotoPlaces>;

interface PlacesDB extends DBSchema {
  places: { key: string; value: Place | null };
  meta: { key: 'list'; value: string };
}

/** Its own database: the index's schema stays as it is, and clearing one leaves the other. */
const DB_NAME = 'nuagerie-places';
/** The list the places were found with, the shape and the language they are kept in. */
const LIST = `${PLACES_URL}#town#${language}`;

function indexedPlaceStorage(): PlaceStorage {
  const open = async () => {
    const db = await openDB<PlacesDB>(DB_NAME, 1, {
      upgrade(database) {
        database.createObjectStore('places');
        database.createObjectStore('meta');
      },
    });
    // Places found with another list (or kept in another shape): start again.
    if ((await db.get('meta', 'list')) !== LIST) {
      const tx = db.transaction(['places', 'meta'], 'readwrite');
      await Promise.all([
        tx.objectStore('places').clear(),
        tx.objectStore('meta').put(LIST, 'list'),
        tx.done,
      ]);
    }
    return db;
  };
  let db: ReturnType<typeof open> | null = null;
  const database = () => (db ??= open());
  return {
    async load() {
      const store = (await database()).transaction('places').store;
      const [keys, values] = await Promise.all([store.getAllKeys(), store.getAll()]);
      return new Map(keys.map((key, i) => [key, values[i] ?? null]));
    },
    async save(entries) {
      const tx = (await database()).transaction('places', 'readwrite');
      for (const [key, place] of entries) void tx.store.put(place, key);
      await tx.done;
    },
    async clear() {
      await (await database()).clear('places');
    },
  };
}

let shared: PhotoPlacesStore | null = null;

/** The app's store of photo places (worker + IndexedDB), created on first use. */
export function photoPlaces(): PhotoPlacesStore {
  return (shared ??= createPhotoPlaces(lookupPlaces, indexedPlaceStorage()));
}
