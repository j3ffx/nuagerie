import type { DiagnosticReport } from './diagnostics.ts';
import type { IndexProgress, MediaIndex, MediaItem, ThumbnailSize } from './model.ts';

export type DataMode = 'demo' | 'onedrive';

/**
 * Where the index and the thumbnails come from. The UI only talks to this
 * interface, so demo data and OneDrive data are interchangeable.
 */
export interface DataSource {
  readonly mode: DataMode;
  /**
   * The index to show first: the local copy when there is one (instant),
   * otherwise the result of a full enumeration (with progress).
   */
  loadIndex(onProgress?: (progress: IndexProgress) => void): Promise<MediaIndex>;
  /** Fetches the changes since the last sync; a new index when something changed, else null. */
  refresh?(onProgress?: (progress: IndexProgress) => void): Promise<MediaIndex | null>;
  /** Forgets the local copy, so the next load enumerates everything again. */
  reset?(): Promise<void>;
  /** Anonymous summary of the index and checks of the Graph assumptions. */
  diagnose?(): Promise<DiagnosticReport>;
  /** URL usable in <img src>. May be short-lived for OneDrive. */
  getThumbnailUrl(item: MediaItem, size: ThumbnailSize): Promise<string>;
}
