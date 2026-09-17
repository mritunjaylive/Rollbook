const CACHE_NAME = "rollbook-cache-v1";
const OFFLINE_URL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([OFFLINE_URL])),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        }),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL)),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        return networkResponse;
      });
    }),
  );
});

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "Rollbook Update";
  const options = {
    body: data.body || "You have a new update.",
    icon: "/rollbook-192.png",
    badge: "/favicon.svg",
    data: data.data || "/",
    actions: data.actions || [],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const action = event.action;
  const payloadData = event.notification.data;
  
  if (action === "mark_all_present" || action === "mark_sick") {
    const token = payloadData?.token;
    if (token) {
      event.waitUntil(
        fetch("/api/push/quick-mark", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ action })
        }).catch(err => console.error("Quick mark failed:", err))
      );
    }
  } else {
    // default action or view_routine
    const url = typeof payloadData === "object" ? payloadData.url : payloadData;
    event.waitUntil(self.clients.openWindow(url || "/"));
  }
});