// Extended Studio Service Worker (캐시 + FCM 푸시 알림 수신을 이 파일 하나로 처리)
// ※ 서비스워커는 같은 범위('/')에 하나만 존재할 수 있음. 예전엔 firebase-messaging-sw.js 가 따로 있어서
//    페이지를 열 때마다 서로 덮어써 알림 수신 코드가 사라졌음 → 이 파일로 통합
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyBjlF360WY0Z-xefFMujXryn7XeG9C5lY0',
  authDomain: 'extended-studio.firebaseapp.com',
  projectId: 'extended-studio',
  storageBucket: 'extended-studio.firebasestorage.app',
  messagingSenderId: '910732755063',
  appId: '1:910732755063:web:6f3d3655ff691610920672',
})
const messaging = firebase.messaging()

// 앱 아이콘 숫자 (Badging API — 아이폰 홈 화면 앱 iOS 16.4+, 설치한 Chrome/Edge/Safari 앱)
// 서버가 보낸 '처리 안 한 건수'(data.badge)로 설정. 알림 표시는 FCM SDK가 따로 처리함
self.addEventListener('push', event => {
  let badge = null
  try { const p = event.data && event.data.json(); badge = p && p.data && p.data.badge } catch (_) {}
  const n = Number(badge)
  if (badge != null && Number.isFinite(n) && self.navigator && 'setAppBadge' in self.navigator) {
    event.waitUntil((n > 0 ? self.navigator.setAppBadge(n) : self.navigator.clearAppBadge()).catch(() => {}))
  }
})

// 앱이 닫혀 있거나 백그라운드일 때 도착한 알림 (notification 필드가 없는 데이터 메시지용 — notification 필드가 있으면 SDK가 자동 표시)
messaging.onBackgroundMessage(payload => {
  if (payload.notification) return
  const title = payload.data?.title || '새 예약 신청'
  return self.registration.showNotification(title, {
    body: payload.data?.body || '',
    icon: '/pwa-192.png',
    badge: '/pwa-192.png',
    tag: payload.data?.tag || 'extended-studio-notification',
    data: payload.data || {},
    requireInteraction: true,
  })
})

// 알림을 누르면 관리자 화면으로
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const data = event.notification.data || {}
  const url = data.url || (data.FCM_MSG && data.FCM_MSG.data && data.FCM_MSG.data.url) || '/?page=admin'
  event.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of list) {
      if (c.url.startsWith(self.location.origin) && 'focus' in c) {
        try { await c.navigate(url) } catch (_) {}
        return c.focus()
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(url)
  })())
})

const CACHE_VERSION = 'v2026-11-01-2'
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
