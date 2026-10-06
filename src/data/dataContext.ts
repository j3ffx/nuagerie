import { createContext, useContext } from 'react';
import type { IndexProgress, MediaIndex } from './model.ts';
import type { DataMode, DataSource } from './source.ts';

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
  source: DataSource;
  state: DataState;
  sync: SyncState;
  /** Fetches the latest changes now. */
  refresh: () => void;
  /** Forgets the local copy and enumerates everything again. */
  resetIndex: () => Promise<void>;
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
