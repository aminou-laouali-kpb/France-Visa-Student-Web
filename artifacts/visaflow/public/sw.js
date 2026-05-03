// VisaFlow service worker — minimal offline shell.
//
// Strategy:
// - App shell (HTML / JS / CSS / icons): cache-first with network fallback.
// - /api/*: NEVER cached. Authenticated API responses contain per-user PII
//   and would leak across account switches if cached. We pass them through
//   to the network and let the app handle offline behavior in JS.
// - Mutating verbs (anything other than GET): never intercepted.
//
// On install we precache the static shell so the app boots when offline,
// while never persisting account data.

const CACHE = "visaflow-shell-v3";
const SHELL = ["./", "./index.html", "./favicon.svg", "./manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL).catch(() => {})),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Never intercept Clerk auth flows or API calls — they must always hit
  // the network and never be persisted in cache (privacy + tenancy safety).
  if (url.pathname.startsWith("/api/__clerk")) return;
  if (url.pathname.startsWith("/api/")) return;

  // App shell: cache-first with network fallback.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match("./index.html").then((r) => r ?? Response.error()));
    }),
  );
});
