import type { MediaIndex } from '../model.ts';

/** Types of src/data/edits/, apart: the service worker's build reads them through DataSource. */

/** Why one change did not go through. */
export type EditFailure =
  /** An item of that name is already there. */
  | 'nameTaken'
  /** Gone meanwhile (deleted elsewhere, emptied from the recycle bin). */
  | 'gone'
  /** Outside what the changes may touch, or a folder that is not empty. */
  | 'refused'
  /** Microsoft no longer grants the permission: the user must give it again. */
  | 'permission'
  | 'error';

export interface EditResult {
  done: string[];
  failed: { id: string; reason: EditFailure }[];
  /** The index with the changes made, or null when none was. */
  index: MediaIndex | null;
}

/**
 * The changes the user can make to their drive (Réglages → Modifications),
 * each checked against the index first. The index kept on the device takes
 * them at once; the next delta brings the same, so nothing is done twice.
 */
export interface DriveEdits {
  /** To OneDrive's recycle bin. */
  deleteItems(ids: readonly string[], onProgress?: Progress): Promise<EditResult>;
  /** Back from the recycle bin, to where they were (ids the app put there). */
  restoreItems(ids: readonly string[], onProgress?: Progress): Promise<EditResult>;
  moveItems(ids: readonly string[], folderId: string, onProgress?: Progress): Promise<EditResult>;
  /** Undoes a move: back to any folder of the index, a year or a month folder included. */
  moveBack(ids: readonly string[], folderId: string, onProgress?: Progress): Promise<EditResult>;
  createAlbum(parentId: string, name: string): Promise<{ id: string; index: MediaIndex }>;
  renameAlbum(id: string, name: string): Promise<MediaIndex>;
  /** Only an empty album: what OneDrive says, not only what the index knows. */
  deleteAlbum(id: string): Promise<MediaIndex>;
}

export type Progress = (done: number, total: number) => void;
