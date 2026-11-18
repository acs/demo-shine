const CACHE = 'democlip-v1';
// The app shell. Vite emits hashed JS/CSS filenames, so those are cached at
// runtime on first load rather than listed here.
const CORE  = ['./', './index.html', './manifest.json', './icon.svg'];

self.addEventListener('install', e =>
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())
  )
);

self.addEventListener('activate', e =>
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
);

// The page itself is fetched from the network first. It is the one file that
// names the current hashed bundle, so serving it from the cache would keep an
// installed app on an old build for good; the cache is only the offline
// fallback. The hashed assets never change under a given name, so they stay
// cache-first.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  // `version.json` is how the app learns a newer build has been deployed, so it
  // must never come from a cache — not the browser's, and not this one.
  if (url.pathname.endsWith('/version.json')) {
    e.respondWith(fetch(e.request));
    return;
  }

  const put = res => { if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone())); return res; };

  if (e.request.mode === 'navigate' || e.request.destination === 'document') {
    e.respondWith(
      fetch(e.request).then(put).catch(() => caches.match(e.request).then(h => h || caches.match('./index.html')))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(put))
  );
});

