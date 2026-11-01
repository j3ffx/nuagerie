import { MEMORIES_SYNC_TAG } from '../../data/memoryNotifier.ts';

/** Periodic Background Sync, which the DOM types do not have yet (Chrome only). */
interface PeriodicSyncManager {
  register(tag: string, options?: { minInterval?: number }): Promise<void>;
  unregister(tag: string): Promise<void>;
  getTags(): Promise<string[]>;
}
type WithPeriodicSync = ServiceWorkerRegistration & { periodicSync?: PeriodicSyncManager };

export const memoriesNotificationAvailable = () =>
  'serviceWorker' in navigator &&
  'Notification' in window &&
  typeof ServiceWorkerRegistration !== 'undefined' &&
  'periodicSync' in ServiceWorkerRegistration.prototype;

/** How long to wait for the service worker, which may never come (failed to register). */
const READY_TIMEOUT_MS = 5000;

export async function periodicSync(): Promise<PeriodicSyncManager | null> {
  const registration = await Promise.race([
    navigator.serviceWorker.ready as Promise<WithPeriodicSync>,
    new Promise<null>((resolve) => window.setTimeout(() => resolve(null), READY_TIMEOUT_MS)),
  ]);
  return registration?.periodicSync ?? null;
}

/**
 * On when the periodic sync is registered and notifications are allowed. Notifications taken
 * back in the phone's settings: the sync goes too, rather than waking the app for nothing.
 */
export async function memoriesNotificationOn(): Promise<boolean> {
  const sync = await periodicSync();
  const registered = ((await sync?.getTags()) ?? []).includes(MEMORIES_SYNC_TAG);
  if (registered && Notification.permission !== 'granted') {
    await sync?.unregister(MEMORIES_SYNC_TAG);
    return false;
  }
  return registered;
}
