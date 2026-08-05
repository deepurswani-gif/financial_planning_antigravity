/* eslint-disable no-undef */
/**
 * Dedicated FCM service worker (separate from the VitePWA Workbox SW).
 * Public Firebase web config is intentional — same values as the client SDK.
 */
importScripts(
  'https://www.gstatic.com/firebasejs/12.17.0/firebase-app-compat.js'
);
importScripts(
  'https://www.gstatic.com/firebasejs/12.17.0/firebase-messaging-compat.js'
);

firebase.initializeApp({
  apiKey: 'AIzaSyApkW6x9uoYtSXHH8Jz5w1-diYznE2Y-us',
  authDomain: 'wealth-map-f296b.firebaseapp.com',
  projectId: 'wealth-map-f296b',
  storageBucket: 'wealth-map-f296b.firebasestorage.app',
  messagingSenderId: '469307199366',
  appId: '1:469307199366:web:6abb2cc407d0461cebe607',
  measurementId: 'G-SV53FJV1ZW',
});

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || 'Finbrella';
  const body = payload.notification?.body || payload.data?.body || '';
  // If FCM already displayed a webpush.notification, skip a duplicate tray entry.
  if (payload.notification?.title && payload.notification?.body) {
    return;
  }
  const options = {
    body,
    icon: `${self.location.origin}/pwa-192x192.png`,
    data: payload.data || {},
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
      return undefined;
    })
  );
});
