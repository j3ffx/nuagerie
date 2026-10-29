import { createContext, useContext } from 'react';
import type { MediaItem } from '../../data/model.ts';
import type { KeptStatus, OfflineState } from '../../data/offline/offline.ts';

/** What this device keeps offline, per data source (demo and OneDrive ids differ). */
export const keptKey = (mode: string) => `offline.kept.${mode}`;

export interface OfflineContextValue {
  state: OfflineState;
  /** The Favoris album (FAVORITES_ALBUM_ID) or a folder id. */
  isKept: (albumId: string) => boolean;
  keep: (albumId: string, value: boolean) => void;
  /** Kept albums, by folder id, and whether the favourites are. */
  keptAlbums: readonly string[];
  favoritesKept: boolean;
  /** Bytes a number of photos would take. */
  estimate: (count: number) => number;
  allowMobileData: () => void;
  /** How the images of these photos (an album) are kept. */
  statusOf: (items: readonly MediaItem[]) => KeptStatus;
  /** Tries the failed images again now. */
  retry: () => void;
  /** Keeps nothing any more, and empties what was kept. */
  clear: () => Promise<void>;
}

export const OfflineContext = createContext<OfflineContextValue | null>(null);

export function useOffline(): OfflineContextValue {
  const value = useContext(OfflineContext);
  if (!value) throw new Error('useOffline() must be used inside <OfflineProvider>');
  return value;
}
