import { openDB, type IDBPDatabase } from 'idb';
import type { VectorTable } from './rank.ts';

/** The photos' vectors on this device, erased on sign-out and when the search is turned off. */
export interface VectorStore {
  ids(): Promise<Set<string>>;
  put(id: string, vector: Int8Array): Promise<void>;
  putMany(entries: readonly (readonly [string, Int8Array])[]): Promise<void>;
  remove(ids: readonly string[]): Promise<void>;
  /** Every vector, in one table to search; `dimensions` bytes each. */
  table(dimensions: number): Promise<VectorTable>;
  clear(): Promise<void>;
}

const STORE = 'vectors';

function tableOf(entries: readonly (readonly [string, Int8Array])[], dimensions: number) {
  const bytes = new Int8Array(entries.length * dimensions);
  entries.forEach(([, vector], row) => bytes.set(vector, row * dimensions));
  return { ids: entries.map(([id]) => id), bytes };
}

export function createVectorStore(name: string): VectorStore {
  let opened: Promise<IDBPDatabase> | null = null;
  const database = () =>
    (opened ??= openDB(name, 1, {
      upgrade(db) {
        db.createObjectStore(STORE);
      },
    }));

  return {
    async ids() {
      return new Set((await (await database()).getAllKeys(STORE)) as string[]);
    },
    async put(id, vector) {
      await (await database()).put(STORE, vector, id);
    },
    async putMany(entries) {
      const tx = (await database()).transaction(STORE, 'readwrite');
      await Promise.all([...entries.map(([id, vector]) => tx.store.put(vector, id)), tx.done]);
    },
    async remove(ids) {
      const tx = (await database()).transaction(STORE, 'readwrite');
      await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done]);
    },
    async table(dimensions) {
      const db = await database();
      const [ids, vectors] = await Promise.all([
        db.getAllKeys(STORE) as Promise<string[]>,
        db.getAll(STORE) as Promise<Int8Array[]>,
      ]);
      return tableOf(
        ids.map((id, i) => [id, vectors[i] ?? new Int8Array(dimensions)] as const),
        dimensions,
      );
    },
    async clear() {
      await (await database()).clear(STORE);
    },
  };
}

/** The demo's: gone with the page, like the rest of the demo's changes. */
export function createMemoryVectorStore(): VectorStore {
  const vectors = new Map<string, Int8Array>();
  return {
    ids: () => Promise.resolve(new Set(vectors.keys())),
    put(id, vector) {
      vectors.set(id, vector);
      return Promise.resolve();
    },
    putMany(entries) {
      for (const [id, vector] of entries) vectors.set(id, vector);
      return Promise.resolve();
    },
    remove(ids) {
      for (const id of ids) vectors.delete(id);
      return Promise.resolve();
    },
    table: (dimensions) => Promise.resolve(tableOf([...vectors], dimensions)),
    clear() {
      vectors.clear();
      return Promise.resolve();
    },
  };
}
