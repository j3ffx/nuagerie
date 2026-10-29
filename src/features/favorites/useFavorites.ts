import { useMemo } from 'react';
import type { Album } from '../../data/albums.ts';
import { useMediaIndex } from '../../data/dataContext.ts';
import type { MediaItem } from '../../data/model.ts';
import { useSync } from '../../data/sync/syncContext.ts';
import { localized } from '../../lib/i18n.ts';

const t = localized({
  fr: { favorites: 'Favoris' },
  en: { favorites: 'Favourites' },
});

/** Id of the Favoris album (its tile, its map), never a OneDrive folder's. */
export const FAVORITES_ALBUM_ID = 'favoris';

/** The favourite photos and videos still in the index, most recent first, undated last. */
export function useFavoriteItems(): readonly MediaItem[] {
  const { favorites } = useSync();
  return useItemsOf(favorites);
}

/**
 * The favourites this device knows, even while they are hidden (a session to restore, the
 * sync off): those kept offline stay kept through such a passing state.
 */
export function useStoredFavoriteItems(): readonly MediaItem[] {
  const { storedFavorites } = useSync();
  return useItemsOf(storedFavorites);
}

function useItemsOf(ids: ReadonlySet<string>): readonly MediaItem[] {
  const index = useMediaIndex();
  return useMemo(
    () => (index && ids.size > 0 ? index.items.filter((item) => ids.has(item.id)) : []),
    [index, ids],
  );
}

/** The favourites as an album tile of the home screen, or null while there are none. */
export function useFavoritesAlbum(): Album | null {
  const items = useFavoriteItems();
  return useMemo(() => {
    if (items.length === 0) return null;
    const dated = items.filter((item) => item.takenAt !== null);
    return {
      id: FAVORITES_ALBUM_ID,
      name: t.favorites,
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
