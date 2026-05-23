// Firebase Cloud Messaging Service Worker
// 백그라운드 푸시 알림 수신용
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBjLF36OWYOZ-xefFMujXryn7XeG9C5lYO",
  authDomain: "extended-studio.firebaseapp.com",
  projectId: "extended-studio",
  storageBucket: "extended-studio.firebasestorage.app",
  messagingSenderId: "910732755063",
  appId: "1:910732755063:web:6f3d3655ff691610920672"
});

const messaging = firebase.messaging();

// 백그라운드 알림 처리
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message:', payload);
  const title = payload.notification?.title || payload.data?.title || '새 예약 신청';
  const options = {
    body: payload.notification?.body || payload.data?.body || '',
    icon: '/pwa-192.png',
    badge: '/pwa-192.png',
    tag: payload.data?.tag || 'extended-studio-notification',
    data: payload.data || {},
    vibrate: [200, 100, 200],
    requireInteraction: true,
  };
  return self.registration.showNotification(title, options);
});

// 알림 클릭 시 어드민 페이지로 이동
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/?page=admin';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
