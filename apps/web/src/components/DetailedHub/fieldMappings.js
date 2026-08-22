export const DETAILED_HUB_MAPPINGS = {
  // My Wealth Snapshot -> Assets
  'assets.fixedDeposits': 'assets',
  'assets.fixedDeposit.amount': 'assets',
  'assets.custom': 'assets',
  'assets.custom.value': 'assets',

  // Money In & Money Out -> Debt & EMIs
  'debt.emi.loans': 'debt',
  'debt.emi.loan.principal': 'debt',
  'debt.emi.loan.rate': 'debt',
  'debt.emi.loan.tenure': 'debt',

  // Family Info -> Family & Dependents
  'family.children': 'family-details',
  'family.child.name': 'family-details',
  'family.child.dob': 'family-details',
  'family.child.occupation': 'family-details',

  // Goals -> Navigate to Detailed Hub (no sub-card)
  'goals.items': 'goals',
  'goals.item.name': 'goals',
  'goals.item.yearsToGoal': 'goals',
  'goals.item.presentValue': 'goals',

  // Money In & Money Out -> Income & Taxes
  'income.self.otherIncome': 'income',
  'income.self.otherIncome.amount': 'income',

  // My Wealth Snapshot -> Liabilities
  'liabilities.custom': 'liabilities',
  'liabilities.custom.value': 'liabilities',

  // Money In & Money Out -> Insurance Premiums
  'protection.life.policies': 'insurance',
  'protection.life.policy.premium': 'insurance',
  'protection.life.policy.sumAssured': 'insurance',
  'protection.vehicle.premiums': 'insurance',

  // Money In & Money Out -> Savings & Investments
  'savings.ppf': 'savings',
  'savings.nps': 'savings',
  'savings.rd': 'savings',
  'savings.rd.amount': 'savings',
  'savings.monthlyInvestments': 'savings'
};

/**
 * Returns the openSub parameter for Detailed Hub routing.
 * If the field is a goal, it returns 'goals' to indicate navigation to Detailed Hub without a sheet.
 */
export function getDetailedHubMapping(fieldId) {
  return DETAILED_HUB_MAPPINGS[fieldId] || null;
}
