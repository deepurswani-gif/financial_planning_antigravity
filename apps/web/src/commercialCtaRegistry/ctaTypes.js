/**
 * Commercial CTA vocabularies — frozen metadata only.
 *
 * These vocabularies are intentionally independent of the Recommendation
 * Registry's action types: recommendations answer "what should the user do?"
 * while CTAs answer "how can Finbrella help?". The mapping between the two lives
 * in actionMap.js, never inside recommendation metadata.
 */

/** Semantic action a CTA performs (kept separate from recommendation actions). */
export const CTA_ACTION_TYPES = Object.freeze([
  'contact',
  'learn',
  'monitor',
  'celebrate',
  'view',
  'compare',
  'buy',
  'sip',
  'increaseSip',
  'upload',
  'consult',
]);

/** How a resolved CTA is executed. Only `email` is implemented in this phase. */
export const EXECUTION_STRATEGIES = Object.freeze([
  'email',
  'navigate',
  'content',
  'purchase_journey',
  'schedule',
  'upload',
  'track',
  'noop',
]);

/** Whether a CTA is switched on today. */
export const AVAILABILITY = Object.freeze(['active', 'inactive']);

/** Regulatory posture of a CTA (metadata only; no purchase journeys built). */
export const REGULATORY_STATUS = Object.freeze(['approved', 'pending', 'not_required']);

const CTA_ACTION_SET = new Set(CTA_ACTION_TYPES);
const EXECUTION_SET = new Set(EXECUTION_STRATEGIES);
const AVAILABILITY_SET = new Set(AVAILABILITY);
const REGULATORY_SET = new Set(REGULATORY_STATUS);

export const isCtaActionType = (value) => CTA_ACTION_SET.has(value);
export const isExecutionStrategy = (value) => EXECUTION_SET.has(value);
export const isAvailability = (value) => AVAILABILITY_SET.has(value);
export const isRegulatoryStatus = (value) => REGULATORY_SET.has(value);
