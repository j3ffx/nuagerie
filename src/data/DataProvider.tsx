import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { isOnline } from '../lib/online.ts';
import { DataContext, type DataState, type SyncState } from './dataContext.ts';
import type { DataMode, DataSource } from './source.ts';
import { createThumbnails } from './thumbnails/setup.ts';

const IDLE: SyncState = { status: 'idle', progress: null, message: null, lastSyncAt: null };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Shows the index as soon as it is available (local copy first), then keeps
 * it up to date in the background, again when the app comes back to the
 * foreground or the connection comes back.
 */
export function DataProvider({
  mode,
  signedIn,
  source,
  children,
}: {
  mode: DataMode;
  signedIn: boolean;
  source: DataSource;
  children: ReactNode;
}) {
  const [state, setState] = useState<DataState>({ status: 'loading', progress: null });
  const [sync, setSync] = useState<SyncState>(IDLE);
  const syncing = useRef(false);
  const [generation, setGeneration] = useState(0);
  const [thumbnails] = useState(() => createThumbnails(mode, source));

  const refresh = useCallback(() => {
    if (!source.refresh || syncing.current || !isOnline()) return;
    syncing.current = true;
    setSync((s) => ({ ...s, status: 'running', progress: null, message: null }));
    source
      .refresh((progress) => setSync((s) => ({ ...s, progress })))
      .then((index) => {
        if (index) setState((s) => (s.status === 'ready' ? { ...s, index } : s));
        setSync({ status: 'idle', progress: null, message: null, lastSyncAt: Date.now() });
      })
      .catch((error: unknown) => {
        setSync((s) => ({ ...s, status: 'error', progress: null, message: errorMessage(error) }));
      })
      .finally(() => {
        syncing.current = false;
      });
  }, [source]);

  useEffect(() => {
    let cancelled = false;
    const startedAt = performance.now();
    source
      .loadIndex((progress) => {
        if (!cancelled) setState({ status: 'loading', progress });
      })
      .then((index) => {
        if (cancelled) return;
        setState({ status: 'ready', index, loadedInMs: performance.now() - startedAt });
        refresh();
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ status: 'error', message: errorMessage(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [source, refresh, generation]);

  // Pick up changes made elsewhere when the app is shown again.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', refresh);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', refresh);
    };
  }, [refresh]);

  const resetIndex = useCallback(async () => {
    await source.reset?.();
    setSync(IDLE);
    setState({ status: 'loading', progress: null });
    setGeneration((g) => g + 1);
  }, [source]);

  return (
    <DataContext.Provider
      value={{ mode, signedIn, source, thumbnails, state, sync, refresh, resetIndex }}
    >
      {children}
    </DataContext.Provider>
  );
}
