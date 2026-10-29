import {
  applyUpdate,
  checkForUpdate,
  useUpdateState,
  type UpdateStatus,
} from '../../app/updates.ts';
import { Link } from 'wouter';
import { latestLabel } from '../../app/latestVersion.ts';
import { useData } from '../../data/dataContext.ts';
import { issueUrl, REPOSITORY_URL } from '../../lib/report.ts';
import common from '../../ui/common.module.css';
import { localized } from '../../lib/i18n.ts';

const t = localized({
  fr: {
    status: {
      checking: 'recherche…',
      upToDate: 'à jour',
      downloading: 'téléchargement…',
      ready: 'prête à installer',
      error: 'vérification impossible',
    },
    about: 'À propos',
    version: 'Version',
    update: 'Mise à jour',
    install: 'Installer la nouvelle version',
    check: 'Rechercher une mise à jour',
    news: 'Nouveautés',
    report: 'Signaler un problème',
    reportNote:
      'Ouvre GitHub (compte nécessaire), avec la version et le type d’appareil, rien de personnel.',
    places: 'Noms de lieux :',
    licence: ', licence CC BY 4.0. Code source sur',
  },
  en: {
    status: {
      checking: 'checking…',
      upToDate: 'up to date',
      downloading: 'downloading…',
      ready: 'ready to install',
      error: 'cannot check',
    },
    about: 'About',
    version: 'Version',
    update: 'Update',
    install: 'Install the new version',
    check: 'Check for an update',
    news: 'What’s new',
    report: 'Report a problem',
    reportNote:
      'Opens GitHub (an account is needed), with the version and the kind of device, nothing personal.',
    places: 'Place names:',
    licence: ', CC BY 4.0 licence. Source code on',
  },
});

const STATUS_LABELS: Record<UpdateStatus, string> = {
  idle: '—',
  checking: t.status.checking,
  'up-to-date': t.status.upToDate,
  downloading: t.status.downloading,
  ready: t.status.ready,
  error: t.status.error,
};

/** Version of the app, what is new, manual update check, and where to report a problem. */
export function AboutSection() {
  const { status, latest } = useUpdateState();
  const label = latestLabel(latest, { version: __APP_VERSION__, commit: __APP_COMMIT__ });
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
        {t.about}
      </h2>
      <div className={`${common.card} ${common.stack}`}>
        <dl className={common.definitionList}>
          <dt>{t.version}</dt>
          <dd>
            {__APP_VERSION__}
            {__APP_COMMIT__ && ` (${__APP_COMMIT__})`}
          </dd>
          <dt>{t.update}</dt>
          <dd>
            <span role="status">
              {STATUS_LABELS[status]}
              {label && status !== 'up-to-date' ? ` · ${label}` : ''}
            </span>
          </dd>
        </dl>
        {status === 'ready' ? (
          <button type="button" className={common.button} onClick={applyUpdate}>
            {t.install}
          </button>
        ) : (
          <button
            type="button"
            className={common.buttonSoft}
            onClick={() => void checkForUpdate()}
            disabled={busy}
          >
            {t.check}
          </button>
        )}
        <Link href="/nouveautes?retour=%2Freglages" className={common.buttonSoft}>
          {t.news}
        </Link>
        <a
          href={report()}
          target="_blank"
          rel="noreferrer"
          className={common.buttonSoft}
          aria-describedby="report-note"
        >
          {t.report}
        </a>
        <p id="report-note" className={common.muted}>
          {t.reportNote}
        </p>
        <p className={common.muted}>
          {t.places}{' '}
          <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">
            GeoNames
          </a>
          {t.licence}{' '}
          <a href={REPOSITORY_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
          .
        </p>
      </div>
    </section>
  );
}
