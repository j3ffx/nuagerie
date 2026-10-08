import type { AppFolderWriter, GraphClient } from '../graph/client.ts';
import type { GraphDriveItem } from '../graph/types.ts';
import type { RootSyncState, SnapshotInfo } from '../store.ts';

/**
 * A copy of a complete index, left in the app folder (Apps/Nuagerie) for the
 * user's other devices: a new device shows it within seconds, then catches up
 * from its delta links, instead of listing the whole drive again.
 */
export const INDEX_FILE = 'index.json.gz';

export interface IndexSnapshot {
  schema: 1;
  savedAt: number;
  accountId: string;
  rootFolders: { path: string; id: string }[];
  /** Where each delta feed stood when the copy was made. */
  channels: RootSyncState[];
  /** Raw Graph items, as the device keeps them (src/data/store.ts). */
  items: GraphDriveItem[];
}

export interface IndexSnapshots {
  /** The copy another device left, or null (none, not allowed here, unreadable). */
  load(): Promise<IndexSnapshot | null>;
  /** Leaves a copy; false when this device may not write it (sync off). */
  save(snapshot: IndexSnapshot): Promise<boolean>;
}

/** A copy is a day old before a device that changed its index replaces it. */
export const SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Whether this device should leave a new copy: none known yet, or a stale one a day old. */
export function snapshotDue(info: SnapshotInfo | null | undefined, now = Date.now()): boolean {
  if (!info) return true;
  return info.stale && now - info.savedAt >= SNAPSHOT_MAX_AGE_MS;
}

/**
 * Whether a copy can stand for this device's index: same account and same
 * folders, every feed complete. Anything else is ignored (full listing).
 */
export function usableSnapshot(
  value: unknown,
  accountId: string,
  rootFolders: readonly { path: string; id: string }[],
): value is IndexSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as Partial<IndexSnapshot>;
  const sameFolders = (folders: unknown) =>
    Array.isArray(folders) &&
    folders.length === rootFolders.length &&
    folders.every(
      (folder: { path?: unknown; id?: unknown }, i) =>
        folder.path === rootFolders[i]?.path && folder.id === rootFolders[i]?.id,
    );
  return (
    snapshot.schema === 1 &&
    snapshot.accountId === accountId &&
    sameFolders(snapshot.rootFolders) &&
    Array.isArray(snapshot.channels) &&
    snapshot.channels.length > 0 &&
    snapshot.channels.every(
      (channel) => typeof channel.deltaLink === 'string' && channel.resumeLink === null,
    ) &&
    Array.isArray(snapshot.items) &&
    typeof snapshot.savedAt === 'number'
  );
}

/** JSON, gzipped: a few MB of names and dates shrink to about a quarter. */
export async function encodeSnapshot(snapshot: IndexSnapshot): Promise<Blob> {
  const stream = new Blob([JSON.stringify(snapshot)])
    .stream()
    .pipeThrough(new CompressionStream('gzip'));
  return new Response(stream).blob();
}

export async function decodeSnapshot(body: ReadableStream<BufferSource>): Promise<unknown> {
  return new Response(body.pipeThrough(new DecompressionStream('gzip'))).json();
}

/**
 * The copy in the app folder. `may` tells, at each call, whether this device
 * may read or write it (the user's sync choices).
 */
export function createIndexSnapshots(
  client: GraphClient & AppFolderWriter,
  may: { load: () => boolean; save: () => boolean },
  download: typeof fetch = (input, init) => fetch(input, init),
): IndexSnapshots {
  return {
    async load() {
      if (!may.load()) return null;
      try {
        const item = await client.getJson<{ '@microsoft.graph.downloadUrl'?: string }>(
          `/me/drive/special/approot:/${INDEX_FILE}`,
        );
        const url = item['@microsoft.graph.downloadUrl'];
        if (!url) return null;
        const response = await download(url, { credentials: 'omit', cache: 'no-store' });
        if (!response.ok || !response.body) return null;
        return (await decodeSnapshot(response.body)) as IndexSnapshot;
      } catch {
        // No copy yet (404), no permission, or a damaged file: the drive is listed instead.
        return null;
      }
    },

    async save(snapshot) {
      if (!may.save()) return false;
      await client.putAppFile(INDEX_FILE, await encodeSnapshot(snapshot), {
        overwrite: true,
        contentType: 'application/gzip',
      });
      return true;
    },
  };
}
