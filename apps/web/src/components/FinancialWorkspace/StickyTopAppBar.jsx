import React from 'react';
import { Menu } from 'lucide-react';
import finbrellaLogo from '../../assets/finbrella_logo.png';
import { PRIMARY_NAV_ITEMS, WORKSPACE_TITLE } from './workspaceNavConfig';

/**
 * Sticky top application bar: hamburger, logo, workspace title, primary nav, avatar.
 * Selection only — no routing.
 */
export default function StickyTopAppBar({
  activePrimaryId,
  onPrimarySelect,
  onOpenDrawer,
  userInitials = 'U',
  workspaceTitle = WORKSPACE_TITLE,
  registerPrimaryTabRef,
}) {
  return (
    <header className="fw-top-app-bar">
      <div className="fw-top-app-bar-inner">
        <div className="fw-top-app-bar-left">
          <button
            type="button"
            className="fw-icon-btn"
            onClick={onOpenDrawer}
            aria-label="Open navigation menu"
          >
            <Menu size={20} />
          </button>
          <div className="fw-logo">
            <img src={finbrellaLogo} alt="Finbrella" />
          </div>
          <span className="fw-workspace-title-label" title={workspaceTitle}>
            {workspaceTitle}
          </span>
        </div>

        <nav className="fw-primary-nav" aria-label="Primary workspace navigation">
          {PRIMARY_NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              ref={(el) => registerPrimaryTabRef?.(item.id, el)}
              className={`fw-primary-tab ${activePrimaryId === item.id ? 'active' : ''}`}
              aria-pressed={activePrimaryId === item.id}
              onClick={() => onPrimarySelect(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="fw-top-app-bar-right">
          <div
            className="fw-profile-avatar"
            title="Profile"
            aria-label={`Profile ${userInitials}`}
          >
            {userInitials}
          </div>
        </div>
      </div>
    </header>
  );
}
