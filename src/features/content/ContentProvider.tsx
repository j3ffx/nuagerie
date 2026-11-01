import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createContentSearch, type ContentSearch } from '../../data/content/contentSearch.ts';
import { createDemoEngine } from '../../data/content/demoEngine.ts';
import { createWorkerEngine, type EngineDevice } from '../../data/content/engine.ts';
import { createMemoryVectorStore, createVectorStore } from '../../data/content/vectorStore.ts';
import { useData, useMediaIndex } from '../../data/dataContext.ts';
import type { MediaIndex, MediaItem } from '../../data/model.ts';
import type { DataSource } from '../../data/source.ts';
import { createAppFolderVectorSnapshots } from '../../data/sync/appFolderSnapshots.ts';
import type { Thumbnails } from '../../data/thumbnails/setup.ts';
import { thumbnailKey } from '../../data/thumbnails/thumbnailStore.ts';
import { onMobileData } from '../../lib/connection.ts';
import { isOnline } from '../../lib/online.ts';
import { readPersistent, writePersistent } from '../../lib/persistent.ts';
import {
  CONTENT_ANALYSED_KEY,
  CONTENT_DEVICE_KEY,
  CONTENT_ENABLED_KEY,
} from '../../data/forgetAccount.ts';
import { ContentContext } from './contentContext.ts';

const KEYS = { enabled: CONTENT_ENABLED_KEY, analysed: CONTENT_ANALYSED_KEY };

/** Keeps the screen on while the photos are analysed, as far as the browser lets it. */
function keepAwake(): () => void {
  const lock = (
    navigator as Navigator & {
      wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> };
    }
  ).wakeLock
    ?.request('screen')
    .catch(() => null);
  return () => void lock?.then((held) => held?.release()).catch(() => undefined);
}

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

function create(
  demo: boolean,
  signedIn: boolean,
  source: DataSource,
  thumbnails: Thumbnails,
): { search: ContentSearch; follow: (index: MediaIndex) => void } {
  let shown: MediaIndex | null = null;
  const deps = {
    isOnline,
    onMobileData,
    keepAwake,
    pause,
    read: (key: keyof typeof KEYS) => readPersistent(KEYS[key], false),
    write: (key: keyof typeof KEYS, value: boolean) => writePersistent(KEYS[key], value),
    readDevice: () => readPersistent<EngineDevice | null>(CONTENT_DEVICE_KEY, null),
    writeDevice: (device: EngineDevice | null) => writePersistent(CONTENT_DEVICE_KEY, device),
  };
  const follow = (index: MediaIndex) => {
    shown = index;
    search.update(index.items);
  };
  const search = demo
    ? createContentSearch({
        ...deps,
        engine: createDemoEngine(),
        store: createMemoryVectorStore(),
        snapshots: null,
        image: (item) => Promise.resolve(new Blob([shown?.folders.get(item.albumId)?.name ?? ''])),
      })
    : createContentSearch({
        ...deps,
        engine: createWorkerEngine(),
        store: createVectorStore('nuagerie-content-onedrive'),
        snapshots: signedIn ? createAppFolderVectorSnapshots() : null,
        image: async (item: MediaItem, signal: AbortSignal) => {
          // The same thumbnail as the grid's: already seen, no need to download it again.
          const seen = await thumbnails.disk.get(thumbnailKey(item, 'medium'));
          if (seen) return seen;
          const data = await source.fetchThumbnail(item, 'medium', signal);
          if ('blob' in data) return data.blob;
          throw new Error('Thumbnail not readable');
        },
      });
  return { search, follow };
}

/**
 * The search in what the photos show, across the app: an analysis goes on from
 * one screen to another. Nothing runs and nothing is downloaded until it is
 * turned on in the settings.
 */
export function ContentProvider({ children }: { children: ReactNode }) {
  const { mode, signedIn, source, thumbnails } = useData();
  const index = useMediaIndex();
  const [{ search, follow }] = useState(() =>
    create(mode === 'demo', signedIn, source, thumbnails),
  );
  const state = useSyncExternalStore(search.subscribe, search.getSnapshot);

  useEffect(() => {
    if (index) follow(index);
  }, [index, follow]);

  const value = useMemo(
    () => ({ state, search, available: state.enabled && state.done > 0 }),
    [state, search],
  );
  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}
