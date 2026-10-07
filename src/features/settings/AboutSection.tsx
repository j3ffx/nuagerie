import {
  applyUpdate,
  checkForUpdate,
  useUpdateState,
  type UpdateStatus,
} from '../../app/updates.ts';
import { Link } from 'wouter';
import { useData } from '../../data/dataContext.ts';
import { issueUrl, REPOSITORY_URL } from '../../lib/report.ts';
import common from '../../ui/common.module.css';

const STATUS_LABELS: Record<UpdateStatus, string> = {
  idle: '—',
  checking: 'recherche…',
  'up-to-date': 'à jour',
  downloading: 'téléchargement…',
  ready: 'prête à installer',
  error: 'vérification impossible',
};

/** Version of the app, what is new, manual update check, and where to report a problem. */
export function AboutSection() {
  const { status, latestCommit } = useUpdateState();
  const { mode } = useData();
  const busy = status === 'checking' || status === 'downloading';
  const report = () =>
    issueUrl({
      version: __APP_VERSION__,
      commit: __APP_COMMIT__,
      mode,
      userAgent: navigator.userAgent,
      installed: window.matchMedia('(display-mode: standalone)').matches,
      screenWidth: window.innerWidth,
    });

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
          <dd>
            <span role="status">
              {STATUS_LABELS[status]}
              {latestCommit && latestCommit !== __APP_COMMIT__ && status !== 'up-to-date'
                ? ` (${latestCommit})`
                : ''}
            </span>
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
        <Link href="/nouveautes?retour=%2Freglages" className={common.buttonSoft}>
          Nouveautés
        </Link>
        <a
          href={report()}
          target="_blank"
          rel="noreferrer"
          className={common.buttonSoft}
          aria-describedby="report-note"
        >
          Signaler un problème
        </a>
        <p id="report-note" className={common.muted}>
          Ouvre GitHub (compte nécessaire), avec la version et le type d’appareil, rien de
          personnel.
        </p>
        <p className={common.muted}>
          Noms de lieux :{' '}
          <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">
            GeoNames
          </a>
          , licence CC BY 4.0. Code source sur{' '}
          <a href={REPOSITORY_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
          .
        </p>
      </div>
    </section>
  );
}
