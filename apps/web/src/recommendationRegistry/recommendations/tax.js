import { normalizeRecommendation } from '../schema';

/**
 * Tax recommendations.
 * Centralized placeholder for the tax-planning opportunity concept
 * (deferred wiring — see MIGRATION_INVENTORY.md).
 */
export const TAX_RECOMMENDATIONS = [
  normalizeRecommendation({
    id: 'tax.planningOpportunity',
    title: 'Tax Planning Opportunity',
    summary: 'Explore tax-efficient investments to reduce your annual tax outgo.',
    category: 'tax',
    type: 'taxPlanningOpportunity',
    severity: 'low',
    priority: 60,
    triggerId: 'ALWAYS',
    reports: ['your_money_flow'],
    relatedDomains: ['income', 'savings'],
    relatedFields: ['income.self.needTaxPlanning'],
    relatedMetrics: ['computedTax'],
    tags: ['deferred'],
    action: 'learnMore',
  }),
];
