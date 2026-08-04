/**
 * Product-moment event vocabulary (metadata only).
 * Executable evaluation lives in triggerEvaluators.js — not in templates.
 */

export const NOTIFICATION_EVENTS = Object.freeze([
  'WEALTHMAP_RECALCULATED',
  'PROTECTION_GAP_UNRESOLVED',
  'SURPLUS_INVESTABLE',
  'GOAL_BEHIND_SCHEDULE',
  'MONTHLY_WEALTH_SUMMARY_READY',
]);

const SET = new Set(NOTIFICATION_EVENTS);

export function isNotificationEvent(value) {
  return SET.has(value);
}

export function listNotificationEvents() {
  return [...NOTIFICATION_EVENTS];
}
