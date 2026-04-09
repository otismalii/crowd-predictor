const CACHE_NAME = "pagaza-v2";
const PRECACHE_URLS = ["/", "/index.html"];
const NAVIGATE_FALLBACK_DENYLIST = [/^\/~oauth/, /^\/api\//];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigation requests → network-first with offline fallback
  if (request.mode === "navigate") {
    // Skip denied paths
    if (NAVIGATE_FALLBACK_DENYLIST.some(re => re.test(url.pathname))) return;

    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return res;
        })
        .catch(() =>
          caches.match("/index.html").then((cached) =>
            cached || new Response(
              '<!DOCTYPE html><html><body style="background:#0a0a12;color:#78ff78;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif"><div style="text-align:center"><h1>🦅 Pagaza</h1><p>You are offline. Please reconnect.</p></div></body></html>',
              { headers: { "Content-Type": "text/html" } }
            )
          )
        )
    );
    return;
  }

  // Static assets → cache-first
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|woff2?|ico|webp)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return res;
        });
      })
    );
    return;
  }

  // API calls → network-only
  event.respondWith(fetch(request));
});