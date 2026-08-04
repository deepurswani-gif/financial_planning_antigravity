/**
 * Frequency / cooldown vocabulary helpers (metadata shapes).
 * Enforcement lives in frequencyPolicy.js using delivery history.
 */

export const FREQUENCY_TYPES = Object.freeze([
  /** Sliding cooldown window (hours or days). */
  'cooldown',
  /** At most N times inside a calendar month (IST). */
  'calendar_month',
  /** Cooldown scoped by a context key (e.g. per goalId). */
  'per_scope_cooldown',
]);

const SET = new Set(FREQUENCY_TYPES);

export function isFrequencyType(value) {
  return SET.has(value);
}

/**
 * @typedef {object} NotificationFrequency
 * @property {'cooldown'|'calendar_month'|'per_scope_cooldown'} type
 * @property {number} [cooldownHours]
 * @property {number} [cooldownDays]
 * @property {number} [maxPerMonth]
 * @property {string} [scopeKey] - context field name for per_scope_cooldown (e.g. 'goalId')
 * @property {boolean} [resetOnMeaningfulChange] - e.g. protection gap fingerprint change
 * @property {string} [changeFingerprintKey] - signal key compared for meaningful change
 */
