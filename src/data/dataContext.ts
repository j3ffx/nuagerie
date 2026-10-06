import { createContext, useContext } from 'react';
import type { IndexProgress, MediaIndex } from './model.ts';
import type { DataMode, DataSource } from './source.ts';

export type DataState =
  | { status: 'loading'; progress: IndexProgress | null }
  | { status: 'ready'; index: MediaIndex; loadedInMs: number }
  | { status: 'error'; message: string }
  /** OneDrive mode while sign-in is not implemented yet. */
  | { status: 'unavailable' };

export interface DataContextValue {
  mode: DataMode;
  source: DataSource | null;
  state: DataState;
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
