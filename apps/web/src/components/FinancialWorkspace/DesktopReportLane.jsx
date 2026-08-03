import React from 'react';
import { DETAIL_REPORT_TAB_ITEMS, SUMMARY_REPORT_NAV_ITEMS } from './workspaceNavConfig';
import ReportModeToggle from './ReportModeToggle';

/**
 * Single desktop report lane: Summary | Detailed toggle + active report pills/tabs.
 */
export default function DesktopReportLane({
  workspaceFocus,
  summaryMode = false,
  activeSummaryReportId,
  activeDetailReportId,
  onFocusSummary,
  onFocusDetail,
  onSelectSummaryReport,
  onSelectDetailReport,
  detailLocked = false,
  onLockedSelect,
}) {
  const focus = summaryMode ? 'summary' : workspaceFocus;

  return (
    <div className="fw-report-lane" role="navigation" aria-label="Reports">
      <ReportModeToggle
        workspaceFocus={workspaceFocus}
        summaryMode={summaryMode}
        onFocusSummary={onFocusSummary}
        onFocusDetail={onFocusDetail}
        detailLocked={detailLocked}
        onLockedSelect={onLockedSelect}
      />

      <div className="fw-report-lane-items">
        {focus === 'summary'
          ? SUMMARY_REPORT_NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`fw-report-lane-item ${
                  activeSummaryReportId === item.id ? 'fw-report-lane-item--active' : ''
                }`}
                onClick={() => onSelectSummaryReport?.(item.id)}
              >
                {item.label}
              </button>
            ))
          : DETAIL_REPORT_TAB_ITEMS.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={`fw-report-lane-item fw-report-lane-item--detail ${
                  activeDetailReportId === item.id ? 'fw-report-lane-item--active' : ''
                }`}
                onClick={() => onSelectDetailReport?.(item.id)}
              >
                <span className="fw-report-lane-stage">{index + 1} {item.stage}</span>
                <span className="fw-report-lane-label">{item.label}</span>
              </button>
            ))}
      </div>
    </div>
  );
}
