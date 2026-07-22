import { normalizeRecommendation } from '../schema';

/**
 * Retirement recommendations.
 * Centralized definition for the retirement shortfall concept surfaced by the
 * Put Your Money To Work SIP analysis (deferred wiring — see inventory).
 */
export const RETIREMENT_RECOMMENDATIONS = [
  normalizeRecommendation({
    id: 'retirement.shortfall',
    title: 'Retirement Shortfall',
    summary: 'Your current SIP path is projected to fall short of your retirement corpus target.',
    category: 'retirement',
    type: 'retirementShortfall',
    severity: 'high',
    priority: 35,
    triggerId: 'RETIREMENT_SHORTFALL',
    reports: ['put_your_money_to_work'],
    relatedDomains: ['savings', 'goals', 'assumptions'],
    relatedFields: ['family.self.retirementAge', 'savings.sip'],
    relatedMetrics: ['retirementCorpus'],
    businessMeaning:
      'A projected retirement corpus below the target means the current savings pace needs to rise or the horizon extended.',
    tags: ['deferred'],
    action: 'startSip',
  }),
];
