/**
 * Stable editable-section identifiers.
 * Kept free of component imports to avoid circular dependency with workspaceNavConfig
 * and progressive layouts (which need IDs at module init time).
 */

export const SECTION_IDS = {
  PROFILE: 'profile',
  CASH_FLOW: 'cashFlow',
  SAVINGS: 'savings',
  ASSETS: 'assets',
  LIABILITIES: 'liabilities',
  GOALS: 'goals',
  FAMILY_INFORMATION: 'familyInformation',
  MONEY_IN_MONEY_OUT: 'moneyInMoneyOut',
  WEALTH_SNAPSHOT: 'wealthSnapshot',
  DREAMS_AND_GOALS: 'dreamsAndGoals',
  /** Editable assumptions page; drawer entry deferred — registry/surfaces only for now. */
  GROWTH_EXPECTATIONS: 'growthExpectations',
};

/** Legacy drawer / route aliases → stable section IDs. */
export const SECTION_ID_ALIASES = {
  cashflow: SECTION_IDS.CASH_FLOW,
  cash_flow: SECTION_IDS.CASH_FLOW,
  familyinfo: SECTION_IDS.FAMILY_INFORMATION,
  mywealth: SECTION_IDS.WEALTH_SNAPSHOT,
  dreams_goals: SECTION_IDS.DREAMS_AND_GOALS,
  family_information: SECTION_IDS.FAMILY_INFORMATION,
  money_in_out: SECTION_IDS.MONEY_IN_MONEY_OUT,
  my_wealth_snapshot: SECTION_IDS.WEALTH_SNAPSHOT,
  my_dreams_goals: SECTION_IDS.DREAMS_AND_GOALS,
  growth_expectations: SECTION_IDS.GROWTH_EXPECTATIONS,
  growthExpectations: SECTION_IDS.GROWTH_EXPECTATIONS,
};

export const SECTION_GROUP_YOUR_INFORMATION = 'your_information';
export const SECTION_GROUP_ADVANCED_INFORMATION = 'advanced_information';

export function resolveSectionId(id) {
  if (id == null) return null;
  return SECTION_ID_ALIASES[id] ?? id;
}

export function isStableSectionId(id) {
  const resolved = resolveSectionId(id);
  return Object.values(SECTION_IDS).includes(resolved);
}
