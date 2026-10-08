import { useMemo } from 'react';
import { withinFolder } from '../../data/albums.ts';
import { useMediaIndex } from '../../data/dataContext.ts';
import type { MediaItem } from '../../data/model.ts';
import { FAVORITES_ALBUM_ID, useFavoriteItems } from '../favorites/useFavorites.ts';

/**
 * An album by id, with its photos and its sub-albums' (the Favoris album
 * too): what the map shows when opened from an album's menu. Null for an id
 * that is no album (or no id).
 */
export function useAlbumPhotos(
  albumId: string | null,
): { id: string; name: string; items: readonly MediaItem[] } | null {
  const index = useMediaIndex();
  const favorites = useFavoriteItems();
  return useMemo(() => {
    if (!albumId || !index) return null;
    if (albumId === FAVORITES_ALBUM_ID) return { id: albumId, name: 'Favoris', items: favorites };
    const folder = index.folders.get(albumId);
    return folder
      ? { id: folder.id, name: folder.name, items: withinFolder(index, folder.id) }
      : null;
  }, [albumId, index, favorites]);
}
