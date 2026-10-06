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

// New versions take over immediately: a deploy is visible on the next load.
void self.skipWaiting();
clientsClaim();

// App shell: everything produced by the build is precached.
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// SPA: every navigation is answered with the cached index.html.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));

// TODO: thumbnail cache (Cache Storage, key id + size + eTag, LRU capped at 500 MB).
