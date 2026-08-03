import React from 'react';
import ReportModeToggle from './ReportModeToggle';

/**
 * Content-first report orientation: mode toggle, title, stage/step.
 */
export default function MobileReportHeader({
  title,
  stageLabel = null,
  stepLabel = null,
  workspaceFocus,
  summaryMode = false,
  onFocusSummary,
  onFocusDetail,
  detailLocked = false,
  onLockedSelect,
}) {
  return (
    <div className="fw-mobile-report-header" role="region" aria-label="Current report">
      <ReportModeToggle
        workspaceFocus={workspaceFocus}
        summaryMode={summaryMode}
        onFocusSummary={onFocusSummary}
        onFocusDetail={onFocusDetail}
        detailLocked={detailLocked}
        onLockedSelect={onLockedSelect}
        compact
      />
      <h1 className="fw-mobile-report-title">{title}</h1>
      {(stageLabel || stepLabel) && (
        <p className="fw-mobile-report-meta">
          {stageLabel ? <span className="fw-mobile-report-stage">{stageLabel}</span> : null}
          {stageLabel && stepLabel ? <span aria-hidden="true"> · </span> : null}
          {stepLabel ? <span>{stepLabel}</span> : null}
        </p>
      )}
    </div>
  );
}
