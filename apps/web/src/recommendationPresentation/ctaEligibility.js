/**
 * Commercial CTA eligibility — presentation policy only.
 *
 * Does not modify the Commercial CTA Registry. Filters which recommendation
 * instances may surface a secondary commercial CTA. Incomplete-profile /
 * missing-data recommendations show primary (Smart Edit) only.
 */

/** Types that represent genuine advisory / commercial opportunities. */
export const CTA_ELIGIBLE_TYPES = Object.freeze(
  new Set([
    'protectionGap',
    'healthCoverage',
    'familyRisk',
    'retirementShortfall',
    'sipOpportunity',
    'idleCash',
    'taxPlanningOpportunity',
  ]),
);

/** Explicit id allow-list (covers edge cases without a commercial type). */
export const CTA_ELIGIBLE_IDS = Object.freeze(
  new Set([
    'protection.lifeGap',
    'protection.healthAbsent',
    'protection.healthPartial',
    'protection.closeCoverageGaps',
    'protection.investSurplusGap',
    'retirement.shortfall',
    'investments.readyToDeploy',
    'investments.yearEndSurplus',
    'investments.existingAllocations',
    'investments.noAllocations',
    'investments.retirementHorizon',
    'investments.wealthSip',
    'investments.increaseSips',
    'tax.planningOpportunity',
  ]),
);

/** Types that must never show a commercial CTA (data-quality / missing info). */
export const CTA_INELIGIBLE_TYPES = Object.freeze(
  new Set(['missingInformation', 'emergencyFund', 'goalFundingGap', 'cashFlowHealth', 'negativeSurplus', 'highEmiBurden']),
);

/**
 * @param {{ recommendationId?: string, id?: string, type?: string|null, tags?: string[] }} instance
 * @returns {boolean}
 */
export function isCommercialCtaEligible(instance = {}) {
  const id = instance.recommendationId ?? instance.id;
  const type = instance.type ?? null;
  const tags = instance.tags ?? [];

  if (type && CTA_INELIGIBLE_TYPES.has(type)) return false;
  if (tags.includes('empty-state') || tags.includes('missing-info')) return false;
  if (id && CTA_ELIGIBLE_IDS.has(id)) return true;
  if (type && CTA_ELIGIBLE_TYPES.has(type)) return true;
  return false;
}
