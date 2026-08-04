/**
 * Notification categories — coach-style product nudges only.
 * Marketing / campaign types do not belong here.
 */

export const NOTIFICATION_CATEGORIES = Object.freeze([
  Object.freeze({ id: 'progress', label: 'Progress', description: 'Plan updates and recalculation outcomes' }),
  Object.freeze({ id: 'coaching', label: 'Coaching', description: 'Gaps and guidance that need attention' }),
  Object.freeze({ id: 'reminders', label: 'Reminders', description: 'Timely follow-ups on open actions' }),
  Object.freeze({ id: 'milestones', label: 'Milestones', description: 'Summaries and meaningful checkpoints' }),
  Object.freeze({ id: 'system', label: 'System', description: 'Account / delivery system notices' }),
]);

const SET = new Set(NOTIFICATION_CATEGORIES.map((c) => c.id));

export function isNotificationCategory(value) {
  return SET.has(value);
}

export function listNotificationCategories() {
  return [...NOTIFICATION_CATEGORIES];
}
