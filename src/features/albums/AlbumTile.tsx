import { Link } from 'wouter';
import type { Album } from '../../data/albums.ts';
import { formatCount, formatItemCount, formatYearRange } from '../../lib/format.ts';
import { Thumbnail } from '../../ui/Thumbnail.tsx';
import styles from './AlbumTile.module.css';

/** "1 234 éléments", or "12 albums" for an album made only of sub-albums. */
function albumCountLabel(album: Album): string {
  if (album.items.length === 0 && album.subAlbumCount > 0) {
    return `${formatCount(album.subAlbumCount)} ${album.subAlbumCount > 1 ? 'albums' : 'album'}`;
  }
  return formatItemCount(album.items.length);
}

export function AlbumTile({ album }: { album: Album }) {
  const period =
    album.first !== null && album.last !== null ? formatYearRange(album.first, album.last) : null;
  const label = [album.name, albumCountLabel(album), period].filter(Boolean).join(', ');
  return (
    <Link
      href={`/album/${encodeURIComponent(album.id)}`}
      className={styles.tile}
      aria-label={label}
    >
      {album.cover ? (
        <Thumbnail item={album.cover} className={styles.cover} decorative />
      ) : (
        <div className={styles.cover} aria-hidden="true" />
      )}
      <span className={styles.caption}>
        <span className={styles.name}>{album.name}</span>
        <span className={styles.meta}>{albumCountLabel(album)}</span>
        {period && <span className={styles.meta}>{period}</span>}
      </span>
    </Link>
  );
}
