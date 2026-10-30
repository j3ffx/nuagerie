import { currentDateContext, resolveCaptureDate } from '../dates.ts';
import { summarize } from '../diagnostics.ts';
import { createDriveEdits } from '../edits/driveEdits.ts';
import {
  createGraphClient,
  GraphError,
  type DriveWriter,
  type GraphClient,
} from '../graph/client.ts';
import { detectScope, photosFolderPath, resolveFolder, syncRoot } from '../graph/sync.ts';
import {
  createThumbnailFetcher,
  THUMBNAIL_SELECTORS,
  thumbnailPath,
  thumbnailUrlIn,
} from '../graph/thumbnails.ts';
import { createOriginalUrlLoader } from '../graph/originals.ts';
import type { GraphDriveItem } from '../graph/types.ts';
import type { IndexProgress, MediaIndex } from '../model.ts';
import { buildIndex } from '../normalize.ts';
import type { DataSource, DriveFolder } from '../source.ts';
import {
  childPath,
  DEFAULT_ROOT_PATHS,
  hasChosenRootPaths,
  readDefaultRootPath,
  readRootPaths,
  writeDefaultRootPath,
} from '../roots.ts';
import { IndexStore, type IndexMeta, type RootSyncState } from '../store.ts';
import { snapshotDue, usableSnapshot, type IndexSnapshots } from '../sync/indexSnapshot.ts';
import { locale, localized } from '../../lib/i18n.ts';

const t = localized({
  fr: {
    offline: 'Hors connexion, et aucune photo n’est encore enregistrée sur cet appareil.',
    error: (detail: string) => `erreur ${detail}`,
    rootDelta: 'delta sur le dossier racine',
    yes: 'oui',
    driveDelta: 'non (delta du drive entier)',
    firstPage: 'taille de la 1re page delta ($top=1000)',
    items: (count: number) => `${count} éléments`,
    expand: 'miniatures via $expand=thumbnails dans delta',
    withThumbnails: (some: number, all: number) => `${some}/${all} fichiers avec miniatures`,
    readable: (status: number, type: string, kb: number) =>
      `oui (${status}, ${type}, ${kb} Ko lus)`,
    unknownType: 'type inconnu',
    csp: 'non (hôte bloqué par la CSP)',
    no: (detail: string) => `non (${detail})`,
    originalUrl: 'URL de l’original',
    missing: 'absente',
    originalHost: 'hôte des originaux',
    originalRead: 'lecture de l’original (CORS, partage)',
    batch: (count: number) => `miniatures par $batch (${count} éléments)`,
    batchResult: (urls: number, ids: number, ms: number, statuses: string) =>
      `${urls}/${ids} URL en ${ms} ms (statuts ${statuses})`,
    batchCheck: 'miniatures par $batch',
    thumbnailHost: 'hôte des miniatures',
    bytes: 'lecture des octets (CORS)',
    cache: 'cache des miniatures',
    unused: 'pas encore utilisé',
    active: 'actif',
    inactive: 'inactif (URL directes)',
  },
  en: {
    offline: 'Offline, and no photo is saved on this device yet.',
    error: (detail: string) => `error ${detail}`,
    rootDelta: 'delta on the root folder',
    yes: 'yes',
    driveDelta: 'no (delta of the whole drive)',
    firstPage: 'size of the first delta page ($top=1000)',
    items: (count: number) => `${count} items`,
    expand: 'thumbnails through $expand=thumbnails in delta',
    withThumbnails: (some: number, all: number) => `${some}/${all} files with thumbnails`,
    readable: (status: number, type: string, kb: number) =>
      `yes (${status}, ${type}, ${kb} kB read)`,
    unknownType: 'unknown type',
    csp: 'no (host blocked by the CSP)',
    no: (detail: string) => `no (${detail})`,
    originalUrl: 'URL of the original',
    missing: 'missing',
    originalHost: 'host of the originals',
    originalRead: 'reading the original (CORS, sharing)',
    batch: (count: number) => `thumbnails through $batch (${count} items)`,
    batchResult: (urls: number, ids: number, ms: number, statuses: string) =>
      `${urls}/${ids} URLs in ${ms} ms (statuses ${statuses})`,
    batchCheck: 'thumbnails through $batch',
    thumbnailHost: 'host of the thumbnails',
    bytes: 'reading the bytes (CORS)',
    cache: 'thumbnail cache',
    unused: 'not used yet',
    active: 'active',
    inactive: 'inactive (direct URLs)',
  },
});

/** Started offline, with no index kept on the device yet. */
export class OfflineError extends Error {
  constructor() {
    super(t.offline);
    this.name = 'OfflineError';
  }
}

/**
 * Live checks of what the documentation leaves open, on the real drive.
 * Each check reports a short result, never item names.
 */
async function checkApi(
  client: GraphClient,
  meta: IndexMeta,
  sampleIds: string[],
  thumbnails: ReturnType<typeof createThumbnailFetcher>,
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
        result: t.error(
          error instanceof GraphError ? `${error.status} ${error.code}` : String(error),
        ),
      };
    }
  };

  return [
    {
      check: t.rootDelta,
      result: meta.channels[0]?.scope === 'folder' ? t.yes : t.driveDelta,
    },
    await run(t.firstPage, async () => {
      const page = await client.getJson<{ value: unknown[] }>(folderDelta('$select=id&$top=1000'));
      return t.items(page.value.length);
    }),
    await run(t.expand, async () => {
      const page = await client.getJson<{ value: (GraphDriveItem & { thumbnails?: unknown[] })[] }>(
        folderDelta('$select=id,file&$expand=thumbnails&$top=50'),
      );
      const files = page.value.filter((item) => item.file);
      const withThumbs = files.filter((item) => (item.thumbnails ?? []).length > 0);
      return t.withThumbnails(withThumbs.length, files.length);
    }),
    ...(await checkThumbnails(client, sampleIds, thumbnails)),
    ...(await checkOriginal(client, sampleIds[0])),
  ];
}

/** Host of a URL with its first label hidden (random server names). */
const maskedHost = (url: string) => new URL(url).hostname.replace(/^[^.]+/, '*');

/**
 * Whether the app may read a URL's bytes (CORS), telling a Content-Security-
 * Policy block (host to allow in public/_headers) from a CORS refusal. Only
 * the first 64 KB are asked for.
 */
async function probeRead(url: string): Promise<string> {
  let cspBlocked = false;
  const onViolation = () => {
    cspBlocked = true;
  };
  document.addEventListener('securitypolicyviolation', onViolation);
  try {
    const response = await fetch(url, { credentials: 'omit', headers: { Range: 'bytes=0-65535' } });
    const blob = await response.blob();
    return t.readable(response.status, blob.type || t.unknownType, Math.round(blob.size / 1024));
  } catch (error) {
    await new Promise((resolve) => setTimeout(resolve, 0)); // the violation event comes after
    return cspBlocked ? t.csp : t.no(String(error));
  } finally {
    document.removeEventListener('securitypolicyviolation', onViolation);
  }
}

/** Where original files are served from, and whether the app may read them (sharing). */
async function checkOriginal(client: GraphClient, id: string | undefined) {
  if (!id) return [];
  try {
    const item = await client.getJson<{ '@microsoft.graph.downloadUrl'?: string }>(
      `/me/drive/items/${encodeURIComponent(id)}`,
    );
    const url = item['@microsoft.graph.downloadUrl'];
    if (!url) return [{ check: t.originalUrl, result: t.missing }];
    return [
      { check: t.originalHost, result: maskedHost(url) },
      { check: t.originalRead, result: await probeRead(url) },
    ];
  } catch (error) {
    return [
      {
        check: t.originalUrl,
        result: t.error(
          error instanceof GraphError ? `${error.status} ${error.code}` : String(error),
        ),
      },
    ];
  }
}

/** Batched thumbnail URLs, where they are served from, and whether their bytes can be read (CORS). */
async function checkThumbnails(
  client: GraphClient,
  ids: string[],
  thumbnails: ReturnType<typeof createThumbnailFetcher>,
): Promise<{ check: string; result: string }[]> {
  const selector = THUMBNAIL_SELECTORS.medium;
  const urls: string[] = [];
  const checks: { check: string; result: string }[] = [];
  const startedAt = performance.now();
  try {
    const responses = await client.batch(
      ids.map((id, i) => ({ id: String(i), url: thumbnailPath({ id }, selector) })),
    );
    for (const response of responses) {
      const url = response.status === 200 ? thumbnailUrlIn(response.body, selector) : null;
      if (url) urls.push(url);
    }
    const statuses = [...new Set(responses.map((r) => r.status))].join(', ');
    checks.push({
      check: t.batch(ids.length),
      result: t.batchResult(
        urls.length,
        ids.length,
        Math.round(performance.now() - startedAt),
        statuses,
      ),
    });
  } catch (error) {
    checks.push({
      check: t.batchCheck,
      result: t.error(
        error instanceof GraphError ? `${error.status} ${error.code}` : String(error),
      ),
    });
  }
  const url = urls[0];
  if (!url) return checks;
  const hosts = [...new Set(urls.map(maskedHost))];
  checks.push({ check: t.thumbnailHost, result: hosts.join(', ') });
  checks.push({ check: t.bytes, result: await probeRead(url) });
  const readable = thumbnails.bytesReadable();
  checks.push({
    check: t.cache,
    result: readable === null ? t.unused : readable ? t.active : t.inactive,
  });
  return checks;
}

interface FolderPage {
  value: Pick<GraphDriveItem, 'name' | 'folder' | 'size'>[];
  '@odata.nextLink'?: string;
}

export interface OneDriveSourceOptions {
  /**
   * The signed-in account, or null when the app started offline without one:
   * the index kept on the device is shown as is, and never updated or replaced.
   */
  accountId: string | null;
  getToken: () => Promise<string>;
  /** A token allowing changes (Réglages → Modifications); without it, nothing can be changed. */
  getEditToken?: () => Promise<string>;
  /** The copy of the index shared with the user's other devices, when the sync allows it. */
  snapshots?: IndexSnapshots;
  /** For tests. */
  client?: GraphClient;
  writer?: DriveWriter;
  store?: IndexStore;
}

export function createOneDriveSource(options: OneDriveSourceOptions): DataSource {
  const client = options.client ?? createGraphClient({ getToken: options.getToken });
  const thumbnails = createThumbnailFetcher(client);
  const originalUrls = createOriginalUrlLoader(client);
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
    const existing = await store.getMeta();
    if (!hasChosenRootPaths() && options.accountId !== null) await findDefaultRoot(existing);
    const paths = readRootPaths();
    const samePaths = existing?.rootFolders.map((r) => r.path).join('\n') === paths.join('\n');
    if (options.accountId === null) {
      if (existing && samePaths) return existing;
      throw new OfflineError();
    }
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

  /**
   * No folders chosen: the drive's Photos folder, whatever its name. An index
   * already kept for this account keeps its folders (it was made from the
   * default of its time), so nothing is indexed again; the folder found once
   * is kept, so a full reindex finds it again (the drive is asked only then).
   */
  async function findDefaultRoot(existing: IndexMeta | null): Promise<void> {
    const kept = existing?.accountId === options.accountId ? existing.rootFolders : null;
    let path = kept?.length === 1 && kept[0] ? kept[0].path : readDefaultRootPath();
    path ??= (await photosFolderPath(client)) ?? DEFAULT_ROOT_PATHS[0] ?? '/Pictures';
    // Written even when it is the old default, "/Pictures".
    if (path !== readDefaultRootPath()) writeDefaultRootPath(path);
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
      // The copy left for the other devices falls behind.
      ...(changes > 0 && meta.snapshot ? { snapshot: { ...meta.snapshot, stale: true } } : {}),
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

  const signedIn = options.accountId !== null;
  const getEditToken = options.getEditToken;
  const writer =
    options.writer ?? (getEditToken ? createGraphClient({ getToken: getEditToken }) : null);
  const edits =
    signedIn && writer
      ? createDriveEdits({
          writer,
          index: async () => {
            const store = await getStore();
            const meta = await store.getMeta();
            if (!meta) throw new Error('Index not loaded yet');
            return buildFromStore(store, meta);
          },
          apply: async (upserts, deletedIds) => {
            const store = await getStore();
            await store.applyChanges(upserts, deletedIds);
            const meta = await store.getMeta();
            if (!meta) throw new Error('Index not loaded yet');
            // The copy left for the other devices falls behind, as after a delta.
            if (meta.snapshot)
              await store.setMeta({ ...meta, snapshot: { ...meta.snapshot, stale: true } });
            return buildFromStore(store, meta);
          },
        })
      : undefined;
  const webUrls = new Map<string, string | null>();
  /** Off after a reindex asked for: the drive is listed again, the copy is not trusted. */
  let useSharedCopy = true;

  /**
   * A new device starts from the copy another one left, when it covers the
   * same account and folders: shown at once, then brought up to date by delta.
   */
  async function restoreSnapshot(store: IndexStore, meta: IndexMeta): Promise<IndexMeta | null> {
    if (!options.snapshots || options.accountId === null || !useSharedCopy) return null;
    const snapshot = await options.snapshots.load();
    if (!usableSnapshot(snapshot, options.accountId, meta.rootFolders)) return null;
    await store.applyChanges(snapshot.items, []);
    const restored: IndexMeta = {
      ...meta,
      channels: snapshot.channels,
      lastSyncAt: snapshot.savedAt,
      lastCount: snapshot.items.length,
      snapshot: { savedAt: snapshot.savedAt, stale: false },
    };
    await store.setMeta(restored);
    return restored;
  }

  /** Leaves a copy of a complete index for the other devices, at most once a day; never blocks. */
  let saving = false;
  /** Bumped by each reset: a copy made before it no longer describes the index. */
  let generation = 0;
  async function saveSnapshot(store: IndexStore, meta: IndexMeta): Promise<void> {
    if (!options.snapshots || options.accountId === null || saving) return;
    if (!snapshotDue(meta.snapshot)) return;
    saving = true;
    const started = generation;
    try {
      const savedAt = Date.now();
      const saved = await options.snapshots.save({
        schema: 1,
        savedAt,
        accountId: options.accountId,
        rootFolders: meta.rootFolders,
        channels: meta.channels,
        items: await store.loadItems(),
      });
      const latest = await store.getMeta();
      if (saved && latest && generation === started) {
        await store.setMeta({ ...latest, snapshot: { savedAt, stale: false } });
      }
    } catch {
      // Tried again after the next change.
    } finally {
      saving = false;
    }
  }

  return {
    mode: 'onedrive',
    ...(edits && { edits }),

    async loadIndex(onProgress) {
      const store = await getStore();
      let meta = await prepareMeta(store);
      const fresh = meta.channels.every((c) => c.deltaLink === null && c.resumeLink === null);
      if (fresh) meta = (await restoreSnapshot(store, meta).catch(() => null)) ?? meta;
      const complete = meta.channels.every((c) => c.deltaLink !== null && c.resumeLink === null);
      if (!complete) {
        // First start (or an interrupted one): wait for the full enumeration.
        ({ meta } = await sync(store, meta, onProgress));
        void saveSnapshot(store, meta);
      }
      return buildFromStore(store, meta);
    },

    ...(signedIn && {
      async refresh(onProgress?: (progress: IndexProgress) => void) {
        const store = await getStore();
        const meta = await prepareMeta(store);
        const result = await sync(store, meta, onProgress);
        void saveSnapshot(store, result.meta);
        return result.changes > 0 ? buildFromStore(store, result.meta) : null;
      },

      async reset(resetOptions?: { useSharedCopy?: boolean }) {
        useSharedCopy = resetOptions?.useSharedCopy ?? false;
        generation++;
        const store = await getStore();
        await store.clear();
      },
    }),

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
        apiChecks: await checkApi(
          client,
          meta,
          raw
            .filter((item) => item.file?.mimeType?.startsWith('image/'))
            .slice(0, 20)
            .map((item) => item.id),
          thumbnails,
        ),
        lastSyncAt: meta.lastSyncAt ? new Date(meta.lastSyncAt).toISOString() : null,
      });
    },

    async listFolders(path) {
      const encoded = path.split('/').filter(Boolean).map(encodeURIComponent).join('/');
      let url: string | null =
        `${encoded ? `/me/drive/root:/${encoded}:` : '/me/drive/root'}/children` +
        '?$select=name,folder,size&$top=999';
      const folders: DriveFolder[] = [];
      while (url) {
        const page: FolderPage = await client.getJson<FolderPage>(url);
        for (const item of page.value) {
          if (!item.folder || !item.name) continue;
          folders.push({
            name: item.name,
            path: childPath(path, item.name),
            childCount: item.folder.childCount ?? 0,
            size: item.size ?? null,
          });
        }
        url = page['@odata.nextLink'] ?? null;
      }
      return folders.sort((a, b) =>
        a.name.localeCompare(b.name, locale, { sensitivity: 'base', numeric: true }),
      );
    },

    fetchThumbnail: thumbnails,

    getOriginalUrl: originalUrls,

    async getWebUrl(id) {
      // One request per file or folder: an item's page on OneDrive keeps its address.
      const known = webUrls.get(id);
      if (known !== undefined) return known;
      const found = await client.getJson<{ webUrl?: string }>(
        `/me/drive/items/${encodeURIComponent(id)}?$select=webUrl`,
      );
      const url = found.webUrl ?? null;
      webUrls.set(id, url);
      return url;
    },
  };
}
