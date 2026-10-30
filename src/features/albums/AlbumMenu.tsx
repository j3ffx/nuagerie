import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import type { Album } from '../../data/albums.ts';
import { useData, useMediaIndex } from '../../data/dataContext.ts';
import { isEditableAlbum, looksEmpty } from '../../data/edits/rules.ts';
import { useOnline } from '../../lib/online.ts';
import { useConfirm } from '../../ui/confirmContext.ts';
import { NameDialog } from '../edits/EditDialogs.tsx';
import { useEdits } from '../edits/editsContext.ts';
import { formatBytes, formatItemCount } from '../../lib/format.ts';
import {
  ChevronIcon,
  ExternalIcon,
  HideIcon,
  MapIcon,
  OfflineIcon,
  PencilIcon,
  TrashIcon,
} from '../../ui/icons.tsx';
import { useOffline } from '../offline/offlineContext.ts';
import { OneDriveLink } from '../../ui/OneDriveLink.tsx';
import styles from './AlbumMenu.module.css';
import { useAlbumPhotos } from './useAlbumPhotos.ts';
import { useAlbumSelection } from './useAlbums.ts';
import { localized } from '../../lib/i18n.ts';

const t = localized({
  fr: {
    hideHome: 'Masquer de l’accueil',
    hideSub: 'Masquer ce sous-album',
    hideNote: 'Il revient avec « Choisir les albums ».',
    map: 'Voir sur la carte',
    noPlace: 'Aucune photo localisée.',
    unkeep: 'Ne plus garder hors connexion',
    keep: 'Garder hors connexion',
    frees: 'Libère la place prise sur l’appareil.',
    withSubAlbums: ', sous-albums compris',
    cancel: 'Annuler',
    rename: 'Renommer',
    renameTitle: 'Renommer l’album',
    renameConfirm: 'Renommer',
    remove: 'Supprimer l’album',
    removeEmpty: 'Seulement un album vide.',
    removeNote: 'Il est vide : il va dans la corbeille de OneDrive.',
    removeTitle: (name: string) => `Supprimer « ${name} » ?`,
    removeMessage: 'L’album est vide. Le dossier va dans la corbeille de OneDrive.',
    removeConfirm: 'Supprimer',
    needsNetwork: 'Demande le réseau.',
    needsPermission: 'Redonne la permission dans les réglages.',
  },
  en: {
    hideHome: 'Hide from the home screen',
    hideSub: 'Hide this sub-album',
    hideNote: 'It comes back with “Choose the albums”.',
    map: 'See on the map',
    noPlace: 'No photo with a place.',
    unkeep: 'Stop keeping offline',
    keep: 'Keep offline',
    frees: 'Frees the space taken on the device.',
    withSubAlbums: ', sub-albums included',
    cancel: 'Cancel',
    rename: 'Rename',
    renameTitle: 'Rename the album',
    renameConfirm: 'Rename',
    remove: 'Delete the album',
    removeEmpty: 'Only an empty album.',
    removeNote: 'It is empty: it goes to OneDrive’s recycle bin.',
    removeTitle: (name: string) => `Delete “${name}”?`,
    removeMessage: 'The album is empty. Its folder goes to OneDrive’s recycle bin.',
    removeConfirm: 'Delete',
    needsNetwork: 'Needs the network.',
    needsPermission: 'Give the permission again in the settings.',
  },
});

/**
 * Where the tile is: on the home screen, among an album's sub-albums (hiding
 * them is not the same choice), or the Favoris tile (not a OneDrive folder).
 */
export type AlbumPlace = 'home' | 'sub' | 'favorites';

/**
 * The menu of an album tile, opened with a long press (a right click with a
 * mouse): its full name, then hide it, see its photos on the map, keep it
 * offline, open it on OneDrive's website. A native modal dialog: Escape, Android's back gesture
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
  const photos = useAlbumPhotos(album.id);
  const located = photos?.items.some((item) => item.latitude !== null) ?? false;
  const offline = useOffline();
  const kept = offline.isKept(album.id);
  const count = photos?.items.length ?? 0;
  const index = useMediaIndex();
  const edits = useEdits();
  const confirm = useConfirm();
  const online = useOnline();
  const { mode } = useData();
  const [renaming, setRenaming] = useState(false);
  const editable =
    place !== 'favorites' && edits.status !== 'off' && !!index && isEditableAlbum(index, album.id);
  const empty = !!index && looksEmpty(index, album.id);
  const editNote =
    edits.status === 'needs-permission'
      ? t.needsPermission
      : !online && mode !== 'demo'
        ? t.needsNetwork
        : undefined;
  const parentId = index?.folders.get(album.id)?.parentId ?? null;

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const hide = () => {
    if (place === 'home') setChecked(album.id, false);
    else setHidden(album.id, true);
    onClose();
  };

  if (renaming && parentId) {
    return (
      <NameDialog
        title={t.renameTitle}
        confirmLabel={t.renameConfirm}
        parentId={parentId}
        initial={album.name}
        ignoreId={album.id}
        onCancel={onClose}
        onDone={async (name) => {
          await edits.renameAlbum(album.id, name);
          onClose();
        }}
      />
    );
  }

  const remove = async () => {
    const answer = await confirm({
      title: t.removeTitle(album.name),
      message: t.removeMessage,
      confirmLabel: t.removeConfirm,
      danger: true,
    });
    if (answer) await edits.deleteAlbum(album.id);
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
                {place === 'home' ? t.hideHome : t.hideSub}
                <span className={styles.note}>{t.hideNote}</span>
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
              {t.map}
              {!located && <span className={styles.note}>{t.noPlace}</span>}
            </span>
            <ChevronIcon className={styles.chevron} />
          </button>
          <button
            type="button"
            className={styles.item}
            onClick={() => {
              offline.keep(album.id, !kept);
              onClose();
            }}
            disabled={!kept && count === 0}
          >
            <OfflineIcon className={styles.icon} />
            <span className={styles.text}>
              {kept ? t.unkeep : t.keep}
              <span className={styles.note}>
                {kept
                  ? t.frees
                  : `≈ ${formatBytes(offline.estimate(count))} · ${formatItemCount(count)}${album.subAlbumCount > 0 ? t.withSubAlbums : ''}`}
              </span>
            </span>
            <ChevronIcon className={styles.chevron} />
          </button>
          {place !== 'favorites' && (
            <OneDriveLink id={album.id} className={styles.item}>
              <ExternalIcon className={styles.icon} />
            </OneDriveLink>
          )}
          {editable && (
            <>
              <button
                type="button"
                className={styles.item}
                onClick={() => setRenaming(true)}
                disabled={!edits.usable}
              >
                <PencilIcon className={styles.icon} />
                <span className={styles.text}>
                  {t.rename}
                  {editNote && <span className={styles.note}>{editNote}</span>}
                </span>
                <ChevronIcon className={styles.chevron} />
              </button>
              <button
                type="button"
                className={styles.item}
                onClick={() => {
                  onClose();
                  void remove();
                }}
                disabled={!edits.usable || !empty}
              >
                <TrashIcon className={styles.icon} />
                <span className={styles.text}>
                  {t.remove}
                  <span className={styles.note}>
                    {editNote ?? (empty ? t.removeNote : t.removeEmpty)}
                  </span>
                </span>
                <ChevronIcon className={styles.chevron} />
              </button>
            </>
          )}
        </div>
        <button type="button" className={styles.cancel} onClick={onClose} autoFocus>
          {t.cancel}
        </button>
      </div>
    </dialog>
  );
}
