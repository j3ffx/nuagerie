/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
  type PrecacheEntry,
} from 'workbox-precaching';
import { openDB } from 'idb';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { currentDateContext } from './data/dates.ts';
import {
  loadStoredIndex,
  MEMORIES_SYNC_TAG,
  MEMORIES_URL,
  notifyMemories,
  type NavigateMessage,
} from './data/memoryNotifier.ts';

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: (string | PrecacheEntry)[];
};

// A new version waits until the app asks for it ("Mettre à jour"), so the page
// is never reloaded by surprise. The first install takes control at once.
self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') void self.skipWaiting();
});
clientsClaim();

// App shell: everything produced by the build is precached.
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// SPA: every navigation is answered with the cached index.html.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));

// Thumbnails are cached by the page itself (src/data/thumbnails/), in Cache Storage:
// the page holds the Graph token, and the cache works in development too.

// Memories of the day (src/data/memoryNotifier.ts): when the browser wakes the app, from the
// index kept on the device, with no network.
interface PeriodicSyncEvent extends ExtendableEvent {
  readonly tag: string;
}

const openMemoryState = () =>
  openDB('nuagerie-memories', 1, {
    upgrade(database) {
      database.createObjectStore('state');
    },
  });

/** One connection per wake-up, closed at the end: an open one would block a later upgrade. */
async function tellMemories(): Promise<void> {
  const state = await openMemoryState();
  try {
    await notifyMemories({
      loadIndex: loadStoredIndex,
      now: () => currentDateContext().nowWallClock,
      readNotifiedOn: async () =>
        ((await state.get('state', 'notifiedOn')) as string | undefined) ?? null,
      writeNotifiedOn: async (day) => {
        await state.put('state', day, 'notifiedOn');
      },
      // No badge: Android draws it from the icon's transparency, and ours is full-bleed.
      show: (title, body) =>
        self.registration.showNotification(title, {
          body,
          icon: '/pwa-192x192.png',
          tag: MEMORIES_SYNC_TAG,
          data: { url: MEMORIES_URL },
        }),
    });
  } finally {
    state.close();
  }
}

self.addEventListener('periodicsync', (event) => {
  const sync = event as PeriodicSyncEvent;
  if (sync.tag !== MEMORIES_SYNC_TAG || Notification.permission !== 'granted') return;
  sync.waitUntil(tellMemories());
});

// A tap on the notification opens the memories: in the app if it is open (its own routing, no
// reload), else in a new window.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | null)?.url ?? '/';
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window' });
      const app = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (app) {
        await app.focus();
        app.postMessage({ type: 'NAVIGATE', url } satisfies NavigateMessage);
      } else {
        await self.clients.openWindow(url);
      }
    })(),
  );
});
