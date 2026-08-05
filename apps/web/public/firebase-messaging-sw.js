/* eslint-disable no-undef */
/**
 * Firebase Messaging background handler.
 * Loaded either as:
 *  - standalone `/firebase-messaging-sw.js`, or
 *  - importScripts'd into the VitePWA Workbox SW (preferred on production).
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

function payloadToNotification(payload) {
  const data = payload?.data || {};
  const title = payload?.notification?.title || data.title || 'Finbrella';
  const body = payload?.notification?.body || data.body || '';
  // Small square PNG under /public — large logos cause Chrome Android to drop trays.
  const icon =
    data.icon ||
    payload?.notification?.icon ||
    `${self.location.origin}/pwa-192x192.png`;
  return {
    title,
    options: {
      body,
      icon,
      badge: `${self.location.origin}/pwa-192x192.png`,
      data: { ...data, url: data.url || `${self.location.origin}/` },
    },
  };
}

try {
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    const { title, options } = payloadToNotification(payload);
    return self.registration.showNotification(title, options);
  });
} catch (err) {
  // Avoid breaking the host Workbox SW if Messaging init fails.
  console.error('[FCM SW] init failed', err);
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || `${self.location.origin}/`;
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
