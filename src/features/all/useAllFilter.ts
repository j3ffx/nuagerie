import { useCallback, useMemo } from 'react';
import type { PhotoOrder } from '../../data/albums.ts';
import { useData } from '../../data/dataContext.ts';
import { usePersistentState } from '../../lib/persistent.ts';

const NONE: string[] = [];

/** Folders hidden from "Tout" (with everything below them), per data source. */
export function useAllFilter() {
  const { mode } = useData();
  const [list, setList] = usePersistentState<string[]>(`all.excluded.${mode}`, NONE);
  const excluded = useMemo(() => new Set(list), [list]);

  const setShown = useCallback(
    (folderId: string, shown: boolean) => {
      const next = new Set(excluded);
      if (shown) next.delete(folderId);
      else next.add(folderId);
      setList([...next]);
    },
    [excluded, setList],
  );

  const showAll = useCallback(() => setList(NONE), [setList]);

  return { excluded, setShown, showAll };
}

export function useAllOrder() {
  return usePersistentState<PhotoOrder>('all.photoOrder', 'desc');
}
