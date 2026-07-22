import { normalizeRecommendation } from '../schema';

/**
 * Emergency / liquidity recommendations.
 * Text migrated verbatim from SafetyNetLogic.buildRecoverySteps,
 * investSurplusLogic (emergency suggestion) and ExecutiveSummaryLogic.
 */
export const EMERGENCY_RECOMMENDATIONS = [
  normalizeRecommendation({
    id: 'emergency.buildFund',
    title: 'Build Emergency Fund',
    summary: 'Assign remaining funds for emergency reserves of {emergencyGapDisplay}.',
    category: 'emergency',
    type: 'emergencyFund',
    severity: 'critical',
    priority: 30,
    triggerId: 'LOW_EMERGENCY_FUND',
    reports: ['safety_net'],
    relatedDomains: ['assets', 'expenses'],
    relatedFields: ['assets.emergencyFund'],
    relatedMetrics: ['emergencyFundNeeded', 'emergencyFundHave', 'gap'],
    supportingMetrics: ['emergencyGap', 'emergencyGapDisplay'],
    businessMeaning:
      'A liquid buffer of 6 months of expenses lets the family absorb income shocks without selling investments or taking debt.',
    tags: ['recovery-step'],
    action: 'monitor',
  }),
  normalizeRecommendation({
    id: 'emergency.investSurplusBuffer',
    title: 'Strengthen your emergency buffer',
    summary: 'Your fund covers ~{emergencyMonthsCovered} months; ideal is {emergencyIdealMonths} months.',
    category: 'emergency',
    type: 'emergencyFund',
    severity: 'medium',
    priority: 40,
    triggerId: 'LOW_EMERGENCY_FUND',
    reports: ['put_your_money_to_work'],
    relatedDomains: ['assets', 'expenses'],
    relatedFields: ['assets.emergencyFund'],
    relatedMetrics: ['monthsCoveredByFund', 'contingencyPeriod', 'gap'],
    supportingMetrics: ['emergencyMonthsCovered', 'emergencyIdealMonths', 'emergencyGap'],
    businessMeaning:
      'Deploying part of the surplus to close the emergency-fund gap strengthens short-term resilience before wealth building.',
    tags: ['suggestion', 'deferred'],
    action: 'monitor',
  }),
  normalizeRecommendation({
    id: 'emergency.buildReserves',
    title: 'Build Emergency Reserves',
    summary: 'Build liquid emergency reserves toward at least 6 months of expenses and EMIs.',
    category: 'emergency',
    type: 'emergencyFund',
    severity: 'high',
    priority: 20,
    triggerId: 'WEAK_EMERGENCY',
    reports: ['useful_insights'],
    relatedDomains: ['assets', 'expenses'],
    relatedFields: ['assets.emergencyFund'],
    relatedMetrics: ['emergencyMonths'],
    businessMeaning:
      'Emergency reserves are the second pillar of readiness; without them a shock forces high-cost borrowing.',
    tags: ['priority-next-step'],
    action: 'monitor',
  }),
];
