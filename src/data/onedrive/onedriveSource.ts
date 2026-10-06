import { readPersistent } from '../../lib/persistent.ts';
import { currentDateContext, resolveCaptureDate } from '../dates.ts';
import { summarize } from '../diagnostics.ts';
import { createGraphClient, GraphError, type GraphClient } from '../graph/client.ts';
import { detectScope, resolveFolder, syncRoot } from '../graph/sync.ts';
import { createThumbnailFetcher } from '../graph/thumbnails.ts';
import type { GraphDriveItem } from '../graph/types.ts';
import type { IndexProgress, MediaIndex } from '../model.ts';
import { buildIndex } from '../normalize.ts';
import type { DataSource } from '../source.ts';
import { IndexStore, type IndexMeta, type RootSyncState } from '../store.ts';

/** Folders scanned by default; more can be added in the settings. */
export const DEFAULT_ROOT_PATHS = ['/Pictures'];
export const ROOT_PATHS_KEY = 'rootPaths';

/**
 * Live checks of what the documentation leaves open, on the real drive.
 * Each check reports a short result, never item names.
 */
async function checkApi(
  client: GraphClient,
  meta: IndexMeta,
): Promise<{ check: string; result: string }[]> {
  const root = meta.rootFolders[0];
  if (!root) return [];
  const folderDelta = (query: string) =>
    meta.channels[0]?.scope === 'folder'
      ? `/me/drive/items/${encodeURIComponent(root.id)}/delta?${query}`
      : `/me/drive/root/delta?${query}`;

  const run = async (check: string, task: () => Promise<string>) => {
    try {
      return { check, result: await task() };
    } catch (error) {
      return {
        check,
        result: `erreur ${error instanceof GraphError ? `${error.status} ${error.code}` : String(error)}`,
      };
    }
  };

  return [
    {
      check: 'delta sur le dossier racine',
      result: meta.channels[0]?.scope === 'folder' ? 'oui' : 'non (delta du drive entier)',
    },
    await run('taille de la 1re page delta ($top=1000)', async () => {
      const page = await client.getJson<{ value: unknown[] }>(folderDelta('$select=id&$top=1000'));
      return `${page.value.length} éléments`;
    }),
    await run('miniatures via $expand=thumbnails dans delta', async () => {
      const page = await client.getJson<{ value: (GraphDriveItem & { thumbnails?: unknown[] })[] }>(
        folderDelta('$select=id,file&$expand=thumbnails&$top=50'),
      );
      const files = page.value.filter((item) => item.file);
      const withThumbs = files.filter((item) => (item.thumbnails ?? []).length > 0);
      return `${withThumbs.length}/${files.length} fichiers avec miniatures`;
    }),
  ];
}

export interface OneDriveSourceOptions {
  accountId: string;
  getToken: () => Promise<string>;
  /** For tests. */
  client?: GraphClient;
  store?: IndexStore;
}

export function createOneDriveSource(options: OneDriveSourceOptions): DataSource {
  const client = options.client ?? createGraphClient({ getToken: options.getToken });
  const thumbnails = createThumbnailFetcher(client);
  let storePromise: Promise<IndexStore> | null = options.store
    ? Promise.resolve(options.store)
    : null;
  const getStore = () => (storePromise ??= IndexStore.open());

  async function buildFromStore(store: IndexStore, meta: IndexMeta): Promise<MediaIndex> {
    const items = await store.loadItems();
    const context = currentDateContext();
    return buildIndex(
      items,
      meta.rootFolders.map((root) => root.id),
      (item) => resolveCaptureDate(item, context),
    );
  }

  /** Meta matching the current account and root paths, created (with scope detection) if needed. */
  async function prepareMeta(store: IndexStore): Promise<IndexMeta> {
    const paths = readPersistent<string[]>(ROOT_PATHS_KEY, DEFAULT_ROOT_PATHS);
    const existing = await store.getMeta();
    const samePaths = existing?.rootFolders.map((r) => r.path).join('\n') === paths.join('\n');
    if (existing && existing.accountId === options.accountId && samePaths) return existing;

    // Another account or another perimeter: start from a clean index.
    if (existing) await store.clear();
    const rootFolders = await Promise.all(
      paths.map(async (path) => ({ path, id: (await resolveFolder(client, path)).id })),
    );
    const scopes = await Promise.all(rootFolders.map((root) => detectScope(client, root.id)));
    const channels: RootSyncState[] = scopes.every((scope) => scope === 'folder')
      ? rootFolders.map((root) => ({
          ...root,
          scope: 'folder',
          deltaLink: null,
          resumeLink: null,
        }))
      : [{ path: '/', id: 'root', scope: 'drive', deltaLink: null, resumeLink: null }];
    const meta: IndexMeta = {
      schema: 1,
      accountId: options.accountId,
      rootFolders,
      channels,
      lastSyncAt: null,
      lastCount: existing?.lastCount ?? null,
    };
    await store.setMeta(meta);
    return meta;
  }

  /** Runs every channel; returns the number of changes. */
  async function sync(
    store: IndexStore,
    start: IndexMeta,
    onProgress?: (progress: IndexProgress) => void,
  ): Promise<{ meta: IndexMeta; changes: number }> {
    let meta = start;
    let changes = 0;
    let loadedBefore = 0;
    const full = meta.channels.some((c) => c.deltaLink === null);
    const stats = { items: 0, pages: 0, fetchMs: 0, storeMs: 0, totalMs: 0 };
    const startedAt = performance.now();
    for (let i = 0; i < meta.channels.length; i++) {
      const channel = meta.channels[i];
      if (!channel) continue;
      const outcome = await syncRoot(client, store, channel, {
        estimate: meta.lastCount,
        onProgress: ({ loaded }) =>
          onProgress?.({ loaded: loadedBefore + loaded, total: meta.lastCount }),
        onRootState: async (state) => {
          meta = { ...meta, channels: meta.channels.map((c, j) => (j === i ? state : c)) };
          await store.setMeta(meta);
        },
      });
      changes += outcome.changes;
      loadedBefore += outcome.changes;
      stats.pages += outcome.timings.pages;
      stats.fetchMs += outcome.timings.fetchMs;
      stats.storeMs += outcome.timings.storeMs;
      if (outcome.resynced) {
        // The store was cleared: every other channel must enumerate again too.
        meta = {
          ...meta,
          channels: meta.channels.map((c, j) =>
            j === i ? c : { ...c, deltaLink: null, resumeLink: null },
          ),
        };
        i = -1;
        loadedBefore = 0;
      }
    }
    const count = await store.count();
    meta = {
      ...meta,
      lastSyncAt: Date.now(),
      lastCount: count,
      ...(full
        ? {
            lastFullSync: {
              ...stats,
              items: count,
              totalMs: Math.round(performance.now() - startedAt),
              fetchMs: Math.round(stats.fetchMs),
              storeMs: Math.round(stats.storeMs),
            },
          }
        : {}),
    };
    await store.setMeta(meta);
    return { meta, changes };
  }

  return {
    mode: 'onedrive',

    async loadIndex(onProgress) {
      const store = await getStore();
      let meta = await prepareMeta(store);
      const complete = meta.channels.every((c) => c.deltaLink !== null && c.resumeLink === null);
      if (!complete) {
        // First start (or an interrupted one): wait for the full enumeration.
        ({ meta } = await sync(store, meta, onProgress));
      }
      return buildFromStore(store, meta);
    },

    async refresh(onProgress) {
      const store = await getStore();
      const meta = await prepareMeta(store);
      const result = await sync(store, meta, onProgress);
      return result.changes > 0 ? buildFromStore(store, result.meta) : null;
    },

    async reset() {
      const store = await getStore();
      await store.clear();
    },

    async diagnose() {
      const store = await getStore();
      const meta = await store.getMeta();
      if (!meta) throw new Error('Index not loaded yet');
      const raw = await store.loadItems();
      const index = await buildFromStore(store, meta);
      return summarize(raw, index, currentDateContext(), {
        mode: 'onedrive',
        lastFullSync: meta.lastFullSync ?? null,
        channels: meta.channels.map(({ path, scope }) => ({ path, scope })),
        apiChecks: await checkApi(client, meta),
        lastSyncAt: meta.lastSyncAt ? new Date(meta.lastSyncAt).toISOString() : null,
      });
    },

    fetchThumbnail: thumbnails,
  };
}
