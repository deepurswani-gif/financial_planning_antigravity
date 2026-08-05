import { deleteToken, getToken, onMessage } from 'firebase/messaging';
import { getFirebaseMessaging, isFirebaseConfigured } from './firebase';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;
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

async function getOrRegisterMessagingServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers are not supported in this browser.');
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

function ensureForegroundListener(messaging) {
  if (foregroundUnsubscribe) return;
  foregroundUnsubscribe = onMessage(messaging, (payload) => {
    const title = payload.notification?.title || payload.data?.title || 'Finbrella';
    const body = payload.notification?.body || payload.data?.body || '';
    const icon =
      payload.data?.icon ||
      `${typeof window !== 'undefined' ? window.location.origin : ''}/pwa-192x192.png`;
    if (import.meta.env.DEV) {
      console.info('[FCM] Message received (foreground):', payload);
    }
    if (Notification.permission !== 'granted') return;

    // Chrome Android often ignores `new Notification()` while the tab is focused.
    // Prefer the FCM service worker tray notification instead.
    const showViaSw = async () => {
      try {
        const registration =
          (await navigator.serviceWorker.getRegistration(FCM_SW_SCOPE)) ||
          (await navigator.serviceWorker.ready);
        if (registration?.showNotification) {
          await registration.showNotification(title, {
            body,
            icon,
            data: payload.data || {},
          });
          return;
        }
      } catch {
        /* fall through */
      }
      new Notification(title, {
        body,
        icon,
        data: payload.data || {},
      });
    };
    void showViaSw();
  });
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
