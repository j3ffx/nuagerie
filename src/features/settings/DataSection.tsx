import { Link } from 'wouter';
import { checkForUpdate } from '../../app/updates.ts';
import { useData } from '../../data/dataContext.ts';
import { formatCount, formatDateTime } from '../../lib/format.ts';
import { localized } from '../../lib/i18n.ts';
import { useOnline } from '../../lib/online.ts';
import common from '../../ui/common.module.css';
import { useConfirm } from '../../ui/confirmContext.ts';

const t = localized({
  fr: {
    resetTitle: 'Tout relire ?',
    resetMessage:
      'Nuagerie relit tout le contenu de OneDrive, ce qui prend environ une minute. Les miniatures déjà gardées restent.',
    resetConfirm: 'Tout relire',
    title: 'Données',
    source: 'Source',
    demo: 'Démo (photos factices)',
    items: 'Photos et vidéos',
    folders: 'Dossiers',
    update: 'Dernière lecture',
    offline: 'hors connexion',
    paused: 'en pause',
    running: (progress: string) => `en cours${progress}`,
    failed: 'échec',
    updateNow: 'Relire les changements',
    reindex: 'Tout relire depuis OneDrive',
    diagnostic: 'Diagnostic de l’index',
  },
  en: {
    resetTitle: 'Read everything again?',
    resetMessage:
      'Nuagerie reads all of OneDrive again, which takes about a minute. The thumbnails already kept stay.',
    resetConfirm: 'Read everything',
    title: 'Data',
    source: 'Source',
    demo: 'Demo (made-up photos)',
    items: 'Photos and videos',
    folders: 'Folders',
    update: 'Last read',
    offline: 'offline',
    paused: 'paused',
    running: (progress: string) => `in progress${progress}`,
    failed: 'failed',
    updateNow: 'Read the changes',
    reindex: 'Read everything from OneDrive',
    diagnostic: 'Index diagnostic',
  },
});

/** What the app read from OneDrive, and the ways to read it again. */
export function DataSection() {
  const { mode, signedIn, state, sync, refresh, resetIndex } = useData();
  const online = useOnline();
  const confirm = useConfirm();
  const index = state.status === 'ready' ? state.index : null;

  const confirmReset = async () => {
    const answer = await confirm({
      title: t.resetTitle,
      message: t.resetMessage,
      confirmLabel: t.resetConfirm,
    });
    if (answer) void resetIndex();
  };

  return (
    <section className={common.section} aria-labelledby="settings-data">
      <h2 id="settings-data" className={common.sectionTitle}>
        {t.title}
      </h2>
      <div className={`${common.card} ${common.stack}`}>
        <dl className={common.definitionList}>
          <dt>{t.source}</dt>
          <dd>{mode === 'demo' ? t.demo : 'OneDrive'}</dd>
          {index && (
            <>
              <dt>{t.items}</dt>
              <dd>{formatCount(index.items.length)}</dd>
              <dt>{t.folders}</dt>
              <dd>{formatCount(index.folders.size)}</dd>
            </>
          )}
          {mode === 'onedrive' && (
            <>
              <dt>{t.update}</dt>
              <dd>
                <span role="status">
                  {!online
                    ? t.offline
                    : !signedIn
                      ? t.paused
                      : sync.status === 'running'
                        ? t.running(sync.progress ? ` (${formatCount(sync.progress.loaded)})` : '…')
                        : sync.status === 'error'
                          ? t.failed
                          : sync.lastSyncAt
                            ? formatDateTime(sync.lastSyncAt)
                            : '—'}
                </span>
              </dd>
            </>
          )}
        </dl>
        {sync.status === 'error' && sync.message && <p className={common.muted}>{sync.message}</p>}
        {mode === 'onedrive' && signedIn && (
          <>
            <button
              type="button"
              className={common.buttonSoft}
              onClick={() => {
                refresh();
                void checkForUpdate({ quiet: true });
              }}
              disabled={!online || sync.status === 'running' || state.status !== 'ready'}
            >
              {t.updateNow}
            </button>
            <button
              type="button"
              className={common.buttonSoft}
              onClick={() => void confirmReset()}
              disabled={!online}
            >
              {t.reindex}
            </button>
            <Link href="/diagnostic" className={common.buttonSoft}>
              {t.diagnostic}
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
