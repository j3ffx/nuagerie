import { useEffect, useState } from 'react';
import { useMediaIndex } from '../../data/dataContext.ts';
import { formatBytes, formatCount } from '../../lib/format.ts';
import common from '../../ui/common.module.css';
import { useConfirm } from '../../ui/confirmContext.ts';
import { useFavoritesAlbum } from '../favorites/useFavorites.ts';
import { useOffline } from '../offline/offlineContext.ts';
import styles from './OfflineSection.module.css';
import { localized, plural } from '../../lib/i18n.ts';

const t = localized({
  fr: {
    favorites: 'Favoris',
    removeAllTitle: 'Ne plus rien garder hors connexion ?',
    removeAllMessage: (bytes: string) =>
      `Les images gardées (${bytes}) sont effacées de l’appareil. Rien ne change dans OneDrive.`,
    removeAll: 'Tout retirer',
    title: 'Hors connexion',
    help: 'Les albums gardés s’ouvrent sans réseau, en grand. Pour en garder un, fais un appui long sur sa tuile.',
    list: 'Gardés hors connexion',
    unkeep: (name: string) => `Ne plus garder ${name}`,
    remove: 'Retirer',
    onDevice: 'Sur l’appareil',
    images: (count: string, n: number) => `${count} ${plural(n, 'image', 'images')}`,
    left: 'Place restante',
    paused: (images: string) => `En pause : hors connexion. Il reste ${images}.`,
    wifi: (images: string) => `En attente du Wi-Fi : ${images} à télécharger.`,
    anyway: 'Télécharger quand même',
    downloading: (done: string, total: string) => `Téléchargement : ${done} / ${total}`,
    progress: 'Téléchargement hors connexion',
    failed: (count: string, n: number) =>
      `${count} ${plural(n, 'image n’a pas pu être gardée', 'images n’ont pas pu être gardées')} : nouvel essai au retour du réseau ou dans l’application.`,
  },
  en: {
    favorites: 'Favourites',
    removeAllTitle: 'Stop keeping anything offline?',
    removeAllMessage: (bytes: string) =>
      `The kept images (${bytes}) are erased from the device. Nothing changes in OneDrive.`,
    removeAll: 'Remove all',
    title: 'Offline',
    help: 'Kept albums open without a network, in full size. To keep one, long-press its tile.',
    list: 'Kept offline',
    unkeep: (name: string) => `Stop keeping ${name}`,
    remove: 'Remove',
    onDevice: 'On the device',
    images: (count: string, n: number) => `${count} ${plural(n, 'image', 'images')}`,
    left: 'Space left',
    paused: (images: string) => `Paused: offline. ${images} left.`,
    wifi: (images: string) => `Waiting for Wi-Fi: ${images} to download.`,
    anyway: 'Download anyway',
    downloading: (done: string, total: string) => `Downloading: ${done} / ${total}`,
    progress: 'Offline download',
    failed: (count: string, n: number) =>
      `${count} ${plural(n, 'image could not be kept', 'images could not be kept')}: another try when the network is back, or in the app.`,
  },
});

/** What the browser leaves to Nuagerie on this device, if it says. */
function useAvailableBytes(usedBytes: number): number | null {
  const [available, setAvailable] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    navigator.storage
      ?.estimate?.()
      .then(({ quota, usage }) => {
        if (live && quota !== undefined) setAvailable(Math.max(0, quota - (usage ?? 0)));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [usedBytes]);
  return available;
}

/**
 * The albums kept offline (chosen in an album's menu): their space, the
 * downloads under way, and a way to take them back.
 */
export function OfflineSection() {
  const offline = useOffline();
  const { state } = offline;
  const index = useMediaIndex();
  const favorites = useFavoritesAlbum();
  const confirm = useConfirm();
  const available = useAvailableBytes(state.bytes);
  const albums = offline.keptAlbums
    .map((id) => ({ id, name: index?.folders.get(id)?.name }))
    .filter((album): album is { id: string; name: string } => album.name !== undefined);
  const kept = [
    ...(offline.favoritesKept && favorites ? [{ id: favorites.id, name: t.favorites }] : []),
    ...albums,
  ];
  const left = state.total - state.done - state.failed;

  const removeAll = async () => {
    const answer = await confirm({
      title: t.removeAllTitle,
      message: t.removeAllMessage(formatBytes(state.bytes)),
      confirmLabel: t.removeAll,
      danger: true,
    });
    if (answer) await offline.clear();
  };

  return (
    <section className={common.section} aria-labelledby="settings-offline">
      <h2 id="settings-offline" className={common.sectionTitle}>
        {t.title}
      </h2>
      <div className={`${common.card} ${common.stack}`}>
        <p className={common.muted}>{t.help}</p>
        {kept.length > 0 && (
          <ul className={styles.list} aria-label={t.list}>
            {kept.map((album) => (
              <li key={album.id} className={styles.row}>
                <span className={styles.name}>{album.name}</span>
                <button
                  type="button"
                  className={styles.remove}
                  aria-label={t.unkeep(album.name)}
                  onClick={() => offline.keep(album.id, false)}
                >
                  {t.remove}
                </button>
              </li>
            ))}
          </ul>
        )}
        <dl className={common.definitionList}>
          <dt>{t.onDevice}</dt>
          <dd>
            {formatBytes(state.bytes)} · {t.images(formatCount(state.images), state.images)}
          </dd>
          {available !== null && (
            <>
              <dt>{t.left}</dt>
              <dd>{formatBytes(available)}</dd>
            </>
          )}
        </dl>
        <OfflineProgress left={left} />
        {kept.length > 0 && (
          <button type="button" className={common.buttonSoft} onClick={() => void removeAll()}>
            {t.removeAll}
          </button>
        )}
      </div>
    </section>
  );
}

function OfflineProgress({ left }: { left: number }) {
  const { state, allowMobileData } = useOffline();
  if (state.pause === 'offline' && left > 0) {
    return <p role="status">{t.paused(t.images(formatCount(left), left))}</p>;
  }
  if (state.pause === 'mobile-data') {
    return (
      <div className={common.stack}>
        <p role="status">{t.wifi(t.images(formatCount(left), left))}</p>
        <button type="button" className={common.buttonSoft} onClick={allowMobileData}>
          {t.anyway}
        </button>
      </div>
    );
  }
  if (state.running) {
    return (
      <div className={common.stack}>
        <p role="status">{t.downloading(formatCount(state.done), formatCount(state.total))}</p>
        <progress
          className={styles.progress}
          max={state.total}
          value={state.done}
          aria-label={t.progress}
        />
      </div>
    );
  }
  if (state.failed > 0) {
    return (
      <p role="status" className={common.muted}>
        {t.failed(formatCount(state.failed), state.failed)}
      </p>
    );
  }
  return null;
}
