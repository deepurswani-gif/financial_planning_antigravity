import {
  WORKSPACE_STORAGE_KEY,
  DEFAULT_SUMMARY_REPORT_ID,
  DEFAULT_DETAIL_TAB_ID,
  getDefaultExpandedDrawerGroups,
  SUMMARY_REPORT_NAV_ITEMS,
  DETAIL_REPORT_TAB_ITEMS,
  PRIMARY_NAV_ITEMS,
  SECONDARY_NAV_BY_PRIMARY,
  resolveCanonicalId,
  isKnownCalculatorId,
} from './workspaceNavConfig';

export function createDefaultWorkspaceState() {
  return {
    mode: 'full',
    activePrimaryId: null,
    activeSecondaryId: null,
    secondaryByPrimary: {},
    openCalculatorId: null,
    lastOpenedCalculatorId: null,
    visitedCalculatorIds: [],
    activeSummaryReportId: DEFAULT_SUMMARY_REPORT_ID,
    activeDetailReportId: DEFAULT_DETAIL_TAB_ID,
    workspaceFocus: 'detail',
    drawerOpen: false,
    expandedDrawerGroups: getDefaultExpandedDrawerGroups(),
    detailReportUi: {},
    summaryReportUi: {},
    calculatorUi: {},
    workspaceScrollTop: 0,
  };
}

function isKnownPrimary(id) {
  return PRIMARY_NAV_ITEMS.some((item) => item.id === id);
}

function isKnownSecondary(primaryId, secondaryId) {
  const canonicalSecondary = resolveCanonicalId(secondaryId);
  return (SECONDARY_NAV_BY_PRIMARY[primaryId] || []).some((item) => item.id === canonicalSecondary);
}

function isKnownSummary(id) {
  const canonical = resolveCanonicalId(id);
  return SUMMARY_REPORT_NAV_ITEMS.some((item) => item.id === canonical);
}

function isKnownDetail(id) {
  const canonical = resolveCanonicalId(id);
  return DETAIL_REPORT_TAB_ITEMS.some((item) => item.id === canonical);
}

/** Remap object keys through resolveCanonicalId; merge collisions (canonical wins over alias). */
export function canonicalizeIdKeyedMap(map) {
  if (!map || typeof map !== 'object') return {};
  const next = {};
  for (const [key, value] of Object.entries(map)) {
    const canonicalKey = resolveCanonicalId(key);
    if (next[canonicalKey] == null) {
      next[canonicalKey] = value;
    } else if (key === canonicalKey) {
      // Prefer the entry already stored under the canonical key
      next[canonicalKey] = value;
    }
  }
  return next;
}

function canonicalizeCalculatorIdList(ids) {
  if (!Array.isArray(ids)) return [];
  const seen = new Set();
  const result = [];
  for (const id of ids) {
    const canonical = resolveCanonicalId(id);
    if (!isKnownCalculatorId(canonical) || seen.has(canonical)) continue;
    seen.add(canonical);
    result.push(canonical);
  }
  return result;
}

/** Persist only durable navigation/UI state (not ephemeral drawer open). */
export function serializeWorkspaceState(state) {
  return {
    mode: state.mode === 'summary' ? 'summary' : 'full',
    activePrimaryId: state.activePrimaryId,
    activeSecondaryId: state.activeSecondaryId,
    secondaryByPrimary: state.secondaryByPrimary,
    openCalculatorId: state.openCalculatorId,
    lastOpenedCalculatorId: state.lastOpenedCalculatorId,
    visitedCalculatorIds: state.visitedCalculatorIds,
    activeSummaryReportId: state.activeSummaryReportId,
    activeDetailReportId: state.activeDetailReportId,
    workspaceFocus: state.workspaceFocus,
    expandedDrawerGroups: state.expandedDrawerGroups,
    detailReportUi: state.detailReportUi,
    summaryReportUi: state.summaryReportUi,
    calculatorUi: state.calculatorUi,
    workspaceScrollTop: state.workspaceScrollTop,
  };
}

/**
 * Hydrate persisted workspace state and convert any legacy IDs to canonical IDs.
 * Never returns legacy IDs in active navigation / UI maps.
 */
export function hydrateWorkspaceState(raw) {
  const defaults = createDefaultWorkspaceState();
  if (!raw || typeof raw !== 'object') return defaults;

  const activePrimaryId =
    raw.activePrimaryId && isKnownPrimary(raw.activePrimaryId) ? raw.activePrimaryId : null;

  let activeSecondaryId = raw.activeSecondaryId != null ? resolveCanonicalId(raw.activeSecondaryId) : null;
  if (
    activeSecondaryId &&
    activePrimaryId &&
    !isKnownSecondary(activePrimaryId, activeSecondaryId)
  ) {
    activeSecondaryId = null;
  } else if (activeSecondaryId && !isKnownCalculatorId(activeSecondaryId)) {
    activeSecondaryId = null;
  }

  const secondaryByPrimary = {};
  if (raw.secondaryByPrimary && typeof raw.secondaryByPrimary === 'object') {
    for (const [primaryId, secondaryId] of Object.entries(raw.secondaryByPrimary)) {
      const canonicalSecondary = resolveCanonicalId(secondaryId);
      if (isKnownPrimary(primaryId) && isKnownSecondary(primaryId, canonicalSecondary)) {
        secondaryByPrimary[primaryId] = canonicalSecondary;
      }
    }
  }

  const visitedCalculatorIds = canonicalizeCalculatorIdList(raw.visitedCalculatorIds);

  let openCalculatorId =
    raw.openCalculatorId != null ? resolveCanonicalId(raw.openCalculatorId) : null;
  if (openCalculatorId && !isKnownCalculatorId(openCalculatorId)) {
    openCalculatorId = null;
  }
  if (openCalculatorId && !visitedCalculatorIds.includes(openCalculatorId)) {
    visitedCalculatorIds.push(openCalculatorId);
  }

  let lastOpenedCalculatorId =
    raw.lastOpenedCalculatorId != null ? resolveCanonicalId(raw.lastOpenedCalculatorId) : null;
  if (lastOpenedCalculatorId && !isKnownCalculatorId(lastOpenedCalculatorId)) {
    lastOpenedCalculatorId = null;
  }

  const summaryRaw = resolveCanonicalId(raw.activeSummaryReportId);
  const detailRaw = resolveCanonicalId(raw.activeDetailReportId);
  const mode = raw.mode === 'summary' ? 'summary' : 'full';

  return {
    ...defaults,
    mode,
    activePrimaryId,
    activeSecondaryId,
    secondaryByPrimary,
    openCalculatorId: mode === 'summary' ? null : openCalculatorId,
    lastOpenedCalculatorId,
    visitedCalculatorIds,
    activeSummaryReportId: isKnownSummary(summaryRaw) ? summaryRaw : DEFAULT_SUMMARY_REPORT_ID,
    activeDetailReportId: isKnownDetail(detailRaw) ? detailRaw : DEFAULT_DETAIL_TAB_ID,
    workspaceFocus:
      mode === 'summary'
        ? 'summary'
        : raw.workspaceFocus === 'summary'
          ? 'summary'
          : 'detail',
    drawerOpen: false,
    expandedDrawerGroups: Array.isArray(raw.expandedDrawerGroups)
      ? raw.expandedDrawerGroups
      : defaults.expandedDrawerGroups,
    detailReportUi: canonicalizeIdKeyedMap(raw.detailReportUi),
    summaryReportUi: canonicalizeIdKeyedMap(raw.summaryReportUi),
    calculatorUi: canonicalizeIdKeyedMap(raw.calculatorUi),
    workspaceScrollTop: typeof raw.workspaceScrollTop === 'number' ? raw.workspaceScrollTop : 0,
  };
}

/** True when raw payload still contains legacy alias keys that should be rewritten. */
export function persistedStateNeedsMigration(raw) {
  if (!raw || typeof raw !== 'object') return false;

  const scalarIds = [
    raw.activeSecondaryId,
    raw.openCalculatorId,
    raw.lastOpenedCalculatorId,
    raw.activeSummaryReportId,
    raw.activeDetailReportId,
  ];
  if (scalarIds.some((id) => id != null && resolveCanonicalId(id) !== id)) return true;

  if (Array.isArray(raw.visitedCalculatorIds)) {
    if (raw.visitedCalculatorIds.some((id) => resolveCanonicalId(id) !== id)) return true;
  }

  if (raw.secondaryByPrimary && typeof raw.secondaryByPrimary === 'object') {
    if (Object.values(raw.secondaryByPrimary).some((id) => resolveCanonicalId(id) !== id)) {
      return true;
    }
  }

  for (const mapKey of ['calculatorUi', 'summaryReportUi', 'detailReportUi']) {
    const map = raw[mapKey];
    if (map && typeof map === 'object') {
      if (Object.keys(map).some((key) => resolveCanonicalId(key) !== key)) return true;
    }
  }

  return false;
}

export function loadWorkspaceState() {
  try {
    const rawJson = localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (!rawJson) return createDefaultWorkspaceState();

    const raw = JSON.parse(rawJson);
    const hydrated = hydrateWorkspaceState(raw);

    // Rewrite localStorage with canonical IDs so legacy keys are not retained.
    if (persistedStateNeedsMigration(raw)) {
      saveWorkspaceState(hydrated);
    }

    return hydrated;
  } catch (error) {
    console.warn('Failed to load Financial Workspace state:', error);
    return createDefaultWorkspaceState();
  }
}

export function saveWorkspaceState(state) {
  try {
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(serializeWorkspaceState(state)));
  } catch (error) {
    console.warn('Failed to save Financial Workspace state:', error);
  }
}
