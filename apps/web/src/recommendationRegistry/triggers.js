/**
 * Trigger identifiers (Phase 6 Refinement 1) — a frozen VOCABULARY of stable
 * ids only. This module is metadata: it declares which trigger ids exist so
 * the registry can reference them and validation can catch typos.
 *
 * The executable evaluation of a trigger against a signals snapshot lives in
 * the resolver (see triggerEvaluators.js). Keeping the vocabulary here and the
 * logic there is what keeps the Recommendation Registry declarative and
 * reusable by dashboards, notifications, emails and AI assistants without
 * embedding executable code inside recommendation metadata.
 */

export const TRIGGER_IDS = Object.freeze([
  // Always applicable (informational / evergreen)
  'ALWAYS',

  // Protection
  'HAS_PROTECTION_GAP',
  'HEALTH_COVER_ABSENT',
  'HEALTH_COVER_PARTIAL',

  // Emergency / Liquidity
  'LOW_EMERGENCY_FUND',

  // Cash Flow
  'NEGATIVE_MONTHLY_SURPLUS',
  'LOW_SAVINGS_RATE',
  'HIGH_EMI_BURDEN',

  // Investments / surplus deployment
  'HAS_FREE_CASH',
  'NO_FREE_CASH',
  'HAS_YEAR_SURPLUS',
  'HAS_EXISTING_ALLOCATIONS',
  'NO_ALLOCATIONS',
  'HAS_RETIREMENT_HORIZON',
  'IDLE_CASH',
  'SIP_OPPORTUNITY',

  // Goals / Retirement
  'GOAL_FUNDING_GAP',
  'RETIREMENT_SHORTFALL',

  // Executive Summary weak-pillar drivers
  'WEAK_DAILY_STABILITY',
  'WEAK_EMERGENCY',
  'WEAK_FAMILY_PROTECTION',
  'WEAK_WEALTH_BUILDING',
  'WEAK_GOAL_READINESS',

  // Behaviour
  'MISSING_MONEY_FLOW_DATA',
]);

const SET = new Set(TRIGGER_IDS);

export function isTriggerId(value) {
  return SET.has(value);
}

export function listTriggerIds() {
  return [...TRIGGER_IDS];
}
