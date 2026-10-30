const BASE_PATH = new URL(self.registration.scope).pathname;
const CACHE = 'field-sales-v2';
const CORE = [BASE_PATH, `${BASE_PATH}manifest.webmanifest`, `${BASE_PATH}icons/icon-192.png`, `${BASE_PATH}icons/icon-512.png`];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CORE);
    const indexUrl = `${BASE_PATH}index.html`;
    const response = await fetch(indexUrl);
    await cache.put(indexUrl, response.clone());
    const html = await response.text();
    const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map(match => match[1]);
    await Promise.all(assets.map(async path => {
      try { const asset = await fetch(path); if (asset.ok) await cache.put(path, asset); } catch { /* shell remains usable */ }
    }));
  })());
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key.startsWith('field-sales-') && key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(BASE_PATH)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request, { ignoreVary: true });
    if (cached) return cached;
    try {
      const response = await fetch(request);
      const appAsset = url.pathname.startsWith(`${BASE_PATH}assets/`) || url.pathname.startsWith(`${BASE_PATH}icons/`) || url.pathname === `${BASE_PATH}manifest.webmanifest`;
      if (response.ok && (request.mode === 'navigate' || appAsset)) await cache.put(request, response.clone());
      return response;
    } catch {
      if (request.mode === 'navigate') return (await cache.match(`${BASE_PATH}index.html`, { ignoreVary: true })) || (await cache.match(BASE_PATH, { ignoreVary: true }));
      return new Response('', { status: 504, statusText: 'Offline' });
    }
  })());
});
