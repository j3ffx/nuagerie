import type { Folder, MediaIndex, MediaItem } from './model.ts';

/**
 * Album model (CLAUDE.md → Invariants → Albums).
 *  - A non-technical folder is a potential album.
 *  - A checked folder whose ancestors are all unchecked is an album on the home screen.
 *  - The non-technical subfolders of an album are its sub-albums: tiles at the top of
 *    its page, each of which can be hidden. They never appear on the home screen.
 *  - An album shows its own files only (including its technical subfolders such as
 *    2026/10 and "Sans date"), never the files of its sub-albums.
 */

export interface AlbumSelection {
  /** Checked folder ids; null until the user chooses (first-level folders by default). */
  checked: string[] | null;
  /** Sub-albums hidden from their parent's page. */
  hidden: string[];
}

export const DEFAULT_SELECTION: AlbumSelection = { checked: null, hidden: [] };

export interface Album {
  id: string;
  name: string;
  /** Parent album, or null for a home album. */
  parentId: string | null;
  /** Visible sub-albums, by name. */
  subAlbumIds: string[];
  /** Number of sub-albums, hidden ones included. */
  subAlbumCount: number;
  /** The album's own files, most recent first, undated last. */
  items: MediaItem[];
  /**
   * Most recent dated photo (videos only when there is no photo, any file when
   * nothing is dated), of the album itself or else of its sub-albums.
   */
  cover: MediaItem | null;
  /** Date range of the album's own files, or of its sub-albums when it has none. */
  first: number | null;
  last: number | null;
}

export interface AlbumModel {
  /** Albums shown on the home screen (unsorted). */
  home: Album[];
  /** Every album reachable from the home screen, by folder id. */
  byId: Map<string, Album>;
}

/** Non-technical folders as a tree under the perimeter roots, children sorted by name. */
export interface FolderNode {
  folder: Folder;
  children: FolderNode[];
}

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, 'fr', { sensitivity: 'base', numeric: true });

/** Non-technical child folders of each folder. */
function childrenMap(index: MediaIndex): Map<string, Folder[]> {
  const children = new Map<string, Folder[]>();
  for (const folder of index.folders.values()) {
    if (folder.technical || folder.parentId === null) continue;
    const list = children.get(folder.parentId);
    if (list) list.push(folder);
    else children.set(folder.parentId, [folder]);
  }
  for (const list of children.values()) list.sort(byName);
  return children;
}

export function folderTree(index: MediaIndex): FolderNode[] {
  const children = childrenMap(index);
  const build = (folder: Folder): FolderNode => ({
    folder,
    children: (children.get(folder.id) ?? []).map(build),
  });
  return index.rootFolderIds.flatMap((rootId) => (children.get(rootId) ?? []).map(build));
}

/** First-level folders of the perimeter: the default selection. */
export function defaultChecked(index: MediaIndex): string[] {
  return folderTree(index).map((node) => node.folder.id);
}

export function buildAlbums(index: MediaIndex, selection: AlbumSelection): AlbumModel {
  const children = childrenMap(index);
  const checked = new Set(selection.checked ?? defaultChecked(index));
  const hidden = new Set(selection.hidden);

  // Own files of every folder that is an album (items are already sorted).
  const itemsByAlbum = new Map<string, MediaItem[]>();
  for (const item of index.items) {
    const list = itemsByAlbum.get(item.albumId);
    if (list) list.push(item);
    else itemsByAlbum.set(item.albumId, [item]);
  }

  const byId = new Map<string, Album>();

  const build = (folder: Folder, parentId: string | null): Album => {
    const subFolders = children.get(folder.id) ?? [];
    const subAlbums = subFolders.map((sub) => build(sub, folder.id));
    const items = itemsByAlbum.get(folder.id) ?? [];
    const firstDated = items.find((item) => item.takenAt !== null) ?? null;
    let lastDated: MediaItem | null = null;
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      if (item && item.takenAt !== null) {
        lastDated = item;
        break;
      }
    }

    // Cover: the most recent dated photo; else the most recent dated video; else any file.
    let cover =
      items.find((item) => item.takenAt !== null && item.kind === 'image') ??
      firstDated ??
      items[0] ??
      null;
    let last = firstDated?.takenAt ?? null;
    let first = lastDated?.takenAt ?? null;
    if (items.length === 0) {
      // A container album (only sub-albums): borrow cover and range from them.
      for (const sub of subAlbums) {
        if (
          sub.cover &&
          sub.cover.takenAt !== null &&
          (cover?.takenAt ?? -Infinity) < sub.cover.takenAt
        ) {
          cover = sub.cover;
        }
        if (sub.last !== null && (last === null || sub.last > last)) last = sub.last;
        if (sub.first !== null && (first === null || sub.first < first)) first = sub.first;
      }
    }

    const album: Album = {
      id: folder.id,
      name: folder.name,
      parentId,
      subAlbumIds: subAlbums.filter((sub) => !hidden.has(sub.id)).map((sub) => sub.id),
      subAlbumCount: subAlbums.length,
      items,
      cover,
      first,
      last,
    };
    byId.set(folder.id, album);
    return album;
  };

  // Home albums: checked folders with no checked ancestor (sub-albums of a checked
  // folder are reached through it).
  const home: Album[] = [];
  const visit = (node: FolderNode, underChecked: boolean) => {
    if (!underChecked && checked.has(node.folder.id)) {
      home.push(build(node.folder, null));
      return;
    }
    for (const child of node.children) visit(child, underChecked);
  };
  for (const node of folderTree(index)) visit(node, false);

  return { home, byId };
}

export type AlbumSortKey = 'last' | 'first' | 'name';
export interface AlbumSort {
  key: AlbumSortKey;
  direction: 'desc' | 'asc';
}
export const DEFAULT_ALBUM_SORT: AlbumSort = { key: 'last', direction: 'desc' };

/** Sorts albums for the home screen; albums without any date always come last. */
export function sortAlbums(albums: readonly Album[], sort: AlbumSort): Album[] {
  const sign = sort.direction === 'asc' ? 1 : -1;
  return [...albums].sort((a, b) => {
    if (sort.key === 'name') return sign * byName(a, b);
    const va = sort.key === 'last' ? a.last : a.first;
    const vb = sort.key === 'last' ? b.last : b.first;
    if (va === null || vb === null) {
      if (va === vb) return byName(a, b);
      return va === null ? 1 : -1;
    }
    return va === vb ? byName(a, b) : sign * (va - vb);
  });
}

export type PhotoOrder = 'desc' | 'asc';

/** Items in the chosen date order; undated items always stay last. */
export function orderItems(items: readonly MediaItem[], order: PhotoOrder): MediaItem[] {
  if (order === 'desc') return [...items];
  const firstUndated = items.findIndex((item) => item.takenAt === null);
  const dated = firstUndated === -1 ? items : items.slice(0, firstUndated);
  const undated = firstUndated === -1 ? [] : items.slice(firstUndated);
  return [...dated].reverse().concat(undated);
}
