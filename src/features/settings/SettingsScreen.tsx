import { useAccount } from '@azure/msal-react';
import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { useUpdateState } from '../../app/updates.ts';
import { analysisComplete } from '../../data/content/contentSearch.ts';
import { useData } from '../../data/dataContext.ts';
import { isDemoForced, leaveDemoMode } from '../../data/mode.ts';
import { folderName, useRootPaths } from '../../data/roots.ts';
import { useSync, type SyncStatus } from '../../data/sync/syncContext.ts';
import { formatCount } from '../../lib/format.ts';
import { localized, type LanguagePreference } from '../../lib/i18n.ts';
import { useLanguagePreference } from '../../lib/languagePreference.ts';
import { useThemePreference, type ThemePreference } from '../../lib/theme.ts';
import common from '../../ui/common.module.css';
import { ChevronIcon } from '../../ui/icons.tsx';
import { ScreenHeader } from '../../ui/ScreenHeader.tsx';
import { useContentSearch } from '../content/contentContext.ts';
import { useEdits } from '../edits/editsContext.ts';
import { memoriesNotificationAvailable, memoriesNotificationOn } from './memoriesNotification.ts';
import styles from './SettingsScreen.module.css';

const t = localized({
  fr: {
    auto: 'Automatique',
    light: 'Clair',
    dark: 'Sombre',
    title: 'Réglages',
    appearance: 'Apparence',
    theme: 'Thème',
    language: 'Langue',
    demoNote: 'Tu es dans la démo : des photos factices, et rien ne sort de cet appareil.',
    leaveDemo: 'Quitter la démo',
    photos: 'Mes photos',
    chooseFolders: 'Choisir les dossiers',
    chooseAlbums: 'Choisir les albums',
    chooseAlbumsDetail: 'Ceux qui s’affichent dans Albums',
    options: 'Options',
    readOnlyNote: 'Par défaut, Nuagerie ne fait que lire ton OneDrive.',
    on: 'Activée',
    off: 'Désactivée',
    needsSignIn: 'Connexion nécessaire',
    permissionToGrant: 'Permission à accorder',
    sync: 'Favoris et synchronisation',
    syncStatus: {
      off: 'Désactivée, sans elle pas de favoris',
      syncing: 'En cours…',
      ok: 'À jour',
      offline: 'En attente du réseau',
      error: 'Échec',
    },
    onDevice: 'Sur cet appareil',
    content: 'Recherche dans les photos',
    contentReady: 'Prête',
    contentAnalysing: (done: string, total: string) => `Analyse en cours : ${done} / ${total}`,
    contentDone: (done: string, total: string) => `${done} photos analysées sur ${total}`,
    edits: 'Modifications',
    editsOn: 'Activées',
    editsOff: 'Désactivées',
    memories: 'Notification de souvenirs',
    memoriesNo: 'Non disponible ici',
    account: 'Compte',
    microsoftAccount: 'Compte Microsoft',
    accountOn: 'Connecté',
    accountOff: 'Non connecté',
    app: 'Application',
    device: 'Sur cet appareil',
    deviceDetail: 'Albums hors connexion, miniatures',
    data: 'Données',
    dataDetail: (count: string) => `${count} photos et vidéos lues dans OneDrive`,
    about: 'À propos',
    version: (version: string) => `Version ${version}`,
    updateReady: (version: string) => `Version ${version} · nouvelle version prête`,
  },
  en: {
    auto: 'Automatic',
    light: 'Light',
    dark: 'Dark',
    title: 'Settings',
    appearance: 'Appearance',
    theme: 'Theme',
    language: 'Language',
    demoNote: 'You are in the demo: made-up photos, and nothing leaves this device.',
    leaveDemo: 'Leave the demo',
    photos: 'My photos',
    chooseFolders: 'Choose the folders',
    chooseAlbums: 'Choose the albums',
    chooseAlbumsDetail: 'Those shown in Albums',
    options: 'Options',
    readOnlyNote: 'By default, Nuagerie only reads your OneDrive.',
    on: 'On',
    off: 'Off',
    needsSignIn: 'Sign-in needed',
    permissionToGrant: 'Permission to grant',
    sync: 'Favourites and sync',
    syncStatus: {
      off: 'Off, and no favourites without it',
      syncing: 'In progress…',
      ok: 'Up to date',
      offline: 'Waiting for the network',
      error: 'Failed',
    },
    onDevice: 'On this device',
    content: 'Search in the photos',
    contentReady: 'Ready',
    contentAnalysing: (done: string, total: string) => `Analysis under way: ${done} / ${total}`,
    contentDone: (done: string, total: string) => `${done} photos analysed out of ${total}`,
    edits: 'Changes',
    editsOn: 'On',
    editsOff: 'Off',
    memories: 'Memories notification',
    memoriesNo: 'Not available here',
    account: 'Account',
    microsoftAccount: 'Microsoft account',
    accountOn: 'Signed in',
    accountOff: 'Not signed in',
    app: 'App',
    device: 'On this device',
    deviceDetail: 'Offline albums, thumbnails',
    data: 'Data',
    dataDetail: (count: string) => `${count} photos and videos read from OneDrive`,
    about: 'About',
    version: (version: string) => `Version ${version}`,
    updateReady: (version: string) => `Version ${version} · new version ready`,
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

/** One line of the settings: what it is, how it stands, and the way in. */
function Row({ href, title, status }: { href: string; title: string; status: string }) {
  return (
    <li>
      <Link href={href} className={styles.row}>
        <span className={styles.rowText}>
          <span className={styles.rowTitle}>
            {title}
            <span className="hidden-inline">, </span>
          </span>
          <span className={styles.rowStatus}>{status}</span>
        </span>
        <ChevronIcon className={styles.rowChevron} width={20} height={20} aria-hidden="true" />
      </Link>
    </li>
  );
}

function Group({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note?: string | null;
  children: React.ReactNode;
}) {
  return (
    <section className={common.section} aria-labelledby={id}>
      <h2 id={id} className={common.sectionTitle}>
        {title}
      </h2>
      {note && <p className={`${common.muted} ${styles.note}`}>{note}</p>}
      <ul className={styles.rows}>{children}</ul>
    </section>
  );
}

function useSyncLine(): string {
  const sync = useSync();
  const { mode } = useData();
  if (mode === 'demo') return t.onDevice;
  if (!sync.available) return t.needsSignIn;
  const labels: Record<SyncStatus, string> = {
    off: t.syncStatus.off,
    syncing: t.syncStatus.syncing,
    ok: t.syncStatus.ok,
    offline: t.syncStatus.offline,
    'needs-permission': t.permissionToGrant,
    error: t.syncStatus.error,
  };
  return labels[sync.status];
}

function useContentLine(): string {
  const { state } = useContentSearch();
  const done = formatCount(state.done);
  const total = formatCount(state.total);
  if (!state.enabled) return t.off;
  if (state.analysing) return t.contentAnalysing(done, total);
  return analysisComplete(state) ? t.contentReady : t.contentDone(done, total);
}

function useEditsLine(): string {
  const edits = useEdits();
  if (!edits.available) return t.needsSignIn;
  if (edits.status === 'off') return t.editsOff;
  return edits.status === 'needs-permission' ? t.permissionToGrant : t.editsOn;
}

function useMemoriesLine(): string {
  const { mode } = useData();
  const available = mode !== 'demo' && memoriesNotificationAvailable();
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    if (!available) return;
    let live = true;
    memoriesNotificationOn().then(
      (value) => live && setOn(value),
      () => live && setOn(false),
    );
    return () => {
      live = false;
    };
  }, [available]);
  if (!available) return t.memoriesNo;
  return on === null ? '…' : on ? t.on : t.off;
}

/**
 * The settings at a glance: each line says how something stands and leads to a screen of its
 * own (SettingsDetailScreen), so that nothing here needs explaining. Only the look of the app,
 * which is one tap each, is changed from here.
 */
export function SettingsScreen() {
  const [theme, setTheme] = useThemePreference();
  const [language, setLanguage] = useLanguagePreference();
  const { mode, signedIn, state } = useData();
  const roots = useRootPaths();
  const account = useAccount();
  const sync = useSync();
  const edits = useEdits();
  const { status: updateStatus } = useUpdateState();
  const syncLine = useSyncLine();
  const contentLine = useContentLine();
  const editsLine = useEditsLine();
  const memoriesLine = useMemoriesLine();
  const index = state.status === 'ready' ? state.index : null;
  const readOnly = mode === 'onedrive' && !sync.enabled && edits.status === 'off';

  return (
    <>
      <ScreenHeader title={t.title} />
      <div className={common.page}>
        {mode === 'demo' && (
          <div className={`${common.card} ${common.stack} ${styles.demo}`}>
            <p>{t.demoNote}</p>
            {!isDemoForced() && (
              <button type="button" className={common.buttonSoft} onClick={leaveDemoMode}>
                {t.leaveDemo}
              </button>
            )}
          </div>
        )}

        <section className={common.section} aria-labelledby="settings-appearance">
          <h2 id="settings-appearance" className={common.sectionTitle}>
            {t.appearance}
          </h2>
          <div className={`${common.card} ${common.stack}`}>
            <div className={styles.choice}>
              <span id="settings-theme" className={styles.choiceLabel}>
                {t.theme}
              </span>
              <fieldset className={common.segmented} aria-labelledby="settings-theme">
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
            <div className={styles.choice}>
              <span id="settings-language" className={styles.choiceLabel}>
                {t.language}
              </span>
              <fieldset className={common.segmented} aria-labelledby="settings-language">
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
          </div>
        </section>

        <Group id="settings-photos" title={t.photos}>
          <Row
            href="/reglages/dossiers"
            title={t.chooseFolders}
            status={roots.map(folderName).join(', ')}
          />
          <Row
            href="/albums/choisir?retour=reglages"
            title={t.chooseAlbums}
            status={t.chooseAlbumsDetail}
          />
        </Group>

        <Group id="settings-options" title={t.options} note={readOnly ? t.readOnlyNote : null}>
          <Row href="/reglages/synchronisation" title={t.sync} status={syncLine} />
          <Row href="/reglages/recherche" title={t.content} status={contentLine} />
          <Row href="/reglages/modifications" title={t.edits} status={editsLine} />
          <Row href="/reglages/souvenirs" title={t.memories} status={memoriesLine} />
        </Group>

        {mode === 'onedrive' && (
          <Group id="settings-account" title={t.account}>
            <Row
              href="/reglages/compte"
              title={t.microsoftAccount}
              status={signedIn ? (account?.name ?? account?.username ?? t.accountOn) : t.accountOff}
            />
          </Group>
        )}

        <Group id="settings-app" title={t.app}>
          <Row href="/reglages/appareil" title={t.device} status={t.deviceDetail} />
          {index && (
            <Row
              href="/reglages/donnees"
              title={t.data}
              status={t.dataDetail(formatCount(index.items.length))}
            />
          )}
          <Row
            href="/reglages/a-propos"
            title={t.about}
            status={
              updateStatus === 'ready' ? t.updateReady(__APP_VERSION__) : t.version(__APP_VERSION__)
            }
          />
        </Group>
      </div>
    </>
  );
}
