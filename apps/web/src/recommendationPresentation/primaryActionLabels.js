/**
 * Context-aware primary action labels.
 *
 * Presentation-only mapping. Cards never invent labels — toPresentationModel
 * resolves the label from recommendation metadata (id → type → category).
 * Behavior remains launchRecommendationAction(); only the label changes.
 */

export const DEFAULT_PRIMARY_ACTION_LABEL = 'Update Information';

/** Stable recommendation id → label */
export const PRIMARY_LABEL_BY_ID = Object.freeze({
  'protection.lifeGap': 'Update Insurance Details',
  'protection.investSurplusGap': 'Update Insurance Details',
  'protection.healthAbsent': 'Update Health Coverage',
  'protection.healthPartial': 'Update Health Coverage',
  'protection.closeCoverageGaps': 'Update Insurance Details',
  'emergency.buildFund': 'Review Emergency Fund',
  'emergency.investSurplusBuffer': 'Review Emergency Fund',
  'emergency.buildReserves': 'Review Emergency Fund',
  'retirement.shortfall': 'Update Retirement Savings',
  'goals.increaseFundingPace': 'Update Goal Details',
  'goals.fundingGap': 'Update Goal Details',
  'cashflow.improveSurplus': 'Update Income & Expenses',
  'cashflow.noFreeCash': 'Update Income & Expenses',
  'cashflow.highEmiBurden': 'Update Loan Details',
  'behaviour.completeMoneyFlow': 'Complete Information',
  'investments.readyToDeploy': 'Update Investment Details',
  'investments.yearEndSurplus': 'Update Investment Details',
  'investments.existingAllocations': 'Update Investment Details',
  'investments.noAllocations': 'Update Investment Details',
  'investments.retirementHorizon': 'Update Retirement Savings',
  'investments.wealthSip': 'Update Investment Details',
  'investments.increaseSips': 'Update Investment Details',
  'tax.planningOpportunity': 'Update Tax Details',
  'wealth.assetDiversification': 'Update Investment Details',
});

/** Recommendation type → label */
export const PRIMARY_LABEL_BY_TYPE = Object.freeze({
  protectionGap: 'Update Insurance Details',
  healthCoverage: 'Update Health Coverage',
  familyRisk: 'Update Insurance Details',
  emergencyFund: 'Review Emergency Fund',
  retirementShortfall: 'Update Retirement Savings',
  goalFundingGap: 'Update Goal Details',
  highEmiBurden: 'Update Loan Details',
  cashFlowHealth: 'Update Income & Expenses',
  negativeSurplus: 'Update Income & Expenses',
  missingInformation: 'Complete Information',
  sipOpportunity: 'Update Investment Details',
  idleCash: 'Update Investment Details',
  taxPlanningOpportunity: 'Update Tax Details',
  assetDiversification: 'Update Investment Details',
});

/** Category fallback → label */
export const PRIMARY_LABEL_BY_CATEGORY = Object.freeze({
  protection: 'Update Insurance Details',
  emergency: 'Review Emergency Fund',
  retirement: 'Update Retirement Savings',
  goals: 'Update Goal Details',
  cashflow: 'Update Income & Expenses',
  investments: 'Update Investment Details',
  tax: 'Update Tax Details',
  wealth: 'Update Investment Details',
  behaviour: 'Complete Information',
});

/**
 * @param {{ recommendationId?: string, id?: string, type?: string, category?: string }} meta
 * @returns {string}
 */
export function resolvePrimaryActionLabel(meta = {}) {
  const id = meta.recommendationId ?? meta.id;
  if (id && PRIMARY_LABEL_BY_ID[id]) return PRIMARY_LABEL_BY_ID[id];
  if (meta.type && PRIMARY_LABEL_BY_TYPE[meta.type]) return PRIMARY_LABEL_BY_TYPE[meta.type];
  if (meta.category && PRIMARY_LABEL_BY_CATEGORY[meta.category]) {
    return PRIMARY_LABEL_BY_CATEGORY[meta.category];
  }
  return DEFAULT_PRIMARY_ACTION_LABEL;
}
