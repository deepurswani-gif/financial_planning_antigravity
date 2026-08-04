/**
 * Stable analytics keys for notification lifecycle tracking.
 * Product surfaces emit these via trackAnalyticsEvent; registry entries
 * carry an analyticsKey used as the notification identity in properties.
 */

export const NOTIFICATION_LIFECYCLE = Object.freeze({
  GENERATED: 'notification_generated',
  SENT: 'notification_sent',
  DELIVERED: 'notification_delivered',
  OPENED: 'notification_opened',
  DEEP_LINK_OPENED: 'notification_deep_link_opened',
});

export const NOTIFICATION_LIFECYCLE_EVENTS = Object.freeze(
  Object.values(NOTIFICATION_LIFECYCLE),
);

const SET = new Set(NOTIFICATION_LIFECYCLE_EVENTS);

export function isNotificationLifecycleEvent(value) {
  return SET.has(value);
}
