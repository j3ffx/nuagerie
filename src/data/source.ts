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
  /**
   * Forgets the local copy, so the next load enumerates everything again,
   * or starts from the copy another device shared when `useSharedCopy`.
   */
  reset?(options?: { useSharedCopy?: boolean }): Promise<void>;
  /** Subfolders of a drive folder ("/" for the drive root), by name, to choose root folders. */
  listFolders?(path: string): Promise<DriveFolder[]>;
  /** Anonymous summary of the index and checks of the Graph assumptions. */
  diagnose?(): Promise<DiagnosticReport>;
  /**
   * A thumbnail image, downloaded on a cache miss (see src/data/thumbnails/).
   * Rejects when the item has none, or with the signal's reason once aborted.
   */
  fetchThumbnail(
    item: MediaItem,
    size: ThumbnailSize,
    signal?: AbortSignal,
  ): Promise<ThumbnailData>;
  /**
   * Short-lived URL of the original file, to play a video or open the file;
   * null when there is none to give (demo videos).
   */
  getOriginalUrl(item: MediaItem): Promise<string | null>;
  /** The file's page on OneDrive's website (none in the demo). */
  getWebUrl?(item: MediaItem): Promise<string | null>;
}

/** Image bytes to keep in the cache, or (when they cannot be read) a URL to show as is. */
export type ThumbnailData = { blob: Blob } | { url: string };

/** A folder of the drive, as shown when choosing root folders. */
export interface DriveFolder {
  name: string;
  /** From the drive root, e.g. "/Documents/Scans". */
  path: string;
  /** Files and folders right inside it (not counting what its subfolders hold). */
  childCount: number;
  /** Total size in bytes, subfolders included, when known. */
  size: number | null;
}
