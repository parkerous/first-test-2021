/* Kill-switch service worker: the old Binsu Star site registered a service
   worker at this path. This replacement unregisters it and clears any caches
   so browsers fall back to loading the site (now Pixel Arcade) normally. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll({ type: "window" }))
      .then(clients => clients.forEach(c => c.navigate(c.url)))
  );
});
