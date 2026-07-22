/**
 * React binding for the Recommendation Store.
 *
 * Memoizes a store for the given signals so reports simply *request*
 * recommendations. The engine owns ordering, deduplication, lifecycle and CTA
 * resolution; the component only presents.
 *
 * Callers should pass a memoized `signals` object and stable `reports` /
 * `capabilities` references (e.g. module-level constants) to keep the store
 * stable across renders.
 */

import { useMemo } from 'react';
import { createRecommendationStore } from './store';

/**
 * @param {Record<string, unknown>} signals
 * @param {{
 *   reports?: string[],
 *   capabilities?: Record<string, boolean>,
 *   lifecycleOverrides?: Record<string, string>,
 *   sourceByReport?: Record<string, import('./originatingSources').OriginatingSource>,
 * }} [options]
 */
export function useRecommendationStore(signals, options = {}) {
  const { reports, capabilities, lifecycleOverrides, sourceByReport } = options;
  return useMemo(
    () =>
      createRecommendationStore(signals, {
        reports,
        capabilities,
        lifecycleOverrides,
        sourceByReport,
      }),
    [signals, reports, capabilities, lifecycleOverrides, sourceByReport],
  );
}
