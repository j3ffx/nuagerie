import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { folderTrail } from '../../data/albums.ts';
import { useData, useMediaIndex } from '../../data/dataContext.ts';
import type { MediaItem } from '../../data/model.ts';
import {
  formatBytes,
  formatDimensions,
  formatDuration,
  formatLongDate,
  formatTakenTime,
} from '../../lib/format.ts';
import { useOnline } from '../../lib/online.ts';
import { CloseIcon } from '../../ui/icons.tsx';
import styles from './InfoPanel.module.css';
import { usePlaceName } from './usePlaceName.ts';

const DATE_SOURCES = {
  exif: 'Donnée de l’appareil photo (EXIF)',
  filename: 'Lue dans le nom du fichier',
} as const;

/**
 * What is known of the photo: date and where it comes from, album, folder,
 * file, camera, size, place. Under the photo on a phone, beside it on a wide
 * screen. Coordinates are never shown, only the place's name.
 */
export function InfoPanel({ item, onClose }: { item: MediaItem; onClose: () => void }) {
  const index = useMediaIndex();
  const album = index?.folders.get(item.albumId) ?? null;
  const trail = index ? folderTrail(index.folders, item.folderId) : [];
  const place = usePlaceName(item);
  const time =
    item.takenAt === null
      ? null
      : formatTakenTime({ takenAt: item.takenAt, dateSource: item.dateSource });

  return (
    <section className={styles.panel} aria-labelledby="info-title" data-info-panel="">
      <header className={styles.header}>
        <h2 id="info-title" className={styles.title}>
          Infos
        </h2>
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="Fermer les infos"
          autoFocus
        >
          <CloseIcon />
        </button>
      </header>
      <dl className={styles.list}>
        <dt>Date</dt>
        <dd>
          {item.takenAt === null
            ? 'Sans date'
            : `${formatLongDate(item.takenAt)}${time ? ` à ${time}` : ''}`}
          <span className={styles.note}>
            {item.dateSource
              ? DATE_SOURCES[item.dateSource]
              : 'Ni l’appareil photo ni le nom du fichier ne la donnent'}
          </span>
        </dd>
        {album && (
          <>
            <dt>Album</dt>
            <dd>
              <Link href={`/album/${encodeURIComponent(album.id)}`} className={styles.link}>
                {album.name}
              </Link>
            </dd>
          </>
        )}
        {trail.length > 0 && (
          <>
            <dt>Dossier</dt>
            <dd>{trail.join(' › ')}</dd>
          </>
        )}
        <dt>Fichier</dt>
        <dd>{item.name}</dd>
        {item.camera && (
          <>
            <dt>Appareil</dt>
            <dd>{item.camera}</dd>
          </>
        )}
        <dt>Taille</dt>
        <dd>
          {item.width && item.height ? `${formatDimensions(item.width, item.height)} · ` : ''}
          {formatBytes(item.size)}
        </dd>
        {item.durationMs !== null && item.durationMs > 0 && (
          <>
            <dt>Durée</dt>
            <dd>{formatDuration(item.durationMs)}</dd>
          </>
        )}
        {place && (
          <>
            <dt>Lieu</dt>
            <dd>
              <Link
                href={`/carte?focus=${encodeURIComponent(item.id)}`}
                className={styles.link}
                aria-label={`${place}, voir sur la carte`}
              >
                {place}
              </Link>
            </dd>
          </>
        )}
      </dl>
      <OneDriveLink item={item} />
    </section>
  );
}

/** The file on OneDrive's website, its address asked for once the panel shows it. */
function OneDriveLink({ item }: { item: MediaItem }) {
  const { source } = useData();
  const online = useOnline();
  const [found, setFound] = useState<{ id: string; url: string | null } | null>(null);
  const getWebUrl = source.getWebUrl?.bind(source);

  useEffect(() => {
    if (!getWebUrl || !online) return;
    let cancelled = false;
    getWebUrl(item).then(
      (url) => {
        if (!cancelled) setFound({ id: item.id, url });
      },
      () => {
        if (!cancelled) setFound({ id: item.id, url: null });
      },
    );
    return () => {
      cancelled = true;
    };
    // The item, not each new copy of the source's bound method.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, online, source]);

  if (!getWebUrl) return null;
  const url = found?.id === item.id ? found.url : null;
  return url && online ? (
    <a className={styles.action} href={url} target="_blank" rel="noopener noreferrer">
      Ouvrir dans OneDrive
    </a>
  ) : (
    <span className={styles.action} aria-disabled="true" data-disabled="">
      {online ? 'Ouvrir dans OneDrive…' : 'Ouvrir dans OneDrive (hors connexion)'}
    </span>
  );
}
