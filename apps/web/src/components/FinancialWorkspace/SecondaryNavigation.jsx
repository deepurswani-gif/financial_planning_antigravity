import React, { useLayoutEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { getSecondaryItems } from './workspaceNavConfig';

/**
 * Progressive calculator toolbar — hidden until a primary category is selected.
 * In Summary Mode chips stay visible/locked and open the unlock dialog.
 */
export default function SecondaryNavigation({
  open,
  activePrimaryId,
  activeSecondaryId,
  onSecondarySelect,
  anchorCenterPx,
  trackRef,
  calculatorsLocked = false,
  onLockedSelect,
}) {
  const items = activePrimaryId ? getSecondaryItems(activePrimaryId) : [];
  const clusterRef = useRef(null);
  const [leftPx, setLeftPx] = useState(null);

  useLayoutEffect(() => {
    if (!open || anchorCenterPx == null || !trackRef?.current || !clusterRef.current) {
      setLeftPx(null);
      return;
    }

    const trackWidth = trackRef.current.clientWidth;
    const clusterWidth = clusterRef.current.offsetWidth;
    const half = clusterWidth / 2;
    const pad = 12;
    const clamped = Math.min(
      Math.max(anchorCenterPx, half + pad),
      Math.max(half + pad, trackWidth - half - pad)
    );
    setLeftPx(clamped);
  }, [open, anchorCenterPx, activePrimaryId, items.length, trackRef]);

  return (
    <div
      className={`fw-secondary-nav ${open ? 'fw-secondary-nav--open' : ''}`}
      aria-hidden={!open}
    >
      <div className="fw-secondary-nav-collapse">
        <div className="fw-secondary-nav-track" ref={trackRef}>
          {items.length > 0 && (
            <div
              ref={clusterRef}
              className="fw-secondary-nav-cluster"
              style={leftPx != null ? { left: `${leftPx}px` } : undefined}
              role="toolbar"
              aria-label="Calculator categories"
            >
              {items.map((item) => {
                const locked = calculatorsLocked;
                const active = !locked && activeSecondaryId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`fw-nav-chip ${active ? 'active' : ''} ${locked ? 'fw-locked' : ''}`}
                    onClick={() => {
                      if (locked) onLockedSelect?.();
                      else onSecondarySelect(item.id);
                    }}
                    aria-pressed={active}
                    aria-label={locked ? `${item.label} (locked)` : item.label}
                    title={locked ? 'Available after Detailed Planning' : undefined}
                    tabIndex={open ? 0 : -1}
                  >
                    {locked ? <Lock size={12} className="fw-lock-icon" aria-hidden="true" /> : null}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
