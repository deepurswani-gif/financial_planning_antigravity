import { normalizeRecommendation } from '../schema';

/**
 * Goal recommendations.
 * `goals.increaseFundingPace` is migrated from ExecutiveSummary action
 * priorities (wired). `goals.fundingGap` centralizes the Future Self gap
 * verdict (deferred wiring — see MIGRATION_INVENTORY.md).
 */
export const GOAL_RECOMMENDATIONS = [
  normalizeRecommendation({
    id: 'goals.increaseFundingPace',
    title: 'Increase Goal Funding Pace',
    summary: 'Review each goal plan and increase funding pace for underprepared goals.',
    category: 'goals',
    type: 'goalFundingGap',
    severity: 'high',
    priority: 50,
    triggerId: 'WEAK_GOAL_READINESS',
    reports: ['useful_insights'],
    relatedDomains: ['goals', 'savings'],
    relatedFields: ['goals.items'],
    relatedMetrics: ['goalReadinessPct'],
    businessMeaning:
      'Goals fall short when their funding pace lags the inflation-adjusted target; increasing contributions early costs the least.',
    tags: ['priority-next-step'],
    action: 'learnMore',
  }),
  normalizeRecommendation({
    id: 'goals.fundingGap',
    title: 'Goal Funding Gap',
    summary:
      'Based on current projections, there may be a gap between the resources available and the estimated future cost of this goal.',
    category: 'goals',
    type: 'goalFundingGap',
    severity: 'medium',
    priority: 55,
    triggerId: 'GOAL_FUNDING_GAP',
    reports: ['future_self'],
    relatedDomains: ['goals'],
    relatedFields: ['goals.items'],
    relatedMetrics: ['coveragePercent', 'gap'],
    businessMeaning:
      'When projected resources trail a goal cost, the plan needs a higher SIP, a longer horizon, or a lower target.',
    tags: ['deferred'],
    action: 'learnMore',
  }),
];
