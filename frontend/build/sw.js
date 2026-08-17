/* UniTech PWA service worker — self-healing, no offline cache.
   Goal: installed PWAs / cached tabs must NEVER get stuck on a stale build.
   On activate we wipe any old CacheStorage left by previous SW versions and
   tell open windows to reload once. For app-shell requests (navigation, JS, CSS)
   we always hit the network fresh so users get the latest code. */
const SW_VERSION = "v3-fresh";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Delete every cache stored by any previous SW version.
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.clients.claim();
      // Ask already-open windows to reload once so they drop the stale bundle.
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((c) => c.postMessage({ type: "SW_UPDATED", version: SW_VERSION }));
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return; // let cross-origin pass through
  const isNav = req.mode === "navigate";
  const isAsset = /\.(js|css)$/.test(url.pathname);
  if (isNav || isAsset) {
    // Always fetch fresh app-shell code from the network (bypass HTTP cache).
    event.respondWith(fetch(req, { cache: "no-store" }).catch(() => fetch(req)));
  }
  // Everything else (API calls, images, etc.) uses the default network path.
});
