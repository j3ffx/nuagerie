import { useData } from '../../data/dataContext.ts';
import { useSync } from '../../data/sync/syncContext.ts';
import { formatCount, formatDateTime } from '../../lib/format.ts';
import { useOnline } from '../../lib/online.ts';
import common from '../../ui/common.module.css';
import { useConfirm } from '../../ui/confirmContext.ts';

const STATUS_LABELS = {
  off: 'désactivée',
  syncing: 'en cours…',
  ok: 'à jour',
  offline: 'en attente du réseau',
  'needs-permission': 'permission à accorder',
  error: 'échec',
} as const;

/**
 * The sync: favourites, preferences and root folders kept on the device and,
 * if the user turns it on, in OneDrive's app folder too (they then survive a
 * reinstall and follow the user to other devices). Favourites need it.
 */
export function SyncSection() {
  const sync = useSync();
  const { mode } = useData();
  const online = useOnline();
  const confirm = useConfirm();

  const turnOn = async () => {
    const answer = await confirm({
      title: 'Activer la synchronisation ?',
      message:
        'Nuagerie va demander à Microsoft le droit d’écrire dans un seul dossier, Applis/Nuagerie, pour y ranger tes favoris, tes préférences et l’index de tes photos. Tes photos restent en lecture seule, et tu pourras arrêter à tout moment.',
      confirmLabel: 'Activer',
    });
    if (answer) await sync.enable();
  };

  const turnOff = async () => {
    const answer = await confirm({
      title: 'Désactiver la synchronisation ?',
      message:
        'Sur cet appareil, tes favoris ne s’affichent plus. Ce qui est rangé dans ton OneDrive y reste et revient si tu la réactives. Pour retirer aussi la permission donnée à Nuagerie, passe par « Permissions ».',
      confirmLabel: 'Désactiver',
    });
    if (answer) sync.disable();
  };

  return (
    <section className={common.section} aria-labelledby="settings-sync">
      <h2 id="settings-sync" className={common.sectionTitle}>
        Synchronisation
      </h2>
      <div className={`${common.card} ${common.stack}`}>
        <dl className={common.definitionList}>
          <dt>Favoris</dt>
          <dd>{formatCount(sync.favorites.size)}</dd>
          <dt>{mode === 'demo' ? 'Gardés' : 'État'}</dt>
          <dd>
            <span role="status">
              {mode === 'demo' ? 'sur cet appareil' : STATUS_LABELS[sync.status]}
              {sync.status === 'ok' && sync.lastSyncAt
                ? ` · ${formatDateTime(sync.lastSyncAt)}`
                : ''}
            </span>
          </dd>
        </dl>
        {sync.status === 'error' && sync.message && <p className={common.muted}>{sync.message}</p>}
        {!sync.available ? (
          <p className={common.muted}>
            {mode === 'demo'
              ? 'En démo, les favoris et les préférences restent sur cet appareil.'
              : 'Connecte-toi pour synchroniser tes favoris et tes préférences.'}
          </p>
        ) : !sync.enabled ? (
          <>
            <p className={common.muted}>
              Tes favoris, tes préférences (albums affichés, tris, filtre de « Tout »), tes dossiers
              et l’index de tes photos se rangent dans ton OneDrive, dans un dossier à part
              (Applis/Nuagerie) : rien ne se perd, tes autres appareils suivent et s’ouvrent en
              quelques secondes. Les favoris en ont besoin.
            </p>
            <button
              type="button"
              className={common.buttonSoft}
              onClick={() => void turnOn()}
              disabled={!online}
            >
              Activer la synchronisation
            </button>
          </>
        ) : (
          <>
            <p className={common.muted}>
              Favoris, préférences, dossiers et index rangés dans Applis/Nuagerie, dans ton
              OneDrive. Tes autres appareils connectés à ce compte suivent tout seuls.
            </p>
            {/* Not granted yet, or withdrawn at Microsoft: the page is the way on. */}
            {!sync.favoritesOn && sync.status !== 'syncing' ? (
              <button
                type="button"
                className={common.button}
                onClick={() => void sync.enable()}
                disabled={!online}
              >
                Accorder la permission
              </button>
            ) : (
              <button
                type="button"
                className={common.buttonSoft}
                onClick={sync.syncNow}
                disabled={!online || sync.status === 'syncing'}
              >
                Synchroniser maintenant
              </button>
            )}
            <button type="button" className={common.buttonSoft} onClick={() => void turnOff()}>
              Désactiver la synchronisation
            </button>
          </>
        )}
      </div>
    </section>
  );
}
