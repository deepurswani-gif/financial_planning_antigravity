/**
 * Analytics readiness — metadata only.
 *
 * This phase exposes the metadata a future analytics layer would need. It does
 * NOT emit or persist anything. `timestamp` and `completionStatus` are runtime
 * concerns left as placeholders for a future phase to populate at emit time.
 */

/**
 * @typedef {object} CtaAnalytics
 * @property {string|null} recommendationId
 * @property {string} ctaId - the resolved CTA id
 * @property {string|null} requestedCtaId - the ideal CTA before fallback
 * @property {string|null} originatingReport
 * @property {string} actionType - recommendation.action.type
 * @property {string} ctaActionType - resolved CTA actionType
 * @property {string} analyticsEvent
 * @property {boolean} fallbackApplied
 * @property {null} timestamp - filled at emit time by a future phase
 * @property {'pending'} completionStatus - lifecycle placeholder
 */

/**
 * @returns {CtaAnalytics}
 */
export function buildCtaAnalytics({
  recommendation,
  cta,
  requestedCtaId,
  originatingReport,
  fallbackApplied,
}) {
  return {
    recommendationId: recommendation?.id ?? null,
    ctaId: cta.id,
    requestedCtaId: requestedCtaId ?? null,
    originatingReport: originatingReport ?? null,
    actionType: recommendation?.action?.type ?? 'none',
    ctaActionType: cta.actionType,
    analyticsEvent: cta.analyticsEvent,
    fallbackApplied: Boolean(fallbackApplied),
    timestamp: null,
    completionStatus: 'pending',
  };
}
