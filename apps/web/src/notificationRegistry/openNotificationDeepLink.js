/**
 * Helpers for opening registry deep links from push / in-app payloads.
 */

import { resolveDeepLink, getDeepLinkById } from './deepLinks';
import { trackNotificationDeepLinkOpened, trackNotificationOpened } from './trackNotificationLifecycle';

/**
 * Normalize FCM / notification data into a navigable path + analytics.
 * @param {Record<string, string>} data
 * @param {{ userId?: string, planId?: string, navigate?: (path: string) => void }} [options]
 */
export function openNotificationDeepLink(data = {}, options = {}) {
  const notificationId = data.notificationId || data.analyticsKey || '';
  const analyticsKey = data.analyticsKey || notificationId;
  const deepLinkId = data.deepLinkId || '';
  const path =
    data.url ||
    resolveDeepLink(deepLinkId || 'workspace.default').path;

  trackNotificationOpened({
    analyticsKey,
    notificationId,
    version: data.version ? Number(data.version) : undefined,
    variantId: data.variantId,
    deepLinkId,
    channel: data.channel || 'push',
    userId: options.userId,
    planId: options.planId,
  });

  trackNotificationDeepLinkOpened({
    analyticsKey,
    notificationId,
    version: data.version ? Number(data.version) : undefined,
    variantId: data.variantId,
    deepLinkId: deepLinkId || getDeepLinkById('workspace.default')?.id,
    channel: data.channel || 'push',
    userId: options.userId,
    planId: options.planId,
    properties: { path },
  });

  if (typeof options.navigate === 'function' && path) {
    options.navigate(path);
  }

  return { path, deepLinkId, analyticsKey, notificationId };
}
