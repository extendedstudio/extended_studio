// Extended Studio Service Worker
// 보수적 전략: HTML/API는 항상 네트워크 우선, 정적 자원만 캐시

const CACHE_VERSION = 'v2026-06-02-1'
const CACHE_NAME = `extended-studio-${CACHE_VERSION}`

// 설치 — 즉시 활성화
self.addEventListener('install', (event) => {
  self.skipWaiting()
})

// 활성화 — 옛 캐시 전부 삭제 + 모든 탭에 즉시 적용
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
      await self.clients.claim()
    })()
  )
})

// fetch 전략
self.addEventListener('fetch', (event) => {
  const req = event.request

  // POST 등 GET 외 요청은 패스
  if (req.method !== 'GET') return

  const url = new URL(req.url)

  // 외부 도메인 (Firebase, Anthropic API, Naver blog 등) 패스
  if (url.origin !== self.location.origin) return

  // /api/* 패스 (chat.js, notify.js)
  if (url.pathname.startsWith('/api/')) return

  // HTML 페이지: 네트워크 우선 (항상 최신 가격/이미지 반영)
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req).catch(() => caches.match(req).then((r) => r || caches.match('/')))
    )
    return
  }

  // 이미지/CSS/JS: stale-while-revalidate (캐시 빠르게 보여주고 백그라운드 업데이트)
  if (['image', 'style', 'script', 'font'].includes(req.destination)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(req).then((cached) => {
          const fetchPromise = fetch(req)
            .then((response) => {
              if (response.ok) cache.put(req, response.clone())
              return response
            })
            .catch(() => cached)
          return cached || fetchPromise
        })
      )
    )
  }
})

// 클라이언트에서 'SKIP_WAITING' 메시지 받으면 즉시 활성화 (수동 갱신용)
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})
