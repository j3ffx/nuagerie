import { useEffect, useState } from 'react';
import { useMediaIndex } from '../../data/dataContext.ts';
import { formatBytes, formatCount } from '../../lib/format.ts';
import common from '../../ui/common.module.css';
import { useConfirm } from '../../ui/confirmContext.ts';
import { useFavoritesAlbum } from '../favorites/useFavorites.ts';
import { useOffline } from '../offline/offlineContext.ts';
import styles from './OfflineSection.module.css';

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
    ...(offline.favoritesKept && favorites ? [{ id: favorites.id, name: 'Favoris' }] : []),
    ...albums,
  ];
  const left = state.total - state.done - state.failed;

  const removeAll = async () => {
    const answer = await confirm({
      title: 'Ne plus rien garder hors connexion ?',
      message: `Les images gardées (${formatBytes(state.bytes)}) sont effacées de l’appareil. Rien ne change dans OneDrive.`,
      confirmLabel: 'Tout retirer',
      danger: true,
    });
    if (answer) await offline.clear();
  };

  return (
    <section className={common.section} aria-labelledby="settings-offline">
      <h2 id="settings-offline" className={common.sectionTitle}>
        Hors connexion
      </h2>
      <div className={`${common.card} ${common.stack}`}>
        <p className={common.muted}>
          Les albums gardés s’ouvrent sans réseau, en grand. Pour en garder un, fais un appui long
          sur sa tuile.
        </p>
        {kept.length > 0 && (
          <ul className={styles.list} aria-label="Gardés hors connexion">
            {kept.map((album) => (
              <li key={album.id} className={styles.row}>
                <span className={styles.name}>{album.name}</span>
                <button
                  type="button"
                  className={styles.remove}
                  aria-label={`Ne plus garder ${album.name}`}
                  onClick={() => offline.keep(album.id, false)}
                >
                  Retirer
                </button>
              </li>
            ))}
          </ul>
        )}
        <dl className={common.definitionList}>
          <dt>Sur l’appareil</dt>
          <dd>
            {formatBytes(state.bytes)} · {formatCount(state.images)} image
            {state.images > 1 ? 's' : ''}
          </dd>
          {available !== null && (
            <>
              <dt>Place restante</dt>
              <dd>{formatBytes(available)}</dd>
            </>
          )}
        </dl>
        <OfflineProgress left={left} />
        {kept.length > 0 && (
          <button type="button" className={common.buttonSoft} onClick={() => void removeAll()}>
            Tout retirer
          </button>
        )}
      </div>
    </section>
  );
}

function OfflineProgress({ left }: { left: number }) {
  const { state, allowMobileData } = useOffline();
  if (state.pause === 'offline' && left > 0) {
    return (
      <p role="status">
        En pause : hors connexion. Il reste {formatCount(left)} image{left > 1 ? 's' : ''}.
      </p>
    );
  }
  if (state.pause === 'mobile-data') {
    return (
      <div className={common.stack}>
        <p role="status">
          En attente du Wi-Fi : {formatCount(left)} image{left > 1 ? 's' : ''} à télécharger.
        </p>
        <button type="button" className={common.buttonSoft} onClick={allowMobileData}>
          Télécharger quand même
        </button>
      </div>
    );
  }
  if (state.running) {
    return (
      <div className={common.stack}>
        <p role="status">
          Téléchargement : {formatCount(state.done)} / {formatCount(state.total)}
        </p>
        <progress
          className={styles.progress}
          max={state.total}
          value={state.done}
          aria-label="Téléchargement hors connexion"
        />
      </div>
    );
  }
  if (state.failed > 0) {
    return (
      <p role="status" className={common.muted}>
        {formatCount(state.failed)} image{state.failed > 1 ? 's n’ont' : ' n’a'} pas pu être gardée
        {state.failed > 1 ? 's' : ''} : nouvel essai au retour du réseau ou dans l’application.
      </p>
    );
  }
  return null;
}
