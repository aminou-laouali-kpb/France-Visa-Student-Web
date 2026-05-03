// Register the VisaFlow service worker. The SW lives at /<base>/sw.js so it
// scopes to the artifact's preview path — required because each artifact in
// this monorepo is mounted on a different prefix. Registration is fire-and-
// forget; failures are logged but never block the app.

export function registerSW(): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (import.meta.env.DEV) return; // avoid the dev-server cache headache
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${base}/sw.js`, { scope: `${base}/` })
      .catch((err) => console.warn("SW registration failed", err));
  });
}

// Tell the SW which user is now active so it writes fetches into that user's
// cache namespace. Call this after a successful sign-in.
export function activateUserCache(userId: string): void {
  if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;
  navigator.serviceWorker.ready
    .then((reg) => reg.active?.postMessage({ type: "ACTIVATE_USER", userId }))
    .catch(() => {});
}

// Instruct the SW to delete the cache that belongs to this user. Call this
// before or immediately after sign-out so a subsequent user cannot see the
// previous session's cached shell entries.
export function purgeUserCache(userId: string): void {
  if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;
  navigator.serviceWorker.ready
    .then((reg) => reg.active?.postMessage({ type: "PURGE_USER_CACHE", userId }))
    .catch(() => {});
}
