/* Binsu Star service worker — passthrough only.
   Exists so the site is installable (Add to Home Screen); it does NOT
   cache anything, so deploys are always picked up immediately. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", e => { e.respondWith(fetch(e.request)); });
