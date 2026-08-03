import React from 'react';
import { Menu } from 'lucide-react';
import finbrellaLogo from '../../assets/finbrella_logo.png';
import { WORKSPACE_TITLE, WORKSPACE_DASHBOARD_LABEL } from './workspaceNavConfig';
import DesktopToolsMenu from './DesktopToolsMenu';
import DesktopReportLane from './DesktopReportLane';
import WorkspaceInfoMenu from './WorkspaceInfoMenu';
import WorkspaceProfileMenu from './WorkspaceProfileMenu';

/**
 * Slim desktop chrome: brand + dashboard label left; title → Tools + Info + profile right; report lane.
 */
export default function DesktopChrome({
  onOpenDrawer,
  userInitials = 'U',
  userEmail = '',
  onLogout,
  workspaceTitle = WORKSPACE_TITLE,
  dashboardLabel = WORKSPACE_DASHBOARD_LABEL,
  calculatorsLocked = false,
  onOpenCalculator,
  onLockedSelect,
  workspaceFocus,
  summaryMode = false,
  activeSummaryReportId,
  activeDetailReportId,
  onFocusSummary,
  onFocusDetail,
  onSelectSummaryReport,
  onSelectDetailReport,
  detailLocked = false,
  contextFields = [],
}) {
  return (
    <div className="fw-chrome fw-chrome--desktop">
      <header className="fw-top-app-bar">
        <div className="fw-top-app-bar-inner fw-top-app-bar-inner--slim">
          <div className="fw-top-app-bar-left">
            <button
              type="button"
              className="fw-icon-btn"
              onClick={onOpenDrawer}
              aria-label="Open Smart Edit"
            >
              <Menu size={20} />
            </button>
            <div className="fw-logo">
              <img src={finbrellaLogo} alt="Finbrella" />
            </div>
            <span className="fw-dashboard-label" title={dashboardLabel}>
              {dashboardLabel}
            </span>
          </div>

          <div className="fw-top-app-bar-right">
            <div className="fw-tools-cluster" aria-label={`${workspaceTitle} tools`}>
              <span className="fw-workspace-title-label fw-workspace-title-label--cluster" title={workspaceTitle}>
                {workspaceTitle}
              </span>
              <span className="fw-tools-cluster-arrow" aria-hidden="true">
                →
              </span>
              <DesktopToolsMenu
                calculatorsLocked={calculatorsLocked}
                onOpenCalculator={onOpenCalculator}
                onLockedSelect={onLockedSelect}
              />
            </div>
            <WorkspaceInfoMenu fields={contextFields} />
            <WorkspaceProfileMenu
              userInitials={userInitials}
              userEmail={userEmail}
              onLogout={onLogout}
            />
          </div>
        </div>
      </header>

      <DesktopReportLane
        workspaceFocus={workspaceFocus}
        summaryMode={summaryMode}
        activeSummaryReportId={activeSummaryReportId}
        activeDetailReportId={activeDetailReportId}
        onFocusSummary={onFocusSummary}
        onFocusDetail={onFocusDetail}
        onSelectSummaryReport={onSelectSummaryReport}
        onSelectDetailReport={onSelectDetailReport}
        detailLocked={detailLocked}
        onLockedSelect={onLockedSelect}
      />
    </div>
  );
}
