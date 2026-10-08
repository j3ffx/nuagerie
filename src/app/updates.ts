import { useSyncExternalStore } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { fetchDeployed, type Deployed } from './latestVersion.ts';

/**
 * App updates. A new version is downloaded by the service worker but only
 * loaded when the user asks for it (banner or settings), so the page is never
 * reloaded by surprise. Updates are also looked for when the app comes back
 * to the foreground, at most once a minute.
 */

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  /** A newer version exists and is being downloaded. */
  | 'downloading'
  /** The newer version is downloaded and can be loaded. */
  | 'ready'
  | 'error';

export interface UpdateState {
  status: UpdateStatus;
  /** Version and commit of the deployed app, when known. */
  latest: Deployed | null;
  checkedAt: number | null;
}

const FOREGROUND_CHECK_INTERVAL_MS = 60_000;

let state: UpdateState = { status: 'idle', latest: null, checkedAt: null };
const listeners = new Set<() => void>();
let registration: ServiceWorkerRegistration | undefined;
let updateSW: (reloadPage?: boolean) => Promise<void> = async () => window.location.reload();

/** Read through a function: the status can change while a check awaits. */
const currentStatus = (): UpdateStatus => state.status;

function setState(patch: Partial<UpdateState>) {
  state = { ...state, ...patch };
  listeners.forEach((notify) => notify());
}

// Development only (removed from production builds): show the banner without a deploy.
if (import.meta.env.DEV) {
  (window as unknown as { simulateUpdate: (version?: string) => void }).simulateUpdate = (
    version = '9.9.9',
  ) => setState({ status: 'ready', latest: { version, commit: '0000000' } });
}

export function initUpdates(): void {
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh: () => {
      setState({ status: 'ready' });
      // Found by the service worker on its own: learn which version it is, to name it.
      void fetchDeployed().then((latest) => {
        if (latest) setState({ latest });
      });
    },
    onRegisteredSW: (_url, reg) => {
      registration = reg;
    },
  });

  document.addEventListener('visibilitychange', () => {
    const stale = Date.now() - (state.checkedAt ?? 0) > FOREGROUND_CHECK_INTERVAL_MS;
    if (document.visibilityState === 'visible' && stale) void checkForUpdate({ quiet: true });
  });
}

/** Looks for a newer deployed version; `quiet` keeps the current status while checking. */
export async function checkForUpdate({ quiet = false } = {}): Promise<void> {
  if (state.status === 'ready' || state.status === 'checking') return;
  if (!quiet) setState({ status: 'checking' });
  try {
    const latest = await fetchDeployed();
    await registration?.update();
    // The new version may have finished downloading meanwhile (onNeedRefresh).
    if (currentStatus() === 'ready') {
      if (latest) setState({ latest });
      return;
    }
    const newer = Boolean(latest && latest.commit !== __APP_COMMIT__);
    const pending = Boolean(registration?.installing || registration?.waiting);
    setState({
      status: registration?.waiting ? 'ready' : newer || pending ? 'downloading' : 'up-to-date',
      latest,
      checkedAt: Date.now(),
    });
  } catch {
    setState({ status: quiet ? state.status : 'error', checkedAt: Date.now() });
  }
}

/** Loads the downloaded version (the page reloads). */
export function applyUpdate(): void {
  void updateSW(true);
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

export function useUpdateState(): UpdateState {
  return useSyncExternalStore(subscribe, () => state);
}
