/**
 * Recommendation Store.
 *
 * A lightweight, derived-only view over the orchestration pipeline output. It
 * introduces NO new persistence — it is computed from signals on creation and
 * exposes read APIs that every surface (reports, dashboard, notifications, AI,
 * CRM) can share. Consumers query the store; they never re-order, re-dedupe, or
 * invoke the CTA resolver themselves.
 *
 * Query APIs return renderable recommendations (instance + resolved CTA).
 * All list queries return only currently-renderable (active) recommendations;
 * `getById` searches every instance regardless of lifecycle state.
 */

import { orchestrateRecommendations, isRenderable } from './orchestrate';

/**
 * @param {Record<string, unknown>} [signals]
 * @param {Parameters<typeof orchestrateRecommendations>[1]} [context]
 */
export function createRecommendationStore(signals = {}, context = {}) {
  const { instances, diagnostics } = orchestrateRecommendations(signals, context);
  const active = instances.filter(isRenderable);

  return {
    /** Every instance, including non-renderable lifecycle states. */
    getAll: () => instances,
    /** Currently renderable (active) recommendations, globally ordered. */
    getActive: () => active,
    /** Active recommendations whose trigger fired in the given report. */
    getByReport: (reportId) =>
      active.filter((instance) => instance.originatingReports.includes(reportId)),
    /** Active recommendations in a registry category. */
    getByCategory: (category) => active.filter((instance) => instance.category === category),
    /** Active recommendations at a given severity. */
    getBySeverity: (severity) => active.filter((instance) => instance.severity === severity),
    /** Lookup a single instance by recommendation id (any lifecycle state). */
    getById: (recommendationId) =>
      instances.find((instance) => instance.recommendationId === recommendationId) ?? null,
    /** Developer diagnostics for the current signal snapshot. */
    getDiagnostics: () => diagnostics,
  };
}
