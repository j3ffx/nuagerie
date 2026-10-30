import { folderTrail } from '../albums.ts';
import type { MediaIndex } from '../model.ts';
import { isTechnicalFolderName } from '../technical.ts';
import { locale } from '../../lib/i18n.ts';

/**
 * What the changes may touch (CLAUDE.md → Invariants): the photos and videos
 * of the index, and the albums below the root folders. Never a root folder
 * itself (the perimeter is chosen by its path), never anything outside.
 */

/** The ids among `ids` that are photos or videos of the index. */
export function mediaIdsIn(index: MediaIndex, ids: readonly string[]): string[] {
  const media = new Set(index.items.map((item) => item.id));
  return ids.filter((id) => media.has(id));
}

/** A folder below a root folder, not a technical one: it can be renamed, or deleted when empty. */
export function isEditableAlbum(index: MediaIndex, folderId: string): boolean {
  const folder = index.folders.get(folderId);
  return !!folder && folder.parentId !== null && !folder.technical;
}

/** Nothing of the index is in it: no photo, no video, no subfolder (Graph checks the rest). */
export function looksEmpty(index: MediaIndex, folderId: string): boolean {
  for (const folder of index.folders.values()) if (folder.parentId === folderId) return false;
  return !index.items.some((item) => item.folderId === folderId);
}

/** Where photos can be moved: every album, root folders included, by their path of names. */
export interface MoveTarget {
  id: string;
  /** "Albums › Animaux": the folders from the root down. */
  path: string[];
}

export function moveTargets(index: MediaIndex): MoveTarget[] {
  return [...index.folders.values()]
    .filter((folder) => !folder.technical)
    .map((folder) => ({
      id: folder.id,
      path: folderTrail(index.folders, folder.id),
    }))
    .sort((a, b) =>
      a.path.join('\u0000').localeCompare(b.path.join('\u0000'), locale, {
        sensitivity: 'base',
        numeric: true,
      }),
    );
}

export type NameProblem = 'empty' | 'tooLong' | 'characters' | 'technical' | 'taken';

// eslint-disable-next-line no-control-regex -- control characters are what it looks for
const FORBIDDEN = /["*:<>?/\\|\u0000-\u001f]/;
/** Names OneDrive refuses whatever the characters. */
const RESERVED = /^(con|prn|aux|nul|com\d|lpt\d|desktop\.ini|\.lock)$|^~\$|_vti_/i;
const MAX_NAME = 120;

/**
 * Why a name cannot be an album's, or null when it can: OneDrive's forbidden
 * characters, a name that would make it a technical folder (a year, "Sans
 * date"…: its photos would go to the parent album), or one a sibling has.
 */
export function albumNameProblem(
  index: MediaIndex,
  parentId: string,
  name: string,
  ignoreId: string | null = null,
): NameProblem | null {
  const trimmed = name.trim();
  if (!trimmed) return 'empty';
  if (trimmed.length > MAX_NAME) return 'tooLong';
  if (FORBIDDEN.test(trimmed) || RESERVED.test(trimmed) || trimmed.endsWith('.')) {
    return 'characters';
  }
  if (isTechnicalFolderName(trimmed, index.folders.get(parentId)?.name ?? null)) return 'technical';
  const lower = trimmed.toLocaleLowerCase(locale);
  for (const folder of index.folders.values()) {
    if (folder.id === ignoreId || folder.parentId !== parentId) continue;
    if (folder.name.toLocaleLowerCase(locale) === lower) return 'taken';
  }
  return null;
}
