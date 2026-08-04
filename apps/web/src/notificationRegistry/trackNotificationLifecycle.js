/**
 * Emit notification lifecycle analytics using registry analyticsKey.
 */

import { trackAnalyticsEvent } from '../lib/analytics';
import { NOTIFICATION_LIFECYCLE } from './analyticsKeys';

/**
 * @param {string} lifecycleEvent - one of NOTIFICATION_LIFECYCLE.*
 * @param {{
 *   analyticsKey: string,
 *   notificationId: string,
 *   version?: number,
 *   variantId?: string,
 *   deepLinkId?: string,
 *   channel?: string,
 *   userId?: string,
 *   planId?: string,
 *   properties?: object,
 * }} payload
 */
export function trackNotificationLifecycle(lifecycleEvent, payload) {
  if (!payload?.analyticsKey || !payload?.notificationId) return;

  trackAnalyticsEvent({
    eventName: lifecycleEvent,
    eventCategory: 'notification',
    feature: payload.analyticsKey,
    component: 'notificationRegistry',
    userId: payload.userId,
    planId: payload.planId,
    properties: {
      analyticsKey: payload.analyticsKey,
      notificationId: payload.notificationId,
      version: payload.version ?? null,
      variantId: payload.variantId ?? null,
      deepLinkId: payload.deepLinkId ?? null,
      channel: payload.channel ?? 'push',
      lifecycle: lifecycleEvent,
      ...(payload.properties ?? {}),
    },
  });
}

export function trackNotificationGenerated(payload) {
  trackNotificationLifecycle(NOTIFICATION_LIFECYCLE.GENERATED, payload);
}

export function trackNotificationSent(payload) {
  trackNotificationLifecycle(NOTIFICATION_LIFECYCLE.SENT, payload);
}

export function trackNotificationDelivered(payload) {
  trackNotificationLifecycle(NOTIFICATION_LIFECYCLE.DELIVERED, payload);
}

export function trackNotificationOpened(payload) {
  trackNotificationLifecycle(NOTIFICATION_LIFECYCLE.OPENED, payload);
}

export function trackNotificationDeepLinkOpened(payload) {
  trackNotificationLifecycle(NOTIFICATION_LIFECYCLE.DEEP_LINK_OPENED, payload);
}
