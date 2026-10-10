/* Asset Tagger service worker: precache app shell + libraries so the app works with no signal. */
const CACHE = 'asset-tagger-v1.4.0';
const ASSETS = [
  './', './index.html', './app.js', './styles.css', './manifest.webmanifest',
  './vendor/qrcode-generator.js', './vendor/html5-qrcode.min.js', './vendor/xlsx.full.min.js',
  './icons/icon.svg', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Stale-while-revalidate for same-origin GETs: instant offline load, quietly refreshed when online.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // The /demo/ showcase site is a separate static page: let the network handle it, never answer it with the app shell.
  if (req.url.startsWith(new URL('./demo/', self.registration.scope).href)) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(req, {ignoreSearch: true});
    const network = fetch(req).then(res => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
    if (cached) { e.waitUntil(network); return cached; }
    const res = await network;
    return res || (req.mode === 'navigate' ? cache.match('./index.html') : Response.error());
  }));
});
