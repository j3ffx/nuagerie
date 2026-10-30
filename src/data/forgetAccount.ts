import { removePersistent } from '../lib/persistent.ts';
import { DEFAULT_ROOT_PATH_KEY } from './roots.ts';
import { SYNCED_PREFERENCES } from './sync/state.ts';
import { SYNC_ENABLED_KEY, SYNC_GRANTED_KEY, syncStateKey } from './sync/syncContext.ts';

/**
 * The preferences that tell about the account's photos: the folders and
 * albums chosen, the sorts and filters, the sync's copy and state, the
 * recent searches, the map's last view (it shows where the photos are) and
 * the Photos folder found. Signing out erases them (OneDrive's copy stays and
 * comes back with the sync); the look of the app (theme, language, columns,
 * cache size) stays with the device, and so does the choice to keep the sync
 * off on it (signing back in must not turn it on by itself).
 */
export const ACCOUNT_PREFERENCES: readonly string[] = [
  ...SYNCED_PREFERENCES,
  syncStateKey('onedrive'),
  SYNC_ENABLED_KEY,
  SYNC_GRANTED_KEY,
  'sync.lastSyncAt',
  'sync.pendingFavorite',
  'sync.asking',
  'search.recent.onedrive',
  'map.view',
  DEFAULT_ROOT_PATH_KEY,
];

export function forgetAccountPreferences(): void {
  ACCOUNT_PREFERENCES.forEach(removePersistent);
}
