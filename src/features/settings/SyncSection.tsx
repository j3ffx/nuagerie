import { useData } from '../../data/dataContext.ts';
import { useSync } from '../../data/sync/syncContext.ts';
import { formatCount, formatDateTime } from '../../lib/format.ts';
import { useOnline } from '../../lib/online.ts';
import common from '../../ui/common.module.css';
import { useConfirm } from '../../ui/confirmContext.ts';

const STATUS_LABELS = {
  off: 'désactivés',
  syncing: 'synchronisation…',
  ok: 'synchronisés',
  offline: 'en attente du réseau',
  'needs-permission': 'permission à accorder',
  error: 'échec',
} as const;

/**
 * Favourites and preferences: kept on the device, and, if the user turns
 * it on, in OneDrive's app folder too (they then survive a reinstall and
 * follow the user to other devices).
 */
export function SyncSection() {
  const sync = useSync();
  const { mode } = useData();
  const online = useOnline();
  const confirm = useConfirm();

  const turnOn = async () => {
    const answer = await confirm({
      title: 'Activer les favoris ?',
      message:
        'Nuagerie va demander à Microsoft le droit d’écrire dans un seul dossier, Applis/Nuagerie, pour y ranger tes favoris et tes préférences. Tes photos restent en lecture seule, et tu pourras arrêter à tout moment.',
      confirmLabel: 'Activer',
    });
    if (answer) await sync.enable();
  };

  const turnOff = async () => {
    const answer = await confirm({
      title: 'Désactiver les favoris ?',
      message:
        'Tes favoris et préférences restent dans ton OneDrive et reviendront si tu les réactives. Pour retirer aussi la permission donnée à Nuagerie, passe par « Permissions ».',
      confirmLabel: 'Désactiver',
    });
    if (answer) sync.disable();
  };

  return (
    <section className={common.section} aria-labelledby="settings-sync">
      <h2 id="settings-sync" className={common.sectionTitle}>
        Favoris et préférences
      </h2>
      <div className={`${common.card} ${common.stack}`}>
        <dl className={common.definitionList}>
          <dt>Favoris</dt>
          <dd>{formatCount(sync.favorites.size)}</dd>
          <dt>{mode === 'demo' ? 'Gardés' : 'Synchronisation'}</dt>
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
              ? 'En démo, les favoris restent sur cet appareil.'
              : 'Connecte-toi pour synchroniser tes favoris dans OneDrive.'}
          </p>
        ) : !sync.enabled ? (
          <>
            <p className={common.muted}>
              Les favoris et tes préférences se rangent dans ton OneDrive, dans un dossier à part
              (Applis/Nuagerie) : ils ne se perdent jamais et te suivent sur tes autres appareils.
            </p>
            <button
              type="button"
              className={common.buttonSoft}
              onClick={() => void turnOn()}
              disabled={!online}
            >
              Activer les favoris
            </button>
          </>
        ) : (
          <>
            <p className={common.muted}>Rangés dans le dossier Applis/Nuagerie de ton OneDrive.</p>
            {sync.status === 'needs-permission' ? (
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
              Désactiver les favoris
            </button>
          </>
        )}
      </div>
    </section>
  );
}
