import { useCallback } from 'react';
import { useMediaIndex } from '../../data/dataContext.ts';
import { useAlbumSelection } from '../albums/useAlbums.ts';
import { useEdits } from './editsContext.ts';

/**
 * Creates an album; one made right in a root folder is shown on the home
 * screen even when the user chose the albums there (it would be missing).
 */
export function useCreateAlbum(): (parentId: string, name: string) => Promise<string | null> {
  const { createAlbum } = useEdits();
  const index = useMediaIndex();
  const { setChecked } = useAlbumSelection();
  return useCallback(
    async (parentId, name) => {
      const id = await createAlbum(parentId, name);
      if (id && index?.rootFolderIds.includes(parentId)) setChecked(id, true);
      return id;
    },
    [createAlbum, index, setChecked],
  );
}
