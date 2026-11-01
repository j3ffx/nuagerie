import { removePersistent } from '../lib/persistent.ts';
import { trashCacheName, trashKey } from './edits/trash.ts';
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
/** The search in the photos (src/data/content/): turned on, and whether this device analysed. */
export const CONTENT_ENABLED_KEY = 'content.enabled';
export const CONTENT_ANALYSED_KEY = 'content.analysed';
export const CONTENT_DEVICE_KEY = 'content.device';

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
  // The changes start off again for whoever signs in next, with nothing in the app's bin.
  'edits.enabled',
  'edits.granted',
  'edits.asking',
  trashKey('onedrive'),
  CONTENT_ENABLED_KEY,
  CONTENT_ANALYSED_KEY,
  CONTENT_DEVICE_KEY,
];

export function forgetAccountPreferences(): void {
  ACCOUNT_PREFERENCES.forEach(removePersistent);
}

/** The thumbnails kept with the app's list of what it put in the recycle bin. */
export async function forgetTrashThumbnails(): Promise<void> {
  if (typeof caches !== 'undefined') await caches.delete(trashCacheName('onedrive'));
}
