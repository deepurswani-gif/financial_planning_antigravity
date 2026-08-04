/**
 * Client-side coach notification dispatcher.
 * Resolves registry rules, applies policy, sends via Edge Function, records history.
 */

import {
  resolveNotification,
  trackNotificationGenerated,
  trackNotificationSent,
} from '../notificationRegistry';
import { isPushOptedIn } from '../lib/pushNotifications';
import { sendPushToSelf } from '../services/pushNotificationEdgeService';
import {
  enqueuePendingNotification,
  getGlobalSendHistory,
  getNotificationSendHistory,
  listDuePendingNotifications,
  recordNotificationSent,
  removePendingNotification,
} from './localDeliveryHistory';
import {
  buildGoalBehindSignals,
  buildMonthlyWealthSummarySignals,
  buildPostRecalcCoachSignals,
  buildProtectionGapSignals,
  buildSurplusAvailableSignals,
} from './buildCoachSignals';

const IDS = Object.freeze({
  wealthMapUpdated: 'coach.wealthMapUpdated',
  protectionGap: 'coach.protectionGapAttention',
  surplus: 'coach.surplusAvailable',
  goalBehind: 'coach.goalFallingBehind',
  monthlySummary: 'coach.monthlyWealthSummary',
});

/**
 * @param {string} notificationId
 * @param {Record<string, unknown>} signals
 * @param {{ userId?: string, planId?: string, variantId?: string, now?: Date, scopeValue?: string, fingerprint?: string }} [options]
 */
export async function dispatchCoachNotification(notificationId, signals, options = {}) {
  const userId = options.userId;
  if (!userId) {
    return { ok: false, reason: 'no_user' };
  }

  const optedIn = options.optedIn ?? isPushOptedIn(userId);
  const history = getNotificationSendHistory(userId);
  const globalSendHistory = getGlobalSendHistory(userId);

  const result = resolveNotification(notificationId, signals, {
    optedIn,
    history,
    globalSendHistory,
    now: options.now ?? new Date(),
    variantId: options.variantId,
    scopeValue: options.scopeValue,
    fingerprint: options.fingerprint,
  });

  if (!result.applicable) {
    return { ok: false, reason: result.reason };
  }

  trackNotificationGenerated({
    analyticsKey: result.rendered.analyticsKey,
    notificationId: result.rendered.notificationId,
    version: result.rendered.version,
    variantId: result.rendered.variantId,
    deepLinkId: result.rendered.deepLink.deepLinkId,
    userId,
    planId: options.planId,
  });

  const { delivery, push, rendered } = result;
  const scopeKey =
    options.scopeValue
    ?? (signals.goalId != null ? String(signals.goalId) : null);
  const fingerprint =
    options.fingerprint
    ?? (signals.protectionGapFingerprint != null
      ? String(signals.protectionGapFingerprint)
      : null);

  if (delivery.action === 'defer') {
    return { ok: false, reason: delivery.reason || 'deferred' };
  }

  if (delivery.action === 'queue') {
    enqueuePendingNotification(userId, {
      notificationId: rendered.notificationId,
      deliverAt: (delivery.deliverAt || new Date()).toISOString(),
      push,
      rendered,
      planId: options.planId ?? null,
      scopeKey,
      fingerprint,
    });
    return { ok: true, queued: true, deliverAt: delivery.deliverAt };
  }

  return sendResolvedPush({
    userId,
    planId: options.planId,
    push,
    rendered,
    scopeKey,
    fingerprint,
  });
}

async function sendResolvedPush({
  userId,
  planId,
  push,
  rendered,
  scopeKey = null,
  fingerprint = null,
}) {
  const { error } = await sendPushToSelf({
    title: push.title,
    body: push.body,
    data: push.data,
  });

  if (error) {
    if (import.meta.env.DEV) {
      console.warn('[notifications] send failed:', error.message || error);
    }
    return { ok: false, reason: 'send_failed', error };
  }

  recordNotificationSent(userId, {
    notificationId: rendered.notificationId,
    variantId: rendered.variantId,
    version: rendered.version,
    scopeKey,
    fingerprint,
  });

  trackNotificationSent({
    analyticsKey: rendered.analyticsKey,
    notificationId: rendered.notificationId,
    version: rendered.version,
    variantId: rendered.variantId,
    deepLinkId: rendered.deepLink.deepLinkId,
    userId,
    planId,
  });

  return { ok: true, sent: true };
}

function safeDispatch(label, fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn(`[notifications] ${label} dispatch error:`, err);
      }
      return { ok: false, reason: 'exception' };
    }
  };
}

/** Fire WealthMap Updated after a successful plan recalculation. */
export const dispatchWealthMapUpdated = safeDispatch(
  'wealthMapUpdated',
  async (options = {}) =>
    dispatchCoachNotification(
      IDS.wealthMapUpdated,
      {
        wealthMapRecalculated: true,
        recalculationSucceeded: true,
      },
      options,
    ),
);

/** Protection Gap Needs Attention */
export const dispatchProtectionGapAttention = safeDispatch(
  'protectionGap',
  async (plan, options = {}) => {
    const signals = buildProtectionGapSignals(plan);
    return dispatchCoachNotification(IDS.protectionGap, signals, {
      ...options,
      fingerprint: signals.protectionGapFingerprint,
    });
  },
);

/** Surplus Available */
export const dispatchSurplusAvailable = safeDispatch(
  'surplus',
  async (plan, options = {}) => {
    const signals = buildSurplusAvailableSignals(plan);
    return dispatchCoachNotification(IDS.surplus, signals, options);
  },
);

/** Goal Falling Behind — one dispatch per behind goal (14d cooldown each). */
export const dispatchGoalFallingBehind = safeDispatch(
  'goalBehind',
  async (plan, options = {}) => {
    if (!options.userId) return { ok: false, reason: 'no_user', results: [] };
    if (!isPushOptedIn(options.userId)) return { ok: false, reason: 'not_opted_in', results: [] };

    const signals = buildGoalBehindSignals(plan);
    if (!signals.hasGoalBehindSchedule) {
      return { ok: false, reason: 'trigger_not_met', results: [] };
    }

    const results = [];
    for (const goal of signals.behindGoals) {
      const result = await dispatchCoachNotification(
        IDS.goalBehind,
        {
          hasGoalBehindSchedule: true,
          goalId: goal.goalId,
          behindGoalIds: signals.behindGoalIds,
        },
        {
          ...options,
          scopeValue: goal.goalId,
        },
      );
      results.push({ goalId: goal.goalId, ...result });
    }
    return {
      ok: results.some((r) => r.ok),
      results,
    };
  },
);

/** Monthly Wealth Summary Ready */
export const dispatchMonthlyWealthSummary = safeDispatch(
  'monthlySummary',
  async (plan, options = {}) => {
    const signals = buildMonthlyWealthSummarySignals(plan);
    return dispatchCoachNotification(IDS.monthlySummary, signals, options);
  },
);

/**
 * After Smart Edit recalculation: Protection → Surplus → Goals (in order).
 * WealthMap Updated is dispatched separately first by the caller.
 */
export const dispatchCoachNotificationsAfterRecalc = safeDispatch(
  'afterRecalc',
  async (plan, options = {}) => {
    const pack = buildPostRecalcCoachSignals(plan);
    const protection = await dispatchProtectionGapAttention(plan, options);
    const surplus = await dispatchSurplusAvailable(plan, options);
    const goals = await dispatchGoalFallingBehind(plan, options);
    return {
      ok: Boolean(protection.ok || surplus.ok || goals.ok),
      protection,
      surplus,
      goals,
      signals: pack,
    };
  },
);

/**
 * Flush quiet-hour queue when due (call on workspace load / interval).
 */
export async function flushPendingNotifications({ userId, planId } = {}) {
  if (!userId || !isPushOptedIn(userId)) return { flushed: 0 };

  const due = listDuePendingNotifications(userId);
  let flushed = 0;

  for (const item of due) {
    const result = await sendResolvedPush({
      userId,
      planId: planId || item.planId,
      push: item.push,
      rendered: item.rendered,
      scopeKey: item.scopeKey ?? null,
      fingerprint: item.fingerprint ?? null,
    });
    removePendingNotification(userId, item.notificationId);
    if (result.ok) flushed += 1;
  }

  return { flushed };
}

export { IDS as COACH_NOTIFICATION_IDS };
