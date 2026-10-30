import { GraphError, mapWithConcurrency, type DriveWriter } from '../graph/client.ts';
import type { GraphDriveItem } from '../graph/types.ts';
import type { MediaIndex } from '../model.ts';
import type { DriveEdits, EditFailure, EditResult, Progress } from './types.ts';
export type { DriveEdits, EditFailure, EditResult, Progress } from './types.ts';
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
    if (error.status === 401 || error.status === 403) return 'permission';
  }
  return 'error';
}

export function createDriveEdits({ writer, index, apply }: DriveEditsOptions): DriveEdits {
  /** Runs `change` on each id; applies what went through in one go. */
  async function each(
    ids: readonly string[],
    allowed: ReadonlySet<string>,
    change: (id: string) => Promise<{ upsert?: GraphDriveItem; deleted?: string } | null>,
    onProgress?: Progress,
  ): Promise<EditResult> {
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
        failed.push({ id, reason });
      } finally {
        onProgress?.(++finished, ids.length);
      }
    });
    const changed = upserts.length > 0 || deleted.length > 0;
    return { done, failed, index: changed ? await apply(upserts, deleted) : null };
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
      );
    },

    async restoreItems(ids, onProgress) {
      // Not in the index any more: the caller gives only what the app itself deleted.
      return each(
        ids,
        new Set(ids),
        async (id) => ({ upsert: await writer.restoreItem(id) }),
        onProgress,
      );
    },

    async moveItems(ids, folderId, onProgress) {
      const current = await index();
      if (!moveTargets(current).some((target) => target.id === folderId)) {
        throw new EditRefused('refused');
      }
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
      // Other files (a PDF, a text file) are not in the index: OneDrive tells.
      const folder = await writer.getItem(id);
      if ((folder.folder?.childCount ?? 1) !== 0) throw new EditRefused('refused');
      await writer.deleteItem(id);
      return apply([], [id]);
    },
  };
}
