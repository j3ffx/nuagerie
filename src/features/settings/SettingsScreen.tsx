import { Link } from 'wouter';
import { useData } from '../../data/dataContext.ts';
import { isDemoForced, leaveDemoMode } from '../../data/mode.ts';
import { folderName, useRootPaths } from '../../data/roots.ts';
import { formatCount, formatDateTime } from '../../lib/format.ts';
import { useOnline } from '../../lib/online.ts';
import { localized, type LanguagePreference } from '../../lib/i18n.ts';
import { useLanguagePreference } from '../../lib/languagePreference.ts';
import { useThemePreference, type ThemePreference } from '../../lib/theme.ts';
import common from '../../ui/common.module.css';
import { ScreenHeader } from '../../ui/ScreenHeader.tsx';
import { useConfirm } from '../../ui/confirmContext.ts';
import { checkForUpdate } from '../../app/updates.ts';
import { AboutSection } from './AboutSection.tsx';
import { AccountSection } from './AccountSection.tsx';
import { MemoriesNotificationSection } from './MemoriesNotificationSection.tsx';
import { OfflineSection } from './OfflineSection.tsx';
import { PermissionsSection } from './PermissionsSection.tsx';
import { SyncSection } from './SyncSection.tsx';
import { ThumbnailCacheSection } from './ThumbnailCacheSection.tsx';

const t = localized({
  fr: {
    auto: 'Automatique',
    light: 'Clair',
    dark: 'Sombre',
    resetTitle: 'Tout réindexer ?',
    resetMessage:
      'Nuagerie relit tout le contenu de OneDrive, ce qui prend environ une minute. Les miniatures déjà gardées restent.',
    resetConfirm: 'Réindexer',
    title: 'Réglages',
    appearance: 'Apparence',
    theme: 'Thème',
    language: 'Langue',
    photos: 'Photos',
    folders: 'Dossiers',
    folder: 'Dossier',
    chooseFolders: 'Choisir les dossiers',
    chooseAlbums: 'Choisir les albums',
    data: 'Données',
    source: 'Source',
    demo: 'Démo (photos factices)',
    items: 'Éléments',
    shownIn: 'Affiché en',
    update: 'Mise à jour',
    offline: 'hors connexion',
    paused: 'en pause',
    running: (progress: string) => `en cours${progress}`,
    failed: 'échec',
    updateNow: 'Mettre à jour maintenant',
    reindex: 'Relancer l’indexation complète',
    diagnostic: 'Diagnostic de l’index',
    leaveDemo: 'Quitter la démo',
  },
  en: {
    auto: 'Automatic',
    light: 'Light',
    dark: 'Dark',
    resetTitle: 'Reindex everything?',
    resetMessage:
      'Nuagerie reads all of OneDrive again, which takes about a minute. The thumbnails already kept stay.',
    resetConfirm: 'Reindex',
    title: 'Settings',
    appearance: 'Appearance',
    theme: 'Theme',
    language: 'Language',
    photos: 'Photos',
    folders: 'Folders',
    folder: 'Folder',
    chooseFolders: 'Choose the folders',
    chooseAlbums: 'Choose the albums',
    data: 'Data',
    source: 'Source',
    demo: 'Demo (made-up photos)',
    items: 'Items',
    shownIn: 'Shown in',
    update: 'Update',
    offline: 'offline',
    paused: 'paused',
    running: (progress: string) => `in progress${progress}`,
    failed: 'failed',
    updateNow: 'Update now',
    reindex: 'Run the full indexing again',
    diagnostic: 'Index diagnostic',
    leaveDemo: 'Leave the demo',
  },
});

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'auto', label: t.auto },
  { value: 'light', label: t.light },
  { value: 'dark', label: t.dark },
];

/** Each language in its own words: whoever does not read this one finds theirs. */
const LANGUAGES: { value: LanguagePreference; label: string; lang?: string }[] = [
  { value: 'auto', label: t.auto },
  { value: 'fr', label: 'Français', lang: 'fr' },
  { value: 'en', label: 'English', lang: 'en' },
];

export function SettingsScreen() {
  const [theme, setTheme] = useThemePreference();
  const [language, setLanguage] = useLanguagePreference();
  const { mode, signedIn, state, sync, refresh, resetIndex } = useData();
  const online = useOnline();
  const roots = useRootPaths();
  const index = state.status === 'ready' ? state.index : null;
  const confirm = useConfirm();

  const confirmReset = async () => {
    const answer = await confirm({
      title: t.resetTitle,
      message: t.resetMessage,
      confirmLabel: t.resetConfirm,
    });
    if (answer) void resetIndex();
  };

  return (
    <>
      <ScreenHeader title={t.title} />
      <div className={common.page}>
        <section className={common.section} aria-labelledby="settings-appearance">
          <h2 id="settings-appearance" className={common.sectionTitle}>
            {t.appearance}
          </h2>
          <div className={`${common.card} ${common.stack}`}>
            <fieldset className={common.segmented}>
              <legend className="visually-hidden">{t.theme}</legend>
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
            <fieldset className={common.segmented}>
              <legend className="visually-hidden">{t.language}</legend>
              {LANGUAGES.map(({ value, label, lang }) => (
                <label key={value} lang={lang}>
                  <input
                    type="radio"
                    name="language"
                    value={value}
                    checked={language === value}
                    onChange={() => setLanguage(value)}
                  />
                  {label}
                </label>
              ))}
            </fieldset>
          </div>
        </section>

        {mode === 'onedrive' && <AccountSection />}
        {mode === 'onedrive' && signedIn && <PermissionsSection />}

        <section className={common.section} aria-labelledby="settings-photos">
          <h2 id="settings-photos" className={common.sectionTitle}>
            {t.photos}
          </h2>
          <div className={`${common.card} ${common.stack}`}>
            <dl className={common.definitionList}>
              <dt>{roots.length > 1 ? t.folders : t.folder}</dt>
              <dd>{roots.map(folderName).join(', ')}</dd>
            </dl>
            <Link href="/reglages/dossiers" className={common.buttonSoft}>
              {t.chooseFolders}
            </Link>
            <Link href="/albums/choisir?retour=reglages" className={common.buttonSoft}>
              {t.chooseAlbums}
            </Link>
          </div>
        </section>

        <SyncSection />

        <MemoriesNotificationSection />

        <section className={common.section} aria-labelledby="settings-data">
          <h2 id="settings-data" className={common.sectionTitle}>
            {t.data}
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
              {state.status === 'ready' && (
                <>
                  <dt>{t.shownIn}</dt>
                  <dd>{formatCount(Math.round(state.loadedInMs))} ms</dd>
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
                            ? t.running(
                                sync.progress ? ` (${formatCount(sync.progress.loaded)})` : '…',
                              )
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
            {mode === 'demo' && !isDemoForced() && (
              <button type="button" className={common.buttonSoft} onClick={leaveDemoMode}>
                {t.leaveDemo}
              </button>
            )}
          </div>
        </section>

        <OfflineSection />

        <ThumbnailCacheSection />

        <AboutSection />
      </div>
    </>
  );
}
