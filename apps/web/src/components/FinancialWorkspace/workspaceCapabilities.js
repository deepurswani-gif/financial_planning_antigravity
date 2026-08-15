/**
 * Capability gating for Financial Workspace operating modes.
 * Single workspace — features unlock based on mode, not duplicate shells.
 */

import { SECTION_IDS } from './sectionIds';

export const WORKSPACE_MODE_SUMMARY = 'summary';
export const WORKSPACE_MODE_FULL = 'full';

/** Drawer item IDs unlocked when the user capability is Summary. */
export const SUMMARY_CAPABILITY_UNLOCKED_SECTION_IDS = new Set([
  SECTION_IDS.PROFILE,
  SECTION_IDS.CASH_FLOW,
  SECTION_IDS.SAVINGS,
  SECTION_IDS.ASSETS,
  SECTION_IDS.LIABILITIES,
  SECTION_IDS.GOALS,
  'settings',
  'logout',
]);

export function normalizeWorkspaceMode(mode) {
  return mode === WORKSPACE_MODE_FULL ? WORKSPACE_MODE_FULL : WORKSPACE_MODE_SUMMARY;
}

export function isSummaryMode(mode) {
  return normalizeWorkspaceMode(mode) === WORKSPACE_MODE_SUMMARY;
}

export function isFullMode(mode) {
  return normalizeWorkspaceMode(mode) === WORKSPACE_MODE_FULL;
}

export function canUseCalculators(mode) {
  return isFullMode(mode);
}

export function canUseDetailReports(mode) {
  return isFullMode(mode);
}

export function canUseSummaryReports() {
  return true;
}

export function isDrawerItemLocked(mode, itemId) {
  if (isFullMode(mode)) return false;
  return !SUMMARY_CAPABILITY_UNLOCKED_SECTION_IDS.has(itemId);
}

export const UNLOCK_DIALOG_COPY = {
  title: 'Unlock Complete Planning',
  body: 'Complete your Financial Profile to access detailed reports, advanced calculators, loan tracking, tax planning tools, and many more powerful planning features.',
  primary: 'Complete Financial Profile →',
  secondary: 'Maybe Later',
};
