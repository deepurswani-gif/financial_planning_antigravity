import React, { useEffect, useRef, useState } from 'react';

/**
 * Profile avatar dropdown — email + logout (matches summary-flow pattern).
 */
export default function WorkspaceProfileMenu({
  userInitials = 'U',
  userEmail = '',
  onLogout,
  onTakeTour,
  size = 'md',
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="fw-profile-menu summary-profile-wrap" ref={rootRef}>
      <button
        type="button"
        className={`fw-profile-avatar ${size === 'sm' ? 'fw-profile-avatar--sm' : ''} fw-profile-avatar--btn`}
        title="Profile"
        aria-label={`Profile ${userInitials}`}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
      >
        {userInitials}
      </button>
      {open ? (
        <div className="summary-profile-dropdown" role="menu">
          <div className="summary-profile-dropdown-email" title={userEmail || ''}>
            {userEmail || 'Signed in'}
          </div>
          {typeof onTakeTour === 'function' ? (
            <button
              type="button"
              className="summary-profile-dropdown-item"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onTakeTour();
              }}
            >
              Take a quick tour
            </button>
          ) : null}
          <button
            type="button"
            className="summary-profile-dropdown-logout"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout?.();
            }}
          >
            Logout
          </button>
        </div>
      ) : null}
    </div>
  );
}
