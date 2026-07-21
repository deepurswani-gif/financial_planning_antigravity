import React, { useEffect } from 'react';
import { UNLOCK_DIALOG_COPY } from './workspaceCapabilities';

/**
 * Centered unlock dialog for Summary Mode locked features.
 */
export default function UnlockPlanningDialog({ open, onClose, onContinue }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
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

  if (!open) return null;

  return (
    <div
      className="fw-unlock-dialog-root"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="fw-unlock-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fw-unlock-dialog-title"
        aria-describedby="fw-unlock-dialog-body"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="fw-unlock-dialog-title" className="fw-unlock-dialog-title">
          {UNLOCK_DIALOG_COPY.title}
        </h2>
        <p id="fw-unlock-dialog-body" className="fw-unlock-dialog-body">
          {UNLOCK_DIALOG_COPY.body}
        </p>
        <div className="fw-unlock-dialog-actions">
          <button
            type="button"
            className="btn btn-secondary fw-unlock-dialog-secondary"
            onClick={onClose}
          >
            {UNLOCK_DIALOG_COPY.secondary}
          </button>
          <button
            type="button"
            className="btn btn-primary fw-unlock-dialog-primary"
            onClick={onContinue}
          >
            {UNLOCK_DIALOG_COPY.primary}
          </button>
        </div>
      </div>
    </div>
  );
}
