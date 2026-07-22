import { normalizeRecommendation } from '../schema';

/**
 * Behaviour recommendations — nudges about missing or stale information.
 * `behaviour.completeMoneyFlow` is migrated from the no-data guard in
 * investSurplusLogic.computeInvestSurplusInsights.
 */
export const BEHAVIOUR_RECOMMENDATIONS = [
  normalizeRecommendation({
    id: 'behaviour.completeMoneyFlow',
    title: 'Complete Your Money Flow',
    summary: 'Complete Your Money Flow to see surplus deployment options.',
    category: 'behaviour',
    type: 'missingInformation',
    severity: 'informational',
    priority: 5,
    triggerId: 'MISSING_MONEY_FLOW_DATA',
    reports: ['invest_surplus'],
    relatedDomains: ['income', 'expenses'],
    tags: ['empty-state'],
    action: 'learnMore',
  }),
];
