import { useEffect, useState, type ReactNode } from 'react';
import { DataContext, type DataState } from './dataContext.ts';
import { createDemoSource } from './demo/demoSource.ts';
import { resolveDataMode } from './mode.ts';
import type { DataMode, DataSource } from './source.ts';

function createSource(mode: DataMode): DataSource | null {
  return mode === 'demo' ? createDemoSource() : null;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [{ mode, source }] = useState(() => {
    const resolved = resolveDataMode();
    return { mode: resolved, source: createSource(resolved) };
  });
  const [state, setState] = useState<DataState>(() =>
    source ? { status: 'loading', progress: null } : { status: 'unavailable' },
  );

  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    const startedAt = performance.now();
    source
      .loadIndex((progress) => {
        if (!cancelled) setState({ status: 'loading', progress });
      })
      .then((index) => {
        if (!cancelled) {
          setState({ status: 'ready', index, loadedInMs: performance.now() - startedAt });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : String(error),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [source]);

  return <DataContext.Provider value={{ mode, source, state }}>{children}</DataContext.Provider>;
}
