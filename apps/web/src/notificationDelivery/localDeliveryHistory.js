/**
 * Local delivery history + quiet-hour queue for Phase-1 client dispatch.
 * Scoped per userId. Server-side log can replace this later.
 */

const STORAGE_KEY = 'finplan_notification_delivery_v1';

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore quota */
  }
}

function ensureUserBucket(store, userId) {
  if (!store[userId]) {
    store[userId] = { sends: [], pending: [] };
  }
  if (!Array.isArray(store[userId].sends)) store[userId].sends = [];
  if (!Array.isArray(store[userId].pending)) store[userId].pending = [];
  return store[userId];
}

/**
 * @param {string} userId
 * @returns {{ notificationId: string, sentAt: string, scopeKey?: string|null, fingerprint?: string|null }[]}
 */
export function getNotificationSendHistory(userId) {
  if (!userId) return [];
  const bucket = ensureUserBucket(readStore(), userId);
  return [...bucket.sends];
}

/**
 * Global send timestamps for rate-limit evaluation.
 * @param {string} userId
 */
export function getGlobalSendHistory(userId) {
  return getNotificationSendHistory(userId).map((s) => ({ sentAt: s.sentAt }));
}

/**
 * @param {string} userId
 * @param {{ notificationId: string, sentAt?: string, scopeKey?: string|null, fingerprint?: string|null, variantId?: string, version?: number }} entry
 */
export function recordNotificationSent(userId, entry) {
  if (!userId || !entry?.notificationId) return;
  const store = readStore();
  const bucket = ensureUserBucket(store, userId);
  bucket.sends.push({
    notificationId: entry.notificationId,
    sentAt: entry.sentAt || new Date().toISOString(),
    scopeKey: entry.scopeKey ?? null,
    fingerprint: entry.fingerprint ?? null,
    variantId: entry.variantId ?? null,
    version: entry.version ?? null,
  });
  // Keep last 90 days roughly
  const cutoff = Date.now() - 90 * 86400 * 1000;
  bucket.sends = bucket.sends.filter((s) => new Date(s.sentAt).getTime() >= cutoff);
  writeStore(store);
}

/**
 * Queue a rendered notification until quiet hours end.
 * @param {string} userId
 * @param {{ notificationId: string, deliverAt: string, push: object, rendered: object }} item
 */
export function enqueuePendingNotification(userId, item) {
  if (!userId || !item?.notificationId) return;
  const store = readStore();
  const bucket = ensureUserBucket(store, userId);
  // Replace same notificationId pending entry
  bucket.pending = bucket.pending.filter((p) => p.notificationId !== item.notificationId);
  bucket.pending.push({
    ...item,
    queuedAt: new Date().toISOString(),
  });
  writeStore(store);
}

/**
 * @param {string} userId
 * @param {Date} [now]
 */
export function listDuePendingNotifications(userId, now = new Date()) {
  if (!userId) return [];
  const bucket = ensureUserBucket(readStore(), userId);
  const nowMs = now.getTime();
  return bucket.pending.filter((p) => {
    const t = new Date(p.deliverAt).getTime();
    return Number.isFinite(t) && t <= nowMs;
  });
}

/**
 * @param {string} userId
 * @param {string} notificationId
 */
export function removePendingNotification(userId, notificationId) {
  if (!userId || !notificationId) return;
  const store = readStore();
  const bucket = ensureUserBucket(store, userId);
  bucket.pending = bucket.pending.filter((p) => p.notificationId !== notificationId);
  writeStore(store);
}
