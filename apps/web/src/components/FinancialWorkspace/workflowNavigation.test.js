import { describe, expect, it } from 'vitest';
import {
  DETAIL_REPORT_TAB_ITEMS,
  SUMMARY_REPORT_NAV_ITEMS,
} from './workspaceNavConfig';

/**
 * Lightweight reducer-facing checks for summary + detail workflow neighbors.
 * Mirrors FinancialWorkspaceContext workflow helpers without mounting React.
 */
function isSummaryWorkflow(state) {
  return state.mode === 'summary' || state.workspaceFocus === 'summary';
}

function getWorkflowItems(state) {
  return isSummaryWorkflow(state) ? SUMMARY_REPORT_NAV_ITEMS : DETAIL_REPORT_TAB_ITEMS;
}

function getWorkflowActiveId(state) {
  return isSummaryWorkflow(state) ? state.activeSummaryReportId : state.activeDetailReportId;
}

function getWorkflowIndex(state) {
  const activeId = getWorkflowActiveId(state);
  return getWorkflowItems(state).findIndex((item) => item.id === activeId);
}

function neighbors(state) {
  const items = getWorkflowItems(state);
  const index = getWorkflowIndex(state);
  return {
    previous: index > 0 ? items[index - 1] : null,
    next: index >= 0 && index < items.length - 1 ? items[index + 1] : null,
    index,
  };
}

describe('workspace workflow neighbors', () => {
  it('walks summary reports with named neighbors', () => {
    const state = {
      mode: 'summary',
      workspaceFocus: 'summary',
      activeSummaryReportId: 'safety_net',
      activeDetailReportId: 'your_money_flow',
    };
    const { previous, next, index } = neighbors(state);
    expect(index).toBe(1);
    expect(previous?.label).toBe('Your Money Story');
    expect(next?.label).toBe('Your Future Self');
  });

  it('uses summary lane in full mode when focus is summary', () => {
    const state = {
      mode: 'full',
      workspaceFocus: 'summary',
      activeSummaryReportId: 'money_story',
      activeDetailReportId: 'your_money_flow',
    };
    const { previous, next } = neighbors(state);
    expect(previous).toBeNull();
    expect(next?.id).toBe('safety_net');
  });

  it('walks detail journey when focus is detail', () => {
    const state = {
      mode: 'full',
      workspaceFocus: 'detail',
      activeSummaryReportId: 'money_story',
      activeDetailReportId: 'put_your_money_to_work',
    };
    const { previous, next } = neighbors(state);
    expect(previous?.label).toBe('Fix Your Financial Gaps');
    expect(next?.label).toBe("Your Money's Magic");
  });

  it('disables next on last summary report', () => {
    const state = {
      mode: 'summary',
      workspaceFocus: 'summary',
      activeSummaryReportId: 'useful_insights',
      activeDetailReportId: 'your_money_flow',
    };
    const { next } = neighbors(state);
    expect(next).toBeNull();
  });
});
