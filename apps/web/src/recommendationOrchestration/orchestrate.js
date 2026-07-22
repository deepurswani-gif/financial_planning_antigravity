/**
 * Orchestration pipeline.
 *
 *   Financial Engines
 *          |
 *   Signal Adapters        -> normalized `signals`
 *          |
 *   Orchestration Engine   <-- THIS: create/dedupe/prioritize/lifecycle
 *          |
 *   Recommendation Resolver  (consumed here; interprets registry + triggers)
 *          |
 *   Commercial CTA Resolver  (consumed here; produces renderable CTA)
 *          |
 *   Reports / Dashboard / Notifications / AI / CRM
 *
 * Responsibilities (runtime state only — never financial calculations):
 *   1. evaluate triggers via the Recommendation Resolver (per report scope)
 *   2. create recommendation instances
 *   3. deduplicate by recommendationId (one canonical instance per recommendation)
 *   4. merge originatingSources from every contributing report
 *   5. apply the lifecycle overlay (defaults to ACTIVE)
 *   6. produce one globally prioritized list
 *   7. attach the Commercial CTA (so no report ever calls the CTA resolver)
 *   8. emit developer diagnostics
 */

import { resolveRecommendations, REPORT_IDS } from '../recommendationRegistry';
import { resolveCommercialCta } from '../commercialCtaRegistry';
import { createInstance } from './instanceModel';
import { applyLifecycleOverride, isRenderable } from './lifecycle';
import { sortInstances } from './prioritize';
import { buildDiagnostics } from './diagnostics';
import {
  mergeOriginatingSources,
  sourceForReport,
} from './originatingSources';

/**
 * @typedef {import('./instanceModel').RecommendationInstance & {
 *   priorityRank: number,
 *   cta: import('../commercialCtaRegistry/resolveCommercialCta').ResolvedCta|null,
 * }} RenderableRecommendation
 */

/**
 * Attach the resolved Commercial CTA to an instance, yielding a renderable
 * recommendation. The pipeline owns this so reports never invoke the CTA
 * resolver directly.
 */
function attachCta(instance, context) {
  const cta = resolveCommercialCta(
    { id: instance.recommendationId, action: instance.action },
    {
      report: instance.originatingReports[0] ?? null,
      capabilities: context.capabilities,
    },
  );
  return { ...instance, cta };
}

/**
 * Orchestrate recommendations from a normalized signals snapshot.
 *
 * Signals should ideally be the merged snapshot from every signal adapter so the
 * engine can produce the single global set. A single report may instead scope
 * resolution via `context.reports` (e.g. `['safety_net']`) so incomplete signals
 * don't surface unrelated recommendations.
 *
 * @param {Record<string, unknown>} [signals]
 * @param {{
 *   reports?: string[],
 *   capabilities?: Record<string, boolean>,
 *   lifecycleOverrides?: Record<string, import('./lifecycle').LifecycleStatus>,
 *   now?: number,
 *   sourceByReport?: Record<string, import('./originatingSources').OriginatingSource>,
 * }} [context]
 * @returns {{ instances: RenderableRecommendation[], diagnostics: ReturnType<typeof buildDiagnostics> }}
 */
export function orchestrateRecommendations(signals = {}, context = {}) {
  const reports = context.reports ?? REPORT_IDS;
  const now = context.now ?? Date.now();
  const sourceByReport = context.sourceByReport;

  // 1-4: resolve per report, collect one entry per recommendationId, and merge
  // originatingSources from every report in which the trigger fired. This is
  // the deduplication guarantee: a single recommendation surfaced by multiple
  // reports yields ONE canonical instance with full provenance retained.
  const byId = new Map();
  let duplicatesRemoved = 0;
  for (const report of reports) {
    const source = sourceForReport(report, sourceByReport);
    for (const resolved of resolveRecommendations(signals, { report })) {
      const existing = byId.get(resolved.id);
      if (existing) {
        duplicatesRemoved += 1;
        existing.originatingSources = mergeOriginatingSources(
          existing.originatingSources,
          [source],
        );
      } else {
        byId.set(resolved.id, {
          resolved,
          originatingSources: mergeOriginatingSources([], [source]),
        });
      }
    }
  }

  const duplicateIds = [...byId.entries()]
    .filter(([, value]) => value.originatingSources.length > 1)
    .map(([id]) => id);

  // 5: create instances + apply lifecycle overlay.
  let instances = [...byId.values()].map(({ resolved, originatingSources }) =>
    createInstance(resolved, { now, originatingSources }),
  );
  instances = instances.map((instance) =>
    applyLifecycleOverride(instance, context.lifecycleOverrides, now),
  );

  // 6: global prioritization + rank.
  instances = sortInstances(instances).map((instance, index) => ({
    ...instance,
    priorityRank: index + 1,
  }));

  // 7: attach CTA -> renderable recommendations.
  const renderables = instances.map((instance) => attachCta(instance, context));

  // 8: diagnostics.
  const diagnostics = buildDiagnostics(renderables, { duplicatesRemoved, duplicateIds });

  return { instances: renderables, diagnostics };
}

export { isRenderable };
