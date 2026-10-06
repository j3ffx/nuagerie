export type MediaKind = 'image' | 'video';
export type DateSource = 'exif' | 'filename';
export type ThumbnailSize = 'small' | 'medium' | 'large';

export interface CaptureDate {
  /**
   * Capture time as wall-clock time encoded in UTC milliseconds: a photo taken
   * at 08:47 local time is stored as Date.UTC(…, 8, 47). It is never shifted
   * to another time zone and is always formatted with timeZone 'UTC'.
   */
  takenAt: number;
  source: DateSource;
}

/** A photo or video of the index. Fields are never optional (stable shape, cheap to scan). */
export interface MediaItem {
  id: string;
  name: string;
  /** Folder that physically contains the file (may be technical: 2026, 10, Sans date). */
  folderId: string;
  /** Nearest non-technical ancestor folder: the album the file belongs to. */
  albumId: string;
  kind: MediaKind;
  mimeType: string;
  size: number;
  eTag: string;
  /** null = no reliable date, shown in the "Sans date" section. */
  takenAt: number | null;
  dateSource: DateSource | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  latitude: number | null;
  longitude: number | null;
}

export interface Folder {
  id: string;
  name: string;
  /** null for a root of the scanned perimeter (e.g. /Pictures). */
  parentId: string | null;
  /** Year, month-under-year or "Sans date" folder: never an album. */
  technical: boolean;
}

export interface MediaIndex {
  folders: Map<string, Folder>;
  /** Sorted by capture date, most recent first, undated items last. */
  items: MediaItem[];
  rootFolderIds: string[];
}

export interface IndexProgress {
  loaded: number;
  /** Estimated total, when known. */
  total: number | null;
}
