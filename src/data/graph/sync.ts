import type { IndexStore, RootSyncState } from '../store.ts';
import { GraphError, type GraphClient } from './client.ts';
import type { GraphDriveItem } from './types.ts';

/**
 * Keeps the local index in step with OneDrive using `delta`: one full
 * enumeration, then only the changes. Pages are applied as they arrive and
 * the next link is saved, so an interrupted enumeration resumes where it
 * stopped.
 */

/** Only the fields the app uses (CLAUDE.md → Invariants: grids use thumbnails, never the original). */
export const DELTA_SELECT =
  'id,name,parentReference,file,folder,photo,video,image,location,size,eTag,deleted,root';
const PAGE_SIZE = 1000;

interface DeltaPage {
  value: GraphDriveItem[];
  '@odata.nextLink'?: string;
  '@odata.deltaLink'?: string;
}

export interface SyncProgress {
  /** Items received during this run. */
  loaded: number;
  /** Estimated total (previous index size), when known. */
  total: number | null;
}

export interface SyncCallbacks {
  onProgress?: (progress: SyncProgress) => void;
  /** Saves the root state after each page (resume link, then delta link). */
  onRootState: (root: RootSyncState) => Promise<void>;
  estimate?: number | null;
}

export interface SyncOutcome {
  root: RootSyncState;
  /** Items added, changed or deleted. */
  changes: number;
  /** True when the server asked for a full resync (410 Gone): the store was cleared. */
  resynced: boolean;
}

/** Resolves a folder path such as "/Pictures" to its id. */
export async function resolveFolder(
  client: GraphClient,
  path: string,
): Promise<{ id: string; name: string }> {
  const encoded = path.split('/').filter(Boolean).map(encodeURIComponent).join('/');
  return client.getJson(`/me/drive/root:/${encoded}?$select=id,name,folder`);
}

export function initialDeltaUrl(root: Pick<RootSyncState, 'id' | 'scope'>): string {
  const query = `?$select=${DELTA_SELECT}&$top=${PAGE_SIZE}`;
  return root.scope === 'folder'
    ? `/me/drive/items/${encodeURIComponent(root.id)}/delta${query}`
    : `/me/drive/root/delta${query}`;
}

/** Folders are kept (album tree); files only if they are photos or videos. */
export function isWorthKeeping(item: GraphDriveItem): boolean {
  if (item.folder || item.root) return true;
  const mime = item.file?.mimeType ?? '';
  return mime.startsWith('image/') || mime.startsWith('video/');
}

/**
 * Whether the folder supports its own delta. The documentation only lists
 * drive-level delta, so this is checked against the real service; when it
 * fails, the whole drive is enumerated and the index keeps the folder only.
 */
export async function detectScope(
  client: GraphClient,
  folderId: string,
): Promise<RootSyncState['scope']> {
  try {
    await client.getJson(`/me/drive/items/${encodeURIComponent(folderId)}/delta?$select=id&$top=1`);
    return 'folder';
  } catch (error) {
    if (error instanceof GraphError && error.status >= 400 && error.status < 500) return 'drive';
    throw error;
  }
}

export async function syncRoot(
  client: GraphClient,
  store: IndexStore,
  start: RootSyncState,
  callbacks: SyncCallbacks,
): Promise<SyncOutcome> {
  let root = start;
  let url = root.resumeLink ?? root.deltaLink ?? initialDeltaUrl(root);
  let loaded = 0;
  let changes = 0;
  let resynced = false;

  for (;;) {
    let page: DeltaPage;
    try {
      page = await client.getJson<DeltaPage>(url);
    } catch (error) {
      if (error instanceof GraphError && error.status === 410 && !resynced) {
        // The service cannot continue from this token: enumerate again from scratch.
        resynced = true;
        await store.clear();
        root = { ...root, deltaLink: null, resumeLink: null };
        await callbacks.onRootState(root);
        url = error.location ?? initialDeltaUrl(root);
        loaded = 0;
        continue;
      }
      throw error;
    }

    const deleted: string[] = [];
    const upserts: GraphDriveItem[] = [];
    for (const item of page.value) {
      if (item.deleted) deleted.push(item.id);
      else if (isWorthKeeping(item)) upserts.push(item);
      else deleted.push(item.id); // e.g. a photo renamed to .txt
    }
    await store.applyChanges(upserts, deleted);
    loaded += page.value.length;
    changes += page.value.length;
    callbacks.onProgress?.({ loaded, total: callbacks.estimate ?? null });

    const next = page['@odata.nextLink'];
    if (next) {
      root = { ...root, resumeLink: next };
      await callbacks.onRootState(root);
      url = next;
      continue;
    }
    root = { ...root, resumeLink: null, deltaLink: page['@odata.deltaLink'] ?? root.deltaLink };
    await callbacks.onRootState(root);
    return { root, changes, resynced };
  }
}
