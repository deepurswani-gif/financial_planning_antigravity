/**
 * Report identifiers a recommendation can surface in.
 *
 * Aligned with the report nav ids in workspaceNavConfig.js
 * (SUMMARY_REPORT_NAV_ITEMS / DETAIL_REPORT_TAB_ITEMS) plus a couple of
 * logical report surfaces. Recommendations reference these so the resolver can
 * hand each report only the recommendations relevant to it.
 *
 * Extensible: append to REPORT_IDS to introduce a new report surface.
 */

export const REPORT_IDS = Object.freeze([
  // Summary reports
  'money_story',
  'safety_net',
  'future_self',
  'useful_insights',
  // Detailed reports
  'your_money_flow',
  'fix_your_financial_gaps',
  'put_your_money_to_work',
  'your_moneys_magic',
  'invest_surplus',
  'life_journey',
]);

const SET = new Set(REPORT_IDS);

export function isReportId(value) {
  return SET.has(value);
}

export function listReportIds() {
  return [...REPORT_IDS];
}
