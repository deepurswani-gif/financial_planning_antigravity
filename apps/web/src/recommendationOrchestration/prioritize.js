/**
 * Global prioritization.
 *
 * The engine produces ONE globally prioritized recommendation list. Ordering
 * uses existing registry metadata only — no new financial scoring is invented:
 *
 *   1. registry priority        (lower number = more important)
 *   2. severity                 (heavier severity first) — this doubles as the
 *                                proxy for "trigger importance": a trigger's
 *                                importance is reflected by the severity of the
 *                                recommendation it fires
 *   3. recommendationId         (stable tie-breaker for deterministic output)
 */

import { severityWeight } from '../recommendationRegistry';

export function compareInstances(a, b) {
  return (
    a.priority - b.priority ||
    severityWeight(b.severity) - severityWeight(a.severity) ||
    a.recommendationId.localeCompare(b.recommendationId)
  );
}

/** Returns a new, globally-sorted array of instances. */
export function sortInstances(instances) {
  return [...instances].sort(compareInstances);
}
