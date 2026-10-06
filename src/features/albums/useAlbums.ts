import { useCallback, useMemo } from 'react';
import {
  buildAlbums,
  DEFAULT_ALBUM_SORT,
  DEFAULT_SELECTION,
  defaultChecked,
  type AlbumModel,
  type AlbumSelection,
  type AlbumSort,
  type PhotoOrder,
} from '../../data/albums.ts';
import { useData, useMediaIndex } from '../../data/dataContext.ts';
import { usePersistentState } from '../../lib/persistent.ts';

/** Album choices are per data source: demo and OneDrive folders have different ids. */
export function useAlbumSelection() {
  const { mode } = useData();
  const index = useMediaIndex();
  const [selection, setSelection] = usePersistentState<AlbumSelection>(
    `albums.selection.${mode}`,
    DEFAULT_SELECTION,
  );

  const checked = useMemo(
    () => new Set(selection.checked ?? (index ? defaultChecked(index) : [])),
    [selection.checked, index],
  );
  const hidden = useMemo(() => new Set(selection.hidden), [selection.hidden]);

  const setChecked = useCallback(
    (folderId: string, value: boolean) => {
      const next = new Set(checked);
      if (value) next.add(folderId);
      else next.delete(folderId);
      setSelection({ ...selection, checked: [...next] });
    },
    [checked, selection, setSelection],
  );

  const setHidden = useCallback(
    (folderId: string, value: boolean) => {
      const next = new Set(hidden);
      if (value) next.add(folderId);
      else next.delete(folderId);
      setSelection({ ...selection, hidden: [...next] });
    },
    [hidden, selection, setSelection],
  );

  const reset = useCallback(() => setSelection(DEFAULT_SELECTION), [setSelection]);

  return { selection, checked, hidden, setChecked, setHidden, reset };
}

export function useAlbumModel(): AlbumModel | null {
  const index = useMediaIndex();
  const { selection } = useAlbumSelection();
  return useMemo(() => (index ? buildAlbums(index, selection) : null), [index, selection]);
}

export function useAlbumSort() {
  return usePersistentState<AlbumSort>('albums.sort', DEFAULT_ALBUM_SORT);
}

/** Sort of the sub-album tiles on album pages (remembered apart from the home screen's). */
export function useSubAlbumSort() {
  return usePersistentState<AlbumSort>('albums.subSort', DEFAULT_ALBUM_SORT);
}

const DEFAULT_ORDER: PhotoOrder = 'desc';

export function usePhotoOrder() {
  return usePersistentState<PhotoOrder>('albums.photoOrder', DEFAULT_ORDER);
}
