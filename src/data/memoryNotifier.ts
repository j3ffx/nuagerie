import { currentDateContext, resolveCaptureDate } from './dates.ts';
import { dayKey, memoryNotification, NOTIFY_FROM_HOUR } from './memories.ts';
import type { MediaIndex } from './model.ts';
import { buildIndex } from './normalize.ts';
import { IndexStore } from './store.ts';

/**
 * The morning notification, from the service worker: when the browser wakes
 * it (Periodic Background Sync, at a time the browser chooses), it reads the
 * index kept on the device, with no network, and tells the day's memories
 * once a day, never before 8 o'clock. Off until the user turns it on
 * (Réglages → Souvenirs), which asks for the notification permission.
 */

/** Tag of the periodic sync; registered means the notification is on. */
export const MEMORIES_SYNC_TAG = 'souvenirs';
/** What a tap on the notification opens. */
export const MEMORIES_URL = '/souvenirs';

/** Asks an open window of the app to show a screen, without reloading it (src/app/App.tsx). */
export interface NavigateMessage {
  type: 'NAVIGATE';
  url: string;
}

export function isNavigateMessage(data: unknown): data is NavigateMessage {
  const message = data as Partial<NavigateMessage> | null;
  return (
    message?.type === 'NAVIGATE' &&
    typeof message.url === 'string' &&
    message.url.startsWith('/') &&
    !message.url.startsWith('//')
  );
}

export interface NotifierDeps {
  /** The index of the device, or null when there is none (demo, signed out). */
  loadIndex(): Promise<MediaIndex | null>;
  /** Wall clock of now. */
  now(): number;
  readNotifiedOn(): Promise<string | null>;
  writeNotifiedOn(day: string): Promise<void>;
  show(title: string, body: string): Promise<void>;
}

/** Tells the memories of the day if it is time; says whether it did. */
export async function notifyMemories(deps: NotifierDeps): Promise<boolean> {
  // The browser may wake the app at night or several times a day: the index (the whole drive)
  // is read only when a notification could be shown.
  const now = deps.now();
  if (new Date(now).getUTCHours() < NOTIFY_FROM_HOUR) return false;
  const notifiedOn = await deps.readNotifiedOn();
  if (notifiedOn === dayKey(now)) return false;
  const index = await deps.loadIndex();
  if (!index) return false;
  const notification = memoryNotification(index.items, now, notifiedOn);
  if (!notification) return false;
  await deps.show(notification.title, notification.body);
  await deps.writeNotifiedOn(notification.day);
  return true;
}

/** The index the app keeps (src/data/store.ts), rebuilt as the app does at startup. */
export async function loadStoredIndex(): Promise<MediaIndex | null> {
  const store = await IndexStore.open();
  try {
    const meta = await store.getMeta();
    if (!meta) return null;
    const context = currentDateContext();
    return buildIndex(
      await store.loadItems(),
      meta.rootFolders.map((root) => root.id),
      (item) => resolveCaptureDate(item, context),
    );
  } finally {
    store.close();
  }
}
