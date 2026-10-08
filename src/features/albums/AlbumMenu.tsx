import { useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'wouter';
import { withinFolder, type Album } from '../../data/albums.ts';
import { useMediaIndex } from '../../data/dataContext.ts';
import { MapIcon } from '../../ui/icons.tsx';
import { OneDriveLink } from '../../ui/OneDriveLink.tsx';
import styles from './AlbumMenu.module.css';
import { useAlbumSelection } from './useAlbums.ts';

/** On the home screen, or among an album's sub-albums: hiding it is not the same choice. */
export type AlbumPlace = 'home' | 'sub';

/**
 * The menu of an album tile, opened with a long press (a right click with a
 * mouse): its full name, then hide it, see its photos on the map, open it on
 * OneDrive's website. A native modal dialog: Escape, Android's back gesture
 * or a tap beside it closes it.
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
  const index = useMediaIndex();
  const [, navigate] = useLocation();
  const { setChecked, setHidden } = useAlbumSelection();
  const located = useMemo(
    () => (index ? withinFolder(index, album.id).some((item) => item.latitude !== null) : false),
    [index, album.id],
  );

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
        <button type="button" className={styles.item} onClick={hide}>
          {place === 'home' ? 'Masquer de l’accueil' : 'Masquer ce sous-album'}
          <span className={styles.note}>Il revient avec « Choisir les albums ».</span>
        </button>
        <button
          type="button"
          className={styles.item}
          onClick={() => {
            onClose();
            navigate(`/carte?album=${encodeURIComponent(album.id)}`);
          }}
          disabled={!located}
        >
          <span className={styles.label}>
            <MapIcon width={20} height={20} />
            Voir sur la carte
          </span>
          {!located && <span className={styles.note}>Aucune photo localisée.</span>}
        </button>
        <OneDriveLink id={album.id} className={styles.item} />
        <button type="button" className={styles.cancel} onClick={onClose} autoFocus>
          Annuler
        </button>
      </div>
    </dialog>
  );
}
