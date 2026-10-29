import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import type { Album } from '../../data/albums.ts';
import { formatCount, formatItemCount, formatYearRange } from '../../lib/format.ts';
import { Thumbnail } from '../../ui/Thumbnail.tsx';
import { KeptBadge } from '../offline/KeptBadge.tsx';
import { useOffline } from '../offline/offlineContext.ts';
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
  /** Where the tile is, for its menu (long press, right click); null: no menu. */
  menu?: AlbumPlace | null;
}) {
  const period =
    album.first !== null && album.last !== null ? formatYearRange(album.first, album.last) : null;
  // A long press (a right click with a mouse) opens its menu, titled with its full name.
  // Closed, the menu gives the focus back to its tile (keyboard, screen readers).
  const [menuFor, setMenuFor] = useState<HTMLElement | null>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  // Once the modal menu is gone: while it is open, the rest of the page cannot take the focus.
  useEffect(() => {
    if (menuFor || !returnTo.current) return;
    returnTo.current.focus({ preventScroll: true });
    returnTo.current = null;
  }, [menuFor]);
  const kept = useOffline().isKept(album.id);
  const longPress = useLongPress((tile) => {
    if (menu) setMenuFor(tile);
  });
  return (
    <div className={styles.holder}>
      <Link
        href={href ?? `/album/${encodeURIComponent(album.id)}`}
        className={styles.tile}
        // Held, a link would be dragged instead of opening the menu.
        draggable={false}
        {...longPress}
        onContextMenu={(event) => {
          if (!menu) return;
          event.preventDefault();
          setMenuFor(event.currentTarget);
        }}
      >
        {album.cover ? (
          <Thumbnail item={album.cover} className={styles.cover} decorative />
        ) : (
          <div className={styles.cover} aria-hidden="true" />
        )}
        {/* The caption names the link: what is read is what is shown. The hidden commas sit
            inside the lines: between them, a space would come before each. */}
        <span className={styles.caption}>
          <span className={styles.name} title={album.name}>
            {album.name}
            <span className="hidden-inline">, </span>
          </span>
          <span className={styles.meta}>
            {albumCountLabel(album)}
            {period && <span className="hidden-inline">, </span>}
          </span>
          {period && <span className={styles.meta}>{period}</span>}
          {kept && <span className="visually-hidden">, gardé hors connexion</span>}
        </span>
      </Link>
      {/* Beside the link, over the corner of the cover: a tap on it tells, without opening. */}
      {kept && (
        <span className={styles.badgeArea}>
          <KeptBadge albumId={album.id} name={album.name} />
        </span>
      )}
      {menuFor && menu && (
        <AlbumMenu
          album={album}
          place={menu}
          onClose={() => {
            returnTo.current = menuFor;
            setMenuFor(null);
          }}
        />
      )}
    </div>
  );
}
