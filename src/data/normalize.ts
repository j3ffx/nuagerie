import type { GraphDriveItem } from './graph/types.ts';
import type { CaptureDate, Folder, MediaIndex, MediaItem, MediaKind } from './model.ts';
import { isTechnicalFolderName } from './technical.ts';

/** Decides the capture date of a file, or null for "Sans date". */
export type DateResolver = (item: GraphDriveItem) => CaptureDate | null;

/** Most recent first, undated last, then by name for a stable order. */
export function compareByDateDesc(a: MediaItem, b: MediaItem): number {
  if (a.takenAt !== b.takenAt) {
    if (a.takenAt === null) return 1;
    if (b.takenAt === null) return -1;
    return b.takenAt - a.takenAt;
  }
  return a.name < b.name ? 1 : a.name > b.name ? -1 : 0;
}

function mediaKind(mimeType: string): MediaKind | null {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  return null;
}

/**
 * Builds the in-memory index from raw drive items (folders and files, in any
 * order): keeps the folders under the given roots, keeps image/video files
 * only, resolves each file's album and capture date, sorts by date.
 */
export function buildIndex(
  driveItems: Iterable<GraphDriveItem>,
  rootFolderIds: readonly string[],
  resolveDate: DateResolver,
): MediaIndex {
  const roots = new Set(rootFolderIds);
  const rawFolders = new Map<string, { name: string; parentId: string | null }>();
  const files: GraphDriveItem[] = [];

  for (const item of driveItems) {
    if (item.deleted) continue;
    if (item.folder) {
      rawFolders.set(item.id, {
        name: item.name ?? '',
        parentId: roots.has(item.id) ? null : (item.parentReference?.id ?? null),
      });
    } else if (item.file) {
      files.push(item);
    }
  }

  // A folder is in scope when its parent chain reaches one of the roots.
  const scope = new Map<string, boolean>();
  const inScope = (folderId: string): boolean => {
    const chain: string[] = [];
    let current: string | null = folderId;
    let result = false;
    while (current !== null) {
      const known = scope.get(current);
      if (known !== undefined) {
        result = known;
        break;
      }
      if (roots.has(current)) {
        result = true;
        chain.push(current);
        break;
      }
      const raw = rawFolders.get(current);
      chain.push(current);
      if (!raw || chain.length > 256) break;
      current = raw.parentId;
    }
    for (const id of chain) scope.set(id, result);
    return result;
  };

  const folders = new Map<string, Folder>();
  for (const [id, raw] of rawFolders) {
    if (!inScope(id)) continue;
    const parentName = raw.parentId ? (rawFolders.get(raw.parentId)?.name ?? null) : null;
    folders.set(id, {
      id,
      name: raw.name,
      parentId: raw.parentId,
      technical: !roots.has(id) && isTechnicalFolderName(raw.name, parentName),
    });
  }

  const albumOf = new Map<string, string>();
  const resolveAlbum = (folderId: string): string => {
    const known = albumOf.get(folderId);
    if (known !== undefined) return known;
    let current = folders.get(folderId);
    while (current?.technical && current.parentId !== null) {
      current = folders.get(current.parentId);
    }
    const albumId = current?.id ?? folderId;
    albumOf.set(folderId, albumId);
    return albumId;
  };

  const items: MediaItem[] = [];
  for (const file of files) {
    const folderId = file.parentReference?.id;
    if (!folderId || !folders.has(folderId)) continue;
    const mimeType = file.file?.mimeType ?? '';
    const kind = mediaKind(mimeType);
    if (!kind) continue;

    const date = resolveDate(file);
    items.push({
      id: file.id,
      name: file.name ?? '',
      folderId,
      albumId: resolveAlbum(folderId),
      kind,
      mimeType,
      size: file.size ?? 0,
      eTag: file.eTag ?? '',
      takenAt: date?.takenAt ?? null,
      dateSource: date?.source ?? null,
      width: file.image?.width ?? file.video?.width ?? null,
      height: file.image?.height ?? file.video?.height ?? null,
      durationMs: file.video?.duration ?? null,
      camera: cameraName(file.photo?.cameraMake, file.photo?.cameraModel),
      latitude: file.location?.latitude ?? null,
      longitude: file.location?.longitude ?? null,
    });
  }

  items.sort(compareByDateDesc);
  return { folders, items, rootFolderIds: [...rootFolderIds] };
}

/**
 * "samsung" + "Galaxy S23" → "samsung Galaxy S23"; the make is dropped when
 * the model already starts with it ("Canon" + "Canon EOS R6" → "Canon EOS R6").
 */
export function cameraName(make: string | undefined, model: string | undefined): string | null {
  const brand = make?.trim() ?? '';
  const name = model?.trim() ?? '';
  if (!name) return brand || null;
  if (!brand || name.toLowerCase().startsWith(brand.toLowerCase())) return name;
  return `${brand} ${name}`;
}
