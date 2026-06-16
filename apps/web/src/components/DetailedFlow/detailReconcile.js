export const RECONCILE_TOLERANCE = 1;

/** Compare summary snapshot vs detailed breakdown totals. */
export function reconcileAmounts(summaryTotal, detailTotal, tolerance = RECONCILE_TOLERANCE) {
    const summary = parseFloat(summaryTotal) || 0;
    const detail = parseFloat(detailTotal) || 0;
    const delta = summary - detail;

    if (summary <= 0 && detail <= 0) {
        return { summaryTotal: summary, detailTotal: detail, delta: 0, status: 'empty' };
    }
    if (Math.abs(delta) <= tolerance) {
        return { summaryTotal: summary, detailTotal: detail, delta: 0, status: 'match' };
    }
    if (delta > 0) {
        return { summaryTotal: summary, detailTotal: detail, delta, status: 'under' };
    }
    return { summaryTotal: summary, detailTotal: detail, delta, status: 'over' };
}
