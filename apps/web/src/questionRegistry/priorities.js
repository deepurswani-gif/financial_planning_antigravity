/**
 * Shared level enum for importance and quickEditPriority.
 * These metadata fields are independent — do not collapse them.
 */

export const LEVELS = Object.freeze(['critical', 'high', 'medium', 'low']);

/** Higher number = stronger weight for ranking helpers. */
export const LEVEL_WEIGHT = Object.freeze({
  critical: 40,
  high: 30,
  medium: 20,
  low: 10,
});

export function isLevel(value) {
  return LEVELS.includes(value);
}

export function levelWeight(level) {
  return LEVEL_WEIGHT[level] ?? 0;
}
