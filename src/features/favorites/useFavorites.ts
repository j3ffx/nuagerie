import { useMemo } from 'react';
import type { Album } from '../../data/albums.ts';
import { useMediaIndex } from '../../data/dataContext.ts';
import type { MediaItem } from '../../data/model.ts';
import { useSync } from '../../data/sync/syncContext.ts';

/** The favourite photos and videos still in the index, most recent first, undated last. */
export function useFavoriteItems(): readonly MediaItem[] {
  const index = useMediaIndex();
  const { favorites } = useSync();
  return useMemo(
    () => (index && favorites.size > 0 ? index.items.filter((item) => favorites.has(item.id)) : []),
    [index, favorites],
  );
}

/** The favourites as an album tile of the home screen, or null while there are none. */
export function useFavoritesAlbum(): Album | null {
  const items = useFavoriteItems();
  return useMemo(() => {
    if (items.length === 0) return null;
    const dated = items.filter((item) => item.takenAt !== null);
    return {
      id: 'favoris',
      name: 'Favoris',
      parentId: null,
      subAlbumIds: [],
      subAlbumCount: 0,
      items: [...items],
      cover: dated.find((item) => item.kind === 'image') ?? dated[0] ?? items[0] ?? null,
      last: dated[0]?.takenAt ?? null,
      first: dated.at(-1)?.takenAt ?? null,
    };
  }, [items]);
}
