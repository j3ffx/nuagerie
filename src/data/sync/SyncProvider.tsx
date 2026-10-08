import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getSyncToken, requestSyncPermission, SyncPermissionMissing } from '../../auth/msal.ts';
import { isOnline } from '../../lib/online.ts';
import {
  onPersistentWrite,
  readPersistent,
  usePersistentState,
  writePersistent,
} from '../../lib/persistent.ts';
import { useData } from '../dataContext.ts';
import { createGraphClient } from '../graph/client.ts';
import { readRootPaths } from '../roots.ts';
import type { DataMode } from '../source.ts';
import { createAppFolder, syncWith } from './appFolder.ts';
import { whenPermissionMissing } from './permission.ts';
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
import {
  SYNC_ENABLED_KEY,
  SYNC_GRANTED_KEY,
  SYNC_TURNED_OFF_KEY,
  SyncContext,
  syncStateKey,
  type SyncStatus,
} from './syncContext.ts';

const LAST_SYNC_KEY = 'sync.lastSyncAt';
const PENDING_FAVORITE_KEY = 'sync.pendingFavorite';
/** Set while the user is on Microsoft's page for the permission, to know what they answered. */
const ASKING_KEY = 'sync.asking';

const DECLINED_NOTICE =
  'Microsoft n’a pas donné la permission : sans elle, Nuagerie ne peut rien ranger dans ton OneDrive, ni tes favoris ni tes préférences. Tu peux réessayer quand tu veux.';
const failedNotice = (detail: string) =>
  `La synchronisation n’a pas pu démarrer (${detail}). Réessaie dans un moment.`;
/** A change goes out after this pause, so a few taps make one write. */
const SYNC_DELAY_MS = 1500;
/** While the app is on screen, another device's changes come in within this time. */
const SYNC_INTERVAL_MS = 60_000;

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
  const { resetIndex } = useData();
  const stateKey = syncStateKey(mode);
  const [stored] = usePersistentState<unknown>(stateKey, null);
  const state = useMemo(() => parseState(stored), [stored]);
  const [enabledSetting] = usePersistentState<boolean>(SYNC_ENABLED_KEY, false);
  const [granted] = usePersistentState<boolean>(SYNC_GRANTED_KEY, false);
  const [lastSyncAt] = usePersistentState<number | null>(LAST_SYNC_KEY, null);
  const available = mode === 'onedrive' && signedIn;
  const enabled = available && enabledSetting;
  const [status, setStatus] = useState<{ status: SyncStatus; message: string | null }>({
    status: 'off',
    message: null,
  });
  const [notice, setNotice] = useState<string | null>(null);

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

  const run = useCallback(
    async ({ quiet = false } = {}) => {
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
      // The check every minute shows nothing while it runs: the status line would blink.
      if (!quiet) setStatus({ status: 'syncing', message: null });
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
        const rootsBefore = readRootPaths().join('\n');
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
        // Other root folders chosen on another device: this one indexes them too.
        if (readRootPaths().join('\n') !== rootsBefore) void resetIndex();
        writePersistent(LAST_SYNC_KEY, Date.now());
        writePersistent(SYNC_GRANTED_KEY, true);
        writePersistent(ASKING_KEY, false);
        setStatus({ status: 'ok', message: null });
      } catch (error) {
        const asked = readPersistent(ASKING_KEY, false);
        writePersistent(ASKING_KEY, false);
        if (error instanceof SyncPermissionMissing) {
          const outcome = whenPermissionMissing({
            granted: readPersistent(SYNC_GRANTED_KEY, false),
            asked,
          });
          if (!outcome.enabled) writePersistent(SYNC_ENABLED_KEY, false);
          if (outcome.declined) setNotice(DECLINED_NOTICE);
          setStatus({ status: outcome.status, message: null });
        } else {
          const message = error instanceof Error ? error.message : String(error);
          if (asked) setNotice(failedNotice(message));
          setStatus({ status: isOnline() ? 'error' : 'offline', message });
        }
      } finally {
        running.current = false;
        if (again.current) {
          again.current = false;
          void run();
        }
      }
    },
    // `current` reads storage; it needs no dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [folder, save, resetIndex],
  );

  // On start, after a change (a short pause first), when back online or in the foreground,
  // and every minute while on screen (one small read; a write only if something changed).
  useEffect(() => {
    if (!folder) return;
    void run();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void run();
    };
    const onOnline = () => void run();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && isOnline()) void run({ quiet: true });
    }, SYNC_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      window.clearInterval(timer);
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
    writePersistent(SYNC_TURNED_OFF_KEY, false);
    setNotice(null);
    try {
      // Granted already (on another device, or before signing out): no page to go through.
      await getSyncToken({ deviceOnly: true });
      writePersistent(SYNC_GRANTED_KEY, true);
      writePersistent(SYNC_ENABLED_KEY, true);
      return;
    } catch {
      // Whatever the reason, Microsoft's page asks the user; the first sync tells what they said.
    }
    writePersistent(SYNC_GRANTED_KEY, false);
    writePersistent(ASKING_KEY, true);
    writePersistent(SYNC_ENABLED_KEY, true);
    try {
      await requestSyncPermission();
    } catch (error) {
      // The page could not be opened: nothing was asked.
      writePersistent(ASKING_KEY, false);
      writePersistent(SYNC_ENABLED_KEY, false);
      setNotice(failedNotice(error instanceof Error ? error.message : String(error)));
    }
  }, []);

  const disable = useCallback(() => {
    writePersistent(SYNC_ENABLED_KEY, false);
    writePersistent(SYNC_TURNED_OFF_KEY, true);
  }, []);

  // Turned on from another device: Microsoft grants the permission to the account, not to a
  // device, and the app folder holds a copy. This device then follows without a word, unless
  // the user turned the sync off here. One token and one small read, once per start.
  useEffect(() => {
    if (!available || enabledSetting || !isOnline()) return;
    if (readPersistent(SYNC_TURNED_OFF_KEY, false)) return;
    let cancelled = false;
    const getToken = () => getSyncToken({ deviceOnly: true });
    void (async () => {
      try {
        await getToken();
        const copy = await createAppFolder(createGraphClient({ getToken })).read();
        if (cancelled || !copy) return;
        writePersistent(SYNC_GRANTED_KEY, true);
        writePersistent(SYNC_ENABLED_KEY, true);
      } catch {
        // Not granted, or never turned on anywhere: the sync stays off.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [available, enabledSetting]);

  const dismissNotice = useCallback(
    (retry: boolean) => {
      setNotice(null);
      if (retry) void enable();
      else writePersistent(PENDING_FAVORITE_KEY, null);
    },
    [enable],
  );

  // Favourites need the sync with OneDrive: kept on the device only, they would be lost with
  // the app. They come on once Microsoft has granted the permission. The demo has no OneDrive:
  // there they stay on the device.
  const favoritesOn =
    mode === 'demo' || (enabled && granted && status.status !== 'needs-permission');
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
        notice,
        dismissNotice,
        enable,
        disable,
        syncNow: () => void run(),
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}
