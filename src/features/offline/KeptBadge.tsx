import { useEffect, useMemo, useRef, useState } from 'react';
import type { FailureReason, KeptStatus } from '../../data/offline/offline.ts';
import { formatBytes, formatCount } from '../../lib/format.ts';
import { useOnline } from '../../lib/online.ts';
import { AlertIcon, OfflineIcon } from '../../ui/icons.tsx';
import menu from '../albums/AlbumMenu.module.css';
import { useAlbumPhotos } from '../albums/useAlbumPhotos.ts';
import styles from './KeptBadge.module.css';
import { useOffline } from './offlineContext.ts';
import { localized, plural } from '../../lib/i18n.ts';

const t = localized({
  fr: {
    reasons: {
      unreadable: 'OneDrive ne laisse pas le navigateur lire ces images',
      missing: 'elles ne sont plus dans OneDrive',
      full: 'il n’y a plus de place sur l’appareil',
      failed: 'le réseau ou OneDrive n’a pas répondu',
    },
    photos: (count: string, n: number) => `${count} ${plural(n, 'photo', 'photos')}`,
    done: 'à jour',
    downloading: (kept: string, total: string) => `téléchargement en cours, ${kept} sur ${total}`,
    notKept: (photos: string, n: number) => `${photos} ${plural(n, 'non gardée', 'non gardées')}`,
    paused: 'en pause, hors connexion',
    wifi: 'en attente du Wi-Fi',
    waiting: 'en attente',
    badge: (state: string) => `Hors connexion : ${state}. Voir les détails`,
    kept: (state: string) => `Gardé hors connexion : ${state}`,
    onDevice: 'Sur l’appareil',
    keptPhotos: 'Photos gardées',
    of: (kept: string, total: string) => `${kept} sur ${total}`,
    failed: (n: number, reasons: string) =>
      `${plural(n, 'Elle n’a pas pu être gardée', 'Elles n’ont pas pu être gardées')} : ${reasons}. Nouvel essai au retour du réseau ou dans l’application.`,
    retry: 'Réessayer maintenant',
    anyway: 'Télécharger quand même',
    unkeep: 'Ne plus garder',
    close: 'Fermer',
  },
  en: {
    reasons: {
      unreadable: 'OneDrive does not let the browser read these images',
      missing: 'they are no longer in OneDrive',
      full: 'there is no space left on the device',
      failed: 'the network or OneDrive did not answer',
    },
    photos: (count: string, n: number) => `${count} ${plural(n, 'photo', 'photos')}`,
    done: 'up to date',
    downloading: (kept: string, total: string) => `downloading, ${kept} of ${total}`,
    notKept: (photos: string) => `${photos} not kept`,
    paused: 'paused, offline',
    wifi: 'waiting for Wi-Fi',
    waiting: 'waiting',
    badge: (state: string) => `Offline: ${state}. See the details`,
    kept: (state: string) => `Kept offline: ${state}`,
    onDevice: 'On the device',
    keptPhotos: 'Photos kept',
    of: (kept: string, total: string) => `${kept} of ${total}`,
    failed: (n: number, reasons: string) =>
      `${plural(n, 'It could not be kept', 'They could not be kept')}: ${reasons}. Another try when the network is back, or in the app.`,
    retry: 'Try again now',
    anyway: 'Download anyway',
    unkeep: 'Stop keeping',
    close: 'Close',
  },
});

const REASONS: Record<FailureReason, string> = t.reasons;

const photos = (count: number) => t.photos(formatCount(count), count);

/** The state in a few words: the badge's name, and the first line of its details. */
function stateText(status: KeptStatus, pause: 'offline' | 'mobile-data' | null): string {
  switch (status.phase) {
    case 'done':
      return t.done;
    case 'downloading':
      return t.downloading(formatCount(status.keptPhotos), formatCount(status.photos));
    case 'error':
      return t.notKept(photos(status.failedPhotos), status.failedPhotos);
    case 'waiting':
      return pause === 'offline' ? t.paused : pause === 'mobile-data' ? t.wifi : t.waiting;
  }
}

/**
 * The mark of an album kept offline, on its tile: green when every photo is
 * on the device, blue and turning while downloading, blue when waiting, red
 * when some could not be kept. A tap tells the space, the state, the error.
 */
export function KeptBadge({ albumId, name }: { albumId: string; name: string }) {
  const offline = useOffline();
  const items = useAlbumPhotos(albumId)?.items;
  const { statusOf } = offline;
  // Again only when the progress or the album changes (the progress comes 4 times a second).
  const status = useMemo(() => statusOf(items ?? []), [statusOf, items]);
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const text = stateText(status, offline.state.pause);

  return (
    <>
      <button
        ref={button}
        type="button"
        className={styles.badge}
        data-phase={status.phase}
        aria-label={t.badge(text)}
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
          onClose={() => {
            setOpen(false);
            // Closed, the details give the focus back to the badge (keyboard, screen readers).
            requestAnimationFrame(() => button.current?.focus({ preventScroll: true }));
          }}
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
          {/* Not a live region while downloading: it would read every photo kept. */}
          <p
            className={styles.state}
            data-phase={status.phase}
            role={status.phase === 'downloading' ? undefined : 'status'}
          >
            {t.kept(text)}
          </p>
          <dl className={styles.facts}>
            <dt>{t.onDevice}</dt>
            <dd>{formatBytes(status.bytes)}</dd>
            <dt>{t.keptPhotos}</dt>
            <dd>{t.of(formatCount(status.keptPhotos), formatCount(status.photos))}</dd>
          </dl>
          {status.phase === 'error' && <p>{t.failed(status.failedPhotos, reasons)}</p>}
        </div>
        {canRetry && (
          <button type="button" className={menu.cancel} onClick={offline.retry}>
            {t.retry}
          </button>
        )}
        {offline.state.pause === 'mobile-data' && status.phase !== 'done' && (
          <button type="button" className={menu.cancel} onClick={offline.allowMobileData}>
            {t.anyway}
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
          {t.unkeep}
        </button>
        <button type="button" className={menu.cancel} onClick={onClose} autoFocus>
          {t.close}
        </button>
      </div>
    </dialog>
  );
}
