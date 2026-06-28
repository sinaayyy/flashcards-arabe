/* Service Worker — mode hors-ligne (PWA).
   Stratégie :
   - App (même origine) : réseau d'abord, repli sur le cache → toujours à jour en ligne,
     fonctionne hors-ligne avec la dernière version vue.
   - Polices & CDN (autre origine) : cache d'abord puis mise à jour en arrière-plan.
   - Supabase (auth / synchro) : jamais intercepté → toujours le réseau. */

const CACHE = "mufradat-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./words.js",
  "./config.js",
  "./favicon.svg",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
];

// Hôtes externes statiques qu'on peut mettre en cache (polices, lib Supabase).
const CACHEABLE_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com", "cdn.jsdelivr.net"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // addAll échoue en bloc si une ressource manque → on tolère les absences.
      .then((c) => Promise.allSettled(APP_SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;                 // POST/PUT (Supabase) → réseau direct
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    e.respondWith(networkFirst(req));               // app shell
    return;
  }
  if (CACHEABLE_HOSTS.indexOf(url.hostname) !== -1) {
    e.respondWith(staleWhileRevalidate(req));        // polices / CDN
  }
  // tout autre cross-origin (Supabase, Google OAuth…) : non intercepté
});

function networkFirst(req) {
  return fetch(req)
    .then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      return res;
    })
    .catch(() => caches.match(req).then((r) => r || caches.match("./index.html")));
}

function staleWhileRevalidate(req) {
  return caches.open(CACHE).then((c) =>
    c.match(req).then((cached) => {
      const net = fetch(req)
        .then((res) => { c.put(req, res.clone()).catch(() => {}); return res; })
        .catch(() => cached);
      return cached || net;
    })
  );
}
