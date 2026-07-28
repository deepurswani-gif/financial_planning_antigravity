/** Static navigation + path registries for Financial Workspace (Phase 2). */

import { SECTION_IDS, resolveSectionId } from './sectionIds';

export const WORKSPACE_TITLE = 'Growth & Loan Trackers';
export const WORKSPACE_STORAGE_KEY = 'finbrella.financialWorkspace.v1';

/** Product entry for the Financial Workspace shell. */
export const FINANCIAL_WORKSPACE_PATH = '/financial-workspace';

/** First step of Summary onboarding (new users). */
export const SUMMARY_FLOW_ENTRY_PATH = '/summary-flow/profile';

/** First step of Detailed Planning (Summary Mode Continue CTA). */
export const DETAILED_FLOW_ENTRY_PATH = '/detailed-flow/familyinfo';

// TEMP DEV ACCESS
// Remove after legacy migration is complete.
export const LEGACY_EXISTING_APP_PATH = '/detailed-flow/existing-app';

/**
 * @param {'summary' | 'full'} [mode]
 * @param {{ report?: string, section?: string, edit?: string, land?: string, control?: string, collection?: string }} [options]
 *   report — summary/detail report id to open on entry
 *   section — DOM id to scroll into view after open (e.g. life-journey)
 *   edit — stable section id to open inside the permanent workspace shell
 *   land — stable question id to land on (Smart Edit landing target)
 *   control — landing control hint: scalar|question|configure|collection
 *   collection — collection field id when landing on a collection
 */
export function financialWorkspacePath(
  mode = 'full',
  { report, section, edit, land, control, collection } = {},
) {
  const normalized = mode === 'summary' ? 'summary' : 'full';
  const params = new URLSearchParams({ mode: normalized });
  if (report) params.set('report', report);
  if (section) params.set('section', section);
  if (edit) params.set('edit', resolveSectionId(edit));
  if (land) params.set('land', land);
  if (control) params.set('control', control);
  if (collection) params.set('collection', collection);
  return `${FINANCIAL_WORKSPACE_PATH}?${params.toString()}`;
}

/** Deep-link to an editable section inside the permanent workspace shell. */
export function financialWorkspaceEditPath(sectionId, { mode = 'full', report } = {}) {
  return financialWorkspacePath(mode, { report, edit: sectionId });
}

export const PRIMARY_NAV_ITEMS = [
  { id: 'wealth_creation', label: 'My Wealth Creation' },
  { id: 'stable_saving', label: 'My Stable Saving' },
  { id: 'retirement_funds', label: 'Retirement Funds' },
  { id: 'income_investment', label: 'Income Investment' },
  { id: 'my_loans', label: 'My Loans' },
];

export const SECONDARY_NAV_BY_PRIMARY = {
  wealth_creation: [
    { id: 'sip', label: 'SIP' },
    { id: 'lumpsum', label: 'Lumpsum' },
    { id: 'equity_etfs', label: 'Equity & ETFs' },
  ],
  stable_saving: [
    { id: 'fixed_deposit', label: 'Fixed Deposit' },
    { id: 'recurring_deposit', label: 'Recurring Deposit' },
  ],
  retirement_funds: [
    { id: 'ppf', label: 'PPF' },
    { id: 'nps', label: 'NPS' },
  ],
  income_investment: [
    { id: 'swp', label: 'SWP' },
  ],
  my_loans: [
    { id: 'personal_loan', label: 'Personal Loan' },
    { id: 'home_loan', label: 'Home Loan' },
    { id: 'car_loan', label: 'Car Loan' },
    { id: 'two_wheeler_loan', label: '2-Wheeler Loan' },
    { id: 'education_loan', label: 'Education Loan' },
  ],
};

export const SUMMARY_REPORT_NAV_ITEMS = [
  { id: 'money_story', label: 'Your Money Story' },
  { id: 'safety_net', label: 'The Safety Net' },
  { id: 'future_self', label: 'Your Future Self' },
  { id: 'useful_insights', label: 'Useful Insights' },
];

export const DETAIL_REPORT_TAB_ITEMS = [
  { id: 'your_money_flow', label: 'Your Money Flow', stage: 'Understand' },
  { id: 'fix_your_financial_gaps', label: 'Fix Your Financial Gaps', stage: 'Protection' },
  { id: 'put_your_money_to_work', label: 'Put Your Money To Work', stage: 'Decide' },
  { id: 'your_moneys_magic', label: "Your Money's Magic", stage: 'Grow' },
];

/** Drawer destinations — open section, calculator, settings, or logout. */
export const DRAWER_ITEM_ACTIONS = {
  [SECTION_IDS.PROFILE]: { type: 'open_section', sectionId: SECTION_IDS.PROFILE },
  [SECTION_IDS.CASH_FLOW]: { type: 'open_section', sectionId: SECTION_IDS.CASH_FLOW },
  [SECTION_IDS.SAVINGS]: { type: 'open_section', sectionId: SECTION_IDS.SAVINGS },
  [SECTION_IDS.ASSETS]: { type: 'open_section', sectionId: SECTION_IDS.ASSETS },
  [SECTION_IDS.LIABILITIES]: { type: 'open_section', sectionId: SECTION_IDS.LIABILITIES },
  [SECTION_IDS.GOALS]: { type: 'open_section', sectionId: SECTION_IDS.GOALS },
  [SECTION_IDS.FAMILY_INFORMATION]: { type: 'open_section', sectionId: SECTION_IDS.FAMILY_INFORMATION },
  [SECTION_IDS.MONEY_IN_MONEY_OUT]: { type: 'open_section', sectionId: SECTION_IDS.MONEY_IN_MONEY_OUT },
  [SECTION_IDS.WEALTH_SNAPSHOT]: { type: 'open_section', sectionId: SECTION_IDS.WEALTH_SNAPSHOT },
  [SECTION_IDS.DREAMS_AND_GOALS]: { type: 'open_section', sectionId: SECTION_IDS.DREAMS_AND_GOALS },
  income_tax_planner: { type: 'open_calculator', calculatorId: 'income_tax' },
  settings: { type: 'none' },
  logout: { type: 'logout' },
};

export const DRAWER_GROUPS = [
  {
    id: 'your_information',
    label: 'Your Information',
    collapsible: true,
    defaultExpanded: true,
    items: [
      { id: SECTION_IDS.PROFILE, label: 'Profile' },
      { id: SECTION_IDS.CASH_FLOW, label: 'Cash Flow' },
      { id: SECTION_IDS.SAVINGS, label: 'Savings' },
      { id: SECTION_IDS.ASSETS, label: 'Assets' },
      { id: SECTION_IDS.LIABILITIES, label: 'Liabilities' },
      { id: SECTION_IDS.GOALS, label: 'Goals' },
    ],
  },
  {
    id: 'advanced_information',
    label: 'Advanced Information',
    collapsible: true,
    defaultExpanded: true,
    items: [
      { id: SECTION_IDS.FAMILY_INFORMATION, label: 'Family Information' },
      { id: SECTION_IDS.MONEY_IN_MONEY_OUT, label: 'Money In & Money Out' },
      { id: SECTION_IDS.WEALTH_SNAPSHOT, label: 'My Wealth Snapshot' },
      { id: SECTION_IDS.DREAMS_AND_GOALS, label: 'My Dreams & Goals' },
    ],
  },
  {
    id: 'income_tax',
    label: 'Income Tax Planner',
    collapsible: false,
    items: [{ id: 'income_tax_planner', label: 'Income Tax Planner' }],
  },
  {
    id: 'settings',
    label: 'Settings',
    collapsible: false,
    items: [{ id: 'settings', label: 'Settings' }],
  },
  {
    id: 'account',
    label: 'Account',
    collapsible: false,
    items: [{ id: 'logout', label: 'Logout' }],
  },
];

export const DEFAULT_SUMMARY_REPORT_ID = SUMMARY_REPORT_NAV_ITEMS[0].id;
export const DEFAULT_DETAIL_TAB_ID = DETAIL_REPORT_TAB_ITEMS[0].id;

/**
 * Calculators hosted in the workspace but not on the header toolbar
 * (opened via drawer / tools).
 */
export const STANDALONE_CALCULATOR_ITEMS = [
  { id: 'income_tax', label: 'Income Tax Planner' },
];

/**
 * Legacy → canonical ID aliases (workspace only).
 * Used when resolving persisted state or external legacy references.
 * Never write these keys into new workspace state.
 */
export const LEGACY_ID_ALIASES = {
  per_loan: 'personal_loan',
  edu_loan: 'education_loan',
  equity: 'equity_etfs',
  fd: 'fixed_deposit',
  rd: 'recurring_deposit',
  your_future_self: 'future_self',
  tax: 'income_tax',
};

/** Resolve a possibly-legacy id to the frozen canonical id. */
export function resolveCanonicalId(id) {
  if (id == null) return id;
  return LEGACY_ID_ALIASES[id] ?? id;
}

export function getSecondaryItems(primaryId) {
  return SECONDARY_NAV_BY_PRIMARY[primaryId] || [];
}

export function getDefaultSecondaryId(primaryId) {
  const items = getSecondaryItems(primaryId);
  return items[0]?.id ?? null;
}

export function getDefaultExpandedDrawerGroups() {
  return DRAWER_GROUPS.filter((g) => g.collapsible && g.defaultExpanded).map((g) => g.id);
}

export function getAllCalculatorIds() {
  const toolbarIds = Object.values(SECONDARY_NAV_BY_PRIMARY).flatMap((items) =>
    items.map((item) => item.id)
  );
  const standaloneIds = STANDALONE_CALCULATOR_ITEMS.map((item) => item.id);
  return [...toolbarIds, ...standaloneIds];
}

export function isKnownCalculatorId(id) {
  const canonical = resolveCanonicalId(id);
  return getAllCalculatorIds().includes(canonical);
}

export function getCalculatorLabel(calculatorId) {
  const canonical = resolveCanonicalId(calculatorId);
  for (const items of Object.values(SECONDARY_NAV_BY_PRIMARY)) {
    const match = items.find((item) => item.id === canonical);
    if (match) return match.label;
  }
  const standalone = STANDALONE_CALCULATOR_ITEMS.find((item) => item.id === canonical);
  if (standalone) return standalone.label;
  return canonical;
}

export function getSummaryReportLabel(id) {
  const canonical = resolveCanonicalId(id);
  return SUMMARY_REPORT_NAV_ITEMS.find((item) => item.id === canonical)?.label ?? canonical;
}

export function getDetailReportLabel(id) {
  const canonical = resolveCanonicalId(id);
  return DETAIL_REPORT_TAB_ITEMS.find((item) => item.id === canonical)?.label ?? canonical;
}

export function getDetailReportIndex(id) {
  const canonical = resolveCanonicalId(id);
  return DETAIL_REPORT_TAB_ITEMS.findIndex((item) => item.id === canonical);
}
