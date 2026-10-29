import { useData } from '../../data/dataContext.ts';
import { useSync } from '../../data/sync/syncContext.ts';
import { formatCount, formatDateTime } from '../../lib/format.ts';
import { useOnline } from '../../lib/online.ts';
import common from '../../ui/common.module.css';
import { useConfirm } from '../../ui/confirmContext.ts';
import { localized } from '../../lib/i18n.ts';

const t = localized({
  fr: {
    status: {
      off: 'désactivée',
      syncing: 'en cours…',
      ok: 'à jour',
      offline: 'en attente du réseau',
      needsPermission: 'permission à accorder',
      error: 'échec',
    },
    onTitle: 'Activer la synchronisation ?',
    onMessage:
      'Nuagerie va demander à Microsoft le droit d’écrire dans un seul dossier, Applis/Nuagerie, pour y ranger tes favoris, tes préférences et l’index de tes photos. Tes photos restent en lecture seule, et tu pourras arrêter à tout moment.',
    onConfirm: 'Activer',
    offTitle: 'Désactiver la synchronisation ?',
    offMessage:
      'Sur cet appareil, tes favoris ne s’affichent plus. Ce qui est rangé dans ton OneDrive y reste et revient si tu la réactives. Pour retirer aussi la permission donnée à Nuagerie, passe par « Permissions ».',
    offConfirm: 'Désactiver',
    title: 'Synchronisation',
    favorites: 'Favoris',
    kept: 'Gardés',
    state: 'État',
    onDevice: 'sur cet appareil',
    demo: 'En démo, les favoris et les préférences restent sur cet appareil.',
    signIn: 'Connecte-toi pour synchroniser tes favoris et tes préférences.',
    what: 'Tes favoris, tes préférences (albums affichés, tris, filtre de « Tout »), tes dossiers et l’index de tes photos se rangent dans ton OneDrive, dans un dossier à part (Applis/Nuagerie) : rien ne se perd, tes autres appareils suivent et s’ouvrent en quelques secondes. Les favoris en ont besoin.',
    turnOn: 'Activer la synchronisation',
    on: 'Favoris, préférences, dossiers et index rangés dans Applis/Nuagerie, dans ton OneDrive. Tes autres appareils connectés à ce compte suivent tout seuls.',
    grant: 'Accorder la permission',
    now: 'Synchroniser maintenant',
    turnOff: 'Désactiver la synchronisation',
  },
  en: {
    status: {
      off: 'off',
      syncing: 'in progress…',
      ok: 'up to date',
      offline: 'waiting for the network',
      needsPermission: 'permission to grant',
      error: 'failed',
    },
    onTitle: 'Turn on the sync?',
    onMessage:
      'Nuagerie will ask Microsoft for the right to write in one folder only, Apps/Nuagerie, to keep your favourites, your preferences and the index of your photos there. Your photos stay read-only, and you can stop at any time.',
    onConfirm: 'Turn on',
    offTitle: 'Turn off the sync?',
    offMessage:
      'On this device, your favourites no longer show. What is kept in your OneDrive stays there and comes back if you turn it on again. To withdraw the permission given to Nuagerie too, go through “Permissions”.',
    offConfirm: 'Turn off',
    title: 'Sync',
    favorites: 'Favourites',
    kept: 'Kept',
    state: 'State',
    onDevice: 'on this device',
    demo: 'In the demo, favourites and preferences stay on this device.',
    signIn: 'Sign in to sync your favourites and preferences.',
    what: 'Your favourites, your preferences (albums shown, sorting, the “All” filter), your folders and the index of your photos are kept in your OneDrive, in a folder of their own (Apps/Nuagerie): nothing gets lost, your other devices follow and open in a few seconds. Favourites need it.',
    turnOn: 'Turn on the sync',
    on: 'Favourites, preferences, folders and index kept in Apps/Nuagerie, in your OneDrive. Your other devices signed in to this account follow on their own.',
    grant: 'Grant the permission',
    now: 'Sync now',
    turnOff: 'Turn off the sync',
  },
});

const STATUS_LABELS = {
  off: t.status.off,
  syncing: t.status.syncing,
  ok: t.status.ok,
  offline: t.status.offline,
  'needs-permission': t.status.needsPermission,
  error: t.status.error,
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
      title: t.onTitle,
      message: t.onMessage,
      confirmLabel: t.onConfirm,
    });
    if (answer) await sync.enable();
  };

  const turnOff = async () => {
    const answer = await confirm({
      title: t.offTitle,
      message: t.offMessage,
      confirmLabel: t.offConfirm,
    });
    if (answer) sync.disable();
  };

  return (
    <section className={common.section} aria-labelledby="settings-sync">
      <h2 id="settings-sync" className={common.sectionTitle}>
        {t.title}
      </h2>
      <div className={`${common.card} ${common.stack}`}>
        <dl className={common.definitionList}>
          <dt>{t.favorites}</dt>
          <dd>{formatCount(sync.favorites.size)}</dd>
          <dt>{mode === 'demo' ? t.kept : t.state}</dt>
          <dd>
            <span role="status">
              {mode === 'demo' ? t.onDevice : STATUS_LABELS[sync.status]}
              {sync.status === 'ok' && sync.lastSyncAt
                ? ` · ${formatDateTime(sync.lastSyncAt)}`
                : ''}
            </span>
          </dd>
        </dl>
        {sync.status === 'error' && sync.message && <p className={common.muted}>{sync.message}</p>}
        {!sync.available ? (
          <p className={common.muted}>{mode === 'demo' ? t.demo : t.signIn}</p>
        ) : !sync.enabled ? (
          <>
            <p className={common.muted}>{t.what}</p>
            <button
              type="button"
              className={common.buttonSoft}
              onClick={() => void turnOn()}
              disabled={!online}
            >
              {t.turnOn}
            </button>
          </>
        ) : (
          <>
            <p className={common.muted}>{t.on}</p>
            {/* Not granted yet, or withdrawn at Microsoft: the page is the way on. */}
            {!sync.favoritesOn && sync.status !== 'syncing' ? (
              <button
                type="button"
                className={common.button}
                onClick={() => void sync.enable()}
                disabled={!online}
              >
                {t.grant}
              </button>
            ) : (
              <button
                type="button"
                className={common.buttonSoft}
                onClick={sync.syncNow}
                disabled={!online || sync.status === 'syncing'}
              >
                {t.now}
              </button>
            )}
            <button type="button" className={common.buttonSoft} onClick={() => void turnOff()}>
              {t.turnOff}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
