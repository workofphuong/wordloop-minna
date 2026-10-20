// Offline cache. Bump VERSION when files are added or removed (it refreshes the precache list).
const VERSION = 'm1';
const CACHE = 'minna-' + VERSION;
const FILES = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './fonts/nunito-latin-wght-normal.woff2', './fonts/nunito-vietnamese-wght-normal.woff2',
  './icons/icon-192.png', './icons/icon-512.png',
  './js/main.js', './js/model.js', './js/store.js', './js/importer.js', './js/schedule.js',
  './js/checker.js', './js/romaji.js', './js/minna.js', './js/exercises.js', './js/engine.js',
  './js/session.js', './js/backup.js', './js/pwa.js', './js/llm-slot.js',
  './js/ui/dom.js', './js/ui/home.js', './js/ui/list.js', './js/ui/newlist.js','./js/ui/add.js', './js/ui/round.js',
  './js/ui/words.js', './js/ui/examples.js', './js/examples.js', './js/ui/practice.js', './js/ui/settings.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('minna-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()));
});

// Network first so edits show up as soon as you are online; the cache is the offline fallback.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })));
});
