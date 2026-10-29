import { Link } from 'wouter';
import { folderTrail } from '../../data/albums.ts';
import { useMediaIndex } from '../../data/dataContext.ts';
import type { MediaItem } from '../../data/model.ts';
import {
  formatBytes,
  formatDimensions,
  formatDuration,
  formatLongDate,
  formatTakenTime,
} from '../../lib/format.ts';
import { CloseIcon } from '../../ui/icons.tsx';
import { OneDriveLink } from '../../ui/OneDriveLink.tsx';
import styles from './InfoPanel.module.css';
import { usePlaceName } from './usePlaceName.ts';
import { localized } from '../../lib/i18n.ts';

const t = localized({
  fr: {
    exif: 'Donnée de l’appareil photo (EXIF)',
    filename: 'Lue dans le nom du fichier',
    title: 'Infos',
    close: 'Fermer les infos',
    date: 'Date',
    undated: 'Sans date',
    at: (day: string, time: string) => `${day} à ${time}`,
    noDate: 'Ni l’appareil photo ni le nom du fichier ne la donnent',
    album: 'Album',
    folder: 'Dossier',
    file: 'Fichier',
    camera: 'Appareil',
    size: 'Taille',
    duration: 'Durée',
    place: 'Lieu',
    onMap: (place: string) => `${place}, voir sur la carte`,
  },
  en: {
    exif: 'From the camera (EXIF)',
    filename: 'Read from the file name',
    title: 'Info',
    close: 'Close the info',
    date: 'Date',
    undated: 'Undated',
    at: (day: string, time: string) => `${day} at ${time}`,
    noDate: 'Neither the camera nor the file name gives it',
    album: 'Album',
    folder: 'Folder',
    file: 'File',
    camera: 'Camera',
    size: 'Size',
    duration: 'Length',
    place: 'Place',
    onMap: (place: string) => `${place}, see on the map`,
  },
});

const DATE_SOURCES = { exif: t.exif, filename: t.filename } as const;

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
          {t.title}
        </h2>
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label={t.close}
          autoFocus
        >
          <CloseIcon />
        </button>
      </header>
      <dl className={styles.list}>
        <dt>{t.date}</dt>
        <dd>
          {item.takenAt === null
            ? t.undated
            : time
              ? t.at(formatLongDate(item.takenAt), time)
              : formatLongDate(item.takenAt)}
          <span className={styles.note}>
            {item.dateSource ? DATE_SOURCES[item.dateSource] : t.noDate}
          </span>
        </dd>
        {album && (
          <>
            <dt>{t.album}</dt>
            <dd>
              <Link href={`/album/${encodeURIComponent(album.id)}`} className={styles.link}>
                {album.name}
              </Link>
            </dd>
          </>
        )}
        {trail.length > 0 && (
          <>
            <dt>{t.folder}</dt>
            <dd>{trail.join(' › ')}</dd>
          </>
        )}
        <dt>{t.file}</dt>
        <dd>{item.name}</dd>
        {item.camera && (
          <>
            <dt>{t.camera}</dt>
            <dd>{item.camera}</dd>
          </>
        )}
        <dt>{t.size}</dt>
        <dd>
          {item.width && item.height ? `${formatDimensions(item.width, item.height)} · ` : ''}
          {formatBytes(item.size)}
        </dd>
        {item.durationMs !== null && item.durationMs > 0 && (
          <>
            <dt>{t.duration}</dt>
            <dd>{formatDuration(item.durationMs)}</dd>
          </>
        )}
        {place && (
          <>
            <dt>{t.place}</dt>
            <dd>
              <Link
                href={`/carte?focus=${encodeURIComponent(item.id)}`}
                className={styles.link}
                aria-label={t.onMap(place)}
              >
                {place}
              </Link>
            </dd>
          </>
        )}
      </dl>
      <OneDriveLink id={item.id} className={styles.action} />
    </section>
  );
}
