import { useEffect, useState } from 'react';
import { useData } from '../data/dataContext.ts';
import type { MediaItem, ThumbnailSize } from '../data/model.ts';
import { thumbnailKey } from '../data/thumbnails/thumbnailStore.ts';

/** URL of the item's thumbnail once available (memory, cache or network), else null. */
export function useThumbnailUrl(item: MediaItem, size: ThumbnailSize): string | null {
  const { store } = useData().thumbnails;
  const key = thumbnailKey(item, size);
  const [loaded, setLoaded] = useState<{ key: string; url: string } | null>(null);

  useEffect(() => {
    const handle = store.acquire(item, size);
    let active = true;
    handle.promise.then(
      (url) => {
        if (active) setLoaded({ key, url });
      },
      () => {
        // No thumbnail (or not now): the placeholder stays.
      },
    );
    return () => {
      active = false;
      handle.release();
    };
  }, [store, item, size, key]);

  return loaded?.key === key ? loaded.url : store.peek(item, size);
}
