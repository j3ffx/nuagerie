import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { orderItems } from '../../data/albums.ts';
import type { MediaItem } from '../../data/model.ts';
import { useMediaIndex } from '../../data/dataContext.ts';
import { formatItemCount } from '../../lib/format.ts';
import common from '../../ui/common.module.css';
import { BackIcon, SortDownIcon, SortUpIcon } from '../../ui/icons.tsx';
import { IndexStatus } from '../../ui/IndexStatus.tsx';
import { ScreenHeader } from '../../ui/ScreenHeader.tsx';
import styles from '../albums/AlbumScreen.module.css';
import { usePhotoOrder } from '../albums/useAlbums.ts';
import { PhotoBrowser } from '../viewer/PhotoBrowser.tsx';
import { useViewer } from '../viewer/useViewer.ts';
import { useFavoriteItems } from './useFavorites.ts';

/** The favourite photos and videos, wherever they are on the drive, in one grid. */
export function FavoritesScreen() {
  const index = useMediaIndex();
  const favorites = useFavoriteItems();
  const [order, setOrder] = usePhotoOrder();
  const { photoId } = useViewer();

  // Taken out of the favourites in the viewer, a photo stays in it (and in the grid behind)
  // until the viewer closes, so a slip of the finger can be undone with a second tap.
  const [kept, setKept] = useState<readonly MediaItem[] | null>(null);
  if (photoId !== null && kept === null) setKept(favorites);
  if (photoId === null && kept !== null) setKept(null);
  const browsed = useMemo(() => {
    if (!kept) return favorites;
    const ids = new Set(favorites.map((item) => item.id));
    return [...favorites, ...kept.filter((item) => !ids.has(item.id))];
  }, [favorites, kept]);
  const items = useMemo(() => orderItems(browsed, order), [browsed, order]);

  return (
    <>
      <ScreenHeader
        title="Favoris"
        leading={
          <Link href="/" className={styles.back} aria-label="Retour aux albums">
            <BackIcon />
          </Link>
        }
        actions={
          items.length > 1 ? (
            <button
              type="button"
              className={styles.order}
              onClick={() => setOrder(order === 'desc' ? 'asc' : 'desc')}
              aria-label={`Ordre : ${order === 'desc' ? 'récent d’abord' : 'ancien d’abord'}. Inverser`}
            >
              {order === 'desc' ? <SortDownIcon /> : <SortUpIcon />}
            </button>
          ) : undefined
        }
      />
      <IndexStatus />
      {index &&
        (items.length === 0 ? (
          <div className={common.page}>
            <div className={`${common.card} ${common.stack}`}>
              <p>Aucun favori pour l’instant.</p>
              <p className={common.muted}>Dans une photo, touche le cœur pour l’ajouter ici.</p>
            </div>
          </div>
        ) : (
          <>
            <p className={`${common.muted} ${styles.summary}`}>{formatItemCount(items.length)}</p>
            <PhotoBrowser items={items} label="Photos et vidéos favorites" />
          </>
        ))}
    </>
  );
}
