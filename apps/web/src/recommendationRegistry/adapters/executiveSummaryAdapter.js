/**
 * Executive Summary adapter.
 *
 * Maps buildExecutiveSummaryReport output into a normalized `signals` snapshot
 * for the Recommendation Resolver. It does NOT recalculate anything — it reads
 * the pillar scores and derives the weakest-first pillar ordering exactly as
 * ExecutiveSummaryLogic did when building `actionPriorities` (bottom 3 pillars
 * by score, ascending).
 */

export const PILLAR_TO_RECOMMENDATION_ID = Object.freeze({
  'daily-stability': 'cashflow.improveSurplus',
  emergency: 'emergency.buildReserves',
  'family-protection': 'protection.closeCoverageGaps',
  'wealth-building': 'investments.increaseSips',
  'goal-readiness': 'goals.increaseFundingPace',
});

export function buildExecutiveSummarySignals(report = {}) {
  const pillars = report?.pillars ?? [];
  const weakestPillars = [...pillars]
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((pillar) => pillar.id);

  const baseMetrics = report?.baseMetrics ?? {};

  return {
    weakestPillars,
    surplusRatioPct: baseMetrics.surplusRatioPct,
    emergencyMonths: baseMetrics.emergencyMonths,
    lifeCoverageRatioPct: baseMetrics.lifeCoverageRatioPct,
    healthCoverLakh: baseMetrics.healthCoverLakh,
    investmentRatioPct: baseMetrics.investmentRatioPct,
    goalReadinessPct: baseMetrics.goalReadinessPct,
  };
}
