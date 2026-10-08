import { currentDateContext, resolveCaptureDate } from '../dates.ts';
import { summarize } from '../diagnostics.ts';
import { buildIndex } from '../normalize.ts';
import { childPath, readRootPaths } from '../roots.ts';
import type { DataSource, DriveFolder } from '../source.ts';
import { DEMO_DRIVE_ROOT_ID, generateDemoDataset, type DemoDataset } from './generator.ts';
import { createDemoThumbnailDrawer } from './thumbnailWorkers.ts';

/** Folder ids by path from the drive root ("/" is the drive root), ignoring case. */
function folderPaths(dataset: DemoDataset): Map<string, string> {
  const byId = new Map(dataset.items.filter((item) => item.folder).map((f) => [f.id, f]));
  const paths = new Map<string, string>([['/', DEMO_DRIVE_ROOT_ID]]);
  const pathOf = (id: string): string => {
    const folder = byId.get(id);
    const parentId = folder?.parentReference?.id;
    if (!folder || !parentId) return '/';
    return childPath(parentId === DEMO_DRIVE_ROOT_ID ? '/' : pathOf(parentId), folder.name ?? '');
  };
  for (const id of byId.keys()) paths.set(pathOf(id).toLocaleLowerCase('en'), id);
  return paths;
}

/** Items right inside each folder, and the bytes below it (subfolders included). */
function folderStats(dataset: DemoDataset): Map<string, { childCount: number; size: number }> {
  const stats = new Map<string, { childCount: number; size: number }>();
  const parentOf = new Map(dataset.items.map((item) => [item.id, item.parentReference?.id]));
  const statsOf = (id: string) => {
    let entry = stats.get(id);
    if (!entry) stats.set(id, (entry = { childCount: 0, size: 0 }));
    return entry;
  };
  for (const item of dataset.items) {
    const parentId = item.parentReference?.id;
    if (parentId) statsOf(parentId).childCount++;
    if (item.folder) continue;
    for (let id = parentId; id; id = parentOf.get(id)) statsOf(id).size += item.size ?? 0;
  }
  return stats;
}

/** Demo data: synthetic OneDrive generated locally, no account, no network. */
export function createDemoSource(): DataSource {
  const drawThumbnail = createDemoThumbnailDrawer();
  let generated: {
    dataset: DemoDataset;
    paths: Map<string, string>;
    stats: ReturnType<typeof folderStats>;
  } | null = null;
  const generate = () => {
    if (!generated) {
      const context = currentDateContext();
      const dataset = generateDemoDataset({
        nowWallClock: context.nowWallClock,
        timeZone: context.timeZone,
      });
      generated = { dataset, paths: folderPaths(dataset), stats: folderStats(dataset) };
    }
    return generated;
  };
  const load = () => {
    const { dataset, paths } = generate();
    // The root folders chosen in the settings, as on a real drive.
    const roots = readRootPaths()
      .map((path) => paths.get(path.toLocaleLowerCase('en')))
      .filter((id): id is string => id !== undefined);
    // Same date extraction as real data; demoExpectedDate only serves the tests.
    const context = currentDateContext();
    const index = buildIndex(
      dataset.items,
      roots.length > 0 ? roots : dataset.rootFolderIds,
      (item) => resolveCaptureDate(item, context),
    );
    return { dataset, index };
  };

  return {
    mode: 'demo',

    async loadIndex(onProgress) {
      // Let the loading state paint before the (synchronous) generation.
      await new Promise((resolve) => setTimeout(resolve, 0));
      const { dataset, index } = load();
      onProgress?.({ loaded: dataset.items.length, total: dataset.items.length });
      return index;
    },

    async diagnose() {
      const { dataset, index } = load();
      return summarize(dataset.items, index, currentDateContext(), {
        mode: 'demo',
        lastFullSync: null,
        channels: [],
        apiChecks: [],
        lastSyncAt: null,
      });
    },

    async listFolders(path) {
      const { dataset, paths, stats } = generate();
      const parentId = paths.get(path.toLocaleLowerCase('en'));
      return dataset.items
        .filter((item) => item.folder && item.parentReference?.id === parentId)
        .map((item): DriveFolder => ({
          name: item.name ?? '',
          path: childPath(path, item.name ?? ''),
          childCount: stats.get(item.id)?.childCount ?? 0,
          size: stats.get(item.id)?.size ?? 0,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base', numeric: true }));
    },

    async getOriginalUrl(item) {
      // No real file: a large drawing stands for a photo; demo videos cannot play.
      if (item.kind === 'video') return null;
      return URL.createObjectURL(await drawThumbnail(item, 'large'));
    },

    async fetchThumbnail(item, size, signal) {
      signal?.throwIfAborted();
      return { blob: await drawThumbnail(item, size) };
    },
  };
}
