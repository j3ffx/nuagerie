import '@fontsource-variable/nunito/wght.css';
import '../styles/tokens.css';
import '../styles/global.css';

import type { AccountInfo } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import { useState } from 'react';
import { Redirect, Route, Router, Switch } from 'wouter';
import { getAccessToken, getMsal } from '../auth/msal.ts';
import { DataProvider } from '../data/DataProvider.tsx';
import { createDemoSource } from '../data/demo/demoSource.ts';
import { createOneDriveSource } from '../data/onedrive/onedriveSource.ts';
import type { DataMode, DataSource } from '../data/source.ts';
import { AlbumScreen } from '../features/albums/AlbumScreen.tsx';
import { AlbumsScreen } from '../features/albums/AlbumsScreen.tsx';
import { ChooseAlbumsScreen } from '../features/albums/ChooseAlbumsScreen.tsx';
import { AllFilterScreen } from '../features/all/AllFilterScreen.tsx';
import { AllScreen } from '../features/all/AllScreen.tsx';
import { DiagnosticScreen } from '../features/diagnostic/DiagnosticScreen.tsx';
import { MapScreen } from '../features/map/MapScreen.tsx';
import { ZoneScreen } from '../features/map/ZoneScreen.tsx';
import { SettingsScreen } from '../features/settings/SettingsScreen.tsx';
import { SignInScreen } from '../features/welcome/SignInScreen.tsx';
import { useApplyTheme } from '../lib/theme.ts';
import styles from './App.module.css';
import { NavBar } from './NavBar.tsx';
import { UpdateBanner } from './UpdateBanner.tsx';
import { scrollToTopOnNewScreen } from './navigation.ts';

export function App({
  mode,
  account,
  authError,
}: {
  mode: DataMode;
  account: AccountInfo | null;
  authError: string | null;
}) {
  useApplyTheme();

  if (mode === 'demo') return <Data mode="demo" create={createDemoSource} />;

  return (
    <MsalProvider instance={getMsal()}>
      {account ? (
        <Data
          mode="onedrive"
          create={() =>
            createOneDriveSource({ accountId: account.homeAccountId, getToken: getAccessToken })
          }
        />
      ) : (
        <SignInScreen error={authError} />
      )}
    </MsalProvider>
  );
}

function Data({ mode, create }: { mode: DataMode; create: () => DataSource }) {
  const [source] = useState(create);
  return (
    <DataProvider mode={mode} source={source}>
      <Router aroundNav={scrollToTopOnNewScreen}>
        <Shell />
      </Router>
    </DataProvider>
  );
}

function Shell() {
  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main">
        Aller au contenu
      </a>
      <NavBar />
      <UpdateBanner />
      <main id="main" className={styles.main}>
        <Switch>
          <Route path="/" component={AlbumsScreen} />
          <Route path="/albums/choisir" component={ChooseAlbumsScreen} />
          <Route path="/album/:id" component={AlbumScreen} />
          <Route path="/tout" component={AllScreen} />
          <Route path="/tout/filtre" component={AllFilterScreen} />
          <Route path="/carte" component={MapScreen} />
          <Route path="/carte/zone" component={ZoneScreen} />
          <Route path="/reglages" component={SettingsScreen} />
          <Route path="/diagnostic" component={DiagnosticScreen} />
          <Route>
            <Redirect to="/" replace />
          </Route>
        </Switch>
      </main>
    </div>
  );
}
