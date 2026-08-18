import { normalizeRecommendation } from '../schema';

/**
 * Protection recommendations.
 * Text migrated from SafetyNetLogic.buildRecoverySteps,
 * investSurplusLogic.buildInvestSurplusReport (protection suggestion) and
 * ExecutiveSummaryLogic action priorities.
 *
 * Safety Net shows separate self / spouse term gaps because life cover pays
 * out only on the insured member's death.
 */
export const PROTECTION_RECOMMENDATIONS = [
  normalizeRecommendation({
    id: 'protection.lifeGap',
    title: "Fill {selfName}'s Protection Gap",
    summary:
      "Buy term cover to close this gap on {selfName}.",
    category: 'protection',
    type: 'protectionGap',
    severity: 'critical',
    priority: 10,
    triggerId: 'HAS_SELF_PROTECTION_GAP',
    reports: ['safety_net'],
    relatedDomains: ['protection', 'expenses'],
    relatedFields: ['protection.life.totalCover'],
    relatedMetrics: ['selfProtectionGap', 'coverageRequired', 'coverageHave'],
    supportingMetrics: ['selfProtectionGap', 'selfProtectionGapDisplay', 'selfName'],
    businessMeaning:
      "Each earning member needs cover equal to household HLV because payout only comes from that member's policies.",
    tags: ['recovery-step'],
    action: 'viewPlans',
  }),
  normalizeRecommendation({
    id: 'protection.lifeGapSpouse',
    title: "Fill {spouseName}'s Protection Gap",
    summary:
      "Buy term cover to close this gap on {spouseName}.",
    category: 'protection',
    type: 'protectionGap',
    severity: 'critical',
    priority: 11,
    triggerId: 'HAS_SPOUSE_PROTECTION_GAP',
    reports: ['safety_net'],
    relatedDomains: ['protection', 'expenses'],
    relatedFields: ['protection.life.totalCover'],
    relatedMetrics: ['spouseProtectionGap', 'coverageRequired'],
    supportingMetrics: ['spouseProtectionGap', 'spouseProtectionGapDisplay', 'spouseName'],
    businessMeaning:
      'Working spouse income also needs HLV-sized cover; household cover on self does not pay out on spouse death.',
    tags: ['recovery-step'],
    action: 'viewPlans',
  }),
  normalizeRecommendation({
    id: 'protection.healthAbsent',
    title: 'Get Family Health Cover',
    summary: 'Get family health insurance with at least {healthMinDisplay} sum insured.',
    category: 'protection',
    type: 'healthCoverage',
    severity: 'high',
    priority: 20,
    triggerId: 'HEALTH_COVER_ABSENT',
    reports: ['safety_net'],
    relatedDomains: ['protection'],
    relatedFields: ['protection.health.totalCover'],
    relatedMetrics: ['healthGap', 'minimumRequired'],
    supportingMetrics: ['healthMinDisplay', 'healthCoverRequired'],
    businessMeaning:
      'A single major hospitalization can cost several lakh; a family floater cover shields savings from medical shocks.',
    tags: ['recovery-step'],
    action: 'viewPlans',
  }),
  normalizeRecommendation({
    id: 'protection.healthPartial',
    title: 'Strengthen Health Cover',
    summary: 'Increase health cover by {healthGapDisplay} to reach the {healthMinDisplay} minimum.',
    category: 'protection',
    type: 'healthCoverage',
    severity: 'high',
    priority: 20,
    triggerId: 'HEALTH_COVER_PARTIAL',
    reports: ['safety_net'],
    relatedDomains: ['protection'],
    relatedFields: ['protection.health.totalCover'],
    relatedMetrics: ['healthGap', 'minimumRequired'],
    supportingMetrics: ['healthGap', 'healthGapDisplay', 'healthMinDisplay'],
    businessMeaning:
      'Topping up an existing but under-sized health cover keeps the family protected against rising treatment costs.',
    tags: ['recovery-step'],
    action: 'viewPlans',
  }),
  normalizeRecommendation({
    id: 'protection.closeCoverageGaps',
    title: 'Close Coverage Gaps',
    summary: 'Close life and health coverage gaps to protect your family against major risks.',
    category: 'protection',
    type: 'familyRisk',
    severity: 'high',
    priority: 30,
    triggerId: 'WEAK_FAMILY_PROTECTION',
    reports: ['useful_insights'],
    relatedDomains: ['protection'],
    relatedFields: ['protection.life.totalCover', 'protection.health.totalCover'],
    relatedMetrics: ['lifeCoverageRatioPct', 'healthCoverLakh'],
    businessMeaning:
      'Protection is the foundation of financial readiness; gaps here expose the family to the largest downside risks.',
    tags: ['priority-next-step'],
    action: 'learnMore',
  }),
  normalizeRecommendation({
    id: 'protection.investSurplusGap',
    title: 'Close the protection gap',
    summary: 'Life cover helps your family maintain lifestyle if income stops unexpectedly.',
    category: 'protection',
    type: 'protectionGap',
    severity: 'medium',
    priority: 40,
    triggerId: 'HAS_PROTECTION_GAP',
    reports: ['put_your_money_to_work'],
    relatedDomains: ['protection'],
    relatedFields: ['protection.life.totalCover'],
    relatedMetrics: ['protectionGap'],
    supportingMetrics: ['protectionGap', 'protectionGapDisplay'],
    businessMeaning:
      'Directing part of the deployable surplus toward term cover closes the HLV protection gap.',
    tags: ['suggestion', 'deferred'],
    action: 'viewPlans',
  }),
];
