import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useData, useMediaIndex } from '../../data/dataContext.ts';
import { thumbnailKey } from '../../data/thumbnails/thumbnailStore.ts';
import {
  createOfflineManager,
  estimateBytes,
  keptItems,
  keptStatus,
  NOTHING_KEPT,
  type KeptChoice,
} from '../../data/offline/offline.ts';
import { isOnline } from '../../lib/online.ts';
import { usePersistentState } from '../../lib/persistent.ts';
import { FAVORITES_ALBUM_ID, useFavoriteItems } from '../favorites/useFavorites.ts';
import { keptKey, OfflineContext, type OfflineContextValue } from './offlineContext.ts';

/** The Network Information API (Chrome on Android): not in the DOM types everywhere. */
type Connection = EventTarget & { type?: string; saveData?: boolean };
const connection = (): Connection | undefined =>
  (navigator as Navigator & { connection?: Connection }).connection;
/** Mobile data, or the user asked to save data: then wait for Wi-Fi. */
const onMobileData = () => {
  const current = connection();
  return current?.type === 'cellular' || current?.saveData === true;
};

/**
 * Keeps the chosen albums and the favourites on this device, for offline
 * use: what is kept follows the index and the favourites (new photos come,
 * removed ones go), and downloads go on when the network comes back or the
 * app returns to the screen.
 */
export function OfflineProvider({ children }: { children: ReactNode }) {
  const { mode, source, thumbnails } = useData();
  const index = useMediaIndex();
  const favorites = useFavoriteItems();
  const [choice, setChoice] = usePersistentState<KeptChoice>(keptKey(mode), NOTHING_KEPT);
  const [manager] = useState(() =>
    createOfflineManager({
      storage: thumbnails.offline,
      fetch: async (item, size, signal) => {
        // Already seen in a grid or the viewer: no need to download it again.
        const seen = await thumbnails.disk.get(thumbnailKey(item, size));
        return seen ? { blob: seen } : source.fetchThumbnail(item, size, signal);
      },
      isOnline,
      onMobileData,
    }),
  );
  const state = useSyncExternalStore(manager.subscribe, manager.getSnapshot);

  const items = useMemo(
    () => (index ? keptItems(index, choice, favorites) : null),
    [index, choice, favorites],
  );
  useEffect(() => {
    if (items) void manager.sync(items);
  }, [items, manager]);

  useEffect(() => {
    const resume = () => {
      if (document.visibilityState === 'visible') void manager.resume();
    };
    window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', resume);
    connection()?.addEventListener('change', resume);
    return () => {
      window.removeEventListener('online', resume);
      document.removeEventListener('visibilitychange', resume);
      connection()?.removeEventListener('change', resume);
    };
  }, [manager]);

  const keep = useCallback(
    (albumId: string, value: boolean) => {
      if (value) {
        // Kept on purpose: ask the browser not to clear it when space runs low.
        void navigator.storage?.persist?.().catch(() => false);
      }
      if (albumId === FAVORITES_ALBUM_ID) {
        setChoice({ ...choice, favorites: value });
        return;
      }
      const albums = choice.albums.filter((id) => id !== albumId);
      setChoice({ ...choice, albums: value ? [...albums, albumId] : albums });
    },
    [choice, setChoice],
  );

  const value = useMemo<OfflineContextValue>(
    () => ({
      state,
      isKept: (albumId) =>
        albumId === FAVORITES_ALBUM_ID ? choice.favorites : choice.albums.includes(albumId),
      keep,
      keptAlbums: choice.albums,
      favoritesKept: choice.favorites,
      estimate: (count) => estimateBytes(count, state.bytes, state.images),
      allowMobileData: () => void manager.allowMobileData(),
      statusOf: (list) => keptStatus(list, manager.view, state),
      retry: () => void manager.resume(),
      clear: async () => {
        setChoice(NOTHING_KEPT);
        await manager.clear();
      },
    }),
    [state, choice, keep, manager, setChoice],
  );

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}
