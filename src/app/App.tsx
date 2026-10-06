import '@fontsource-variable/nunito/wght.css';
import '../styles/tokens.css';
import '../styles/global.css';

import { Redirect, Route, Switch } from 'wouter';
import { useData } from '../data/dataContext.ts';
import { DataProvider } from '../data/DataProvider.tsx';
import { AlbumsScreen } from '../features/albums/AlbumsScreen.tsx';
import { AllScreen } from '../features/all/AllScreen.tsx';
import { MapScreen } from '../features/map/MapScreen.tsx';
import { SettingsScreen } from '../features/settings/SettingsScreen.tsx';
import { WelcomeScreen } from '../features/welcome/WelcomeScreen.tsx';
import { useApplyTheme } from '../lib/theme.ts';
import styles from './App.module.css';
import { NavBar } from './NavBar.tsx';

export function App() {
  useApplyTheme();
  return (
    <DataProvider>
      <Shell />
    </DataProvider>
  );
}

function Shell() {
  const { state } = useData();
  if (state.status === 'unavailable') return <WelcomeScreen />;

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main">
        Aller au contenu
      </a>
      <NavBar />
      <main id="main" className={styles.main}>
        <Switch>
          <Route path="/" component={AlbumsScreen} />
          <Route path="/tout" component={AllScreen} />
          <Route path="/carte" component={MapScreen} />
          <Route path="/reglages" component={SettingsScreen} />
          <Route>
            <Redirect to="/" replace />
          </Route>
        </Switch>
      </main>
    </div>
  );
}
