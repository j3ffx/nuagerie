import { readPersistent, removePersistent, writePersistent } from '../lib/persistent.ts';
import type { DataMode } from './source.ts';

const DEMO_KEY = 'demo';

export function hasOneDriveConfig(): boolean {
  return Boolean(import.meta.env.VITE_MSAL_CLIENT_ID);
}

/** Demo mode is forced by the build (dev:demo), with no Client ID configured. */
export function isDemoForced(): boolean {
  return (
    import.meta.env.MODE === 'demo' || import.meta.env.VITE_DEMO === '1' || !hasOneDriveConfig()
  );
}

/**
 * Decides where data comes from. `?demo=1` turns demo mode on for this device
 * (remembered, so an installed PWA keeps it), `?demo=0` turns it off.
 */
export function resolveDataMode(): DataMode {
  const url = new URL(window.location.href);
  const param = url.searchParams.get('demo');
  if (param !== null) {
    if (param === '0') removePersistent(DEMO_KEY);
    else writePersistent(DEMO_KEY, true);
    url.searchParams.delete('demo');
    window.history.replaceState(window.history.state, '', url);
  }
  if (isDemoForced() || readPersistent(DEMO_KEY, false)) return 'demo';
  return 'onedrive';
}

export function enterDemoMode(): void {
  writePersistent(DEMO_KEY, true);
  window.location.reload();
}

export function leaveDemoMode(): void {
  removePersistent(DEMO_KEY);
  window.location.reload();
}
