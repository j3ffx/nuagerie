import { getSyncToken } from '../../auth/msal.ts';
import { readPersistent } from '../../lib/persistent.ts';
import { createGraphClient } from '../graph/client.ts';
import { createIndexSnapshots, type IndexSnapshots } from './indexSnapshot.ts';
import { SYNC_ENABLED_KEY, SYNC_GRANTED_KEY, SYNC_TURNED_OFF_KEY } from './syncContext.ts';

/**
 * The copy of the index in this account's app folder. Read on a new device
 * unless the user turned the sync off there (it follows the other devices,
 * as the sync itself does); written only where the sync is on. The token
 * comes from what the device keeps: never a page, never a wait.
 */
export function createAppFolderSnapshots(): IndexSnapshots {
  return createIndexSnapshots(
    createGraphClient({ getToken: () => getSyncToken({ deviceOnly: true }) }),
    {
      load: () => !readPersistent(SYNC_TURNED_OFF_KEY, false),
      save: () =>
        readPersistent(SYNC_ENABLED_KEY, false) && readPersistent(SYNC_GRANTED_KEY, false),
    },
  );
}
