import { currentDateContext, resolveCaptureDate } from '../dates.ts';
import { buildIndex } from '../normalize.ts';
import type { DataSource } from '../source.ts';
import { generateDemoDataset } from './generator.ts';
import { demoThumbnailUrl } from './thumbnails.ts';

/** Demo data: synthetic OneDrive generated locally, no account, no network. */
export function createDemoSource(): DataSource {
  return {
    mode: 'demo',

    async loadIndex(onProgress) {
      // Let the loading state paint before the (synchronous) generation.
      await new Promise((resolve) => setTimeout(resolve, 0));
      const context = currentDateContext();
      const dataset = generateDemoDataset({
        nowWallClock: context.nowWallClock,
        timeZone: context.timeZone,
      });
      onProgress?.({ loaded: dataset.items.length, total: dataset.items.length });
      // Same date extraction as real data; demoExpectedDate only serves the tests.
      return buildIndex(dataset.items, dataset.rootFolderIds, (item) =>
        resolveCaptureDate(item, context),
      );
    },

    getThumbnailUrl(item, size) {
      return Promise.resolve(demoThumbnailUrl(item, size));
    },
  };
}
