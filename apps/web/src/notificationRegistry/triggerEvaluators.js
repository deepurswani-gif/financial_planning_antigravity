/**
 * Executable trigger evaluation — separate from templates / registry metadata.
 * Adapters supply a `signals` snapshot; this module never recalculates finance.
 */

/**
 * @typedef {Record<string, unknown>} NotificationSignals
 */

/** @type {Record<string, (signals: NotificationSignals) => boolean>} */
export const NOTIFICATION_TRIGGER_EVALUATORS = Object.freeze({
  WEALTHMAP_RECALCULATED: (s) =>
    Boolean(s.wealthMapRecalculated === true && s.recalculationSucceeded === true),

  PROTECTION_GAP_UNRESOLVED: (s) =>
    Boolean(s.hasProtectionGap === true && s.protectionGapResolved !== true),

  SURPLUS_INVESTABLE: (s) => {
    const amount = Number(s.monthlySurplusAmount);
    return Boolean(s.hasInvestableSurplus === true && Number.isFinite(amount) && amount > 0);
  },

  GOAL_BEHIND_SCHEDULE: (s) =>
    Boolean(s.hasGoalBehindSchedule === true && (s.goalId || s.behindGoalIds?.length)),

  MONTHLY_WEALTH_SUMMARY_READY: (s) => Boolean(s.monthlyWealthSummaryReady === true),
});

/**
 * @param {string} event
 * @param {NotificationSignals} signals
 */
export function evaluateNotificationEvent(event, signals = {}) {
  const fn = NOTIFICATION_TRIGGER_EVALUATORS[event];
  if (!fn) return false;
  try {
    return Boolean(fn(signals));
  } catch {
    return false;
  }
}
