/**
 * Recommendation Resolver.
 *
 * Transforms a normalized `signals` snapshot (produced by report adapters from
 * existing engine outputs) into an ordered list of standardized recommendation
 * descriptors. It:
 *   1. determines applicable recommendations (via trigger evaluation)
 *   2. removes duplicates (by id)
 *   3. sorts by priority (then severity, then id)
 *   4. interpolates templates and exposes recommendations to reports
 *
 * It NEVER calculates financial values — it only reads pre-computed signals.
 *
 * To avoid a circular import with index.js the core takes the recommendation
 * list as its first argument; index.js binds it to RECOMMENDATION_REGISTRY.
 */

import { severityWeight } from './severity';
import { interpolate } from './templating';
import { evaluateTrigger } from './triggerEvaluators';

/**
 * @typedef {object} ResolvedRecommendation
 * @property {string} id
 * @property {string} title
 * @property {string} summary - interpolated
 * @property {string} description - interpolated
 * @property {string} category
 * @property {string|null} type
 * @property {string} severity
 * @property {number} priority
 * @property {string} triggerId
 * @property {string[]} reports
 * @property {string[]} supportingMetrics
 * @property {Record<string, unknown>} metrics - supportingMetrics resolved from signals
 * @property {import('./actions').RecommendationAction} action
 * @property {null} aiExplanation
 * @property {string[]} tags
 */

function toDescriptor(recommendation, signals) {
  const metrics = {};
  for (const key of recommendation.supportingMetrics ?? []) {
    metrics[key] = signals?.[key];
  }
  return Object.freeze({
    id: recommendation.id,
    title: recommendation.title,
    summary: interpolate(recommendation.summary, signals),
    description: interpolate(recommendation.description, signals),
    category: recommendation.category,
    type: recommendation.type ?? null,
    severity: recommendation.severity,
    priority: recommendation.priority,
    triggerId: recommendation.triggerId,
    reports: recommendation.reports,
    supportingMetrics: recommendation.supportingMetrics,
    metrics,
    action: recommendation.action,
    aiExplanation: recommendation.aiExplanation ?? null,
    tags: recommendation.tags ?? [],
  });
}

/**
 * @param {import('./schema').Recommendation[]} recommendations
 * @param {Record<string, unknown>} [signals]
 * @param {{ report?: string }} [options]
 * @returns {ResolvedRecommendation[]}
 */
export function resolveRecommendations(recommendations, signals = {}, options = {}) {
  const reportId = options.report ?? null;
  const seen = new Set();
  const applicable = [];

  for (const recommendation of recommendations ?? []) {
    if (reportId && !(recommendation.reports ?? []).includes(reportId)) continue;
    if (seen.has(recommendation.id)) continue;
    if (!evaluateTrigger(recommendation.triggerId, signals)) continue;
    seen.add(recommendation.id);
    applicable.push(recommendation);
  }

  applicable.sort(
    (a, b) =>
      a.priority - b.priority ||
      severityWeight(b.severity) - severityWeight(a.severity) ||
      a.id.localeCompare(b.id),
  );

  return applicable.map((recommendation) => toDescriptor(recommendation, signals));
}
