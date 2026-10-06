import type { IndexProgress, MediaIndex, MediaItem, ThumbnailSize } from './model.ts';

export type DataMode = 'demo' | 'onedrive';

/**
 * Where the index and the thumbnails come from. The UI only talks to this
 * interface, so demo data and OneDrive data are interchangeable.
 */
export interface DataSource {
  readonly mode: DataMode;
  loadIndex(onProgress?: (progress: IndexProgress) => void): Promise<MediaIndex>;
  /** URL usable in <img src>. May be short-lived for OneDrive. */
  getThumbnailUrl(item: MediaItem, size: ThumbnailSize): Promise<string>;
}
