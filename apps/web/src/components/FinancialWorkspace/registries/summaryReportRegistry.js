import MoneyStorySection from '../../SummaryReport/MoneyStorySection';
import SafetyNetSection from '../../SummaryReport/SafetyNetSection';
import FutureSelfSection from '../../SummaryReport/FutureSelfSection';
import ExecutiveSummarySection from '../../SummaryReport/ExecutiveSummarySection';
import { SUMMARY_REPORT_NAV_ITEMS, resolveCanonicalId } from '../workspaceNavConfig';

/**
 * Canonical summary report → production section (same components as SummaryReportView).
 * Workspace uses `future_self`; standalone route still uses slug `your_future_self`.
 */
const SUMMARY_SECTION_BY_ID = {
  money_story: MoneyStorySection,
  safety_net: SafetyNetSection,
  future_self: FutureSelfSection,
  useful_insights: ExecutiveSummarySection,
};

/**
 * Registry of summary reports keyed by canonical IDs only.
 */
export const SUMMARY_REPORT_REGISTRY = Object.fromEntries(
  SUMMARY_REPORT_NAV_ITEMS.map((item) => [
    item.id,
    {
      id: item.id,
      label: item.label,
      component: SUMMARY_SECTION_BY_ID[item.id],
    },
  ])
);

export function getSummaryReportRegistryEntry(id) {
  return SUMMARY_REPORT_REGISTRY[resolveCanonicalId(id)] ?? null;
}
