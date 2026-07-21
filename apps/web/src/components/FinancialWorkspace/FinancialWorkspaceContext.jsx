import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import {
  DETAIL_REPORT_TAB_ITEMS,
  DEFAULT_DETAIL_TAB_ID,
  DEFAULT_SUMMARY_REPORT_ID,
  DRAWER_ITEM_ACTIONS,
  getDefaultSecondaryId,
  resolveCanonicalId,
} from './workspaceNavConfig';
import { loadWorkspaceState, saveWorkspaceState } from './workspaceStorage';
import {
  canUseCalculators,
  canUseDetailReports,
  normalizeWorkspaceMode,
} from './workspaceCapabilities';

const FinancialWorkspaceContext = createContext(null);

function ensureUiBucket(map, id) {
  return map[id] || { scrollTop: 0, expanded: {}, selections: {}, draft: {} };
}

function workspaceReducer(state, action) {
  switch (action.type) {
    case 'SET_MODE': {
      const mode = normalizeWorkspaceMode(action.mode);
      if (mode === state.mode) return state;
      if (mode === 'summary') {
        return {
          ...state,
          mode,
          workspaceFocus: 'summary',
          activeSummaryReportId: DEFAULT_SUMMARY_REPORT_ID,
          openCalculatorId: null,
          workspaceScrollTop: 0,
        };
      }
      return {
        ...state,
        mode,
        workspaceFocus: 'detail',
        activeDetailReportId: DEFAULT_DETAIL_TAB_ID,
        workspaceScrollTop: 0,
      };
    }
    case 'SELECT_PRIMARY': {
      const primaryId = action.primaryId;
      const remembered = state.secondaryByPrimary[primaryId] ?? null;
      return {
        ...state,
        activePrimaryId: primaryId,
        activeSecondaryId: remembered,
      };
    }
    case 'OPEN_CALCULATOR': {
      if (!canUseCalculators(state.mode)) return state;
      const calculatorId = resolveCanonicalId(action.calculatorId);
      const primaryId = state.activePrimaryId;
      const visited = state.visitedCalculatorIds.includes(calculatorId)
        ? state.visitedCalculatorIds
        : [...state.visitedCalculatorIds, calculatorId];
      return {
        ...state,
        activeSecondaryId: calculatorId,
        secondaryByPrimary: primaryId
          ? { ...state.secondaryByPrimary, [primaryId]: calculatorId }
          : state.secondaryByPrimary,
        openCalculatorId: calculatorId,
        lastOpenedCalculatorId: calculatorId,
        visitedCalculatorIds: visited,
      };
    }
    case 'CLOSE_CALCULATOR': {
      const calculatorId = state.openCalculatorId;
      const nextUi = { ...state.calculatorUi };
      if (calculatorId && action.uiPatch) {
        nextUi[calculatorId] = {
          ...ensureUiBucket(nextUi, calculatorId),
          ...action.uiPatch,
        };
      }
      return {
        ...state,
        openCalculatorId: null,
        calculatorUi: nextUi,
      };
    }
    case 'SELECT_SUMMARY_REPORT':
      return {
        ...state,
        activeSummaryReportId: resolveCanonicalId(action.reportId),
        workspaceFocus: 'summary',
      };
    case 'SELECT_DETAIL_REPORT': {
      if (!canUseDetailReports(state.mode)) return state;
      return {
        ...state,
        activeDetailReportId: resolveCanonicalId(action.reportId),
        workspaceFocus: 'detail',
      };
    }
    case 'WORKFLOW_PREV': {
      if (!canUseDetailReports(state.mode)) return state;
      const index = DETAIL_REPORT_TAB_ITEMS.findIndex((i) => i.id === state.activeDetailReportId);
      if (index <= 0) return state;
      return {
        ...state,
        activeDetailReportId: DETAIL_REPORT_TAB_ITEMS[index - 1].id,
        workspaceFocus: 'detail',
      };
    }
    case 'WORKFLOW_NEXT': {
      if (!canUseDetailReports(state.mode)) return state;
      const index = DETAIL_REPORT_TAB_ITEMS.findIndex((i) => i.id === state.activeDetailReportId);
      if (index < 0 || index >= DETAIL_REPORT_TAB_ITEMS.length - 1) return state;
      return {
        ...state,
        activeDetailReportId: DETAIL_REPORT_TAB_ITEMS[index + 1].id,
        workspaceFocus: 'detail',
      };
    }
    case 'SET_DRAWER_OPEN':
      return { ...state, drawerOpen: action.open };
    case 'TOGGLE_DRAWER_GROUP': {
      const groupId = action.groupId;
      const expanded = state.expandedDrawerGroups.includes(groupId)
        ? state.expandedDrawerGroups.filter((id) => id !== groupId)
        : [...state.expandedDrawerGroups, groupId];
      return { ...state, expandedDrawerGroups: expanded };
    }
    case 'PATCH_DETAIL_UI': {
      const reportId = resolveCanonicalId(action.reportId);
      return {
        ...state,
        detailReportUi: {
          ...state.detailReportUi,
          [reportId]: {
            ...ensureUiBucket(state.detailReportUi, reportId),
            ...action.patch,
          },
        },
      };
    }
    case 'PATCH_SUMMARY_UI': {
      const reportId = resolveCanonicalId(action.reportId);
      return {
        ...state,
        summaryReportUi: {
          ...state.summaryReportUi,
          [reportId]: {
            ...ensureUiBucket(state.summaryReportUi, reportId),
            ...action.patch,
          },
        },
      };
    }
    case 'PATCH_CALCULATOR_UI': {
      const calculatorId = resolveCanonicalId(action.calculatorId);
      return {
        ...state,
        calculatorUi: {
          ...state.calculatorUi,
          [calculatorId]: {
            ...ensureUiBucket(state.calculatorUi, calculatorId),
            ...action.patch,
          },
        },
      };
    }
    case 'SET_WORKSPACE_SCROLL':
      return { ...state, workspaceScrollTop: action.scrollTop };
    default:
      return state;
  }
}

export function FinancialWorkspaceProvider({ children }) {
  const [state, dispatch] = useReducer(workspaceReducer, null, loadWorkspaceState);

  useEffect(() => {
    saveWorkspaceState(state);
  }, [state]);

  const setMode = useCallback((mode) => {
    dispatch({ type: 'SET_MODE', mode });
  }, []);

  const selectPrimary = useCallback((primaryId) => {
    dispatch({ type: 'SELECT_PRIMARY', primaryId });
  }, []);

  const openCalculator = useCallback((calculatorId) => {
    dispatch({ type: 'OPEN_CALCULATOR', calculatorId });
  }, []);

  const closeCalculator = useCallback((uiPatch) => {
    dispatch({ type: 'CLOSE_CALCULATOR', uiPatch });
  }, []);

  const selectSummaryReport = useCallback((reportId) => {
    dispatch({ type: 'SELECT_SUMMARY_REPORT', reportId });
  }, []);

  const selectDetailReport = useCallback((reportId) => {
    dispatch({ type: 'SELECT_DETAIL_REPORT', reportId });
  }, []);

  const workflowPrevious = useCallback(() => {
    dispatch({ type: 'WORKFLOW_PREV' });
  }, []);

  const workflowNext = useCallback(() => {
    dispatch({ type: 'WORKFLOW_NEXT' });
  }, []);

  const setDrawerOpen = useCallback((open) => {
    dispatch({ type: 'SET_DRAWER_OPEN', open });
  }, []);

  const toggleDrawerGroup = useCallback((groupId) => {
    dispatch({ type: 'TOGGLE_DRAWER_GROUP', groupId });
  }, []);

  const patchDetailUi = useCallback((reportId, patch) => {
    dispatch({ type: 'PATCH_DETAIL_UI', reportId, patch });
  }, []);

  const patchSummaryUi = useCallback((reportId, patch) => {
    dispatch({ type: 'PATCH_SUMMARY_UI', reportId, patch });
  }, []);

  const patchCalculatorUi = useCallback((calculatorId, patch) => {
    dispatch({ type: 'PATCH_CALCULATOR_UI', calculatorId, patch });
  }, []);

  const setWorkspaceScroll = useCallback((scrollTop) => {
    dispatch({ type: 'SET_WORKSPACE_SCROLL', scrollTop });
  }, []);

  const getDrawerAction = useCallback((itemId) => DRAWER_ITEM_ACTIONS[itemId] ?? { type: 'none' }, []);

  const detailIndex = DETAIL_REPORT_TAB_ITEMS.findIndex((i) => i.id === state.activeDetailReportId);
  const canWorkflowPrevious = detailIndex > 0 && canUseDetailReports(state.mode);
  const canWorkflowNext =
    detailIndex >= 0 &&
    detailIndex < DETAIL_REPORT_TAB_ITEMS.length - 1 &&
    canUseDetailReports(state.mode);

  const value = useMemo(
    () => ({
      state,
      setMode,
      selectPrimary,
      openCalculator,
      closeCalculator,
      selectSummaryReport,
      selectDetailReport,
      workflowPrevious,
      workflowNext,
      setDrawerOpen,
      toggleDrawerGroup,
      patchDetailUi,
      patchSummaryUi,
      patchCalculatorUi,
      setWorkspaceScroll,
      getDrawerAction,
      canWorkflowPrevious,
      canWorkflowNext,
      getDefaultSecondaryId,
    }),
    [
      state,
      setMode,
      selectPrimary,
      openCalculator,
      closeCalculator,
      selectSummaryReport,
      selectDetailReport,
      workflowPrevious,
      workflowNext,
      setDrawerOpen,
      toggleDrawerGroup,
      patchDetailUi,
      patchSummaryUi,
      patchCalculatorUi,
      setWorkspaceScroll,
      getDrawerAction,
      canWorkflowPrevious,
      canWorkflowNext,
    ]
  );

  return (
    <FinancialWorkspaceContext.Provider value={value}>
      {children}
    </FinancialWorkspaceContext.Provider>
  );
}

export function useFinancialWorkspace() {
  const ctx = useContext(FinancialWorkspaceContext);
  if (!ctx) {
    throw new Error('useFinancialWorkspace must be used within FinancialWorkspaceProvider');
  }
  return ctx;
}
