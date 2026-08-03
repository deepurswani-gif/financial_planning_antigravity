import React, { useEffect, useRef, useState } from 'react';
import { Calculator, ChevronDown, Lock, Wrench } from 'lucide-react';
import {
  PRIMARY_NAV_ITEMS,
  SECONDARY_NAV_BY_PRIMARY,
  STANDALONE_CALCULATOR_ITEMS,
} from './workspaceNavConfig';

/**
 * Desktop Tools control — primary → secondary calculator tree in a popover.
 */
export default function DesktopToolsMenu({
  calculatorsLocked = false,
  onOpenCalculator,
  onLockedSelect,
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set(['wealth_creation']));
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

  const toggleGroup = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectCalculator = (calculatorId) => {
    if (calculatorsLocked) {
      onLockedSelect?.();
      return;
    }
    onOpenCalculator?.(calculatorId);
    setOpen(false);
  };

  return (
    <div className="fw-tools-menu" ref={rootRef}>
      <button
        type="button"
        className={`fw-tools-menu-trigger ${open ? 'fw-tools-menu-trigger--open' : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        <Wrench size={15} aria-hidden="true" />
        <span>Tools</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>

      {open ? (
        <div className="fw-tools-popover" role="dialog" aria-label="Calculators and tools">
          {PRIMARY_NAV_ITEMS.map((primary) => {
            const items = SECONDARY_NAV_BY_PRIMARY[primary.id] || [];
            const isOpen = expanded.has(primary.id);
            return (
              <div key={primary.id} className="fw-tools-group">
                <button
                  type="button"
                  className="fw-tools-group-toggle"
                  onClick={() => toggleGroup(primary.id)}
                  aria-expanded={isOpen}
                >
                  <span>{primary.label}</span>
                  <ChevronDown
                    size={14}
                    className={isOpen ? 'fw-tools-chevron--open' : ''}
                    aria-hidden="true"
                  />
                </button>
                {isOpen ? (
                  <ul className="fw-tools-list">
                    {items.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          className={`fw-tools-item ${calculatorsLocked ? 'fw-locked' : ''}`}
                          onClick={() => selectCalculator(item.id)}
                        >
                          {calculatorsLocked ? (
                            <Lock size={14} aria-hidden="true" />
                          ) : (
                            <Calculator size={14} aria-hidden="true" />
                          )}
                          <span>{item.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })}

          {STANDALONE_CALCULATOR_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`fw-tools-item fw-tools-item--standalone ${
                calculatorsLocked ? 'fw-locked' : ''
              }`}
              onClick={() => selectCalculator(item.id)}
            >
              {calculatorsLocked ? (
                <Lock size={14} aria-hidden="true" />
              ) : (
                <Calculator size={14} aria-hidden="true" />
              )}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
