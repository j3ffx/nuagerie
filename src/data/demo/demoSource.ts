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

/** Demo data: synthetic OneDrive generated locally, no account, no network. */
export function createDemoSource(): DataSource {
  const drawThumbnail = createDemoThumbnailDrawer();
  let generated: { dataset: DemoDataset; paths: Map<string, string> } | null = null;
  const generate = () => {
    if (!generated) {
      const context = currentDateContext();
      const dataset = generateDemoDataset({
        nowWallClock: context.nowWallClock,
        timeZone: context.timeZone,
      });
      generated = { dataset, paths: folderPaths(dataset) };
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
      const { dataset, paths } = generate();
      const parentId = paths.get(path.toLocaleLowerCase('en'));
      const parents = new Set(dataset.items.map((item) => item.parentReference?.id));
      return dataset.items
        .filter((item) => item.folder && item.parentReference?.id === parentId)
        .map((item): DriveFolder => ({
          name: item.name ?? '',
          path: childPath(path, item.name ?? ''),
          hasChildren: parents.has(item.id),
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
