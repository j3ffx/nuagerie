import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { GraphDriveItem } from './graph/types.ts';

/**
 * Local copy of the OneDrive index (IndexedDB). It keeps the raw Graph items,
 * so dates and albums can be recomputed when the rules change, without
 * downloading anything again. The in-memory index is rebuilt from it at
 * startup (src/data/normalize.ts).
 */

/** One delta feed: a root folder, or the whole drive when folders don't support delta. */
export interface RootSyncState {
  /** Path from the drive root, e.g. "/Pictures" ("/" for the whole drive). */
  path: string;
  id: string;
  /** Delta on the folder itself, or on the whole drive. */
  scope: 'folder' | 'drive';
  /** Link to fetch the next changes; null until the first full enumeration completes. */
  deltaLink: string | null;
  /** Next page of an enumeration interrupted halfway (resumed on next start). */
  resumeLink: string | null;
}

export interface IndexMeta {
  schema: 1;
  /** The signed-in account the index belongs to. */
  accountId: string;
  /** Folders whose content forms the index (perimeter), e.g. /Pictures. */
  rootFolders: { path: string; id: string }[];
  /** Delta feeds that keep those folders up to date. */
  channels: RootSyncState[];
  lastSyncAt: number | null;
  /** Item count of the last complete index, used as the progress estimate. */
  lastCount: number | null;
  /** Measures of the last full enumeration (diagnostic). */
  lastFullSync?: FullSyncStats | null;
  /** The copy of the index left for the other devices (src/data/sync/indexSnapshot.ts). */
  snapshot?: SnapshotInfo | null;
}

/** What a device knows of the copy of the index in the app folder. */
export interface SnapshotInfo {
  /** When the copy this device made or started from was saved. */
  savedAt: number;
  /** The index changed since. */
  stale: boolean;
}

export interface FullSyncStats {
  items: number;
  pages: number;
  fetchMs: number;
  storeMs: number;
  totalMs: number;
}

interface NuagerieDB extends DBSchema {
  items: { key: string; value: GraphDriveItem };
  meta: { key: 'index'; value: IndexMeta };
}

const DB_NAME = 'nuagerie';
const DB_VERSION = 1;

export class IndexStore {
  private constructor(private readonly db: IDBPDatabase<NuagerieDB>) {}

  static async open(name = DB_NAME): Promise<IndexStore> {
    const db = await openDB<NuagerieDB>(name, DB_VERSION, {
      upgrade(database) {
        database.createObjectStore('items', { keyPath: 'id' });
        database.createObjectStore('meta');
      },
    });
    return new IndexStore(db);
  }

  loadItems(): Promise<GraphDriveItem[]> {
    return this.db.getAll('items');
  }

  count(): Promise<number> {
    return this.db.count('items');
  }

  async getMeta(): Promise<IndexMeta | null> {
    return (await this.db.get('meta', 'index')) ?? null;
  }

  async setMeta(meta: IndexMeta): Promise<void> {
    await this.db.put('meta', meta, 'index');
  }

  /** Applies one page of changes in a single transaction. */
  async applyChanges(
    upserts: readonly GraphDriveItem[],
    deletedIds: readonly string[],
  ): Promise<void> {
    const tx = this.db.transaction('items', 'readwrite');
    for (const item of upserts) void tx.store.put(item);
    for (const id of deletedIds) void tx.store.delete(id);
    await tx.done;
  }

  async clear(): Promise<void> {
    const tx = this.db.transaction(['items', 'meta'], 'readwrite');
    await Promise.all([tx.objectStore('items').clear(), tx.objectStore('meta').clear(), tx.done]);
  }

  close(): void {
    this.db.close();
  }
}
