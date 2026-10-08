import { Link } from 'wouter';
import { useData } from '../../data/dataContext.ts';
import { isDemoForced, leaveDemoMode } from '../../data/mode.ts';
import { folderName, useRootPaths } from '../../data/roots.ts';
import { formatCount, formatDateTime } from '../../lib/format.ts';
import { useOnline } from '../../lib/online.ts';
import { useThemePreference, type ThemePreference } from '../../lib/theme.ts';
import common from '../../ui/common.module.css';
import { ScreenHeader } from '../../ui/ScreenHeader.tsx';
import { useConfirm } from '../../ui/confirmContext.ts';
import { checkForUpdate } from '../../app/updates.ts';
import { AboutSection } from './AboutSection.tsx';
import { AccountSection } from './AccountSection.tsx';
import { ThumbnailCacheSection } from './ThumbnailCacheSection.tsx';

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'auto', label: 'Automatique' },
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
];

export function SettingsScreen() {
  const [theme, setTheme] = useThemePreference();
  const { mode, signedIn, state, sync, refresh, resetIndex } = useData();
  const online = useOnline();
  const roots = useRootPaths();
  const index = state.status === 'ready' ? state.index : null;
  const confirm = useConfirm();

  const confirmReset = async () => {
    const answer = await confirm({
      title: 'Tout réindexer ?',
      message:
        'Nuagerie relit tout le contenu de OneDrive, ce qui prend environ une minute. Les miniatures déjà gardées restent.',
      confirmLabel: 'Réindexer',
    });
    if (answer) void resetIndex();
  };

  return (
    <>
      <ScreenHeader title="Réglages" />
      <div className={common.page}>
        <section className={common.section} aria-labelledby="settings-appearance">
          <h2 id="settings-appearance" className={common.sectionTitle}>
            Apparence
          </h2>
          <div className={common.card}>
            <fieldset className={common.segmented}>
              <legend className="visually-hidden">Thème</legend>
              {THEMES.map(({ value, label }) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="theme"
                    value={value}
                    checked={theme === value}
                    onChange={() => setTheme(value)}
                  />
                  {label}
                </label>
              ))}
            </fieldset>
          </div>
        </section>

        {mode === 'onedrive' && <AccountSection />}

        <section className={common.section} aria-labelledby="settings-photos">
          <h2 id="settings-photos" className={common.sectionTitle}>
            Photos
          </h2>
          <div className={`${common.card} ${common.stack}`}>
            <dl className={common.definitionList}>
              <dt>{roots.length > 1 ? 'Dossiers' : 'Dossier'}</dt>
              <dd>{roots.map(folderName).join(', ')}</dd>
            </dl>
            <Link href="/reglages/dossiers" className={common.buttonSoft}>
              Choisir les dossiers
            </Link>
            <Link href="/albums/choisir?retour=reglages" className={common.buttonSoft}>
              Choisir les albums
            </Link>
          </div>
        </section>

        <section className={common.section} aria-labelledby="settings-data">
          <h2 id="settings-data" className={common.sectionTitle}>
            Données
          </h2>
          <div className={`${common.card} ${common.stack}`}>
            <dl className={common.definitionList}>
              <dt>Source</dt>
              <dd>{mode === 'demo' ? 'Démo (photos factices)' : 'OneDrive'}</dd>
              {index && (
                <>
                  <dt>Éléments</dt>
                  <dd>{formatCount(index.items.length)}</dd>
                  <dt>Dossiers</dt>
                  <dd>{formatCount(index.folders.size)}</dd>
                </>
              )}
              {state.status === 'ready' && (
                <>
                  <dt>Affiché en</dt>
                  <dd>{formatCount(Math.round(state.loadedInMs))} ms</dd>
                </>
              )}
              {mode === 'onedrive' && (
                <>
                  <dt>Mise à jour</dt>
                  <dd>
                    <span role="status">
                      {!online
                        ? 'hors connexion'
                        : !signedIn
                          ? 'en pause'
                          : sync.status === 'running'
                            ? `en cours${sync.progress ? ` (${formatCount(sync.progress.loaded)})` : '…'}`
                            : sync.status === 'error'
                              ? 'échec'
                              : sync.lastSyncAt
                                ? formatDateTime(sync.lastSyncAt)
                                : '—'}
                    </span>
                  </dd>
                </>
              )}
            </dl>
            {sync.status === 'error' && sync.message && (
              <p className={common.muted}>{sync.message}</p>
            )}
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
                  Mettre à jour maintenant
                </button>
                <button
                  type="button"
                  className={common.buttonSoft}
                  onClick={() => void confirmReset()}
                  disabled={!online}
                >
                  Relancer l’indexation complète
                </button>
                <Link href="/diagnostic" className={common.buttonSoft}>
                  Diagnostic de l’index
                </Link>
              </>
            )}
            {mode === 'demo' && !isDemoForced() && (
              <button type="button" className={common.buttonSoft} onClick={leaveDemoMode}>
                Quitter la démo
              </button>
            )}
          </div>
        </section>

        <ThumbnailCacheSection />

        <AboutSection />
      </div>
    </>
  );
}
