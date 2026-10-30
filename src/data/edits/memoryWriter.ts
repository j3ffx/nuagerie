import { GraphError, type DriveWriter } from '../graph/client.ts';
import type { GraphDriveItem } from '../graph/types.ts';

/**
 * A drive in memory that takes the changes as OneDrive would: the demo's
 * (they last until the page reloads) and the tests'. Deleted items wait in a
 * recycle bin of its own.
 */
export function createMemoryWriter(items: GraphDriveItem[]): DriveWriter {
  const bin = new Map<string, GraphDriveItem>();
  let next = 0;
  const find = (id: string) => {
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) throw new GraphError(404, 'itemNotFound', 'Item not found');
    return index;
  };
  const nameTaken = (parentId: string, name: string, except: string | null = null) =>
    items.some(
      (item) =>
        item.id !== except &&
        item.parentReference?.id === parentId &&
        item.name?.toLowerCase() === name.toLowerCase(),
    );
  const conflict = () => new GraphError(409, 'nameAlreadyExists', 'Name already exists');

  return {
    async deleteItem(id, { ifMatch } = {}) {
      const index = find(id);
      if (ifMatch && items[index]?.eTag !== ifMatch) {
        throw new GraphError(412, 'preconditionFailed', 'Changed meanwhile');
      }
      const [item] = items.splice(index, 1);
      if (item) bin.set(id, item);
      // A folder takes what is inside along, as OneDrive does.
      for (let i = items.length - 1; i >= 0; i--) {
        const child = items[i];
        if (child?.parentReference?.id === id) await this.deleteItem(child.id);
      }
    },

    async updateItem(id, { name, parentId }) {
      const index = find(id);
      const item = items[index] as GraphDriveItem;
      const parent = parentId ?? item.parentReference?.id ?? '';
      if (nameTaken(parent, name ?? item.name ?? '', id)) throw conflict();
      const updated: GraphDriveItem = {
        ...item,
        ...(name === undefined ? {} : { name }),
        parentReference: { ...item.parentReference, id: parent },
        eTag: `${item.eTag ?? ''}+`,
      };
      items[index] = updated;
      return updated;
    },

    async createFolder(parentId, name) {
      find(parentId);
      if (nameTaken(parentId, name)) throw conflict();
      const folder: GraphDriveItem = {
        id: `memory-folder-${next++}`,
        name,
        folder: { childCount: 0 },
        parentReference: { id: parentId },
        eTag: 'new',
      };
      items.push(folder);
      return folder;
    },

    async restoreItem(id, parentId) {
      const deleted = bin.get(id);
      if (!deleted) throw new GraphError(404, 'itemNotFound', 'Not in the recycle bin');
      if (parentId !== undefined) find(parentId);
      bin.delete(id);
      // Without a parent, back where it was, even into a folder deleted meanwhile.
      const item =
        parentId === undefined
          ? deleted
          : { ...deleted, parentReference: { ...deleted.parentReference, id: parentId } };
      items.push(item);
      return item;
    },

    async getItem(id) {
      const item = items[find(id)] as GraphDriveItem;
      const childCount = items.filter((child) => child.parentReference?.id === id).length;
      return item.folder ? { ...item, folder: { ...item.folder, childCount } } : item;
    },
  };
}
