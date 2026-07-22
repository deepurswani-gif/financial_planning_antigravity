/**
 * Recommendation Orchestration Engine — public API.
 *
 * The single source of truth for the user's ACTIVE financial recommendations.
 *
 * Architecture:
 *
 *   Financial Engines
 *          |
 *   Signal Adapters
 *          |
 *   Recommendation Orchestration Engine   <-- this module
 *          |
 *   Recommendation Resolver     (consumed internally)
 *          |
 *   Commercial CTA Resolver     (consumed internally)
 *          |
 *   Reports / Dashboard / Notifications / AI / Advisor CRM
 *
 * Responsibility split (unchanged across Finbrella):
 *   - Registry owns metadata.
 *   - Resolver interprets metadata.
 *   - Orchestration Engine manages runtime state (instances + lifecycle).
 *   - Reports remain presentation-only.
 *
 * No financial calculations live here.
 */

export { orchestrateRecommendations, isRenderable } from './orchestrate';
export { createRecommendationStore } from './store';
export { useRecommendationStore } from './useRecommendationStore';
export { createInstance } from './instanceModel';
export { buildDiagnostics } from './diagnostics';
export { compareInstances, sortInstances } from './prioritize';
export {
  LIFECYCLE_STATUS,
  LIFECYCLE_STATES,
  isLifecycleStatus,
  isRenderableStatus,
  canTransition,
  applyTransition,
  applyLifecycleOverride,
} from './lifecycle';
export {
  SOURCE_BY_REPORT,
  sourceForReport,
  mergeOriginatingSources,
  reportIdsFromSources,
} from './originatingSources';
