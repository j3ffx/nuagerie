import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import type { Album } from '../../data/albums.ts';
import { ChevronIcon, ExternalIcon, HideIcon, MapIcon } from '../../ui/icons.tsx';
import { OneDriveLink } from '../../ui/OneDriveLink.tsx';
import styles from './AlbumMenu.module.css';
import { useAlbumPhotos } from './useAlbumPhotos.ts';
import { useAlbumSelection } from './useAlbums.ts';

/**
 * Where the tile is: on the home screen, among an album's sub-albums (hiding
 * them is not the same choice), or the Favoris tile (not a OneDrive folder).
 */
export type AlbumPlace = 'home' | 'sub' | 'favorites';

/**
 * The menu of an album tile, opened with a long press (a right click with a
 * mouse): its full name, then hide it, see its photos on the map, open it on
 * OneDrive's website. A native modal dialog: Escape, Android's back gesture
 * or a tap beside it closes it. Nothing in it can be selected as text: the
 * finger that opened it is often still down, and Android would select
 * what comes under it.
 */
export function AlbumMenu({
  album,
  place,
  onClose,
}: {
  album: Album;
  place: AlbumPlace;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const pressedBeside = useRef(false);
  const [, navigate] = useLocation();
  const { setChecked, setHidden } = useAlbumSelection();
  const located = useAlbumPhotos(album.id)?.items.some((item) => item.latitude !== null) ?? false;

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const hide = () => {
    if (place === 'home') setChecked(album.id, false);
    else setHidden(album.id, true);
    onClose();
  };

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="album-menu-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // A tap beside the menu closes it; not the lift of the finger that opened it, whose
      // press began before the menu was there.
      onPointerDown={(event) => {
        pressedBeside.current = event.target === ref.current;
      }}
      onClick={(event) => {
        if (event.target === ref.current && pressedBeside.current) onClose();
      }}
    >
      <div className={styles.sheet}>
        <h2 id="album-menu-title" className={styles.title}>
          {album.name}
        </h2>
        <div className={styles.items}>
          {place !== 'favorites' && (
            <button type="button" className={styles.item} onClick={hide}>
              <HideIcon className={styles.icon} />
              <span className={styles.text}>
                {place === 'home' ? 'Masquer de l’accueil' : 'Masquer ce sous-album'}
                <span className={styles.note}>Il revient avec « Choisir les albums ».</span>
              </span>
              <ChevronIcon className={styles.chevron} />
            </button>
          )}
          <button
            type="button"
            className={styles.item}
            onClick={() => {
              onClose();
              navigate(`/carte?album=${encodeURIComponent(album.id)}`);
            }}
            disabled={!located}
          >
            <MapIcon className={styles.icon} />
            <span className={styles.text}>
              Voir sur la carte
              {!located && <span className={styles.note}>Aucune photo localisée.</span>}
            </span>
            <ChevronIcon className={styles.chevron} />
          </button>
          {place !== 'favorites' && (
            <OneDriveLink id={album.id} className={styles.item}>
              <ExternalIcon className={styles.icon} />
            </OneDriveLink>
          )}
        </div>
        <button type="button" className={styles.cancel} onClick={onClose} autoFocus>
          Annuler
        </button>
      </div>
    </dialog>
  );
}
