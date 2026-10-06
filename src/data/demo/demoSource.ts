import { currentDateContext, resolveCaptureDate } from '../dates.ts';
import { summarize } from '../diagnostics.ts';
import { buildIndex } from '../normalize.ts';
import type { DataSource } from '../source.ts';
import { generateDemoDataset } from './generator.ts';
import { createDemoThumbnailDrawer } from './thumbnailWorkers.ts';

/** Demo data: synthetic OneDrive generated locally, no account, no network. */
export function createDemoSource(): DataSource {
  const drawThumbnail = createDemoThumbnailDrawer();
  const load = () => {
    const context = currentDateContext();
    const dataset = generateDemoDataset({
      nowWallClock: context.nowWallClock,
      timeZone: context.timeZone,
    });
    // Same date extraction as real data; demoExpectedDate only serves the tests.
    const index = buildIndex(dataset.items, dataset.rootFolderIds, (item) =>
      resolveCaptureDate(item, context),
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

    async fetchThumbnail(item, size, signal) {
      signal?.throwIfAborted();
      return { blob: await drawThumbnail(item, size) };
    },
  };
}
