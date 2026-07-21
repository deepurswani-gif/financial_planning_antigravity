import React from 'react';
import { SUMMARY_REPORT_NAV_ITEMS } from './workspaceNavConfig';

/**
 * Summary report shortcuts with contextual label.
 * Selected highlight applies only when summary is the focused workspace lane.
 */
export default function SummaryReportNavigation({
  activeSummaryReportId,
  onSummaryReportSelect,
  workspaceFocus = 'detail',
}) {
  const laneActive = workspaceFocus === 'summary';

  return (
    <nav
      className={`fw-summary-report-nav ${laneActive ? 'fw-lane--active' : 'fw-lane--inactive'}`}
      aria-label="Summary report navigation"
    >
      <div className="fw-summary-report-row">
        <span className="fw-summary-report-label">Summary Reports →</span>
        <div className="fw-summary-segment" role="tablist" aria-label="Summary reports">
          {SUMMARY_REPORT_NAV_ITEMS.map((item) => {
            const selected = laneActive && activeSummaryReportId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                className={`fw-summary-pill ${selected ? 'active' : ''}`}
                onClick={() => onSummaryReportSelect(item.id)}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
