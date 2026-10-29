import { useEffect, useRef, useState } from 'react';
import type { FailureReason, KeptStatus } from '../../data/offline/offline.ts';
import { formatBytes, formatCount } from '../../lib/format.ts';
import { useOnline } from '../../lib/online.ts';
import { AlertIcon, OfflineIcon } from '../../ui/icons.tsx';
import menu from '../albums/AlbumMenu.module.css';
import { useAlbumPhotos } from '../albums/useAlbumPhotos.ts';
import styles from './KeptBadge.module.css';
import { useOffline } from './offlineContext.ts';

const REASONS: Record<FailureReason, string> = {
  unreadable: 'OneDrive ne laisse pas le navigateur lire ces images',
  missing: 'elles ne sont plus dans OneDrive',
  full: 'il n’y a plus de place sur l’appareil',
  failed: 'le réseau ou OneDrive n’a pas répondu',
};

const photos = (count: number) => `${formatCount(count)} photo${count > 1 ? 's' : ''}`;

/** The state in a few words: the badge's name, and the first line of its details. */
function stateText(status: KeptStatus, pause: 'offline' | 'mobile-data' | null): string {
  switch (status.phase) {
    case 'done':
      return 'à jour';
    case 'downloading':
      return `téléchargement en cours, ${formatCount(status.keptPhotos)} sur ${formatCount(status.photos)}`;
    case 'error':
      return `${photos(status.failedPhotos)} non gardée${status.failedPhotos > 1 ? 's' : ''}`;
    case 'waiting':
      return pause === 'offline'
        ? 'en pause, hors connexion'
        : pause === 'mobile-data'
          ? 'en attente du Wi-Fi'
          : 'en attente';
  }
}

/**
 * The mark of an album kept offline, on its tile: green when every photo is
 * on the device, blue and turning while downloading, blue when waiting, red
 * when some could not be kept. A tap tells the space, the state, the error.
 */
export function KeptBadge({ albumId, name }: { albumId: string; name: string }) {
  const offline = useOffline();
  const items = useAlbumPhotos(albumId)?.items ?? [];
  const status = offline.statusOf(items);
  const [open, setOpen] = useState(false);
  const text = stateText(status, offline.state.pause);

  return (
    <>
      <button
        type="button"
        className={styles.badge}
        data-phase={status.phase}
        aria-label={`Hors connexion : ${text}. Voir les détails`}
        onClick={() => setOpen(true)}
      >
        <span className={styles.disc}>
          {status.phase === 'error' ? (
            <AlertIcon width={18} height={18} />
          ) : (
            <OfflineIcon width={18} height={18} />
          )}
        </span>
      </button>
      {open && (
        <KeptDetails
          name={name}
          albumId={albumId}
          status={status}
          text={text}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function KeptDetails({
  name,
  albumId,
  status,
  text,
  onClose,
}: {
  name: string;
  albumId: string;
  status: KeptStatus;
  text: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const offline = useOffline();
  const online = useOnline();
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  const reasons = status.reasons.map((reason) => REASONS[reason]).join(' ; ');
  const canRetry =
    status.phase === 'error' && online && !status.reasons.every((reason) => reason === 'full');

  return (
    <dialog
      ref={ref}
      className={`${menu.dialog} ${styles.dialog}`}
      aria-labelledby="kept-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className={menu.sheet}>
        <h2 id="kept-title" className={menu.title}>
          {name}
        </h2>
        <div className={styles.details}>
          <p className={styles.state} data-phase={status.phase} role="status">
            Gardé hors connexion : {text}
          </p>
          <dl className={styles.facts}>
            <dt>Sur l’appareil</dt>
            <dd>{formatBytes(status.bytes)}</dd>
            <dt>Photos gardées</dt>
            <dd>
              {formatCount(status.keptPhotos)} sur {formatCount(status.photos)}
            </dd>
          </dl>
          {status.phase === 'error' && (
            <p>
              {status.failedPhotos > 1 ? 'Elles n’ont' : 'Elle n’a'} pas pu être gardée
              {status.failedPhotos > 1 ? 's' : ''} : {reasons}. Nouvel essai à la prochaine
              ouverture.
            </p>
          )}
        </div>
        {canRetry && (
          <button type="button" className={menu.cancel} onClick={offline.retry}>
            Réessayer maintenant
          </button>
        )}
        {offline.state.pause === 'mobile-data' && status.phase !== 'done' && (
          <button type="button" className={menu.cancel} onClick={offline.allowMobileData}>
            Télécharger quand même
          </button>
        )}
        <button
          type="button"
          className={menu.cancel}
          onClick={() => {
            offline.keep(albumId, false);
            onClose();
          }}
        >
          Ne plus garder
        </button>
        <button type="button" className={menu.cancel} onClick={onClose} autoFocus>
          Fermer
        </button>
      </div>
    </dialog>
  );
}
