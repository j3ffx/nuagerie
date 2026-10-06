import { useEffect, useState } from 'react';
import { useData } from '../data/dataContext.ts';
import type { MediaItem, ThumbnailSize } from '../data/model.ts';
import { describeItem } from '../lib/format.ts';
import { PlayIcon } from './icons.tsx';
import styles from './Thumbnail.module.css';

export function Thumbnail({
  item,
  size = 'medium',
  className,
}: {
  item: MediaItem;
  size?: ThumbnailSize;
  className?: string | undefined;
}) {
  const { source } = useData();
  const [loaded, setLoaded] = useState<{ id: string; url: string } | null>(null);

  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    source.getThumbnailUrl(item, size).then(
      (url) => {
        if (!cancelled) setLoaded({ id: item.id, url });
      },
      () => {
        // Keep the placeholder; retries come with the thumbnail cache.
      },
    );
    return () => {
      cancelled = true;
    };
  }, [source, item, size]);

  const url = loaded?.id === item.id ? loaded.url : null;

  return (
    <div className={`${styles.frame} ${className ?? ''}`}>
      {url && (
        <img
          className={styles.image}
          src={url}
          alt={describeItem(item)}
          loading="lazy"
          decoding="async"
          draggable={false}
        />
      )}
      {item.kind === 'video' && <PlayIcon className={styles.badge} width={22} height={22} />}
    </div>
  );
}
