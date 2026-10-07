/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
  type PrecacheEntry,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

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
