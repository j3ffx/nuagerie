import { createContext, useContext } from 'react';
import type { DataMode } from '../source.ts';

/** This device's copy of the synced state, per data source (demo and OneDrive ids differ). */
export const syncStateKey = (mode: DataMode) => `sync.state.${mode}`;
export const SYNC_ENABLED_KEY = 'sync.enabled';
/** Microsoft granted the sync permission on this device (a token was obtained). */
export const SYNC_GRANTED_KEY = 'sync.granted';

export type SyncStatus =
  /** Kept on this device only (sync off, demo, or no account). */
  | 'off'
  | 'syncing'
  | 'ok'
  /** Waiting for the network; changes go out when it is back. */
  | 'offline'
  /** On, but Microsoft no longer grants the permission: the user must give it again. */
  | 'needs-permission'
  | 'error';

export interface SyncContextValue {
  favorites: ReadonlySet<string>;
  /** Favourites can be used: demo, or the sync with OneDrive is on. */
  favoritesOn: boolean;
  toggleFavorite: (id: string) => void;
  /** The sync can be turned on: OneDrive, signed in. */
  available: boolean;
  enabled: boolean;
  status: SyncStatus;
  message: string | null;
  lastSyncAt: number | null;
  /** Why turning the favourites on did not go through (permission declined, error), to show once. */
  notice: string | null;
  /** The notice was seen; `retry` turns the favourites on again. */
  dismissNotice: (retry: boolean) => void;
  /**
   * Turns the sync on, asking Microsoft for the permission unless this device
   * already holds it (leaves the page); `favoriteId` becomes a favourite once
   * the first sync went through.
   */
  enable: (favoriteId?: string) => Promise<void>;
  /** Turns it off; what is on this device stays. */
  disable: () => void;
  syncNow: () => void;
}

export const SyncContext = createContext<SyncContextValue | null>(null);

export function useSync(): SyncContextValue {
  const value = useContext(SyncContext);
  if (!value) throw new Error('useSync() must be used inside <SyncProvider>');
  return value;
}
