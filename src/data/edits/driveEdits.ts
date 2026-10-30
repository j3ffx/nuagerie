import { GraphError, mapWithConcurrency, type DriveWriter } from '../graph/client.ts';
import type { GraphDriveItem } from '../graph/types.ts';
import type { MediaIndex } from '../model.ts';
import type { DriveEdits, EditFailure, EditResult, Progress, RestoreItem } from './types.ts';
export type { DriveEdits, EditFailure, EditResult, Progress, RestoreItem } from './types.ts';
import { locale } from '../../lib/i18n.ts';
import { albumNameProblem, isEditableAlbum, looksEmpty, mediaIdsIn, moveTargets } from './rules.ts';

export class EditRefused extends Error {
  constructor(readonly reason: EditFailure) {
    super(`Change refused: ${reason}`);
    this.name = 'EditRefused';
  }
}

export interface DriveEditsOptions {
  writer: DriveWriter;
  /** The index as it is now. */
  index: () => Promise<MediaIndex>;
  /** Writes these changes into the index kept on the device; the new index. */
  apply: (upserts: readonly GraphDriveItem[], deletedIds: readonly string[]) => Promise<MediaIndex>;
}

/** Changes in flight at once: quick for a selection, gentle with Graph's throttling. */
const CONCURRENCY = 4;

export function failureOf(error: unknown): EditFailure {
  if (error instanceof EditRefused) return error.reason;
  if (error instanceof Error && error.name === 'EditPermissionMissing') return 'permission';
  if (error instanceof GraphError) {
    if (error.status === 409 || error.code === 'nameAlreadyExists') return 'nameTaken';
    if (error.status === 404) return 'gone';
    // Expired or withdrawn. A 403 is about the item (the Personal Vault, a shared one): the rest
    // can go on.
    if (error.status === 401) return 'permission';
    if (error.status === 403 || error.status === 412) return 'refused';
  }
  return 'error';
}

export function createDriveEdits({ writer, index, apply }: DriveEditsOptions): DriveEdits {
  /**
   * Runs `change` on each id (once, even when given twice); applies what went
   * through in one go. With `dropGone`, an item OneDrive no longer has leaves
   * the index too (deleted elsewhere meanwhile).
   */
  async function each(
    given: readonly string[],
    allowed: ReadonlySet<string>,
    change: (id: string) => Promise<{ upsert?: GraphDriveItem; deleted?: string } | null>,
    onProgress?: Progress,
    dropGone = false,
  ): Promise<EditResult> {
    const ids = [...new Set(given)];
    const done: string[] = [];
    const failed: EditResult['failed'] = [];
    const upserts: GraphDriveItem[] = [];
    const deleted: string[] = [];
    let finished = 0;
    onProgress?.(0, ids.length);
    let permissionLost = false;
    await mapWithConcurrency(ids, CONCURRENCY, async (id) => {
      try {
        if (!allowed.has(id)) throw new EditRefused('refused');
        // No point going on once Microsoft said no: the rest would fail the same way.
        if (permissionLost) throw new EditRefused('permission');
        const outcome = await change(id);
        if (outcome?.upsert) upserts.push(outcome.upsert);
        if (outcome?.deleted) deleted.push(outcome.deleted);
        done.push(id);
      } catch (error) {
        const reason = failureOf(error);
        if (reason === 'permission') permissionLost = true;
        if (reason === 'gone' && dropGone) deleted.push(id);
        failed.push({ id, reason });
      } finally {
        onProgress?.(++finished, ids.length);
      }
    });
    const changed = upserts.length > 0 || deleted.length > 0;
    return { done, failed, index: changed ? await apply(upserts, deleted) : null };
  }

  function moveWithin(
    current: MediaIndex,
    ids: readonly string[],
    folderId: string,
    onProgress?: Progress,
  ): Promise<EditResult> {
    const inFolder = new Set(
      current.items.filter((item) => item.folderId === folderId).map((item) => item.id),
    );
    return each(
      ids,
      new Set(mediaIdsIn(current, ids)),
      async (id) =>
        // Already there: nothing to ask.
        inFolder.has(id) ? null : { upsert: await writer.updateItem(id, { parentId: folderId }) },
      onProgress,
    );
  }

  /**
   * Where to bring back the items whose folder is gone too (an album emptied
   * then deleted): OneDrive would put them back into it, where the index does
   * not look. The album of the same name where it was, made again if need be;
   * else that folder itself (the first root folder when it is gone too). Those
   * whose folder is there go back as they are (no parent given).
   */
  async function homesOf(
    current: MediaIndex,
    items: readonly RestoreItem[],
  ): Promise<{ parents: Map<string, string>; albums: string[]; index: MediaIndex | null }> {
    const parents = new Map<string, string>();
    const albums: string[] = [];
    let latest: MediaIndex | null = null;
    // One after the other: two photos of the same album make it once.
    for (const item of items) {
      if (!item.folderId || current.folders.has(item.folderId)) continue;
      const known = latest ?? current;
      const was = item.albumParentId ? known.folders.get(item.albumParentId) : undefined;
      const parent = was && !was.technical ? was.id : known.rootFolderIds[0];
      if (!parent || !known.folders.has(parent)) continue;
      const name = item.albumName?.trim() ?? '';
      const key = name.toLocaleLowerCase(locale);
      let home = [...known.folders.values()].find(
        (folder) =>
          folder.parentId === parent &&
          !folder.technical &&
          name !== '' &&
          folder.name.toLocaleLowerCase(locale) === key,
      )?.id;
      if (!home && !albumNameProblem(known, parent, name)) {
        try {
          const folder = await writer.createFolder(parent, name);
          latest = await apply([folder], []);
          home = folder.id;
          albums.push(folder.id);
        } catch {
          // Taken meanwhile, or refused: the folder it was in will do.
        }
      }
      parents.set(item.id, home ?? parent);
    }
    return { parents, albums, index: latest };
  }

  return {
    async deleteItems(ids, onProgress) {
      const allowed = new Set(mediaIdsIn(await index(), ids));
      return each(
        ids,
        allowed,
        async (id) => {
          await writer.deleteItem(id);
          return { deleted: id };
        },
        onProgress,
        true,
      );
    },

    async restoreItems(items, onProgress) {
      // Not in the index any more: the caller gives only what the app itself deleted.
      const current = await index();
      const homes = await homesOf(current, items);
      const result = await each(
        items.map((item) => item.id),
        new Set(items.map((item) => item.id)),
        async (id) => ({ upsert: await writer.restoreItem(id, homes.parents.get(id)) }),
        onProgress,
      );
      return { ...result, index: result.index ?? homes.index, albums: homes.albums };
    },

    async moveItems(ids, folderId, onProgress) {
      const current = await index();
      if (!moveTargets(current).some((target) => target.id === folderId)) {
        throw new EditRefused('refused');
      }
      return moveWithin(current, ids, folderId, onProgress);
    },

    async moveBack(ids, folderId, onProgress) {
      // Undo: back to the folder they came from, a year or a month folder included, never
      // outside the index.
      const current = await index();
      if (!current.folders.has(folderId)) throw new EditRefused('refused');
      return moveWithin(current, ids, folderId, onProgress);
    },

    async createAlbum(parentId, name) {
      const current = await index();
      const parent = current.folders.get(parentId);
      if (!parent || parent.technical) throw new EditRefused('refused');
      const problem = albumNameProblem(current, parentId, name);
      if (problem) throw new EditRefused(problem === 'taken' ? 'nameTaken' : 'refused');
      const folder = await writer.createFolder(parentId, name.trim());
      return { id: folder.id, index: await apply([folder], []) };
    },

    async renameAlbum(id, name) {
      const current = await index();
      const parentId = current.folders.get(id)?.parentId;
      if (!isEditableAlbum(current, id) || !parentId) throw new EditRefused('refused');
      const problem = albumNameProblem(current, parentId, name, id);
      if (problem) throw new EditRefused(problem === 'taken' ? 'nameTaken' : 'refused');
      return apply([await writer.updateItem(id, { name: name.trim() })], []);
    },

    async deleteAlbum(id) {
      const current = await index();
      if (!isEditableAlbum(current, id) || !looksEmpty(current, id)) {
        throw new EditRefused('refused');
      }
      // Other files (a PDF, a text file) are not in the index: OneDrive tells. Its eTag changes
      // with what it holds: a file added meanwhile (another device) makes the delete fail.
      const folder = await writer.getItem(id);
      if ((folder.folder?.childCount ?? 1) !== 0) throw new EditRefused('refused');
      await writer.deleteItem(id, folder.eTag ? { ifMatch: folder.eTag } : {});
      return apply([], [id]);
    },
  };
}
