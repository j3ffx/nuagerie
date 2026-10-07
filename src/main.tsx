import type { AccountInfo } from '@azure/msal-browser';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App.tsx';
import { initUpdates } from './app/updates.ts';
import { initWhatsNew } from './app/whatsNew.ts';
import { hasSignedInBefore, initAuth, REDIRECT_PATH } from './auth/msal.ts';
import { resolveDataMode } from './data/mode.ts';
import { ConnectingScreen } from './features/welcome/SignInScreen.tsx';
import { isOnline } from './lib/online.ts';

async function start() {
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

  // Production only (no service worker in dev, so hot reload is never stale).
  initUpdates();
  initWhatsNew();

  const element = document.getElementById('root');
  if (!element) throw new Error('Missing #root element');
  const root = createRoot(element);

  const mode = resolveDataMode();
  let account: AccountInfo | null = null;
  let authError: string | null = null;
  if (mode === 'onedrive') {
    root.render(<ConnectingScreen />);
    try {
      account = await initAuth();
    } catch (error) {
      authError = error instanceof Error ? error.message : String(error);
    }
  }
  // Offline with no session to restore: show the index kept on the device.
  const offline = mode === 'onedrive' && !account && !isOnline() && hasSignedInBefore();

  root.render(
    <StrictMode>
      <App mode={mode} account={account} offline={offline} authError={authError} />
    </StrictMode>,
  );
}

void start();
