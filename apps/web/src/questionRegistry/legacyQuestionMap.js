/**
 * Known Summary + Detailed Flow question ids for registry coverage checks.
 * Goals Summary uses screen name constants rather than progressive question ids.
 * Growth Expectations uses a synthetic question id for the whole form page.
 */

export const SUMMARY_QUESTION_IDS_BY_SECTION = Object.freeze({
  profile: ['name-mobile', 'dob-retirement', 'occupation'],
  cashFlow: ['household-income', 'monthly-expenses', 'insurance-premiums', 'emi-commitments'],
  savings: [
    'monthly-investments',
    'other-savings',
    'life-insurance-cover',
    'health-insurance-cover',
  ],
  assets: ['portfolio-value', 'emergency-fund', 'real-estate-assets'],
  liabilities: ['outstanding-loans', 'credit-card', 'other-payables'],
  goals: ['SELECT', 'YEARS', 'VALUE', 'SUMMARY', 'INTRO'],
});

/**
 * Detailed progressive (and synthetic) question ids keyed by stable section id.
 * Note: `recap` is reused across familyInformation and moneyInMoneyOut — always
 * resolve with sectionId, never questionId alone.
 */
export const DETAILED_QUESTION_IDS_BY_SECTION = Object.freeze({
  familyInformation: [
    'recap',
    'self-profile',
    'spouse-details',
    'spouse-employment',
    'children',
  ],
  moneyInMoneyOut: [
    'recap',
    'self-main',
    'spouse-main',
    'household-breakup',
    'health-insurance',
    'life-insurance',
    'vehicle-other-insurance',
    'recap-emi',
    'emi-loan-types',
    'emi-loans',
    'savings-snapshot',
    'savings-breakdown',
  ],
  wealthSnapshot: [
    'wealth-recap',
    'assets-breakdown',
    'custom-assets',
    'liabilities',
    'custom-liabilities',
  ],
  dreamsAndGoals: [
    'goals-intro',
    'goals-catalog',
    'goals-years',
    'goals-value',
    'goals-review',
  ],
  growthExpectations: ['growth-expectations'],
});

/**
 * Local question id → canonical field ids (hosts).
 * For colliding ids like `recap`, prefer section-qualified lookup via
 * getFieldIdsForLegacyQuestion(questionId, sectionId).
 */
export const LEGACY_QUESTION_TO_FIELDS = Object.freeze({
  'name-mobile': ['family.self.name', 'family.self.mobile'],
  'dob-retirement': ['family.self.dob', 'family.self.retirementAge'],
  occupation: ['family.self.employmentType'],
  'household-income': [
    'income.self.monthlyTakeHome',
    'income.hasSpouseIncome',
    'income.spouse.monthlyTakeHome',
  ],
  'monthly-expenses': ['expenses.household.monthlyTotal'],
  'insurance-premiums': ['expenses.insurance.monthlyPremiumTotal'],
  'emi-commitments': ['debt.hasEmi', 'debt.emi.monthlyTotal'],
  'monthly-investments': ['savings.monthlyInvestments'],
  'other-savings': ['savings.otherMonthlySavings'],
  'life-insurance-cover': ['protection.life.hasCoverage', 'protection.life.totalCover'],
  'health-insurance-cover': ['protection.health.hasCoverage', 'protection.health.totalCover'],
  'portfolio-value': ['assets.portfolioValue'],
  'emergency-fund': ['assets.emergencyFund'],
  'real-estate-assets': ['assets.realEstateValue'],
  'outstanding-loans': ['liabilities.outstandingLoans'],
  'credit-card': ['liabilities.creditCardDues'],
  'other-payables': ['liabilities.otherPayables'],
  SELECT: ['goals.items', 'goals.item.name'],
  YEARS: ['goals.item.yearsToGoal'],
  VALUE: ['goals.item.presentValue'],

  // Detailed — section-qualified keys use `${sectionId}/${questionId}`
  'familyInformation/recap': [
    'family.self.name',
    'family.self.mobile',
    'family.self.dob',
    'family.self.retirementAge',
  ],
  'self-profile': [
    'family.self.employmentType',
    'family.self.isMarried',
    'family.self.organizationName',
  ],
  'spouse-details': [
    'family.spouse.name',
    'family.spouse.dob',
    'family.spouse.mobile',
    'family.spouse.isWorking',
  ],
  'spouse-employment': ['family.spouse.employmentType', 'family.spouse.retirementAge'],
  children: ['family.children', 'family.child.name', 'family.child.dob'],
  'moneyInMoneyOut/recap': [
    'income.self.monthlyTakeHome',
    'income.spouse.monthlyTakeHome',
  ],
  'self-main': [
    'income.self.needTaxPlanning',
    'income.self.inHandSalary',
    'income.self.takeHomeProfit',
    'income.self.otherIncome',
    'income.self.taxPlanning',
  ],
  'spouse-main': ['income.spouse.detail'],
  'household-breakup': [
    'expenses.household.monthlyTotal',
    'expenses.household.grocery',
    'expenses.household.rent',
    'family.child.monthlyEducationExpense',
  ],
  'health-insurance': ['protection.health.premium'],
  'life-insurance': ['protection.life.policies'],
  'vehicle-other-insurance': ['protection.vehicle.premiums'],
  'recap-emi': ['debt.hasEmi', 'debt.emi.monthlyTotal'],
  'emi-loan-types': ['debt.emi.selectedLoanTypes'],
  'emi-loans': ['debt.emi.loans'],
  'savings-snapshot': ['savings.monthlyInvestments', 'savings.otherMonthlySavings'],
  'savings-breakdown': ['savings.sip', 'savings.ppf', 'savings.nps', 'savings.rd'],
  'wealth-recap': [
    'assets.portfolioValue',
    'assets.emergencyFund',
    'assets.realEstateValue',
    'liabilities.outstandingLoans',
    'liabilities.creditCardDues',
    'liabilities.otherPayables',
  ],
  'assets-breakdown': [
    'assets.realEstate.residential',
    'assets.investments.equity',
    'assets.investments.mutualFunds',
    'assets.fixedDeposits',
  ],
  'custom-assets': ['assets.custom'],
  liabilities: [
    'liabilities.loans.home',
    'liabilities.loans.personal',
    'liabilities.loans.creditCard',
  ],
  'custom-liabilities': ['liabilities.custom'],
  'goals-intro': ['goals.items'],
  'goals-catalog': ['goals.items', 'goals.item.name'],
  'goals-years': ['goals.item.yearsToGoal'],
  'goals-value': ['goals.item.presentValue'],
  'goals-review': ['goals.items'],
  'growth-expectations': [
    'assumptions.incomeGrowthRate',
    'assumptions.householdInflationRate',
    'assumptions.educationInflationRate',
  ],
});

/**
 * @param {string} questionId
 * @param {string} [sectionId] stable section id when question ids collide (e.g. recap)
 */
export function getFieldIdsForLegacyQuestion(questionId, sectionId) {
  if (sectionId) {
    const qualified = LEGACY_QUESTION_TO_FIELDS[`${sectionId}/${questionId}`];
    if (qualified) return qualified;
  }
  return LEGACY_QUESTION_TO_FIELDS[questionId] ?? [];
}
