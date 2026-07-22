import { normalizeRecommendation } from '../schema';

/**
 * Cash-flow recommendations.
 * `cashflow.improveSurplus` is migrated from ExecutiveSummaryLogic action
 * priorities (wired). `cashflow.highEmiBurden` centralizes the Your Money Flow
 * EMI-burden insight (deferred wiring — see MIGRATION_INVENTORY.md).
 */
export const CASHFLOW_RECOMMENDATIONS = [
  normalizeRecommendation({
    id: 'cashflow.improveSurplus',
    title: 'Improve Monthly Surplus',
    summary: 'Improve monthly surplus by reducing avoidable expenses or high-cost EMIs.',
    category: 'cashflow',
    type: 'cashFlowHealth',
    severity: 'high',
    priority: 10,
    triggerId: 'WEAK_DAILY_STABILITY',
    reports: ['useful_insights'],
    relatedDomains: ['income', 'expenses', 'debt'],
    relatedFields: ['income.self.monthlyTakeHome', 'expenses.household.monthlyTotal'],
    relatedMetrics: ['surplusRatioPct'],
    businessMeaning:
      'Monthly surplus funds every other goal; improving it is the highest-leverage first step in a plan.',
    tags: ['priority-next-step'],
    action: 'learnMore',
  }),
  normalizeRecommendation({
    id: 'cashflow.noFreeCash',
    title: 'No Free Cash This Month',
    summary:
      'No free cash flow this month — review expenses or income before allocating new investments.',
    category: 'cashflow',
    type: 'negativeSurplus',
    severity: 'medium',
    priority: 8,
    triggerId: 'NO_FREE_CASH',
    reports: ['invest_surplus'],
    relatedDomains: ['income', 'expenses'],
    relatedMetrics: ['monthlyFreeCash'],
    businessMeaning:
      'With no surplus after commitments, cutting expenses or raising income comes before any new investment.',
    tags: ['insight'],
    action: 'learnMore',
  }),
  normalizeRecommendation({
    id: 'cashflow.highEmiBurden',
    title: 'High EMI Burden',
    summary: 'EMI burden is {emiBurdenPct}% of income.',
    category: 'cashflow',
    type: 'highEmiBurden',
    severity: 'medium',
    priority: 45,
    triggerId: 'HIGH_EMI_BURDEN',
    reports: ['your_money_flow'],
    relatedDomains: ['debt', 'income'],
    relatedFields: ['debt.emi.monthlyTotal'],
    relatedMetrics: ['emiRatio'],
    supportingMetrics: ['emiBurdenPct'],
    businessMeaning:
      'An EMI-to-income ratio above 40% leaves little room for savings and raises default risk on income shocks.',
    tags: ['insight', 'deferred'],
    action: 'learnMore',
  }),
];
