/**
 * Action model (Phase 6 Refinement 3) — a generic, UI-agnostic placeholder.
 *
 * The Recommendation Registry must not know about UI concepts like CTAs. Each
 * recommendation instead carries a metadata-only `action` describing the KIND
 * of follow-up a future phase might attach (Contact Advisor, Learn More,
 * Monitor, Celebrate, View Plans, Buy Product, Start SIP, ...).
 *
 * This phase only defines the metadata model. No UI or behaviour is wired.
 * The default action is `{ type: 'none' }`.
 *
 * Extensible: append to ACTION_TYPES to introduce a new action kind.
 */

export const ACTION_TYPES = Object.freeze([
  'none',
  'contactAdvisor',
  'learnMore',
  'monitor',
  'celebrate',
  'viewPlans',
  'buyProduct',
  'startSip',
]);

const SET = new Set(ACTION_TYPES);

export function isActionType(value) {
  return SET.has(value);
}

/**
 * @typedef {object} RecommendationAction
 * @property {string} type - one of ACTION_TYPES
 * @property {string|null} [label] - optional display hint (metadata only)
 * @property {object} [params] - optional opaque params for a future phase
 */

/**
 * Normalize an action descriptor without mutating the source.
 * Accepts a string shorthand (the action type) or a partial object.
 * @param {string|RecommendationAction|null|undefined} action
 * @returns {RecommendationAction}
 */
export function normalizeAction(action) {
  if (!action) return { type: 'none', label: null, params: {} };
  if (typeof action === 'string') return { type: action, label: null, params: {} };
  return {
    type: action.type ?? 'none',
    label: action.label ?? null,
    params: action.params ?? {},
  };
}
