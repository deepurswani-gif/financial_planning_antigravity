/**
 * Recommendation Registry — the single source of truth for every recommendation
 * shown anywhere in Finbrella.
 *
 * Architecture (mirrors Question Registry -> Experience Registry):
 *
 *   Recommendation Registry (declarative metadata: triggerId + templates)
 *          |
 *   Recommendation Resolver (evaluate trigger / dedupe / sort / interpolate)
 *          |
 *   Reports (presentation only)
 *
 * Reports are CONSUMERS of recommendations, never creators. Business knowledge
 * (which recommendation applies, its wording, its severity) lives here; reports
 * only present it. The resolver never calculates financial values — report
 * adapters flatten existing engine outputs into a `signals` snapshot which the
 * resolver reads.
 */

import { normalizeRecommendation, assertRecommendation } from './schema';
import { validateRegistry } from './validateRegistry';
import { searchRecommendations as searchList } from './search';
import { resolveRecommendations as resolveFromList } from './resolveRecommendations';

import { PROTECTION_RECOMMENDATIONS } from './recommendations/protection';
import { EMERGENCY_RECOMMENDATIONS } from './recommendations/emergency';
import { CASHFLOW_RECOMMENDATIONS } from './recommendations/cashflow';
import { INVESTMENT_RECOMMENDATIONS } from './recommendations/investments';
import { RETIREMENT_RECOMMENDATIONS } from './recommendations/retirement';
import { GOAL_RECOMMENDATIONS } from './recommendations/goals';
import { TAX_RECOMMENDATIONS } from './recommendations/tax';
import { WEALTH_RECOMMENDATIONS } from './recommendations/wealth';
import { BEHAVIOUR_RECOMMENDATIONS } from './recommendations/behaviour';

const ALL_RECOMMENDATIONS = [
  ...PROTECTION_RECOMMENDATIONS,
  ...EMERGENCY_RECOMMENDATIONS,
  ...CASHFLOW_RECOMMENDATIONS,
  ...INVESTMENT_RECOMMENDATIONS,
  ...RETIREMENT_RECOMMENDATIONS,
  ...GOAL_RECOMMENDATIONS,
  ...TAX_RECOMMENDATIONS,
  ...WEALTH_RECOMMENDATIONS,
  ...BEHAVIOUR_RECOMMENDATIONS,
].map(normalizeRecommendation);

// Fail fast in development on any malformed or duplicate recommendation.
const seenIds = new Set();
ALL_RECOMMENDATIONS.forEach((recommendation) => {
  assertRecommendation(recommendation);
  if (seenIds.has(recommendation.id)) {
    throw new Error(`Duplicate recommendation id "${recommendation.id}"`);
  }
  seenIds.add(recommendation.id);
});

/** @type {ReadonlyArray<import('./schema').Recommendation>} */
export const RECOMMENDATION_REGISTRY = Object.freeze(ALL_RECOMMENDATIONS);

const BY_ID = new Map(RECOMMENDATION_REGISTRY.map((r) => [r.id, r]));

export function getRecommendationById(id) {
  return BY_ID.get(id) ?? null;
}

export function hasRecommendation(id) {
  return BY_ID.has(id);
}

/**
 * List recommendations, optionally filtered by category / type / report / tag.
 * @param {{ category?: string, type?: string, report?: string, tag?: string }} [options]
 */
export function listRecommendations(options = {}) {
  let list = [...RECOMMENDATION_REGISTRY];
  if (options.category) list = list.filter((r) => r.category === options.category);
  if (options.type) list = list.filter((r) => r.type === options.type);
  if (options.report) list = list.filter((r) => (r.reports ?? []).includes(options.report));
  if (options.tag) list = list.filter((r) => (r.tags ?? []).includes(options.tag));
  return list;
}

/** Registry-wide search over recommendations. */
export function searchRecommendations(query, options = {}) {
  return searchList(listRecommendations(options), query);
}

/**
 * Resolve applicable recommendations for a signals snapshot.
 * @param {Record<string, unknown>} signals - from a report adapter
 * @param {{ report?: string }} [options]
 * @returns {import('./resolveRecommendations').ResolvedRecommendation[]}
 */
export function resolveRecommendations(signals, options = {}) {
  return resolveFromList(RECOMMENDATION_REGISTRY, signals, options);
}

/** Diagnostics for tests / tooling. */
export function getRecommendationRegistryDiagnostics() {
  const result = validateRegistry(RECOMMENDATION_REGISTRY);
  return { total: RECOMMENDATION_REGISTRY.length, ...result };
}

export { validateRegistry };
export { CATEGORIES, isCategoryId, getCategory, listCategories } from './categories';
export { RECOMMENDATION_TYPES, isRecommendationType, listRecommendationTypes } from './recommendationTypes';
export { SEVERITY, isSeverity, severityWeight } from './severity';
export { TRIGGER_IDS, isTriggerId, listTriggerIds } from './triggers';
export { ACTION_TYPES, isActionType, normalizeAction } from './actions';
export { REPORT_IDS, isReportId, listReportIds } from './reports';
export { interpolate, extractTokens } from './templating';
export { TRIGGER_EVALUATORS, evaluateTrigger } from './triggerEvaluators';
