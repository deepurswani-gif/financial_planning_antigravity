import React from 'react';
import { Menu, Wrench, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import finbrellaLogo from '../../assets/finbrella_logo.png';
import { WORKSPACE_DASHBOARD_LABEL } from './workspaceNavConfig';
import WorkspaceInfoMenu from './WorkspaceInfoMenu';
import WorkspaceProfileMenu from './WorkspaceProfileMenu';
import { useProfileCompletion } from '../DetailedHub/useProfileCompletion';

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
  detailLocked = false,
  onLockedSelect,
}) {
  const { incompleteCount } = useProfileCompletion();

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
          <Link
            to={detailLocked ? "#" : "/financial-workspace/full_profile"}
            onClick={(e) => {
              if (detailLocked) {
                e.preventDefault();
                if (onLockedSelect) onLockedSelect('full_profile');
              }
            }}
            className="fw-icon-btn"
            aria-label="Financial Profile"
            style={{ marginLeft: '0.25rem', marginRight: '0.25rem', position: 'relative' }}
          >
            <User size={18} aria-hidden="true" />
            {incompleteCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '0px',
                right: '0px',
                width: '8px',
                height: '8px',
                background: '#ef4444',
                borderRadius: '50%',
                border: '1px solid white'
              }} />
            )}
          </Link>
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
