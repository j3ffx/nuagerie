import { createContext, useContext } from 'react';
import type { IndexProgress, MediaIndex } from './model.ts';
import type { DataMode, DataSource } from './source.ts';
import type { Thumbnails } from './thumbnails/setup.ts';

export type DataState =
  | { status: 'loading'; progress: IndexProgress | null }
  | { status: 'ready'; index: MediaIndex; loadedInMs: number }
  | { status: 'error'; message: string };

/** Background update of an index that is already displayed. */
export interface SyncState {
  status: 'idle' | 'running' | 'error';
  progress: IndexProgress | null;
  message: string | null;
  lastSyncAt: number | null;
}

export interface DataContextValue {
  mode: DataMode;
  /** OneDrive with an account; false in demo mode and when started offline without one. */
  signedIn: boolean;
  source: DataSource;
  thumbnails: Thumbnails;
  state: DataState;
  sync: SyncState;
  /** Fetches the latest changes now. */
  refresh: () => void;
  /**
   * Forgets the local copy and enumerates everything again (or starts from the
   * copy another device shared, when `useSharedCopy`).
   */
  resetIndex: (options?: { useSharedCopy?: boolean }) => Promise<void>;
}

export const DataContext = createContext<DataContextValue | null>(null);

export function useData(): DataContextValue {
  const value = useContext(DataContext);
  if (!value) throw new Error('useData() must be used inside <DataProvider>');
  return value;
}

/** The index when it is ready, null otherwise. */
export function useMediaIndex(): MediaIndex | null {
  const { state } = useData();
  return state.status === 'ready' ? state.index : null;
}
