import { deleteToken, getToken, onMessage } from 'firebase/messaging';
import { getFirebaseMessaging, isFirebaseConfigured } from './firebase';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;
/** Legacy dedicated FCM SW (fallback if PWA SW is not ready). */
const FCM_SW_URL = '/firebase-messaging-sw.js';
const FCM_SW_SCOPE = '/firebase-cloud-messaging-push-scope';
/** Legacy browser-wide flag (pre per-user). */
const PREF_KEY_LEGACY = 'finplan_push_opt_in';

let foregroundUnsubscribe = null;

function prefKeyForUser(userId) {
  return userId ? `${PREF_KEY_LEGACY}:${userId}` : PREF_KEY_LEGACY;
}

/**
 * Opt-in is per signed-in user. Legacy browser-wide flag is only a migration fallback.
 * @param {string} [userId]
 */
export function isPushOptedIn(userId) {
  try {
    if (userId) {
      const perUser = localStorage.getItem(prefKeyForUser(userId));
      if (perUser === '1') return true;
      if (perUser === '0') return false;
      // One-time migration: older builds stored a single browser flag.
      return localStorage.getItem(PREF_KEY_LEGACY) === '1';
    }
    return localStorage.getItem(PREF_KEY_LEGACY) === '1';
  } catch {
    return false;
  }
}

/**
 * @param {boolean} enabled
 * @param {string} [userId]
 */
export function setPushOptIn(enabled, userId) {
  try {
    if (userId) {
      localStorage.setItem(prefKeyForUser(userId), enabled ? '1' : '0');
    }
    if (enabled) localStorage.setItem(PREF_KEY_LEGACY, '1');
    else if (!userId) localStorage.removeItem(PREF_KEY_LEGACY);
  } catch {
    /* ignore quota / private mode */
  }
}

export function getNotificationPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

async function waitUntilServiceWorkerActive(registration) {
  if (registration.active) return registration;

  const worker = registration.installing || registration.waiting;
  if (!worker) {
    throw new Error(
      'FCM service worker did not start. Open DevTools → Application → Service Workers and check firebase-messaging-sw.js.'
    );
  }

  if (worker.state === 'activated') return registration;

  await new Promise((resolve, reject) => {
    worker.addEventListener('statechange', () => {
      if (worker.state === 'activated') resolve();
      if (worker.state === 'redundant') {
        reject(new Error('FCM service worker became redundant during install.'));
      }
    });
  });

  return registration;
}

/**
 * Prefer the VitePWA Workbox SW (scope `/`, importScripts FCM).
 * Fall back to a dedicated FCM registration if PWA SW is unavailable.
 */
async function getOrRegisterMessagingServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers are not supported in this browser.');
  }

  // Wait briefly for VitePWA's injected register() to finish.
  const readyPromise = navigator.serviceWorker.ready;
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 4000));
  const ready = await Promise.race([readyPromise, timeout]);
  if (ready?.active) {
    try {
      await ready.update();
    } catch {
      /* ignore */
    }
    return ready;
  }

  let registration = await navigator.serviceWorker.getRegistration(FCM_SW_SCOPE);
  if (!registration || !registration.active) {
    registration = await navigator.serviceWorker.register(FCM_SW_URL, {
      scope: FCM_SW_SCOPE,
      updateViaCache: 'none',
    });
  }
  return waitUntilServiceWorkerActive(registration);
}

function notificationIconUrl() {
  return `${typeof window !== 'undefined' ? window.location.origin : ''}/pwa-192x192.png`;
}

function ensureForegroundListener(messaging) {
  if (foregroundUnsubscribe) return;
  foregroundUnsubscribe = onMessage(messaging, (payload) => {
    const title = payload.notification?.title || payload.data?.title || 'Finbrella';
    const body = payload.notification?.body || payload.data?.body || '';
    const icon = payload.data?.icon || notificationIconUrl();
    if (import.meta.env.DEV) {
      console.info('[FCM] Message received (foreground):', payload);
    }
    if (Notification.permission !== 'granted') return;

    const showViaSw = async () => {
      try {
        const registration =
          (await navigator.serviceWorker.ready) ||
          (await navigator.serviceWorker.getRegistration(FCM_SW_SCOPE));
        if (registration?.showNotification) {
          await registration.showNotification(title, {
            body,
            icon,
            badge: icon,
            data: payload.data || {},
          });
          return;
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn('[FCM] showNotification failed:', err);
        }
      }
      try {
        new Notification(title, { body, icon, data: payload.data || {} });
      } catch {
        /* ignore */
      }
    };
    void showViaSw();
  });
}

/**
 * Show a local tray notification via the active SW (does not use FCM).
 * Useful to verify OS/Chrome notification permission independently of FCM delivery.
 */
export async function showLocalTrayNotification({ title, body, data } = {}) {
  if (Notification.permission !== 'granted') {
    return { ok: false, reason: 'permission' };
  }
  const icon = notificationIconUrl();
  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title || 'Finbrella', {
      body: body || '',
      icon,
      badge: icon,
      data: data || {},
    });
    return { ok: true };
  } catch (err) {
    try {
      new Notification(title || 'Finbrella', {
        body: body || '',
        icon,
        data: data || {},
      });
      return { ok: true, via: 'Notification' };
    } catch (err2) {
      return { ok: false, error: err2 || err };
    }
  }
}

/**
 * Request permission, register FCM SW + VAPID, return registration token.
 * @param {{ userId?: string }} [options]
 */
export async function enablePushNotifications(options = {}) {
  const userId = options.userId;
  if (!isFirebaseConfigured) {
    throw new Error(
      'Firebase is not configured. Add VITE_FIREBASE_* vars to .env.local (repo root).'
    );
  }
  if (!VAPID_KEY) {
    throw new Error(
      'Missing VITE_FIREBASE_VAPID_KEY (Web Push certificate from Firebase Console).'
    );
  }
  if (typeof Notification === 'undefined') {
    throw new Error('Notifications API is not available in this browser.');
  }

  const permission =
    Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();

  if (permission !== 'granted') {
    setPushOptIn(false, userId);
    return { permission, token: null };
  }

  const messaging = await getFirebaseMessaging();
  if (!messaging) {
    throw new Error(
      'Firebase Messaging is not supported in this browser (needs HTTPS or localhost).'
    );
  }

  const serviceWorkerRegistration = await getOrRegisterMessagingServiceWorker();
  if (!serviceWorkerRegistration.active) {
    throw new Error('FCM service worker registered but is not active yet. Refresh and try again.');
  }

  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration,
  });

  ensureForegroundListener(messaging);
  setPushOptIn(Boolean(token), userId);

  if (import.meta.env.DEV && token) {
    console.info('[FCM] Registration token:\n', token);
  }

  return { permission, token };
}

/** Opt out for this user and delete the FCM token from this browser. */
export async function disablePushNotifications(options = {}) {
  setPushOptIn(false, options.userId);

  const messaging = await getFirebaseMessaging();
  if (!messaging) return { deleted: false };

  try {
    const deleted = await deleteToken(messaging);
    return { deleted: Boolean(deleted) };
  } catch {
    return { deleted: false };
  }
}

/** Foreground messages while the tab is open. */
export async function subscribeToForegroundMessages(handler) {
  const messaging = await getFirebaseMessaging();
  if (!messaging) return () => {};
  return onMessage(messaging, handler);
}
