const CACHE_NAME = "audius-som-shell-v3";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/audius-som.svg",
  "./src/app/app.css?v=8",
  "./src/app/startup.js?v=4",
  "./src/app/catalog-ui.js?v=4",
  "./src/app/player.js?v=6",
  "./src/app/library-ui.js?v=1",
  "./src/app/screen-memory.js?v=2",
  "./src/storage/indexeddb.js",
  "./src/storage/indexeddb.js",
  "./src/storage/catalog-sync.js"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // O catálogo continua seguindo a estratégia local-first + atualização silenciosa.
  if (url.pathname.endsWith("/data/catalogo.json")) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then(cached => cached || caches.match("./index.html")))
  );
});
