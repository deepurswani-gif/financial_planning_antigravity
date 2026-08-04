import { interpolate } from './templating';
import { resolveDeepLink } from './deepLinks';
import { evaluateNotificationEvent } from './triggerEvaluators';
import { evaluateNotificationFrequency } from './frequencyPolicy';
import { planDelivery, DEFAULT_PUSH_POLICY } from './policy';

/**
 * Select a message variant. Phase 1: explicit variantId or first variant / default copy.
 * Experimentation logic can replace this later without changing the registry.
 *
 * @param {import('./schema').NotificationDefinition} notification
 * @param {{ variantId?: string }} [options]
 */
export function selectVariant(notification, options = {}) {
  const variants = notification.variants ?? [];
  if (options.variantId) {
    const found = variants.find((v) => v.id === options.variantId);
    if (found) return found;
  }
  return (
    variants.find((v) => v.id === 'A') ||
    variants.find((v) => v.id === 'default') ||
    variants[0] || {
      id: 'default',
      title: notification.title,
      body: notification.body,
      weight: 1,
    }
  );
}

/**
 * Render title/body/deep link for a notification + placeholder values.
 * @param {import('./schema').NotificationDefinition} notification
 * @param {{
 *   placeholders?: Record<string, unknown>,
 *   variantId?: string,
 *   deepLinkParams?: object,
 * }} [options]
 */
export function renderNotification(notification, options = {}) {
  const variant = selectVariant(notification, options);
  const values = options.placeholders ?? {};
  const deepLink = resolveDeepLink(notification.deepLinkId, options.deepLinkParams);

  return {
    notificationId: notification.id,
    version: notification.version,
    variantId: variant.id,
    analyticsKey: notification.analyticsKey,
    category: notification.category,
    event: notification.event,
    channel: notification.channel,
    title: interpolate(variant.title, values),
    body: interpolate(variant.body, values),
    deepLink,
    priority: notification.priority,
  };
}

/**
 * Build FCM-ready payload (channel-agnostic core + push fields).
 * @param {ReturnType<typeof renderNotification>} rendered
 */
export function buildPushPayload(rendered) {
  return {
    title: rendered.title,
    body: rendered.body,
    data: {
      notificationId: rendered.notificationId,
      version: String(rendered.version),
      variantId: rendered.variantId,
      analyticsKey: rendered.analyticsKey,
      deepLinkId: rendered.deepLink.deepLinkId,
      url: rendered.deepLink.path,
      channel: 'push',
    },
  };
}

/**
 * Full Phase-1 resolution: trigger → frequency → global policy → render.
 *
 * @param {import('./schema').NotificationDefinition} notification
 * @param {Record<string, unknown>} signals
 * @param {{
 *   history?: object[],
 *   globalSendHistory?: object[],
 *   now?: Date,
 *   variantId?: string,
 *   placeholders?: Record<string, unknown>,
 *   deepLinkParams?: object,
 *   policy?: import('./policy').PushDeliveryPolicy,
 *   optedIn?: boolean,
 * }} [context]
 */
export function resolveNotificationDelivery(notification, signals = {}, context = {}) {
  if (!notification?.enabled) {
    return { applicable: false, reason: 'disabled' };
  }
  if (notification.requiresOptIn && context.optedIn === false) {
    return { applicable: false, reason: 'not_opted_in' };
  }
  if (!evaluateNotificationEvent(notification.event, signals)) {
    return { applicable: false, reason: 'trigger_not_met' };
  }

  const scopeValue =
    notification.frequency?.scopeKey != null
      ? signals[notification.frequency.scopeKey] ?? context.scopeValue
      : context.scopeValue;

  const fingerprintKey = notification.frequency?.changeFingerprintKey;
  const fingerprint =
    fingerprintKey != null ? signals[fingerprintKey] ?? context.fingerprint : context.fingerprint;

  const freq = evaluateNotificationFrequency(notification, context.history ?? [], {
    now: context.now,
    scopeValue: scopeValue != null ? String(scopeValue) : null,
    fingerprint: fingerprint != null ? String(fingerprint) : null,
  });
  if (!freq.ok) {
    return { applicable: false, reason: freq.reason };
  }

  const placeholders = {
    ...(context.placeholders ?? {}),
  };
  if (signals.amount != null && placeholders.amount == null) {
    placeholders.amount = signals.amount;
  }
  if (signals.monthlySurplusDisplay != null && placeholders.amount == null) {
    placeholders.amount = signals.monthlySurplusDisplay;
  }

  const rendered = renderNotification(notification, {
    variantId: context.variantId,
    placeholders,
    deepLinkParams: context.deepLinkParams,
  });

  const delivery = planDelivery(
    context.globalSendHistory ?? [],
    context.now ?? new Date(),
    context.policy ?? DEFAULT_PUSH_POLICY,
  );

  const push = buildPushPayload(rendered);

  return {
    applicable: true,
    reason: null,
    rendered,
    push,
    delivery,
  };
}
