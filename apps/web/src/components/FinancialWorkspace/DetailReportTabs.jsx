import React from 'react';
import { Lock } from 'lucide-react';
import { DETAIL_REPORT_TAB_ITEMS } from './workspaceNavConfig';

/**
 * Sticky detail report workspace tabs.
 * Summary Mode: visible + locked; click opens unlock dialog (no state change).
 */
export default function DetailReportTabs({
  activeDetailTabId,
  onDetailTabSelect,
  workspaceFocus = 'detail',
  locked = false,
  onLockedSelect,
}) {
  const laneActive = !locked && workspaceFocus === 'detail';

  return (
    <nav
      className={`fw-detail-report-tabs ${laneActive ? 'fw-lane--active' : 'fw-lane--inactive'} ${
        locked ? 'fw-detail-report-tabs--locked' : ''
      }`}
      aria-label="Detail report tabs"
    >
      <div className="fw-journey-tabs" role="tablist" aria-label="Detail journey">
        {DETAIL_REPORT_TAB_ITEMS.map((item, index) => {
          const selected = laneActive && activeDetailTabId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-label={locked ? `${item.label} (locked)` : item.label}
              title={locked ? 'Available after Detailed Planning' : undefined}
              className={`fw-journey-tab ${selected ? 'active' : ''} ${locked ? 'fw-locked' : ''}`}
              onClick={() => {
                if (locked) onLockedSelect?.();
                else onDetailTabSelect(item.id);
              }}
            >
              <span className="fw-journey-stage">
                <span className="fw-journey-step">{index + 1}</span>
                {item.stage}
              </span>
              <span className="fw-journey-label">
                {locked ? <Lock size={12} className="fw-lock-icon" aria-hidden="true" /> : null}
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
      {locked ? (
        <p className="fw-locked-hint">Available after Detailed Planning</p>
      ) : null}
    </nav>
  );
}
