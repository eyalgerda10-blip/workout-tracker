/* ATHLEAN service worker — offline support
   SHELL  : network-first  (so a new deploy always wins when online)
   ASSETS : cache-first    (images + fonts never change; serve instantly, work offline) */

const VERSION = 'v1';
const SHELL_CACHE  = `athlean-shell-${VERSION}`;
const ASSET_CACHE  = `athlean-assets-${VERSION}`;

const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

const ASSET_HOSTS = [
  'raw.githubusercontent.com',   // exercise photos
  'fonts.googleapis.com',        // font stylesheet
  'fonts.gstatic.com',           // font files
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(SHELL_CACHE)
      .then(c => Promise.allSettled(SHELL_FILES.map(f => c.add(f))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== SHELL_CACHE && k !== ASSET_CACHE)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // ── app shell: network-first, cache fallback ──
  const isShell = req.mode === 'navigate' ||
                  (url.origin === self.location.origin && /\.(html|json)$/.test(url.pathname)) ||
                  url.pathname === self.location.pathname;

  if (isShell) {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then(c => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  // ── images & fonts: cache-first ──
  if (ASSET_HOSTS.includes(url.hostname) || url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(ASSET_CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match(req)))
    );
  }
});
