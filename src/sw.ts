/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
  type PrecacheEntry,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { currentDateContext } from './data/dates.ts';
import type { MediaItem } from './data/model.ts';
import { thumbnailKey } from './data/thumbnails/thumbnailStore.ts';
import {
  loadStoredIndex,
  MEMORIES_SYNC_TAG,
  MEMORIES_URL,
  notifyMemories,
  openMemoryState,
  readLanguage,
  readToldOn,
  writeToldOn,
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

/**
 * A photo of the memories for beside the text, from the thumbnails kept on the device (the
 * offline images first, then the thumbnail cache), as a data URL: no network, and none of the
 * letter Android draws when the icon does not load. The app icon when it is not there.
 */
async function coverIcon(cover: MediaItem | null): Promise<string> {
  const fallback = '/pwa-192x192.png';
  if (!cover) return fallback;
  const key = thumbnailKey(cover, 'medium');
  const names = await caches.keys();
  const places = [
    ...names
      .filter((name) => name.startsWith('nuagerie-offline-'))
      .map((name) => [name, 'offline'] as const),
    ...names
      .filter((name) => name.startsWith('nuagerie-thumbnails-'))
      .map((name) => [name, 'thumbnails'] as const),
  ];
  for (const [name, path] of places) {
    const hit = await (await caches.open(name)).match(`${self.location.origin}/__${path}/${key}`);
    if (!hit) continue;
    const bytes = new Uint8Array(await hit.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return `data:${hit.headers.get('Content-Type') ?? 'image/jpeg'};base64,${btoa(binary)}`;
  }
  return fallback;
}

/** One connection per wake-up, closed at the end: an open one would block a later upgrade. */
async function tellMemories(): Promise<void> {
  const state = await openMemoryState();
  try {
    await notifyMemories({
      loadIndex: loadStoredIndex,
      now: () => currentDateContext().nowWallClock,
      language: (await readLanguage(state)) ?? undefined,
      readNotifiedOn: () => readToldOn(state),
      writeNotifiedOn: (day) => writeToldOn(state, day),
      show: async (title, body, cover) =>
        self.registration.showNotification(title, {
          body,
          icon: await coverIcon(cover).catch(() => '/pwa-192x192.png'),
          // The cloud alone, in white on nothing (scripts/build-badge.mjs): Android draws the
          // status bar icon from its transparency; without it, Chrome shows a bell.
          badge: '/notification-badge.png',
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
