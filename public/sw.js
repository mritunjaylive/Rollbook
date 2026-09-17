const CACHE_NAME = "rollbook-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Let network handle requests with basic fallback
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});