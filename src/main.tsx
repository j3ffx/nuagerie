import type { AccountInfo } from '@azure/msal-browser';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app/App.tsx';
import { REDIRECT_PATH } from './auth/msal.ts';
import { resolveDataMode } from './data/mode.ts';

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
  registerSW({ immediate: true });

  const mode = resolveDataMode();
  let account: AccountInfo | null = null;
  let authError: string | null = null;
  if (mode === 'onedrive') {
    const { initAuth } = await import('./auth/msal.ts');
    try {
      account = await initAuth();
    } catch (error) {
      authError = error instanceof Error ? error.message : String(error);
    }
  }

  const root = document.getElementById('root');
  if (!root) throw new Error('Missing #root element');
  createRoot(root).render(
    <StrictMode>
      <App mode={mode} account={account} authError={authError} />
    </StrictMode>,
  );
}

void start();
