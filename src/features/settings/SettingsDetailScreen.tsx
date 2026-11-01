import type { ReactNode } from 'react';
import { Link, Redirect, useParams } from 'wouter';
import { useData } from '../../data/dataContext.ts';
import { localized } from '../../lib/i18n.ts';
import common from '../../ui/common.module.css';
import { BackIcon } from '../../ui/icons.tsx';
import { ScreenHeader } from '../../ui/ScreenHeader.tsx';
import albumStyles from '../albums/AlbumScreen.module.css';
import { AboutSection } from './AboutSection.tsx';
import { AccountSection } from './AccountSection.tsx';
import { ContentSection } from './ContentSection.tsx';
import { DataSection } from './DataSection.tsx';
import { EditsSection } from './EditsSection.tsx';
import { MemoriesNotificationSection } from './MemoriesNotificationSection.tsx';
import { OfflineSection } from './OfflineSection.tsx';
import { PermissionsSection } from './PermissionsSection.tsx';
import styles from './SettingsDetailScreen.module.css';
import { SyncSection } from './SyncSection.tsx';
import { ThumbnailCacheSection } from './ThumbnailCacheSection.tsx';

const t = localized({
  fr: {
    back: 'Retour aux réglages',
    sync: 'Favoris et synchro',
    content: 'Recherche photos',
    edits: 'Modifications',
    memories: 'Souvenirs',
    account: 'Compte',
    device: 'Sur cet appareil',
    data: 'Données',
    about: 'À propos',
  },
  en: {
    back: 'Back to the settings',
    sync: 'Favourites and sync',
    content: 'Photo search',
    edits: 'Changes',
    memories: 'Memories',
    account: 'Account',
    device: 'On this device',
    data: 'Data',
    about: 'About',
  },
});

/** Each screen's title, short enough for one line at 360 px beside the back button and a chip. */
const SCREENS: Record<string, { title: string; single: boolean; body: () => ReactNode }> = {
  synchronisation: { title: t.sync, single: true, body: () => <SyncSection /> },
  recherche: { title: t.content, single: true, body: () => <ContentSection /> },
  modifications: { title: t.edits, single: true, body: () => <EditsSection /> },
  souvenirs: { title: t.memories, single: true, body: () => <MemoriesNotificationSection /> },
  compte: { title: t.account, single: false, body: () => <AccountScreen /> },
  appareil: {
    title: t.device,
    single: false,
    body: () => (
      <>
        <OfflineSection />
        <ThumbnailCacheSection />
      </>
    ),
  },
  donnees: { title: t.data, single: true, body: () => <DataSection /> },
  'a-propos': { title: t.about, single: true, body: () => <AboutSection /> },
};

function AccountScreen() {
  const { mode, signedIn } = useData();
  return (
    <>
      {mode === 'onedrive' && <AccountSection />}
      {mode === 'onedrive' && signedIn && <PermissionsSection />}
    </>
  );
}

/** One setting on a screen of its own: its explanation, its state, its actions. */
export function SettingsDetailScreen() {
  const { section } = useParams<{ section: string }>();
  const screen = Object.hasOwn(SCREENS, section) ? SCREENS[section] : undefined;
  if (!screen) return <Redirect to="/reglages" replace />;
  return (
    <>
      <ScreenHeader
        title={screen.title}
        leading={
          <Link href="/reglages" className={albumStyles.back} aria-label={t.back}>
            <BackIcon />
          </Link>
        }
      />
      <div className={`${common.page} ${screen.single ? styles.single : ''}`}>{screen.body()}</div>
    </>
  );
}
