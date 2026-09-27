// CACHE_VERSION is replaced at build time by the rollbookSwPlugin in vite.config.ts.
// During dev this stays as the literal placeholder; the service worker is
// effectively disabled for JS/CSS in dev anyway (Vite serves everything fresh).
const CACHE_VERSION = "__ROLLBOOK_SW_VERSION__";
const CACHE_NAME = `rollbook-cache-${CACHE_VERSION}`;
const OFFLINE_URL = "/";

// Assets that are truly immutable once deployed (hashed filenames).
// Everything else — including JS/CSS bundles and HTML — uses network-first.
const STATIC_ASSET_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".svg", ".ico", ".woff2", ".woff"];

function isStaticAsset(url) {
  const pathname = new URL(url).pathname;
  return STATIC_ASSET_EXTENSIONS.some((ext) => pathname.endsWith(ext));
}

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
  const url = new URL(event.request.url);

  // Bypass non-GET requests and API routes so they go straight to network
  if (event.request.method !== "GET" || url.pathname.startsWith("/api/")) {
    return;
  }

  // Navigation requests and JS/CSS: network-first, fall back to cache when offline
  if (event.request.mode === "navigate" || !isStaticAsset(url.href)) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          // Cache a fresh copy for offline fallback
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            (networkResponse.type === "basic" || networkResponse.type === "cors")
          ) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request).then((cached) => cached ?? caches.match(OFFLINE_URL)))
    );
    return;
  }

  // Truly static assets (icons/images with hashed or stable names):
  // cache-first for speed, revalidate in background
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic") {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Ignore network errors when we already have a cached asset
      });

      return cachedResponse || fetchPromise;
    })
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

self.addEventListener("sync", (event) => {
  if (event.tag === "sync-attendance") {
    event.waitUntil(processOfflineQueue());
  }
});

async function processOfflineQueue() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("rollbook-offline-sync", 1);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = async (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("sync-queue")) {
        return resolve();
      }
      
      const tx = db.transaction("sync-queue", "readwrite");
      const store = tx.objectStore("sync-queue");
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = async () => {
        const queue = getAllRequest.result;
        for (const item of queue) {
          try {
            const res = await fetch(item.url, {
              method: item.method,
              headers: item.headers,
              body: item.body,
              credentials: "same-origin"
            });
            if (res.ok || (res.status >= 400 && res.status < 500)) {
              // Delete from IDB using another transaction to avoid tx closing issues
              await new Promise((delResolve) => {
                const delTx = db.transaction("sync-queue", "readwrite");
                delTx.objectStore("sync-queue").delete(item.id).onsuccess = delResolve;
              });
            }
          } catch (err) {
            console.error("SW sync failed for item:", item, err);
            break; // Stop on network failure to maintain order
          }
        }
        resolve();
      };
      
      getAllRequest.onerror = () => reject(getAllRequest.error);
    };
  });
}