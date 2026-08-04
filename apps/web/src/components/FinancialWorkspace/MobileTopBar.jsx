import React from 'react';
import { Menu, Wrench } from 'lucide-react';
import finbrellaLogo from '../../assets/finbrella_logo.png';
import { WORKSPACE_DASHBOARD_LABEL } from './workspaceNavConfig';
import WorkspaceInfoMenu from './WorkspaceInfoMenu';
import WorkspaceProfileMenu from './WorkspaceProfileMenu';

/**
 * Compact mobile header: hub menu, brand + dashboard label, Tools, Info, profile.
 */
export default function MobileTopBar({
  onOpenHub,
  onOpenTools,
  userInitials = 'U',
  userEmail = '',
  onLogout,
  onTakeTour,
  onOpenSettings,
  contextFields = [],
  dashboardLabel = WORKSPACE_DASHBOARD_LABEL,
}) {
  return (
    <header className="fw-mobile-top-bar">
      <div className="fw-mobile-top-bar-inner">
        <div className="fw-mobile-top-bar-left">
          <button
            type="button"
            className="fw-icon-btn"
            onClick={onOpenHub}
            aria-label="Open Smart Edit and menu"
            data-tour="workspace-hub"
          >
            <Menu size={20} />
          </button>
          <div className="fw-logo fw-logo--mobile">
            <img src={finbrellaLogo} alt="Finbrella" />
          </div>
          <span className="fw-dashboard-label fw-dashboard-label--mobile" title={dashboardLabel}>
            {dashboardLabel}
          </span>
        </div>

        <div className="fw-mobile-top-bar-right">
          <button
            type="button"
            className="fw-mobile-tools-btn"
            onClick={onOpenTools}
            aria-label="Open calculators and tools"
            data-tour="workspace-tools"
          >
            <Wrench size={15} aria-hidden="true" />
            <span>Tools</span>
          </button>
          <WorkspaceInfoMenu fields={contextFields} iconOnly />
          <WorkspaceProfileMenu
            userInitials={userInitials}
            userEmail={userEmail}
            onLogout={onLogout}
            onTakeTour={onTakeTour}
            onOpenSettings={onOpenSettings}
            size="sm"
          />
        </div>
      </div>
    </header>
  );
}
