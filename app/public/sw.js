// Service worker minimal : il rend le site installable sur l'écran d'accueil.
// Il ne sert QUE l'icône et les fichiers d'habillage depuis le cache : la
// navigation, les pages et les API passent directement au réseau (les créneaux
// et le tableau de bord doivent toujours être à jour, et intercepter la
// navigation casserait le préchargement de Next.js).
const CACHE = "arboris-shell-v1";
const ASSETS = [
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png",
  "/logo.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !ASSETS.includes(url.pathname)) return;
  event.respondWith(caches.match(request).then((hit) => hit || fetch(request)));
});
