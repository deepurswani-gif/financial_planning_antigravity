/**
 * Recommendation Instance model.
 *
 * The Registry defines *definitions*. The Orchestration Engine produces
 * *instances* — the runtime representation of a recommendation that currently
 * applies to a user. Instances are dynamic (status, timestamps, priority rank,
 * originating sources, resolved CTA); definitions remain immutable.
 *
 * An instance carries everything a channel needs to render or route the
 * recommendation, so reports/dashboards/notifications consume one unified shape
 * and never reach back into the registry or resolvers.
 */

import { LIFECYCLE_STATUS } from './lifecycle';
import { reportIdsFromSources } from './originatingSources';

/**
 * @typedef {object} RecommendationInstance
 * @property {string} instanceId - canonical identity (equals recommendationId; instances are deduped by recommendation)
 * @property {string} recommendationId
 * @property {string} triggerId
 * @property {import('./lifecycle').LifecycleStatus} status
 * @property {number} priority - registry priority (lower = more important)
 * @property {string} severity
 * @property {string} category
 * @property {string|null} type
 * @property {string} title
 * @property {string} summary - interpolated
 * @property {string} description - interpolated
 * @property {import('../recommendationRegistry/actions').RecommendationAction} action
 * @property {import('./originatingSources').OriginatingSource[]} originatingSources - adapter/resolver provenance (merged on dedupe)
 * @property {string[]} originatingReports - report ids derived from originatingSources (store filter compatibility)
 * @property {string[]} supportingMetrics
 * @property {Record<string, unknown>} metrics
 * @property {string[]} tags
 * @property {null} aiExplanation
 * @property {string} createdAt - ISO
 * @property {string} updatedAt - ISO
 */

/**
 * Build a recommendation instance from a resolved recommendation descriptor.
 * @param {import('../recommendationRegistry/resolveRecommendations').ResolvedRecommendation} resolved
 * @param {{
 *   now?: number,
 *   originatingSources?: import('./originatingSources').OriginatingSource[],
 * }} [context]
 * @returns {RecommendationInstance}
 */
export function createInstance(resolved, context = {}) {
  const iso = new Date(context.now ?? Date.now()).toISOString();
  const originatingSources = [...(context.originatingSources ?? [])];
  return {
    instanceId: resolved.id,
    recommendationId: resolved.id,
    triggerId: resolved.triggerId,
    status: LIFECYCLE_STATUS.ACTIVE,
    priority: resolved.priority,
    severity: resolved.severity,
    category: resolved.category,
    type: resolved.type ?? null,
    title: resolved.title,
    summary: resolved.summary,
    description: resolved.description,
    action: resolved.action,
    originatingSources,
    originatingReports: reportIdsFromSources(originatingSources),
    supportingMetrics: resolved.supportingMetrics ?? [],
    metrics: resolved.metrics ?? {},
    tags: resolved.tags ?? [],
    aiExplanation: resolved.aiExplanation ?? null,
    createdAt: iso,
    updatedAt: iso,
  };
}
