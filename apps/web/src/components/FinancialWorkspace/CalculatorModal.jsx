import React, { useCallback, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useFinancialWorkspace } from './FinancialWorkspaceContext';
import { CALCULATOR_REGISTRY } from './registries/calculatorRegistry';
import { getCalculatorLabel } from './workspaceNavConfig';

/**
 * Full-screen calculator overlay. Workspace shell stays mounted underneath.
 * Visited calculators stay mounted (hidden) so draft/scroll state survives.
 */
export default function CalculatorModal() {
  const { state, closeCalculator } = useFinancialWorkspace();
  const { openCalculatorId, visitedCalculatorIds, calculatorUi } = state;
  const open = Boolean(openCalculatorId);
  const bodyRef = useRef(null);
  const closeBtnRef = useRef(null);

  const handleClose = useCallback(() => {
    const id = openCalculatorId;
    const scrollTop = bodyRef.current?.scrollTop ?? calculatorUi[id]?.scrollTop ?? 0;
    closeCalculator(id ? { scrollTop } : undefined);
  }, [openCalculatorId, calculatorUi, closeCalculator]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, handleClose]);

  // Restore body scroll + move focus into the dialog when opening.
  useEffect(() => {
    if (!open || !openCalculatorId) return undefined;
    const scrollTop = calculatorUi[openCalculatorId]?.scrollTop ?? 0;
    const raf = requestAnimationFrame(() => {
      if (bodyRef.current) bodyRef.current.scrollTop = scrollTop;
      closeBtnRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [open, openCalculatorId]); // eslint-disable-line react-hooks/exhaustive-deps -- restore once per open

  const title = openCalculatorId ? getCalculatorLabel(openCalculatorId) : 'Calculator';

  return (
    <div
      className={`fw-calc-modal ${open ? 'fw-calc-modal--open' : ''}`}
      aria-hidden={!open}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <header className="fw-calc-modal-header">
        <div className="fw-calc-modal-heading">
          <p className="fw-calc-modal-eyebrow">Calculator</p>
          <h2 className="fw-calc-modal-title">{title}</h2>
        </div>
        <button
          ref={closeBtnRef}
          type="button"
          className="fw-icon-btn"
          onClick={handleClose}
          aria-label="Close calculator"
          tabIndex={open ? 0 : -1}
        >
          <X size={20} />
        </button>
      </header>

      <div className="fw-calc-modal-body" ref={bodyRef}>
        {visitedCalculatorIds.map((id) => {
          const entry = CALCULATOR_REGISTRY[id];
          if (!entry) return null;
          const Calc = entry.component;
          const isActive = id === openCalculatorId;
          return (
            <div
              key={id}
              className="fw-calc-modal-pane"
              hidden={!isActive}
              aria-hidden={!isActive}
            >
              <Calc />
            </div>
          );
        })}
      </div>

      <footer className="fw-calc-modal-footer">
        <button
          type="button"
          className="btn btn-secondary fw-calc-close-btn"
          onClick={handleClose}
          tabIndex={open ? 0 : -1}
        >
          Close
        </button>
      </footer>
    </div>
  );
}
