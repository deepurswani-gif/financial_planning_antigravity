/**
 * Originating-source provenance.
 *
 * A recommendation's *category* classifies what kind of guidance it is.
 * Provenance answers a different question: which report adapter / financial
 * engine surface produced the signals that caused this instance to fire.
 *
 * Provenance is therefore keyed by report scope (the adapter/resolver context
 * used during orchestration), NEVER by recommendation category.
 *
 * Each source is:
 *   { reportId, reportName, engineId, engineName }
 *
 * Deduplication merges sources from every contributing report so a shared
 * canonical instance retains full provenance.
 */

/**
 * @typedef {object} OriginatingSource
 * @property {string} reportId
 * @property {string} reportName
 * @property {string} engineId
 * @property {string} engineName
 */

/**
 * Adapter/report provenance catalog.
 *
 * Maps the report id passed to the Recommendation Resolver to the financial
 * engine/adapter that actually produced that report's signals. Entries cover
 * the adapters that currently exist; unknown report ids fall back to a
 * report-only placeholder so orchestration never invents category→engine maps.
 */
export const SOURCE_BY_REPORT = Object.freeze({
  safety_net: Object.freeze({
    reportId: 'safety_net',
    reportName: 'The Safety Net',
    engineId: 'safetyNetLogic',
    engineName: 'Safety Net Logic',
  }),
  useful_insights: Object.freeze({
    reportId: 'useful_insights',
    reportName: 'Useful Insights',
    engineId: 'executiveSummaryLogic',
    engineName: 'Executive Summary Logic',
  }),
  invest_surplus: Object.freeze({
    reportId: 'invest_surplus',
    reportName: 'Invest Surplus',
    engineId: 'investSurplusLogic',
    engineName: 'Invest Surplus Logic',
  }),
  put_your_money_to_work: Object.freeze({
    reportId: 'put_your_money_to_work',
    reportName: 'Put Your Money To Work',
    engineId: 'investSurplusLogic',
    engineName: 'Invest Surplus Logic',
  }),
  money_story: Object.freeze({
    reportId: 'money_story',
    reportName: 'Your Money Story',
    engineId: 'moneyStoryLogic',
    engineName: 'Money Story Logic',
  }),
  future_self: Object.freeze({
    reportId: 'future_self',
    reportName: 'Your Future Self',
    engineId: 'futureSelfLogic',
    engineName: 'Future Self Logic',
  }),
  your_money_flow: Object.freeze({
    reportId: 'your_money_flow',
    reportName: 'Your Money Flow',
    engineId: 'moneyFlowLogic',
    engineName: 'Money Flow Logic',
  }),
  your_moneys_magic: Object.freeze({
    reportId: 'your_moneys_magic',
    reportName: "Your Money's Magic",
    engineId: 'moneysMagicLogic',
    engineName: "Money's Magic Logic",
  }),
  life_journey: Object.freeze({
    reportId: 'life_journey',
    reportName: 'Life Journey',
    engineId: 'lifeJourneyLogic',
    engineName: 'Life Journey Logic',
  }),
});

function sourceKey(source) {
  return `${source?.reportId ?? ''}::${source?.engineId ?? ''}`;
}

/**
 * Resolve the originating source for a report scope.
 * Optional `sourceByReport` overrides let a caller pass adapter-declared
 * provenance without hard-coding it into the engine.
 *
 * @param {string} reportId
 * @param {Record<string, OriginatingSource>} [sourceByReport]
 * @returns {OriginatingSource}
 */
export function sourceForReport(reportId, sourceByReport) {
  const override = sourceByReport?.[reportId];
  if (override) {
    return Object.freeze({
      reportId: override.reportId ?? reportId,
      reportName: override.reportName ?? reportId,
      engineId: override.engineId ?? 'unknownEngine',
      engineName: override.engineName ?? 'Unknown Engine',
    });
  }
  const known = SOURCE_BY_REPORT[reportId];
  if (known) return known;
  return Object.freeze({
    reportId,
    reportName: reportId,
    engineId: 'unknownEngine',
    engineName: 'Unknown Engine',
  });
}

/**
 * Merge originating sources from contributing reports, preserving order of
 * first appearance and dropping exact (reportId, engineId) duplicates.
 * @param {OriginatingSource[]} [existing]
 * @param {OriginatingSource[]} [incoming]
 * @returns {OriginatingSource[]}
 */
export function mergeOriginatingSources(existing = [], incoming = []) {
  const byKey = new Map();
  for (const source of [...existing, ...incoming]) {
    if (!source?.reportId) continue;
    const key = sourceKey(source);
    if (!byKey.has(key)) byKey.set(key, source);
  }
  return [...byKey.values()];
}

/** Derive report ids from originating sources (stable, unique). */
export function reportIdsFromSources(sources = []) {
  const ids = [];
  const seen = new Set();
  for (const source of sources) {
    if (!source?.reportId || seen.has(source.reportId)) continue;
    seen.add(source.reportId);
    ids.push(source.reportId);
  }
  return ids;
}
