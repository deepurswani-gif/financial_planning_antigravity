import React, { useEffect, useRef, useState } from 'react';
import { Info } from 'lucide-react';

/**
 * Plan context Info control — popover with all report context fields.
 */
export default function WorkspaceInfoMenu({
  fields = [],
  iconOnly = false,
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

  if (!fields.length) return null;

  return (
    <div className="fw-info-menu" ref={rootRef}>
      <button
        type="button"
        className={`fw-info-menu-trigger ${iconOnly ? 'fw-info-menu-trigger--icon' : ''} ${
          open ? 'fw-info-menu-trigger--open' : ''
        }`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Plan information"
        onClick={() => setOpen((v) => !v)}
      >
        <Info size={iconOnly ? 16 : 15} aria-hidden="true" />
        {!iconOnly ? <span>Info</span> : null}
      </button>

      {open ? (
        <div className="fw-info-popover" role="dialog" aria-label="Plan information">
          <p className="fw-info-popover-title">Plan context</p>
          <dl className="fw-info-field-list">
            {fields.map((field) => (
              <div key={field.id} className="fw-info-field">
                <dt>{field.label}</dt>
                <dd>{field.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </div>
  );
}
