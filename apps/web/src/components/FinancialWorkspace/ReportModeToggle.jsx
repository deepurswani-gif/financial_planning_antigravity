import React from 'react';
import { Lock } from 'lucide-react';

/**
 * Summary | Detailed mode toggle — shared by desktop report lane and mobile header.
 */
export default function ReportModeToggle({
  workspaceFocus,
  summaryMode = false,
  onFocusSummary,
  onFocusDetail,
  detailLocked = false,
  onLockedSelect,
  compact = false,
}) {
  const focus = summaryMode ? 'summary' : workspaceFocus;
  const detailDisabled = summaryMode || detailLocked;

  return (
    <div
      className={`fw-report-lane-mode ${compact ? 'fw-report-lane-mode--compact' : ''}`}
      role="group"
      aria-label="Report mode"
      data-tour={compact ? 'workspace-mode' : undefined}
    >
      <button
        type="button"
        className={`fw-report-lane-mode-btn ${focus === 'summary' ? 'fw-report-lane-mode-btn--active' : ''}`}
        onClick={onFocusSummary}
        aria-pressed={focus === 'summary'}
      >
        Summary
      </button>
      <button
        type="button"
        className={`fw-report-lane-mode-btn ${focus === 'detail' ? 'fw-report-lane-mode-btn--active' : ''} ${
          detailDisabled ? 'fw-locked' : ''
        }`}
        onClick={() => {
          if (detailDisabled) {
            onLockedSelect?.();
            return;
          }
          onFocusDetail?.();
        }}
        aria-pressed={focus === 'detail'}
        title={detailDisabled ? 'Available after Detailed Planning' : undefined}
      >
        {detailDisabled ? <Lock size={12} aria-hidden="true" /> : null}
        Detailed
      </button>
    </div>
  );
}
