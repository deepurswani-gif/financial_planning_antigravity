/**
 * Delivery channels — Phase 1 uses push only.
 * Vocab is extensible for email / WhatsApp / in-app without rewriting entries.
 */

export const NOTIFICATION_CHANNELS = Object.freeze([
  'push',
  'in_app',
  'email',
  'whatsapp',
]);

const SET = new Set(NOTIFICATION_CHANNELS);

export function isNotificationChannel(value) {
  return SET.has(value);
}

export function listNotificationChannels() {
  return [...NOTIFICATION_CHANNELS];
}
