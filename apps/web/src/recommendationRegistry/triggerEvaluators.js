/**
 * Trigger evaluators (Phase 6 Refinement 1) — the ONLY place executable
 * recommendation logic lives.
 *
 * Each entry maps a stable `triggerId` (from triggers.js) to a pure predicate
 * over a normalized `signals` snapshot. The resolver runs these; the registry
 * only references trigger ids. This keeps recommendation metadata declarative
 * and reusable across reports, dashboards, notifications, emails and AI
 * assistants without embedding code in the metadata.
 *
 * Evaluators must be pure and must NOT calculate financial values — they only
 * read pre-computed signals produced by report adapters.
 */

const arr = (value) => (Array.isArray(value) ? value : []);
const num = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

export const TRIGGER_EVALUATORS = Object.freeze({
  ALWAYS: () => true,

  // Protection
  HAS_PROTECTION_GAP: (s) => Boolean(s.hasProtectionGap) || num(s.protectionGap) > 0,
  HAS_SELF_PROTECTION_GAP: (s) =>
    Boolean(s.hasSelfProtectionGap) || num(s.selfProtectionGap) > 0,
  HAS_SPOUSE_PROTECTION_GAP: (s) =>
    Boolean(s.hasSpouseProtectionGap) || num(s.spouseProtectionGap) > 0,
  HEALTH_COVER_ABSENT: (s) =>
    s.healthStatus === 'none' || (Boolean(s.hasHealthGap) && num(s.healthCoverageHave) === 0),
  HEALTH_COVER_PARTIAL: (s) => Boolean(s.hasHealthGap) && num(s.healthCoverageHave) > 0,

  // Emergency / Liquidity
  LOW_EMERGENCY_FUND: (s) => num(s.emergencyGap) > 0,

  // Cash Flow
  NEGATIVE_MONTHLY_SURPLUS: (s) => num(s.monthlySurplus) < 0,
  LOW_SAVINGS_RATE: (s) => typeof s.savingsRatePct === 'number' && s.savingsRatePct < 20,
  HIGH_EMI_BURDEN: (s) => typeof s.emiBurdenPct === 'number' && s.emiBurdenPct > 40,

  // Investments / surplus deployment. Mirrors computeInvestSurplusInsights:
  // every deployment insight only appears once there is free cash this month.
  HAS_FREE_CASH: (s) => num(s.monthlyFreeCash) > 0,
  NO_FREE_CASH: (s) => num(s.monthlyFreeCash) <= 0,
  HAS_YEAR_SURPLUS: (s) => num(s.monthlyFreeCash) > 0 && num(s.proratedUnallocated) > 0,
  HAS_EXISTING_ALLOCATIONS: (s) => num(s.monthlyFreeCash) > 0 && num(s.allocationCount) > 0,
  NO_ALLOCATIONS: (s) => num(s.monthlyFreeCash) > 0 && num(s.allocationCount) === 0,
  HAS_RETIREMENT_HORIZON: (s) => num(s.deployableMonthly) > 0 && num(s.yearsToRetirement) > 0,
  IDLE_CASH: (s) => num(s.proratedUnallocated) > 0,
  SIP_OPPORTUNITY: (s) => num(s.wealthMonthly) > 0,

  // Goals / Retirement
  GOAL_FUNDING_GAP: (s) => Boolean(s.hasGoalFundingGap),
  RETIREMENT_SHORTFALL: (s) => Boolean(s.hasRetirementShortfall),

  // Executive Summary weak-pillar drivers
  WEAK_DAILY_STABILITY: (s) => arr(s.weakestPillars).includes('daily-stability'),
  WEAK_EMERGENCY: (s) => arr(s.weakestPillars).includes('emergency'),
  WEAK_FAMILY_PROTECTION: (s) => arr(s.weakestPillars).includes('family-protection'),
  WEAK_WEALTH_BUILDING: (s) => arr(s.weakestPillars).includes('wealth-building'),
  WEAK_GOAL_READINESS: (s) => arr(s.weakestPillars).includes('goal-readiness'),

  // Behaviour
  MISSING_MONEY_FLOW_DATA: (s) => s.hasMoneyFlowData === false,
});

export function evaluateTrigger(triggerId, signals) {
  const evaluator = TRIGGER_EVALUATORS[triggerId];
  if (!evaluator) return false;
  try {
    return Boolean(evaluator(signals ?? {}));
  } catch {
    return false;
  }
}
