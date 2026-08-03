/* UniTech PWA service worker — minimal, no caching (keeps content always fresh).
   A fetch handler is required for Android/Chrome installability. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // Network passthrough (no offline cache) so users always get the latest build.
});
