import React from 'react';
import MobileTopBar from './MobileTopBar';
import MobileReportHeader from './MobileReportHeader';

/**
 * Mobile workspace chrome — thin top bar + report header (no mid-nav strips).
 */
export default function MobileChrome({
  onOpenHub,
  onOpenTools,
  userInitials,
  userEmail,
  onLogout,
  onTakeTour,
  onOpenSettings,
  reportTitle,
  stageLabel,
  stepLabel,
  contextFields,
  workspaceFocus,
  summaryMode,
  onFocusSummary,
  onFocusDetail,
  detailLocked,
  onLockedSelect,
}) {
  return (
    <div className="fw-chrome fw-chrome--mobile">
      <MobileTopBar
        onOpenHub={onOpenHub}
        onOpenTools={onOpenTools}
        userInitials={userInitials}
        userEmail={userEmail}
        onLogout={onLogout}
        onTakeTour={onTakeTour}
        onOpenSettings={onOpenSettings}
        contextFields={contextFields}
        detailLocked={detailLocked}
        onLockedSelect={onLockedSelect}
      />
      <MobileReportHeader
        title={reportTitle}
        stageLabel={stageLabel}
        stepLabel={stepLabel}
        workspaceFocus={workspaceFocus}
        summaryMode={summaryMode}
        onFocusSummary={onFocusSummary}
        onFocusDetail={onFocusDetail}
        detailLocked={detailLocked}
        onLockedSelect={onLockedSelect}
      />
    </div>
  );
}
