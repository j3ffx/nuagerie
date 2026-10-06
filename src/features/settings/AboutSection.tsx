import {
  applyUpdate,
  checkForUpdate,
  useUpdateState,
  type UpdateStatus,
} from '../../app/updates.ts';
import common from '../../ui/common.module.css';

const STATUS_LABELS: Record<UpdateStatus, string> = {
  idle: '—',
  checking: 'recherche…',
  'up-to-date': 'à jour',
  downloading: 'téléchargement…',
  ready: 'prête à installer',
  error: 'vérification impossible',
};

/** Version of the app, and manual update check. */
export function AboutSection() {
  const { status, latestCommit } = useUpdateState();
  const busy = status === 'checking' || status === 'downloading';

  return (
    <section className={common.section} aria-labelledby="settings-about">
      <h2 id="settings-about" className={common.sectionTitle}>
        À propos
      </h2>
      <div className={`${common.card} ${common.stack}`}>
        <dl className={common.definitionList}>
          <dt>Version</dt>
          <dd>
            {__APP_VERSION__}
            {__APP_COMMIT__ && ` (${__APP_COMMIT__})`}
          </dd>
          <dt>Mise à jour</dt>
          <dd role="status">
            {STATUS_LABELS[status]}
            {latestCommit && latestCommit !== __APP_COMMIT__ && status !== 'up-to-date'
              ? ` (${latestCommit})`
              : ''}
          </dd>
        </dl>
        {status === 'ready' ? (
          <button type="button" className={common.button} onClick={applyUpdate}>
            Installer la nouvelle version
          </button>
        ) : (
          <button
            type="button"
            className={common.buttonSoft}
            onClick={() => void checkForUpdate()}
            disabled={busy}
          >
            Rechercher une mise à jour
          </button>
        )}
      </div>
    </section>
  );
}
