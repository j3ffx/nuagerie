import type { AccountInfo } from '@azure/msal-browser';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App.tsx';
import { initUpdates } from './app/updates.ts';
import { initTouch } from './app/touch.ts';
import { initWhatsNew } from './app/whatsNew.ts';
import { language, localized } from './lib/i18n.ts';
import { applyStoredTheme } from './lib/theme.ts';
import { rememberLanguage } from './data/memoryNotifier.ts';
import { hasSignedInBefore, initAuth, REDIRECT_PATH } from './auth/msal.ts';
import { newHome } from './app/home.ts';
import { resolveDataMode } from './data/mode.ts';
import { PRIVACY_PATH, PrivacyScreen } from './features/privacy/PrivacyScreen.tsx';
import { ConnectingScreen } from './features/welcome/SignInScreen.tsx';

const t = localized({
  fr: {
    description:
      'Nuagerie, la galerie de tes photos OneDrive, rangées par albums, par date et par lieu.',
  },
  en: { description: 'Nuagerie, the gallery of your OneDrive photos, by album, date and place.' },
});

async function start() {
  // The chosen theme and language from the first screen (the redirect bridge included).
  applyStoredTheme();
  document.documentElement.lang = language;
  document.querySelector('meta[name="description"]')?.setAttribute('content', t.description);
  // MSAL v5 redirect bridge: hands the sign-in response back to the app, renders nothing.
  if (window.location.pathname === REDIRECT_PATH) {
    const { broadcastResponseToMainFrame } = await import('@azure/msal-browser/redirect-bridge');
    try {
      await broadcastResponseToMainFrame();
    } catch {
      window.location.replace('/');
    }
    return;
  }

  // The app moved to its own address: with nothing kept here yet, go there now (whoever has
  // photos here is told by a banner, src/app/MovedBanner.tsx).
  const home = newHome();
  if (home && !hasSignedInBefore()) {
    window.location.replace(home);
    return;
  }

  // Production only (no service worker in dev, so hot reload is never stale).
  initUpdates();
  initWhatsNew();
  initTouch();
  // The memories notification speaks the app's language (src/sw.ts).
  rememberLanguage(language).catch(() => undefined);

  const element = document.getElementById('root');
  if (!element) throw new Error('Missing #root element');
  const root = createRoot(element);

  // Readable by anyone, signed in or not (the privacy statement given to Microsoft).
  if (window.location.pathname === PRIVACY_PATH) {
    root.render(
      <StrictMode>
        <PrivacyScreen />
      </StrictMode>,
    );
    return;
  }

  const mode = resolveDataMode();
  let account: AccountInfo | null = null;
  let unreachable = false;
  let authError: string | null = null;
  if (mode === 'onedrive') {
    root.render(<ConnectingScreen />);
    try {
      ({ account, offline: unreachable } = await initAuth());
    } catch (error) {
      authError = error instanceof Error ? error.message : String(error);
    }
  }
  // Offline (or Microsoft out of reach) with no session to restore: show the index kept on
  // the device.
  const offline = mode === 'onedrive' && !account && unreachable && hasSignedInBefore();

  root.render(
    <StrictMode>
      <App mode={mode} account={account} offline={offline} authError={authError} />
    </StrictMode>,
  );
}

void start();
