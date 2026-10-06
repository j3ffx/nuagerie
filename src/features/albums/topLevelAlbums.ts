import type { Folder, MediaIndex, MediaItem } from '../../data/model.ts';

export interface AlbumPreview {
  folder: Folder;
  count: number;
  cover: MediaItem | null;
  first: number | null;
  last: number | null;
}

/**
 * Preview only: one tile per first-level folder of the perimeter, counting
 * everything below it, until the real album model lands.
 */
export function topLevelAlbums(index: MediaIndex): AlbumPreview[] {
  const roots = new Set(index.rootFolderIds);
  const topOf = new Map<string, string | null>();

  const topLevel = (folderId: string): string | null => {
    const known = topOf.get(folderId);
    if (known !== undefined) return known;
    let current = index.folders.get(folderId);
    while (current && current.parentId !== null && !roots.has(current.parentId)) {
      current = index.folders.get(current.parentId);
    }
    const result = current && current.parentId !== null ? current.id : null;
    topOf.set(folderId, result);
    return result;
  };

  const previews = new Map<string, AlbumPreview>();
  for (const item of index.items) {
    const id = topLevel(item.folderId);
    const folder = id ? index.folders.get(id) : undefined;
    if (!folder) continue;
    let preview = previews.get(folder.id);
    if (!preview) {
      preview = { folder, count: 0, cover: null, first: null, last: null };
      previews.set(folder.id, preview);
    }
    preview.count++;
    if (item.takenAt !== null) {
      // Items are sorted most recent first.
      if (preview.cover === null) {
        preview.cover = item;
        preview.last = item.takenAt;
      }
      preview.first = item.takenAt;
    }
  }

  return [...previews.values()].sort((a, b) => (b.last ?? -Infinity) - (a.last ?? -Infinity));
}
