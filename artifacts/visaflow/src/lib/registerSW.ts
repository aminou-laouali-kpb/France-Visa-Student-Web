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
