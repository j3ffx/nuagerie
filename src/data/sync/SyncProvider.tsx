import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getSyncToken, requestSyncPermission, SyncPermissionMissing } from '../../auth/msal.ts';
import { isOnline } from '../../lib/online.ts';
import {
  onPersistentWrite,
  readPersistent,
  usePersistentState,
  writePersistent,
} from '../../lib/persistent.ts';
import { createGraphClient } from '../graph/client.ts';
import type { DataMode } from '../source.ts';
import { createAppFolder, syncWith } from './appFolder.ts';
import {
  favoriteIds,
  mergeStates,
  parseState,
  sameState,
  SYNCED_PREFERENCES,
  withFavorite,
  withPreference,
  type SyncedState,
} from './state.ts';
import { SYNC_ENABLED_KEY, SyncContext, syncStateKey, type SyncStatus } from './syncContext.ts';

const LAST_SYNC_KEY = 'sync.lastSyncAt';
const PENDING_FAVORITE_KEY = 'sync.pendingFavorite';
/** A change goes out after this pause, so a few taps make one write. */
const SYNC_DELAY_MS = 1500;

const SYNCED = new Set<string>(SYNCED_PREFERENCES);

/**
 * Favourites, and the sync of favourites and preferences to OneDrive's app
 * folder. Off by default: everything stays on the device until the user
 * turns the sync on (Réglages), which asks Microsoft for a permission
 * limited to that folder.
 */
export function SyncProvider({
  mode,
  signedIn,
  children,
}: {
  mode: DataMode;
  signedIn: boolean;
  children: ReactNode;
}) {
  const stateKey = syncStateKey(mode);
  const [stored] = usePersistentState<unknown>(stateKey, null);
  const state = useMemo(() => parseState(stored), [stored]);
  const [enabledSetting] = usePersistentState<boolean>(SYNC_ENABLED_KEY, false);
  const [lastSyncAt] = usePersistentState<number | null>(LAST_SYNC_KEY, null);
  const available = mode === 'onedrive' && signedIn;
  const enabled = available && enabledSetting;
  const [status, setStatus] = useState<{ status: SyncStatus; message: string | null }>({
    status: 'off',
    message: null,
  });

  /** Always the latest copy, for writes from event listeners. */
  const current = () => parseState(readPersistent<unknown>(stateKey, null));
  const save = useCallback((next: SyncedState) => writePersistent(stateKey, next), [stateKey]);

  // Preferences changed on this device are recorded with their time; those
  // brought in by the sync are written without being recorded again.
  const applying = useRef(false);
  useEffect(() => {
    if (mode !== 'onedrive') return;
    return onPersistentWrite((key, value) => {
      if (applying.current || !SYNCED.has(key)) return;
      save(withPreference(parseState(readPersistent(stateKey, null)), key, value, Date.now()));
    });
  }, [mode, save, stateKey]);

  const toggleFavorite = useCallback(
    (id: string) => {
      const latest = parseState(readPersistent(stateKey, null));
      save(withFavorite(latest, id, !favoriteIds(latest).has(id), Date.now()));
    },
    [save, stateKey],
  );

  const folder = useMemo(
    () => (enabled ? createAppFolder(createGraphClient({ getToken: getSyncToken })) : null),
    [enabled],
  );
  const running = useRef(false);
  const again = useRef(false);

  const run = useCallback(async () => {
    if (!folder) return;
    if (running.current) {
      again.current = true;
      return;
    }
    if (!isOnline()) {
      setStatus({ status: 'offline', message: null });
      return;
    }
    running.current = true;
    setStatus({ status: 'syncing', message: null });
    try {
      // Preferences set before the sync was on count as the oldest change: another device wins.
      let local = current();
      for (const key of SYNCED_PREFERENCES) {
        const value = readPersistent<unknown>(key, undefined);
        if (value !== undefined && !local.preferences[key]) {
          local = withPreference(local, key, value, 0);
        }
      }
      const merged = await syncWith(folder, local);
      // Changes made on this device while the sync ran are kept, the next run sends them.
      const latest = current();
      const kept = mergeStates(merged, latest);
      if (!sameState(kept, latest)) save(kept);
      applying.current = true;
      try {
        for (const [key, entry] of Object.entries(merged.preferences)) {
          if (!SYNCED.has(key)) continue;
          const mine = readPersistent<unknown>(key, undefined);
          if (JSON.stringify(mine) !== JSON.stringify(entry.value))
            writePersistent(key, entry.value);
        }
      } finally {
        applying.current = false;
      }
      writePersistent(LAST_SYNC_KEY, Date.now());
      setStatus({ status: 'ok', message: null });
    } catch (error) {
      setStatus(
        error instanceof SyncPermissionMissing
          ? { status: 'needs-permission', message: null }
          : {
              status: isOnline() ? 'error' : 'offline',
              message: error instanceof Error ? error.message : String(error),
            },
      );
    } finally {
      running.current = false;
      if (again.current) {
        again.current = false;
        void run();
      }
    }
    // `current` reads storage; it needs no dependency.
  }, [folder, save]); // eslint-disable-line react-hooks/exhaustive-deps

  // On start, after a change (a short pause first), when back online or in the foreground.
  useEffect(() => {
    if (!folder) return;
    void run();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void run();
    };
    const onOnline = () => void run();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [folder, run]);

  const firstState = useRef(true);
  useEffect(() => {
    if (firstState.current) {
      firstState.current = false;
      return;
    }
    if (!folder || running.current) return;
    const timer = window.setTimeout(() => void run(), SYNC_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [stored, folder, run]);

  const enable = useCallback(async (favoriteId?: string) => {
    if (favoriteId) writePersistent(PENDING_FAVORITE_KEY, favoriteId);
    writePersistent(SYNC_ENABLED_KEY, true);
    try {
      await getSyncToken();
    } catch (error) {
      // Not granted yet: Microsoft's page asks the user, then the app comes back.
      if (error instanceof SyncPermissionMissing) await requestSyncPermission();
      else throw error;
    }
  }, []);

  const disable = useCallback(() => writePersistent(SYNC_ENABLED_KEY, false), []);

  // Favourites need the sync with OneDrive: kept on the device only, they would be lost with
  // the app. The demo has no OneDrive: there they stay on the device.
  const favoritesOn = mode === 'demo' || (enabled && status.status !== 'needs-permission');
  const favorites = useMemo(
    () => (favoritesOn ? favoriteIds(state) : new Set<string>()),
    [favoritesOn, state],
  );

  // A heart touched before the sync was on: that photo becomes a favourite once it is.
  useEffect(() => {
    if (!enabled || status.status !== 'ok') return;
    const pending = readPersistent<string | null>(PENDING_FAVORITE_KEY, null);
    if (!pending) return;
    writePersistent(PENDING_FAVORITE_KEY, null);
    const latest = parseState(readPersistent(stateKey, null));
    if (!favoriteIds(latest).has(pending)) save(withFavorite(latest, pending, true, Date.now()));
  }, [enabled, status.status, save, stateKey]);
  const shownStatus = enabled ? status : { status: 'off' as const, message: null };

  return (
    <SyncContext.Provider
      value={{
        favorites,
        favoritesOn,
        toggleFavorite,
        available,
        enabled,
        status: shownStatus.status,
        message: shownStatus.message,
        lastSyncAt,
        enable,
        disable,
        syncNow: () => void run(),
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}
