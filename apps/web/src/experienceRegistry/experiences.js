/**
 * Curated experiences — the primary user intents for editing financial objects.
 *
 * These represent *what the user wants to edit* and map to one or more canonical
 * fields (`registryTargets`). Field-level labels/aliases/businessMeaning are NOT
 * copied here — they are read from the Question Registry. Only intent-level
 * synonyms are added as `aliases`.
 *
 * The long tail (every other editable field) is auto-derived; see
 * `deriveExperiences.js`.
 */

export const CURATED_EXPERIENCES = [
  // —— Income ——
  {
    id: 'income.salary',
    title: 'Monthly Salary',
    aliases: ['salary', 'monthly salary', 'take home pay', 'net pay'],
    experienceType: 'scalar',
    launchStrategy: 'focused_edit_session',
    icon: 'wallet',
    registryTargets: ['income.self.monthlyTakeHome'],
    landingTarget: 'income.selfSalary',
    searchPriority: 'critical',
    quickEditPriority: 'critical',
  },
  {
    id: 'income.spouseSalary',
    title: 'Spouse Salary',
    aliases: ['spouse salary', 'partner income'],
    experienceType: 'scalar',
    launchStrategy: 'focused_edit_session',
    icon: 'wallet',
    registryTargets: ['income.spouse.monthlyTakeHome'],
    landingTarget: 'income.spouseSalary',
    searchPriority: 'high',
    quickEditPriority: 'medium',
  },
  {
    id: 'income.otherIncome',
    title: 'Other Income',
    aliases: ['other income', 'side income', 'rental income', 'passive income'],
    experienceType: 'collection',
    launchStrategy: 'collection_picker',
    icon: 'coins',
    registryTargets: ['income.self.otherIncome'],
    collectionResolver: { collectionFieldId: 'income.self.otherIncome', labelKey: 'source' },
    picker: { strategy: 'instance_list', addLabel: 'Add income source' },
    searchPriority: 'medium',
    quickEditPriority: 'medium',
  },

  // —— Expenses ——
  {
    id: 'expenses.household',
    title: 'Household Expenses',
    aliases: ['household expenses', 'monthly expenses', 'spending', 'cost of living'],
    experienceType: 'configure',
    // Registry marks this a breakdown with inline fallback, so a focused edit of
    // the headline value is the fastest path; the breakdown remains available.
    launchStrategy: 'focused_edit_session',
    icon: 'shopping-cart',
    registryTargets: ['expenses.household.monthlyTotal'],
    landingTarget: 'expenses.household',
    searchPriority: 'critical',
    quickEditPriority: 'critical',
  },

  // —— Savings / Investments ——
  {
    id: 'savings.monthlyInvestments',
    title: 'Monthly Investments',
    aliases: ['monthly investments', 'monthly savings', 'investment amount'],
    experienceType: 'configure',
    launchStrategy: 'focused_edit_session',
    icon: 'trending-up',
    registryTargets: ['savings.monthlyInvestments'],
    searchPriority: 'critical',
    quickEditPriority: 'critical',
  },
  {
    id: 'savings.sip',
    title: 'SIP',
    aliases: ['sip', 'systematic investment', 'mutual fund sip'],
    experienceType: 'scalar',
    launchStrategy: 'focused_edit_session',
    icon: 'trending-up',
    registryTargets: ['savings.sip'],
    landingTarget: 'investment.sip',
    searchPriority: 'high',
    quickEditPriority: 'high',
  },
  {
    id: 'savings.ppf',
    title: 'PPF',
    aliases: ['ppf', 'provident fund'],
    experienceType: 'scalar',
    launchStrategy: 'focused_edit_session',
    icon: 'piggy-bank',
    registryTargets: ['savings.ppf'],
    landingTarget: 'investment.ppf',
    searchPriority: 'medium',
    quickEditPriority: 'medium',
  },
  {
    id: 'savings.nps',
    title: 'NPS',
    aliases: ['nps', 'national pension'],
    experienceType: 'scalar',
    launchStrategy: 'focused_edit_session',
    icon: 'piggy-bank',
    registryTargets: ['savings.nps'],
    landingTarget: 'investment.nps',
    searchPriority: 'medium',
    quickEditPriority: 'medium',
  },
  {
    id: 'savings.recurringDeposits',
    title: 'Recurring Deposits',
    aliases: ['rd', 'recurring deposit'],
    experienceType: 'collection',
    launchStrategy: 'collection_picker',
    icon: 'piggy-bank',
    registryTargets: ['savings.rd'],
    landingTarget: 'investment.rd',
    activation: { channel: 'rdCollection', collection: true },
    collectionResolver: { collectionFieldId: 'savings.rd', labelKey: 'name' },
    picker: { strategy: 'instance_list', addLabel: 'Add recurring deposit' },
    searchPriority: 'medium',
    quickEditPriority: 'medium',
  },
  {
    id: 'savings.otherSavings',
    title: 'Other Savings',
    aliases: ['other savings'],
    experienceType: 'scalar',
    launchStrategy: 'focused_edit_session',
    icon: 'piggy-bank',
    registryTargets: ['savings.otherSaving'],
    searchPriority: 'low',
    quickEditPriority: 'low',
  },

  // —— Insurance ——
  {
    id: 'protection.lifeInsurance',
    title: 'Life Insurance Policies',
    aliases: ['life insurance', 'term insurance', 'life cover', 'life policy'],
    experienceType: 'collection',
    launchStrategy: 'collection_picker',
    icon: 'shield',
    registryTargets: ['protection.life.policies', 'protection.life.totalCover'],
    landingTarget: 'insurance.life',
    // Reuses the existing LifePolicyDetailsModal, which manages add + list of
    // policies internally, so activation just opens that one configure modal.
    activation: { channel: 'lifePolicyModal' },
    collectionResolver: { collectionFieldId: 'protection.life.policies', labelKey: 'insurer' },
    picker: { strategy: 'instance_list', addLabel: 'Add policy' },
    searchPriority: 'high',
    quickEditPriority: 'medium',
  },
  {
    id: 'protection.healthInsurance',
    title: 'Health Insurance',
    aliases: ['health insurance', 'mediclaim', 'health cover', 'medical insurance'],
    experienceType: 'configure',
    launchStrategy: 'focused_edit_session',
    icon: 'shield-plus',
    registryTargets: ['protection.health.totalCover', 'protection.health.premium'],
    landingTarget: 'insurance.health',
    searchPriority: 'high',
    quickEditPriority: 'medium',
  },

  // —— Loans & Liabilities ——
  {
    id: 'liabilities.homeLoan',
    title: 'Home Loan',
    aliases: ['home loan', 'housing loan', 'mortgage'],
    experienceType: 'configure',
    launchStrategy: 'configure_screen',
    capability: 'full',
    icon: 'landmark',
    registryTargets: ['liabilities.loans.home'],
    landingTarget: 'loan.home',
    // Loans are deterministic by type — open the existing LoanDetailsModal for
    // the home-loan key directly (no picker needed).
    activation: { channel: 'loanModal', key: 'homeLoan' },
    configureComponent: { kind: 'section' },
    searchPriority: 'high',
    quickEditPriority: 'medium',
  },
  {
    id: 'debt.loans',
    title: 'Loans & EMIs',
    aliases: ['loan', 'emi', 'personal loan', 'car loan', 'education loan'],
    experienceType: 'collection',
    launchStrategy: 'collection_picker',
    capability: 'full',
    icon: 'landmark',
    registryTargets: ['debt.emi.loans'],
    landingTarget: 'loan.personal',
    collectionResolver: { collectionFieldId: 'debt.emi.loans', idKey: 'loanKey', labelKey: 'type' },
    picker: { strategy: 'instance_list', addLabel: 'Add loan' },
    searchPriority: 'medium',
    quickEditPriority: 'medium',
  },

  // —— Goals ——
  {
    id: 'goals.collection',
    title: 'Goals',
    aliases: ['goals', 'dreams', 'financial goals', 'targets'],
    experienceType: 'collection',
    launchStrategy: 'collection_picker',
    icon: 'target',
    registryTargets: ['goals.items'],
    landingTarget: 'goal.selection',
    collectionResolver: { collectionFieldId: 'goals.items', labelKey: 'name' },
    picker: { strategy: 'instance_list', addLabel: 'Add goal' },
    searchPriority: 'high',
    quickEditPriority: 'high',
  },

  // —— Family ——
  {
    id: 'family.children',
    title: 'Children',
    aliases: ['children', 'kids', 'child', 'dependents'],
    experienceType: 'collection',
    launchStrategy: 'collection_picker',
    capability: 'full',
    icon: 'users',
    registryTargets: ['family.children'],
    collectionResolver: { collectionFieldId: 'family.children', labelKey: 'name' },
    picker: { strategy: 'instance_list', addLabel: 'Add child' },
    searchPriority: 'medium',
    quickEditPriority: 'medium',
  },

  // —— Assets ——
  {
    id: 'assets.fixedDeposits',
    title: 'Fixed Deposits',
    aliases: ['fd', 'fixed deposit', 'term deposit'],
    experienceType: 'collection',
    launchStrategy: 'collection_picker',
    capability: 'full',
    icon: 'banknote',
    registryTargets: ['assets.fixedDeposits'],
    landingTarget: 'asset.fd',
    activation: { channel: 'fdCollection', collection: true },
    collectionResolver: { collectionFieldId: 'assets.fixedDeposits', labelKey: 'name' },
    picker: { strategy: 'instance_list', addLabel: 'Add fixed deposit' },
    searchPriority: 'medium',
    quickEditPriority: 'medium',
  },

  // —— Planning tools (existing configure modal) ——
  {
    id: 'planning.incomeTax',
    title: 'Income Tax Planner',
    aliases: ['tax', 'income tax', 'tax planning', 'tax saver'],
    experienceType: 'configure',
    launchStrategy: 'configure_modal',
    capability: 'full',
    icon: 'file-text',
    registryTargets: ['income.self.taxPlanning'],
    configureComponent: { kind: 'calculator', calculatorId: 'income_tax' },
    searchPriority: 'medium',
    quickEditPriority: 'medium',
  },

  // —— Assumptions (mini wizard) ——
  {
    id: 'assumptions.growth',
    title: 'Growth Assumptions',
    aliases: ['growth', 'inflation', 'growth rate', 'assumptions', 'expectations'],
    experienceType: 'wizard',
    launchStrategy: 'mini_wizard',
    capability: 'full',
    icon: 'sliders',
    registryTargets: [
      'assumptions.incomeGrowthRate',
      'assumptions.householdInflationRate',
      'assumptions.educationInflationRate',
    ],
    searchPriority: 'medium',
    quickEditPriority: 'low',
  },

  // —— Read-only explanation (derived value) ——
  {
    id: 'explain.totalEmi',
    title: 'Total Monthly EMI',
    aliases: ['total emi', 'monthly emi', 'emi total'],
    experienceType: 'read_only',
    launchStrategy: 'readonly_explanation',
    icon: 'info',
    registryTargets: ['debt.emi.monthlyTotal'],
    businessMeaning:
      'Your total monthly EMI is calculated from your individual loans. To change it, edit the underlying loans.',
    searchPriority: 'low',
    quickEditPriority: 'low',
  },
];
