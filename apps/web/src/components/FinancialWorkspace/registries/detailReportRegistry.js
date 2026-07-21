import DetailReportPlaceholder from '../placeholders/DetailReportPlaceholder';
import YourMoneyFlowSection from '../../DetailedReport/YourMoneyFlowSection';
import PutYourMoneyToWorkSection from '../../DetailedReport/PutYourMoneyToWorkSection';
import TrackSurplusAllocationSection from '../../DetailedReport/TrackSurplusAllocationSection';
import { DETAIL_REPORT_TAB_ITEMS, resolveCanonicalId } from '../workspaceNavConfig';

/** Activated production detail sections (flagship journey complete). */
const DETAIL_SECTION_BY_ID = {
  your_money_flow: YourMoneyFlowSection,
  put_your_money_to_work: PutYourMoneyToWorkSection,
  your_moneys_magic: TrackSurplusAllocationSection,
};

/**
 * Registry of detail journey reports keyed by canonical IDs only.
 */
export const DETAIL_REPORT_REGISTRY = Object.fromEntries(
  DETAIL_REPORT_TAB_ITEMS.map((item) => {
    const component = DETAIL_SECTION_BY_ID[item.id] || DetailReportPlaceholder;
    return [
      item.id,
      {
        id: item.id,
        label: item.label,
        stage: item.stage,
        component,
        usesHostUiProps: component === DetailReportPlaceholder,
      },
    ];
  })
);

export function getDetailReportRegistryEntry(id) {
  return DETAIL_REPORT_REGISTRY[resolveCanonicalId(id)] ?? null;
}
