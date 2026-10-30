import { describe, expect, it } from 'vitest';
import { readPersistent, writePersistent } from '../lib/persistent.ts';
import { forgetAccountPreferences } from './forgetAccount.ts';

/** Every key the app writes in OneDrive mode, and whether signing out must erase it. */
const KEYS: Record<string, boolean> = {
  rootPaths: true,
  'rootPaths.default': true,
  'albums.selection.onedrive': true,
  'albums.sort': true,
  'albums.subSort': true,
  'albums.photoOrder': true,
  'all.excluded.onedrive': true,
  'all.photoOrder': true,
  'memories.closedOn': true,
  'sync.state.onedrive': true,
  'sync.enabled': true,
  'sync.granted': true,
  'sync.turnedOff': true,
  'sync.lastSyncAt': true,
  'sync.pendingFavorite': true,
  'sync.asking': true,
  'search.recent.onedrive': true,
  'map.view': true,
  // The look of the app stays with the device.
  theme: false,
  language: false,
  'grid.columns': false,
  seenVersion: false,
};

describe('forgetAccountPreferences', () => {
  it('erases what tells about the account’s photos, and keeps the look of the app', () => {
    for (const key of Object.keys(KEYS)) writePersistent(key, 'x');
    forgetAccountPreferences();
    const left = Object.keys(KEYS).filter((key) => readPersistent(key, null) !== null);
    expect(left).toEqual(Object.keys(KEYS).filter((key) => !KEYS[key]));
  });
});
