import React, { useEffect } from 'react';
import { X, ChevronDown, ChevronRight, Lock } from 'lucide-react';
import { DRAWER_GROUPS } from './workspaceNavConfig';
import { isDrawerItemLocked } from './workspaceCapabilities';

/**
 * Navigation drawer — opens from hamburger; items navigate or show unlock dialog.
 */
export default function WorkspaceNavDrawer({
  open,
  onClose,
  expandedGroups,
  onToggleGroup,
  onItemSelect,
  mode = 'full',
}) {
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const renderItem = (item) => {
    const locked = isDrawerItemLocked(mode, item.id);
    return (
      <li key={item.id}>
        <button
          type="button"
          className={`fw-drawer-link ${item.standalone ? 'fw-drawer-link-standalone' : ''} ${
            locked ? 'fw-locked' : ''
          }`}
          onClick={() => onItemSelect?.(item.id, { locked })}
          aria-label={locked ? `${item.label} (locked)` : item.label}
          title={locked ? 'Available after Detailed Planning' : undefined}
        >
          {locked ? <Lock size={14} className="fw-lock-icon" aria-hidden="true" /> : null}
          <span>{item.label}</span>
        </button>
      </li>
    );
  };

  return (
    <>
      <div
        className={`fw-drawer-backdrop ${open ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside
        className={`fw-drawer ${open ? 'open' : ''}`}
        aria-hidden={!open}
        aria-label="Workspace navigation"
      >
        <div className="fw-drawer-header">
          <span className="fw-drawer-title">Navigation</span>
          <button
            type="button"
            className="fw-icon-btn"
            onClick={onClose}
            aria-label="Close navigation menu"
          >
            <X size={20} />
          </button>
        </div>

        <div className="fw-drawer-body">
          {DRAWER_GROUPS.map((group, index) => {
            const isCollapsible = group.collapsible;
            const isExpanded = !isCollapsible || expandedGroups.includes(group.id);
            const showDivider = index > 0;

            if (!isCollapsible) {
              return (
                <div key={group.id} className="fw-drawer-group">
                  {showDivider && <div className="fw-drawer-divider" role="separator" />}
                  <ul className="fw-drawer-list">
                    {group.items.map((item) =>
                      renderItem({ ...item, standalone: true })
                    )}
                  </ul>
                </div>
              );
            }

            return (
              <div key={group.id} className="fw-drawer-group">
                {showDivider && <div className="fw-drawer-divider" role="separator" />}
                <button
                  type="button"
                  className="fw-drawer-group-toggle"
                  onClick={() => onToggleGroup(group.id)}
                  aria-expanded={isExpanded}
                >
                  <span>{group.label}</span>
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                {isExpanded && (
                  <ul className="fw-drawer-list">
                    {group.items.map((item) => renderItem(item))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
}
