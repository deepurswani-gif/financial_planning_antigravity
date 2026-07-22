/**
 * Recommendation severity — metadata ONLY.
 *
 * Severity communicates how pressing a recommendation is. No business logic
 * depends on it in this phase (per spec). It is used purely as a metadata
 * flag and as a secondary sort tiebreak in the resolver.
 */

export const SEVERITY = Object.freeze(['critical', 'high', 'medium', 'low', 'informational']);

const SEVERITY_WEIGHT = Object.freeze({
  critical: 50,
  high: 40,
  medium: 30,
  low: 20,
  informational: 10,
});

const SET = new Set(SEVERITY);

export function isSeverity(value) {
  return SET.has(value);
}

/** Higher number = more severe (used only as a resolver sort tiebreak). */
export function severityWeight(severity) {
  return SEVERITY_WEIGHT[severity] ?? 0;
}
