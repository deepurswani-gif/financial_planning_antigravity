/**
 * Recommendation types — the granular financial concepts that used to be
 * proposed as categories (Phase 6 Refinement 2).
 *
 * A `type` describes WHAT a recommendation is about within its high-level
 * `category` domain. Example: category `protection` + type `protectionGap`.
 *
 * Extensible: append to RECOMMENDATION_TYPES to introduce a new concept.
 */

export const RECOMMENDATION_TYPES = Object.freeze([
  // Protection
  'protectionGap',
  'healthCoverage',
  'familyRisk',
  // Emergency / Liquidity
  'emergencyFund',
  'liquidity',
  // Cash Flow
  'negativeSurplus',
  'lowSavingsRate',
  'highEmiBurden',
  'cashFlowHealth',
  // Investments
  'sipOpportunity',
  'idleCash',
  'assetAllocation',
  // Retirement
  'retirementShortfall',
  'retirementContribution',
  // Goals
  'goalFundingGap',
  'goalDelayRisk',
  // Tax
  'taxPlanningOpportunity',
  // Wealth
  'netWorth',
  'assetDiversification',
  // Behaviour
  'missingInformation',
  'outdatedInformation',
]);

const SET = new Set(RECOMMENDATION_TYPES);

export function isRecommendationType(value) {
  return SET.has(value);
}

export function listRecommendationTypes() {
  return [...RECOMMENDATION_TYPES];
}
