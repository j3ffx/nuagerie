import { memo, useEffect, useState } from 'react';
import { useData } from '../data/dataContext.ts';
import type { MediaItem, ThumbnailSize } from '../data/model.ts';
import { thumbnailKey } from '../data/thumbnails/thumbnailStore.ts';
import { describeItem } from '../lib/format.ts';
import { PlayIcon } from './icons.tsx';
import styles from './Thumbnail.module.css';

/** URL of the item's thumbnail once available (memory, cache or network), else null. */
function useThumbnailUrl(item: MediaItem, size: ThumbnailSize): string | null {
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

export const Thumbnail = memo(function Thumbnail({
  item,
  size = 'medium',
  className,
  decorative = false,
}: {
  item: MediaItem;
  size?: ThumbnailSize;
  className?: string | undefined;
  /** The surrounding element already names the content (e.g. an album tile). */
  decorative?: boolean;
}) {
  const url = useThumbnailUrl(item, size);

  return (
    <div className={`${styles.frame} ${className ?? ''}`}>
      {url && (
        <img
          className={styles.image}
          src={url}
          alt={decorative ? '' : describeItem(item)}
          decoding="async"
          draggable={false}
        />
      )}
      {item.kind === 'video' && <PlayIcon className={styles.badge} width={22} height={22} />}
    </div>
  );
});
