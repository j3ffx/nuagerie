import { useSyncExternalStore } from 'react';
import { registerSW } from 'virtual:pwa-register';

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
  /** Commit of the deployed version, when known. */
  latestCommit: string | null;
  checkedAt: number | null;
}

const FOREGROUND_CHECK_INTERVAL_MS = 60_000;

let state: UpdateState = { status: 'idle', latestCommit: null, checkedAt: null };
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
  (window as unknown as { simulateUpdate: () => void }).simulateUpdate = () =>
    setState({ status: 'ready' });
}

export function initUpdates(): void {
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh: () => setState({ status: 'ready' }),
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
    const response = await fetch('/version.json', { cache: 'no-store' });
    const latest = response.ok ? ((await response.json()) as { commit?: string }).commit : null;
    await registration?.update();
    // The new version may have finished downloading meanwhile (onNeedRefresh).
    if (currentStatus() === 'ready') return;
    const newer = Boolean(latest && latest !== __APP_COMMIT__);
    const pending = Boolean(registration?.installing || registration?.waiting);
    setState({
      status: registration?.waiting ? 'ready' : newer || pending ? 'downloading' : 'up-to-date',
      latestCommit: latest ?? null,
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
