// VisaFlow service worker — minimal offline shell.
//
// Strategy:
// - App shell (HTML / JS / CSS / icons): cache-first with network fallback,
//   stored in a per-user cache so switching accounts cannot surface stale data.
// - /api/*: NEVER cached. Authenticated API responses contain per-user PII
//   and would leak across account switches if cached. We pass them through
//   to the network and let the app handle offline behavior in JS.
// - Mutating verbs (anything other than GET): never intercepted.
//
// On install we precache the static shell so the app boots when offline,
// while never persisting account data.
//
// Cache naming:
//   visaflow-shell-v3              — anonymous / pre-login shell (boot only)
//   visaflow-shell-v3-<userId>     — per-user shell cache
//
// The page sends { type: "ACTIVATE_USER", userId } after sign-in so the SW
// starts writing into that user's cache. On sign-out the page sends
// { type: "PURGE_USER_CACHE", userId } and the SW deletes it immediately.

const SHELL_BASE = "visaflow-shell-v3";
const SHELL = ["./", "./index.html", "./favicon.svg", "./manifest.webmanifest"];

// Active user id (kept in SW memory for the lifetime of the SW process).
let activeUserId = null;

function shellCacheName(userId) {
  return userId ? `${SHELL_BASE}-${userId}` : SHELL_BASE;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_BASE).then((cache) => cache.addAll(SHELL).catch(() => {})),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== shellCacheName(activeUserId) && k !== SHELL_BASE)
          .map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

// Message handler — the page drives user-scoped cache lifecycle.
self.addEventListener("message", (event) => {
  const { type, userId } = event.data ?? {};

  if (type === "ACTIVATE_USER" && userId) {
    activeUserId = userId;
    // Pre-populate the user-scoped cache from the anonymous shell so the app
    // is immediately available offline after sign-in.
    caches.open(SHELL_BASE).then((src) =>
      caches.open(shellCacheName(userId)).then((dst) =>
        src.keys().then((reqs) =>
          Promise.all(reqs.map((req) => src.match(req).then((res) => res && dst.put(req, res)))),
        ),
      ),
    );
    return;
  }

  if (type === "PURGE_USER_CACHE" && userId) {
    const target = shellCacheName(userId);
    caches.delete(target).catch(() => {});
    if (activeUserId === userId) activeUserId = null;
    return;
  }
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
  //
  // Reads are scoped: we look ONLY in the active user's named cache (or the
  // anonymous shell cache when no user is known). We never do a global
  // caches.match() call, which would risk surfacing entries from a different
  // user's cache bucket.
  const cacheName = shellCacheName(activeUserId);

  // Lookup helper: check the user-scoped cache first; fall back to the
  // anonymous shell cache only when no user cache entry exists (e.g. the SW
  // just restarted and hasn't been sent ACTIVATE_USER yet). SHELL_BASE only
  // ever holds static assets (HTML/JS/CSS/icons) — never user data — so this
  // fallback is safe.
  function scopedMatch(request) {
    return caches.open(cacheName).then((c) => c.match(request)).then((hit) => {
      if (hit) return hit;
      if (cacheName === SHELL_BASE) return undefined;
      return caches.open(SHELL_BASE).then((c) => c.match(request));
    });
  }

  event.respondWith(
    scopedMatch(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            const copy = res.clone();
            caches.open(cacheName).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() =>
          scopedMatch(new Request("./index.html")).then((r) => r ?? Response.error()),
        );
    }),
  );
});
