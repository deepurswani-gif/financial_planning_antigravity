import React, { useEffect, useRef, useState } from 'react';
import DeleteAccountModal from './DeleteAccountModal';

/**
 * Profile avatar dropdown — email, settings, logout (matches summary-flow pattern).
 */
export default function WorkspaceProfileMenu({
  userInitials = 'U',
  userEmail = '',
  onLogout,
  onTakeTour,
  onOpenSettings,
  size = 'md',
}) {
  const [open, setOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      // Don't close if clicking inside the delete modal (which might be outside rootRef)
      if (document.querySelector('.modal-overlay')?.contains(e.target)) return;
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !deleteModalOpen) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, deleteModalOpen]);

  return (
    <>
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
            {typeof onOpenSettings === 'function' ? (
              <button
                type="button"
                className="summary-profile-dropdown-item"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onOpenSettings();
                }}
              >
                Settings
              </button>
            ) : null}
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
              className="summary-profile-dropdown-item"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setDeleteModalOpen(true);
              }}
              style={{ color: 'var(--color-danger, #d32f2f)' }}
            >
              Delete Account
            </button>
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

      <DeleteAccountModal 
        open={deleteModalOpen} 
        onClose={() => setDeleteModalOpen(false)} 
      />
    </>
  );
}
