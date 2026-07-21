import React, { useEffect, useRef } from 'react';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import { useFinancialWorkspace } from './FinancialWorkspaceContext';
import { DETAIL_REPORT_REGISTRY } from './registries/detailReportRegistry';
import { SUMMARY_REPORT_REGISTRY } from './registries/summaryReportRegistry';
import { DETAIL_REPORT_TAB_ITEMS, SUMMARY_REPORT_NAV_ITEMS } from './workspaceNavConfig';

/**
 * Keep-alive workspace content: all report panes stay mounted; only visibility changes.
 */
export default function WorkspaceContent() {
  const {
    state,
    patchDetailUi,
    setWorkspaceScroll,
  } = useFinancialWorkspace();
  const { summaryReportGeneratedAt, markReportGenerated } = useFinancialPlan();

  const {
    workspaceFocus,
    activeDetailReportId,
    activeSummaryReportId,
    detailReportUi,
    workspaceScrollTop,
  } = state;

  const rootRef = useRef(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    el.scrollTop = workspaceScrollTop || 0;
    const onScroll = () => setWorkspaceScroll(el.scrollTop);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- restore once on mount

  useEffect(() => {
    if (workspaceFocus === 'summary' && !summaryReportGeneratedAt) {
      markReportGenerated();
    }
  }, [workspaceFocus, summaryReportGeneratedAt, markReportGenerated]);

  return (
    <div className="fw-workspace-content" ref={rootRef}>
      <div
        className="fw-workspace-layer fw-detail-report-layer"
        hidden={workspaceFocus !== 'detail'}
        aria-hidden={workspaceFocus !== 'detail'}
      >
        {DETAIL_REPORT_TAB_ITEMS.map((item) => {
          const entry = DETAIL_REPORT_REGISTRY[item.id];
          if (!entry?.component) return null;
          const Report = entry.component;
          const isActive = item.id === activeDetailReportId;
          return (
            <div
              key={item.id}
              className="fw-workspace-pane fw-detail-report-pane"
              hidden={!isActive}
              aria-hidden={!isActive}
            >
              {entry.usesHostUiProps ? (
                <Report
                  reportId={item.id}
                  label={entry.label}
                  stage={entry.stage}
                  ui={detailReportUi[item.id]}
                  onUiChange={(patch) => patchDetailUi(item.id, patch)}
                />
              ) : (
                <Report />
              )}
            </div>
          );
        })}
      </div>

      <div
        className="fw-workspace-layer fw-summary-report-layer"
        hidden={workspaceFocus !== 'summary'}
        aria-hidden={workspaceFocus !== 'summary'}
      >
        {SUMMARY_REPORT_NAV_ITEMS.map((item) => {
          const entry = SUMMARY_REPORT_REGISTRY[item.id];
          if (!entry?.component) return null;
          const Report = entry.component;
          const isActive = item.id === activeSummaryReportId;
          return (
            <div
              key={item.id}
              className="fw-workspace-pane fw-summary-report-pane"
              hidden={!isActive}
              aria-hidden={!isActive}
            >
              <Report />
            </div>
          );
        })}
      </div>
    </div>
  );
}
