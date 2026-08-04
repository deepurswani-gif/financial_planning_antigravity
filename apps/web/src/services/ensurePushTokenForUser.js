/**
 * Ensure the current account has an FCM token bound in Supabase.
 * End users only toggle once; account switches re-bind automatically.
 */

import { enablePushNotifications, isPushOptedIn, setPushOptIn } from '../lib/pushNotifications';
import { hasEnabledPushToken, upsertPushToken } from './pushTokenService';

/**
 * Register (or refresh) this browser's FCM token and attach it to `userId`.
 * @param {string} userId
 * @param {{ force?: boolean }} [options] - force=true even if not previously opted in
 */
export async function ensurePushTokenForUser(userId, options = {}) {
  if (!userId) {
    return { ok: false, reason: 'no_user', token: null };
  }

  if (!options.force && !isPushOptedIn(userId)) {
    const { ok: hasToken } = await hasEnabledPushToken(userId);
    if (!hasToken) {
      return { ok: false, reason: 'not_opted_in', token: null };
    }
  }

  const { permission, token } = await enablePushNotifications({ userId });
  if (permission !== 'granted' || !token) {
    return { ok: false, reason: 'permission_or_token', permission, token: null };
  }

  const { error } = await upsertPushToken({ userId, token });
  if (error) {
    return { ok: false, reason: 'save_failed', token, error };
  }

  setPushOptIn(true, userId);
  try {
    sessionStorage.setItem('finplan_last_fcm_token', token);
    sessionStorage.setItem('finplan_last_fcm_user', userId);
  } catch {
    /* ignore */
  }

  return { ok: true, token, permission };
}
