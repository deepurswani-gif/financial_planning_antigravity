import SummaryProfile from '../SummaryFlow/SummaryProfile';
import SummaryCashFlow from '../SummaryFlow/SummaryCashFlow';
import SummarySavings from '../SummaryFlow/SummarySavings';
import SummaryAssets from '../SummaryFlow/SummaryAssets';
import SummaryLiabilities from '../SummaryFlow/SummaryLiabilities';
import SummaryGoals from '../SummaryFlow/SummaryGoals';
import DetailedFamilyInfo from '../DetailedFlow/DetailedFamilyInfo';
import DetailedMoneyInOut from '../DetailedFlow/DetailedMoneyInOut';
import DetailedMyWealthSnapshot from '../DetailedFlow/DetailedMyWealthSnapshot';
import DetailedDreamsGoals from '../DetailedFlow/DetailedDreamsGoals';
import {
  SECTION_IDS,
  SECTION_ID_ALIASES,
  SECTION_GROUP_YOUR_INFORMATION,
  SECTION_GROUP_ADVANCED_INFORMATION,
  resolveSectionId,
} from './sectionIds';

export {
  SECTION_IDS,
  SECTION_ID_ALIASES,
  SECTION_GROUP_YOUR_INFORMATION,
  SECTION_GROUP_ADVANCED_INFORMATION,
  resolveSectionId,
};

/**
 * Registry of editable sections — maps stable IDs to existing form components.
 * Onboarding paths are preserved for first-time guided flows only.
 */
export const EDITABLE_SECTIONS = [
  {
    id: SECTION_IDS.PROFILE,
    label: 'Profile',
    group: SECTION_GROUP_YOUR_INFORMATION,
    component: SummaryProfile,
    onboardingPath: '/summary-flow/profile',
  },
  {
    id: SECTION_IDS.CASH_FLOW,
    label: 'Cash Flow',
    group: SECTION_GROUP_YOUR_INFORMATION,
    component: SummaryCashFlow,
    onboardingPath: '/summary-flow/cashflow',
  },
  {
    id: SECTION_IDS.SAVINGS,
    label: 'Savings',
    group: SECTION_GROUP_YOUR_INFORMATION,
    component: SummarySavings,
    onboardingPath: '/summary-flow/savings',
  },
  {
    id: SECTION_IDS.ASSETS,
    label: 'Assets',
    group: SECTION_GROUP_YOUR_INFORMATION,
    component: SummaryAssets,
    onboardingPath: '/summary-flow/assets',
  },
  {
    id: SECTION_IDS.LIABILITIES,
    label: 'Liabilities',
    group: SECTION_GROUP_YOUR_INFORMATION,
    component: SummaryLiabilities,
    onboardingPath: '/summary-flow/liabilities',
  },
  {
    id: SECTION_IDS.GOALS,
    label: 'Goals',
    group: SECTION_GROUP_YOUR_INFORMATION,
    component: SummaryGoals,
    onboardingPath: '/summary-flow/goals',
  },
  {
    id: SECTION_IDS.FAMILY_INFORMATION,
    label: 'Family Information',
    group: SECTION_GROUP_ADVANCED_INFORMATION,
    component: DetailedFamilyInfo,
    onboardingPath: '/detailed-flow/familyinfo',
  },
  {
    id: SECTION_IDS.MONEY_IN_MONEY_OUT,
    label: 'Money In & Money Out',
    group: SECTION_GROUP_ADVANCED_INFORMATION,
    component: DetailedMoneyInOut,
    onboardingPath: '/detailed-flow/money_in_out',
  },
  {
    id: SECTION_IDS.WEALTH_SNAPSHOT,
    label: 'My Wealth Snapshot',
    group: SECTION_GROUP_ADVANCED_INFORMATION,
    component: DetailedMyWealthSnapshot,
    onboardingPath: '/detailed-flow/mywealth',
  },
  {
    id: SECTION_IDS.DREAMS_AND_GOALS,
    label: 'My Dreams & Goals',
    group: SECTION_GROUP_ADVANCED_INFORMATION,
    component: DetailedDreamsGoals,
    onboardingPath: '/detailed-flow/dreams_goals',
  },
];

const sectionById = new Map(EDITABLE_SECTIONS.map((section) => [section.id, section]));

export function getSectionById(id) {
  const resolved = resolveSectionId(id);
  return resolved ? sectionById.get(resolved) ?? null : null;
}

export function isKnownSectionId(id) {
  return getSectionById(id) != null;
}

export function getSectionsByGroup(groupId) {
  return EDITABLE_SECTIONS.filter((section) => section.group === groupId);
}

export function isAdvancedSection(sectionId) {
  const section = getSectionById(sectionId);
  return section?.group === SECTION_GROUP_ADVANCED_INFORMATION;
}

/** Onboarding path for first-time guided flow (no workspace drawer). */
export function sectionOnboardingPath(sectionId) {
  const section = getSectionById(sectionId);
  return section?.onboardingPath ?? '/summary-flow/profile';
}
