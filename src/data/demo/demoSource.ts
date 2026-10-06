import { buildIndex } from '../normalize.ts';
import type { DataSource } from '../source.ts';
import { generateDemoDataset, type DemoDriveItem } from './generator.ts';
import { demoThumbnailUrl } from './thumbnails.ts';

/** Demo data: synthetic OneDrive generated locally, no account, no network. */
export function createDemoSource(): DataSource {
  return {
    mode: 'demo',

    async loadIndex(onProgress) {
      // Let the loading state paint before the (synchronous) generation.
      await new Promise((resolve) => setTimeout(resolve, 0));
      const dataset = generateDemoDataset();
      onProgress?.({ loaded: dataset.items.length, total: dataset.items.length });
      // TODO: resolve dates with the real extraction (EXIF, then file name)
      // and keep demoExpectedDate as the test oracle only.
      return buildIndex(
        dataset.items,
        dataset.rootFolderIds,
        (item) => (item as DemoDriveItem).demoExpectedDate ?? null,
      );
    },

    getThumbnailUrl(item, size) {
      return Promise.resolve(demoThumbnailUrl(item, size));
    },
  };
}
