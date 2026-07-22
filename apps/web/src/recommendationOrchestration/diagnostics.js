/**
 * Developer diagnostics for the Orchestration Engine.
 *
 * Read-only insight into what the engine produced: counts, duplicate detection,
 * lifecycle distribution, priority ordering, and originating sources.
 * Diagnostics never affect rendering — they exist for tooling and tests.
 */

import { LIFECYCLE_STATES, LIFECYCLE_STATUS } from './lifecycle';

function tally(map, key) {
  if (key == null) return;
  map[key] = (map[key] ?? 0) + 1;
}

function sourceKey(source) {
  return `${source?.reportId ?? ''}::${source?.engineId ?? ''}`;
}

/**
 * @param {import('./instanceModel').RecommendationInstance[]} instances - globally sorted
 * @param {{ duplicatesRemoved?: number, duplicateIds?: string[] }} [extra]
 */
export function buildDiagnostics(instances, extra = {}) {
  const byLifecycle = Object.fromEntries(LIFECYCLE_STATES.map((s) => [s, 0]));
  const byReport = {};
  const bySeverity = {};
  const byCategory = {};
  const idCounts = {};
  /** @type {Record<string, import('./originatingSources').OriginatingSource & { count: number }>} */
  const byOriginatingSource = {};

  for (const instance of instances) {
    tally(byLifecycle, instance.status);
    tally(bySeverity, instance.severity);
    tally(byCategory, instance.category);
    tally(idCounts, instance.recommendationId);
    for (const report of instance.originatingReports ?? []) tally(byReport, report);
    for (const source of instance.originatingSources ?? []) {
      const key = sourceKey(source);
      if (!byOriginatingSource[key]) {
        byOriginatingSource[key] = {
          reportId: source.reportId,
          reportName: source.reportName,
          engineId: source.engineId,
          engineName: source.engineName,
          count: 0,
        };
      }
      byOriginatingSource[key].count += 1;
    }
  }

  const priorityOrdering = instances.map((instance) => ({
    recommendationId: instance.recommendationId,
    priority: instance.priority,
    severity: instance.severity,
    rank: instance.priorityRank ?? null,
    originatingSources: instance.originatingSources ?? [],
  }));

  const duplicateIds = extra.duplicateIds ?? Object.keys(idCounts).filter((id) => idCounts[id] > 1);

  return {
    total: instances.length,
    active: byLifecycle[LIFECYCLE_STATUS.ACTIVE] ?? 0,
    byLifecycle,
    byOriginatingSource,
    originatingSources: Object.values(byOriginatingSource),
    byReport,
    bySeverity,
    byCategory,
    priorityOrdering,
    duplicatesRemoved: extra.duplicatesRemoved ?? 0,
    duplicateIds,
  };
}
