import { memo } from 'react';
import type { MediaItem, ThumbnailSize } from '../data/model.ts';
import { describeItem } from '../lib/format.ts';
import { PlayIcon } from './icons.tsx';
import styles from './Thumbnail.module.css';
import { useThumbnailUrl } from './useThumbnailUrl.ts';

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
