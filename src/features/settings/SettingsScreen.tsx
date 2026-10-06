import { Link } from 'wouter';
import { useData } from '../../data/dataContext.ts';
import { isDemoForced, leaveDemoMode } from '../../data/mode.ts';
import { formatCount, formatDateTime } from '../../lib/format.ts';
import { useThemePreference, type ThemePreference } from '../../lib/theme.ts';
import common from '../../ui/common.module.css';
import { ScreenHeader } from '../../ui/ScreenHeader.tsx';
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
  const { mode, state, sync, refresh, resetIndex } = useData();
  const index = state.status === 'ready' ? state.index : null;

  const confirmReset = () => {
    if (window.confirm('Tout réindexer ? Le premier chargement reprendra depuis le début.')) {
      void resetIndex();
    }
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
                  <dd role="status">
                    {sync.status === 'running'
                      ? `en cours${sync.progress ? ` (${formatCount(sync.progress.loaded)})` : '…'}`
                      : sync.status === 'error'
                        ? 'échec'
                        : sync.lastSyncAt
                          ? formatDateTime(sync.lastSyncAt)
                          : '—'}
                  </dd>
                </>
              )}
            </dl>
            {sync.status === 'error' && sync.message && (
              <p className={common.muted}>{sync.message}</p>
            )}
            {mode === 'onedrive' && (
              <>
                <button
                  type="button"
                  className={common.buttonSoft}
                  onClick={() => {
                    refresh();
                    void checkForUpdate({ quiet: true });
                  }}
                  disabled={sync.status === 'running' || state.status !== 'ready'}
                >
                  Mettre à jour maintenant
                </button>
                <button type="button" className={common.buttonSoft} onClick={confirmReset}>
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
