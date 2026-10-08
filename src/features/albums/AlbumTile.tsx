import { useState } from 'react';
import { Link } from 'wouter';
import type { Album } from '../../data/albums.ts';
import { formatCount, formatItemCount, formatYearRange } from '../../lib/format.ts';
import { Thumbnail } from '../../ui/Thumbnail.tsx';
import { useLongPress } from '../../ui/useLongPress.ts';
import { AlbumMenu, type AlbumPlace } from './AlbumMenu.tsx';
import styles from './AlbumTile.module.css';

/** "1 234 éléments", or "12 albums" for an album made only of sub-albums. */
function albumCountLabel(album: Album): string {
  if (album.items.length === 0 && album.subAlbumCount > 0) {
    return `${formatCount(album.subAlbumCount)} ${album.subAlbumCount > 1 ? 'albums' : 'album'}`;
  }
  return formatItemCount(album.items.length);
}

export function AlbumTile({
  album,
  href,
  menu = null,
}: {
  album: Album;
  href?: string;
  /** Where the tile is, for its menu (long press, right click); null: no menu (Favoris). */
  menu?: AlbumPlace | null;
}) {
  const period =
    album.first !== null && album.last !== null ? formatYearRange(album.first, album.last) : null;
  const label = [album.name, albumCountLabel(album), period].filter(Boolean).join(', ');
  // A long press (a right click with a mouse) opens its menu, titled with its full name.
  const [menuOpen, setMenuOpen] = useState(false);
  const longPress = useLongPress(() => {
    if (menu) setMenuOpen(true);
  });
  return (
    <>
      <Link
        href={href ?? `/album/${encodeURIComponent(album.id)}`}
        className={styles.tile}
        aria-label={label}
        // Held, a link would be dragged instead of opening the menu.
        draggable={false}
        {...longPress}
        onContextMenu={(event) => {
          if (!menu) return;
          event.preventDefault();
          setMenuOpen(true);
        }}
      >
        {album.cover ? (
          <Thumbnail item={album.cover} className={styles.cover} decorative />
        ) : (
          <div className={styles.cover} aria-hidden="true" />
        )}
        <span className={styles.caption}>
          <span className={styles.name} title={album.name}>
            {album.name}
          </span>
          <span className={styles.meta}>{albumCountLabel(album)}</span>
          {period && <span className={styles.meta}>{period}</span>}
        </span>
      </Link>
      {menuOpen && menu && (
        <AlbumMenu album={album} place={menu} onClose={() => setMenuOpen(false)} />
      )}
    </>
  );
}
