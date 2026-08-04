/**
 * Notification Registry schema — declarative metadata only (no React, no evaluators).
 */

import { isNotificationCategory } from './categories';
import { isNotificationChannel } from './channels';
import { isNotificationEvent } from './events';
import { isFrequencyType } from './frequency';
import { isDeepLinkId } from './deepLinks';
import { extractTokens } from './templating';

const ID_PATTERN = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+$/;

/**
 * @typedef {object} NotificationVariant
 * @property {string} id - e.g. 'A' | 'B'
 * @property {string} title
 * @property {string} body
 * @property {number} [weight] - reserved for future experimentation
 */

/**
 * @typedef {object} NotificationDefinition
 * @property {string} id
 * @property {number} version
 * @property {string} category
 * @property {string} event
 * @property {string} title - default / control copy
 * @property {string} body
 * @property {NotificationVariant[]} variants - A/B foundation (includes default as 'default' or A/B)
 * @property {string} deepLinkId
 * @property {boolean} enabled
 * @property {import('./frequency').NotificationFrequency} frequency
 * @property {string[]} placeholders
 * @property {string} analyticsKey
 * @property {string} channel - primary channel for Phase 1
 * @property {string[]} channels - all supported channels
 * @property {number} priority - lower = higher priority
 * @property {boolean} requiresOptIn
 * @property {string[]} tags
 * @property {string} [businessMeaning]
 */

/**
 * @param {object} partial
 * @returns {NotificationDefinition}
 */
export function normalizeNotification(partial) {
  const title = partial.title;
  const body = partial.body;
  const variants =
    Array.isArray(partial.variants) && partial.variants.length > 0
      ? partial.variants
      : [{ id: 'default', title, body, weight: 1 }];

  const channel = partial.channel ?? 'push';
  const channels = partial.channels ?? [channel];

  return {
    id: partial.id,
    version: partial.version ?? 1,
    category: partial.category,
    event: partial.event,
    title,
    body,
    variants: variants.map((v) => ({
      id: String(v.id),
      title: v.title ?? title,
      body: v.body ?? body,
      weight: typeof v.weight === 'number' ? v.weight : 1,
    })),
    deepLinkId: partial.deepLinkId,
    enabled: partial.enabled !== false,
    frequency: partial.frequency,
    placeholders: partial.placeholders ?? [],
    analyticsKey: partial.analyticsKey ?? partial.id,
    channel,
    channels,
    priority: partial.priority ?? 50,
    requiresOptIn: partial.requiresOptIn !== false,
    tags: partial.tags ?? [],
    businessMeaning: partial.businessMeaning ?? null,
  };
}

/**
 * @param {NotificationDefinition} notification
 * @returns {string[]}
 */
export function validateNotification(notification) {
  const errors = [];
  if (!notification || typeof notification !== 'object') {
    return ['Notification must be an object'];
  }

  if (!notification.id || typeof notification.id !== 'string') {
    errors.push('id is required');
  } else if (!ID_PATTERN.test(notification.id)) {
    errors.push(`id "${notification.id}" must be dotted camelCase segments`);
  }

  if (typeof notification.version !== 'number' || notification.version < 1) {
    errors.push('version must be a number >= 1');
  }

  if (!isNotificationCategory(notification.category)) {
    errors.push(`category "${notification.category}" is invalid`);
  }

  if (!isNotificationEvent(notification.event)) {
    errors.push(`event "${notification.event}" is invalid`);
  }

  if (!notification.title || typeof notification.title !== 'string') {
    errors.push('title is required');
  }
  if (!notification.body || typeof notification.body !== 'string') {
    errors.push('body is required');
  }

  if (!isDeepLinkId(notification.deepLinkId)) {
    errors.push(`deepLinkId "${notification.deepLinkId}" is invalid`);
  }

  if (typeof notification.enabled !== 'boolean') {
    errors.push('enabled must be boolean');
  }

  if (!notification.frequency || !isFrequencyType(notification.frequency.type)) {
    errors.push('frequency.type is invalid');
  }

  if (!Array.isArray(notification.placeholders)) {
    errors.push('placeholders must be an array');
  }

  if (!notification.analyticsKey || typeof notification.analyticsKey !== 'string') {
    errors.push('analyticsKey is required');
  }

  if (!isNotificationChannel(notification.channel)) {
    errors.push(`channel "${notification.channel}" is invalid`);
  }

  for (const ch of notification.channels ?? []) {
    if (!isNotificationChannel(ch)) errors.push(`channels contains invalid "${ch}"`);
  }

  if (typeof notification.priority !== 'number' || !(notification.priority > 0)) {
    errors.push('priority must be a positive number');
  }

  if (!Array.isArray(notification.variants) || notification.variants.length === 0) {
    errors.push('variants must be a non-empty array');
  } else {
    const variantIds = new Set();
    for (const v of notification.variants) {
      if (!v.id || !v.title || !v.body) {
        errors.push(`variant on ${notification.id} needs id, title, body`);
      }
      if (variantIds.has(v.id)) errors.push(`duplicate variant id "${v.id}" on ${notification.id}`);
      variantIds.add(v.id);
    }
  }

  // Declared placeholders should appear in default or variant copy
  const copyPool = [
    notification.title,
    notification.body,
    ...(notification.variants ?? []).flatMap((v) => [v.title, v.body]),
  ].join(' ');
  const present = new Set(extractTokens(copyPool));
  for (const key of notification.placeholders ?? []) {
    if (!present.has(key)) {
      errors.push(`placeholder "${key}" declared but not used in title/body/variants`);
    }
  }

  return errors;
}

export function assertNotification(notification) {
  const errors = validateNotification(notification);
  if (errors.length) {
    throw new Error(`Invalid notification ${notification?.id ?? '?'}: ${errors.join('; ')}`);
  }
}
