/**
 * Maps a Recommendation Registry action type to the CTA the framework would
 * ideally present for it. This is the ONLY coupling point between the two
 * registries and it lives here (not inside recommendation metadata), so the
 * CTA framework consumes recommendation output without duplicating it.
 *
 * The resolver applies capability + regulatory checks on top of this mapping,
 * falling back to Contact Finbrella whenever the ideal CTA is unavailable.
 */

/** recommendation.action.type -> ideal CTA id (null = no CTA) */
export const ACTION_TYPE_TO_CTA = Object.freeze({
  none: null,
  contactAdvisor: 'contactFinbrella',
  learnMore: 'learnMore',
  monitor: 'monitorProgress',
  celebrate: 'celebrate',
  viewPlans: 'viewPlans',
  buyProduct: 'buyProduct',
  startSip: 'startSip',
});

/** The always-available assistance CTA used as the universal fallback. */
export const DEFAULT_FALLBACK_CTA_ID = 'contactFinbrella';
