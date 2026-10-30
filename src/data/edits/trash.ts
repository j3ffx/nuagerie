import type { MediaItem } from '../model.ts';
import type { DataMode } from '../source.ts';

/**
 * Graph cannot list OneDrive's recycle bin, so the app keeps its own list of
 * what it put there, per device, to show it and bring items back. OneDrive
 * empties its bin after 30 days (sooner when it is full): older entries go.
 */
export interface TrashEntry {
  id: string;
  name: string;
  kind: MediaItem['kind'];
  takenAt: number | null;
  /** The album it was in, by name, and the folder to bring it back to. */
  albumName: string;
  folderId: string;
  /** Where that album was: there it is made again, if it is deleted too. */
  albumParentId?: string | null;
  deletedAt: number;
}

export const trashKey = (mode: DataMode) => `edits.trash.${mode}`;
/** Where the thumbnails of these entries are kept, by id: the grid's may let them go. */
export const trashCacheName = (mode: DataMode) => `nuagerie-trash-${mode}`;

export const TRASH_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The entries kept; with `now`, only those OneDrive still keeps. */
export function parseTrash(raw: unknown, now: number | null): TrashEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (entry): entry is TrashEntry =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as TrashEntry).id === 'string' &&
        typeof (entry as TrashEntry).name === 'string' &&
        typeof (entry as TrashEntry).deletedAt === 'number',
    )
    .filter((entry) => now === null || now - entry.deletedAt < TRASH_DAYS * DAY_MS)
    .sort((a, b) => b.deletedAt - a.deletedAt);
}

/** The list with these items deleted now, most recent first (an id deleted again moves up). */
export function withDeleted(
  trash: readonly TrashEntry[],
  items: readonly MediaItem[],
  album: (item: MediaItem) => { name: string; parentId: string | null },
  now: number,
): TrashEntry[] {
  const ids = new Set(items.map((item) => item.id));
  const added = items.map((item): TrashEntry => {
    const { name, parentId } = album(item);
    return {
      id: item.id,
      name: item.name,
      kind: item.kind,
      takenAt: item.takenAt,
      albumName: name,
      folderId: item.folderId,
      albumParentId: parentId,
      deletedAt: now,
    };
  });
  return [...added, ...trash.filter((entry) => !ids.has(entry.id))];
}

export function without(trash: readonly TrashEntry[], ids: readonly string[]): TrashEntry[] {
  const gone = new Set(ids);
  return trash.filter((entry) => !gone.has(entry.id));
}

/** The last day OneDrive keeps it, at the latest. */
export function keptUntil(entry: TrashEntry): number {
  return entry.deletedAt + TRASH_DAYS * DAY_MS;
}
