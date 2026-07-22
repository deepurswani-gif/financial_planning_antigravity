/**
 * Supporting-metric presentation helpers.
 * Formats values already present on the recommendation instance — never recalculates.
 */

/** Human labels for known supporting metric keys. */
export const METRIC_LABELS = Object.freeze({
  protectionGap: 'Protection Gap',
  protectionGapDisplay: 'Protection Gap',
  healthGap: 'Health Cover Gap',
  healthGapDisplay: 'Health Cover Gap',
  healthCoverRequired: 'Health Cover Required',
  healthMinDisplay: 'Recommended Cover',
  emergencyGap: 'Emergency Fund Gap',
  emergencyGapDisplay: 'Emergency Fund Gap',
  emergencyMonthsCovered: 'Emergency Cover',
  emergencyIdealMonths: 'Ideal Emergency Cover',
  monthlyFreeCash: 'Monthly Free Cash',
  monthlyFreeCashDisplay: 'Monthly Free Cash',
  proratedUnallocated: 'Unallocated Surplus',
  proratedUnallocatedDisplay: 'Unallocated Surplus',
  deployableMonthly: 'Deployable Monthly',
  wealthMonthly: 'Wealth SIP Capacity',
  yearsToRetirement: 'Years to Retirement',
  allocationCount: 'Existing Allocations',
});

/** Prefer display-string keys when choosing a single primary metric. */
const PRIMARY_METRIC_PREFERENCE = Object.freeze([
  'protectionGapDisplay',
  'protectionGap',
  'healthGapDisplay',
  'healthMinDisplay',
  'healthCoverRequired',
  'healthGap',
  'emergencyGapDisplay',
  'emergencyGap',
  'emergencyMonthsCovered',
  'monthlyFreeCashDisplay',
  'monthlyFreeCash',
  'proratedUnallocatedDisplay',
  'deployableMonthly',
]);

function formatMetricValue(key, value) {
  if (value == null || value === '') return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (key === 'emergencyMonthsCovered' || key === 'emergencyIdealMonths') {
      return `${value} months`;
    }
    if (key === 'yearsToRetirement') {
      return `${value} years`;
    }
    if (key === 'allocationCount') {
      return String(value);
    }
    try {
      return `₹${Math.round(value).toLocaleString('en-IN')}`;
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/**
 * @param {Record<string, unknown>} [metrics]
 * @param {string[]} [supportingMetrics]
 * @returns {{ key: string, label: string, value: string }[]}
 */
export function buildSupportingMetrics(metrics = {}, supportingMetrics = []) {
  const keys =
    supportingMetrics.length > 0 ? supportingMetrics : Object.keys(metrics ?? {});
  const seen = new Set();
  const result = [];

  for (const key of keys) {
    // Prefer *Display companion when both exist; skip raw twin.
    if (key.endsWith('Display')) {
      // ok
    } else if (metrics[`${key}Display`] != null) {
      continue;
    }
    if (seen.has(key)) continue;
    const value = formatMetricValue(key, metrics[key]);
    if (value == null) continue;
    seen.add(key);
    result.push({
      key,
      label: METRIC_LABELS[key] ?? key,
      value,
    });
  }
  return result;
}

/**
 * Pick one primary metric for the collapsed card, or null.
 * @param {{ key: string, label: string, value: string }[]} metrics
 */
export function pickPrimaryMetric(metrics = []) {
  if (!metrics.length) return null;
  for (const preferred of PRIMARY_METRIC_PREFERENCE) {
    const match = metrics.find((m) => m.key === preferred);
    if (match) return match;
  }
  return metrics[0];
}
