/**
 * Notification Registry — declarative source of truth for Finbrella coach pushes.
 *
 *   Notification Registry (metadata: event + templates + deepLink + frequency)
 *            |
 *   Trigger evaluators (signals → boolean)     ← no finance math
 *            |
 *   Frequency + global policy (quiet hours / rate limits)
 *            |
 *   Resolver → rendered title/body + deep link + FCM payload
 *            |
 *   Delivery channel (push today; email / WhatsApp / in-app later)
 */

import { normalizeNotification, assertNotification } from './schema';
import { validateRegistry } from './validateRegistry';
import {
  resolveNotificationDelivery,
  renderNotification,
  selectVariant,
  buildPushPayload,
} from './resolveNotification';
import { PHASE1_NOTIFICATIONS } from './notifications/phase1';

const ALL = PHASE1_NOTIFICATIONS.map(normalizeNotification);

const seenIds = new Set();
ALL.forEach((n) => {
  assertNotification(n);
  if (seenIds.has(n.id)) {
    throw new Error(`Duplicate notification id "${n.id}"`);
  }
  seenIds.add(n.id);
});

/** @type {ReadonlyArray<import('./schema').NotificationDefinition>} */
export const NOTIFICATION_REGISTRY = Object.freeze(ALL);

const BY_ID = new Map(NOTIFICATION_REGISTRY.map((n) => [n.id, n]));

export function getNotificationById(id) {
  return BY_ID.get(id) ?? null;
}

export function hasNotification(id) {
  return BY_ID.has(id);
}

/**
 * @param {{ category?: string, channel?: string, event?: string, tag?: string, enabled?: boolean }} [options]
 */
export function listNotifications(options = {}) {
  let list = [...NOTIFICATION_REGISTRY];
  if (options.category) list = list.filter((n) => n.category === options.category);
  if (options.channel) list = list.filter((n) => (n.channels ?? []).includes(options.channel));
  if (options.event) list = list.filter((n) => n.event === options.event);
  if (options.tag) list = list.filter((n) => (n.tags ?? []).includes(options.tag));
  if (options.enabled != null) list = list.filter((n) => n.enabled === options.enabled);
  return list;
}

/**
 * Resolve whether / how to deliver a notification for the given signals.
 */
export function resolveNotification(notificationId, signals, context = {}) {
  const notification = getNotificationById(notificationId);
  if (!notification) {
    return { applicable: false, reason: 'unknown_notification' };
  }
  return resolveNotificationDelivery(notification, signals, context);
}

/**
 * Evaluate all enabled notifications against signals; return applicable plans sorted by priority.
 */
export function resolveApplicableNotifications(signals, context = {}) {
  return listNotifications({ enabled: true })
    .map((n) => ({ notification: n, result: resolveNotificationDelivery(n, signals, context) }))
    .filter((row) => row.result.applicable)
    .sort((a, b) => a.notification.priority - b.notification.priority);
}

export function getNotificationRegistryDiagnostics() {
  const result = validateRegistry(NOTIFICATION_REGISTRY);
  return {
    ...result,
    count: NOTIFICATION_REGISTRY.length,
  };
}

export {
  renderNotification,
  selectVariant,
  buildPushPayload,
  resolveNotificationDelivery,
};

export { NOTIFICATION_CATEGORIES, isNotificationCategory, listNotificationCategories } from './categories';
export { NOTIFICATION_CHANNELS, isNotificationChannel, listNotificationChannels } from './channels';
export { NOTIFICATION_EVENTS, isNotificationEvent, listNotificationEvents } from './events';
export { FREQUENCY_TYPES, isFrequencyType } from './frequency';
export {
  DEEP_LINK_REGISTRY,
  getDeepLinkById,
  isDeepLinkId,
  listDeepLinks,
  resolveDeepLink,
} from './deepLinks';
export {
  DEFAULT_PUSH_POLICY,
  isInQuietHours,
  nextQuietHoursEnd,
  evaluateRateLimits,
  planDelivery,
  resolveEffectiveRateLimits,
} from './policy';
export { evaluateNotificationEvent, NOTIFICATION_TRIGGER_EVALUATORS } from './triggerEvaluators';
export { evaluateNotificationFrequency } from './frequencyPolicy';
export { interpolate, extractTokens } from './templating';
export {
  NOTIFICATION_LIFECYCLE,
  NOTIFICATION_LIFECYCLE_EVENTS,
  isNotificationLifecycleEvent,
} from './analyticsKeys';
export { normalizeNotification, validateNotification, assertNotification } from './schema';
export { validateRegistry } from './validateRegistry';
export {
  trackNotificationLifecycle,
  trackNotificationGenerated,
  trackNotificationSent,
  trackNotificationDelivered,
  trackNotificationOpened,
  trackNotificationDeepLinkOpened,
} from './trackNotificationLifecycle';
export { openNotificationDeepLink } from './openNotificationDeepLink';
