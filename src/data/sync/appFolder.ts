import { GraphError, type AppFolderWriter, type GraphClient } from '../graph/client.ts';
import { mergeStates, parseState, sameState, type SyncedState } from './state.ts';

/** The one file the app keeps in its own OneDrive folder (Apps/Nuagerie). */
export const SYNC_FILE = 'nuagerie.json';

export interface RemoteCopy {
  state: SyncedState;
  eTag: string;
}

/** The copy kept in OneDrive's app folder. */
export interface AppFolder {
  read(): Promise<RemoteCopy | null>;
  /** Writes over the copy with that eTag (null: none yet); a newer one throws SyncConflict. */
  write(state: SyncedState, eTag: string | null): Promise<string>;
}

/** The copy in OneDrive changed meanwhile (another device): read and merge again. */
export class SyncConflict extends Error {
  constructor() {
    super('The copy in OneDrive changed meanwhile');
    this.name = 'SyncConflict';
  }
}

export function createAppFolder(
  client: GraphClient & AppFolderWriter,
  download: typeof fetch = (input, init) => fetch(input, init),
): AppFolder {
  return {
    async read() {
      let item: { eTag?: string; '@microsoft.graph.downloadUrl'?: string };
      try {
        item = await client.getJson(`/me/drive/special/approot:/${SYNC_FILE}`);
      } catch (error) {
        if (error instanceof GraphError && error.status === 404) return null;
        throw error;
      }
      const url = item['@microsoft.graph.downloadUrl'];
      if (!url || !item.eTag) throw new Error('No download URL for the app folder file');
      const response = await download(url, { credentials: 'omit', cache: 'no-store' });
      if (!response.ok) throw new Error(`App folder file: HTTP ${response.status}`);
      return { state: parseState(await response.json()), eTag: item.eTag };
    },

    async write(state, eTag) {
      try {
        return (await client.putAppFile(SYNC_FILE, JSON.stringify(state), { ifMatch: eTag })).eTag;
      } catch (error) {
        // 412: If-Match failed; 409: If-None-Match failed (created meanwhile).
        if (error instanceof GraphError && (error.status === 412 || error.status === 409)) {
          throw new SyncConflict();
        }
        throw error;
      }
    },
  };
}

const isEmpty = (state: SyncedState) =>
  Object.keys(state.favorites).length === 0 && Object.keys(state.preferences).length === 0;

/**
 * Brings this device's copy and OneDrive's together: reads, merges, and
 * writes back only when OneDrive misses something. Returns the merged
 * state, for this device to keep.
 */
export async function syncWith(folder: AppFolder, local: SyncedState): Promise<SyncedState> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const remote = await folder.read();
    const merged = remote ? mergeStates(local, remote.state) : local;
    if (remote ? sameState(merged, remote.state) : isEmpty(local)) return merged;
    try {
      await folder.write(merged, remote?.eTag ?? null);
      return merged;
    } catch (error) {
      if (!(error instanceof SyncConflict)) throw error;
    }
  }
  throw new SyncConflict();
}
