// Extended Studio Service Worker
const CACHE_VERSION = 'v2026-06-02-1'
const CACHE_NAME = `extended-studio-${CACHE_VERSION}`

self.addEventListener('install', () => { self.skipWaiting() })

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(fetch(req).catch(() => caches.match(req).then(r => r || caches.match('/'))))
    return
  }
  if (['image', 'style', 'script', 'font'].includes(req.destination)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(req).then(cached => {
          const fetchPromise = fetch(req).then(response => {
            if (response.ok) cache.put(req, response.clone())
            return response
          }).catch(() => cached)
          return cached || fetchPromise
        })
      )
    )
  }
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})
