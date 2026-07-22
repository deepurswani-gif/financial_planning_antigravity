import { normalizeRecommendation } from '../schema';

/**
 * Wealth recommendations.
 * Centralizes the Money Story asset-mix callout (legacy vs income assets)
 * (deferred wiring — see MIGRATION_INVENTORY.md).
 */
export const WEALTH_RECOMMENDATIONS = [
  normalizeRecommendation({
    id: 'wealth.assetDiversification',
    title: 'Diversify Toward Income Assets',
    summary:
      "A large share of your wealth sits in legacy assets that don't generate regular income — aim to increase income-generating assets.",
    category: 'wealth',
    type: 'assetDiversification',
    severity: 'medium',
    priority: 55,
    triggerId: 'ALWAYS',
    reports: ['money_story'],
    relatedDomains: ['assets'],
    relatedFields: ['assets.portfolioValue'],
    relatedMetrics: ['legacyPercent', 'incomePercent'],
    businessMeaning:
      'A portfolio skewed to non-income (legacy) assets under-produces cash flow; rebalancing improves working wealth.',
    tags: ['deferred'],
    action: 'learnMore',
  }),
];
