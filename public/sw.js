const CACHE = 'uktaxer-2026.1';
const send = async data => { for (const client of await self.clients.matchAll({ includeUncontrolled: true })) client.postMessage(data); };
self.addEventListener('install', event => event.waitUntil((async () => {
  try {
    const cache = await caches.open(CACHE);
    const response = await fetch('/precache.json'); if (!response.ok) throw new Error('Offline manifest unavailable');
    const { assets: urls } = await response.json();
    let done = 0;
    for (const url of urls) {
      const asset = await fetch(url); if (!asset.ok) throw new Error(`${url}: HTTP ${asset.status}`);
      await cache.put(url, asset); done++;
      await send({ type: 'progress', done, total: urls.length });
    }
    await self.skipWaiting(); await send({ type: 'complete' });
  } catch (error) { await send({ type: 'error', error: String(error.message || error) }); throw error; }
})()));
self.addEventListener('activate', event => event.waitUntil((async () => { for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key); await self.clients.claim(); })()));
self.addEventListener('fetch', event => { const url = new URL(event.request.url); if (event.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return; event.respondWith((async () => { const cached = await caches.match(event.request); if (cached) return cached; try { return await fetch(event.request); } catch { return new Response('Offline asset unavailable. Complete the offline download while connected.', { status: 503, headers: { 'Content-Type': 'text/plain' } }); } })()); });
