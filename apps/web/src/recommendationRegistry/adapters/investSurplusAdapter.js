/**
 * Invest-Surplus adapter.
 *
 * Maps the output of investSurplusLogic.buildInvestSurplusReport into a
 * normalized `signals` snapshot for the Recommendation Resolver. It does NOT
 * recalculate anything — it reads report keys and pre-formats display strings
 * with the same `₹`/`toLocaleString('en-IN')` convention the report already
 * used, so migrated Deployment Insights copy stays byte-for-byte identical.
 */

function formatInr(value) {
  return `₹${Math.round(value || 0).toLocaleString('en-IN')}`;
}

export function buildInvestSurplusSignals(report = {}) {
  const hasData = report?.meta?.hasData !== false;
  const hero = report?.hero ?? {};
  const allocationsSummary = report?.allocationsSummary ?? {};
  const sipProjection = report?.sipProjection ?? {};

  const monthlyFreeCash = hero.monthlyFreeCash ?? 0;
  const proratedUnallocated = hero.proratedUnallocated ?? 0;
  const deployableMonthly = hero.deployableMonthly ?? 0;
  const allocationCount = allocationsSummary.count ?? 0;
  const monthlyCommitted = allocationsSummary.monthlyCommitted ?? 0;
  const yearsToRetirement = report?.meta?.yearsToRetirement ?? 0;
  const wealthMonthly = deployableMonthly;
  const sipFutureValue = sipProjection.futureValue ?? 0;

  return {
    hasMoneyFlowData: hasData,

    monthlyFreeCash,
    monthlyFreeCashDisplay: formatInr(monthlyFreeCash),

    proratedUnallocated,
    proratedUnallocatedDisplay: formatInr(proratedUnallocated),

    allocationCount,
    allocationPlural: allocationCount > 1 ? 's' : '',
    monthlyCommitted,
    monthlyCommittedDisplay: formatInr(monthlyCommitted),

    deployableMonthly,
    yearsToRetirement,

    wealthMonthly,
    wealthMonthlyDisplay: formatInr(wealthMonthly),
    sipFutureValue,
  };
}
