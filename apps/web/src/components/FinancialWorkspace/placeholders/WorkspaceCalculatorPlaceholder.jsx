import React, { useEffect, useRef } from 'react';

/**
 * Lightweight Phase 2 calculator placeholder (full-screen modal content).
 * Draft values + scroll persist in workspace state until real calculators are plugged in.
 */
export default function WorkspaceCalculatorPlaceholder({ calculatorId, label, ui, onUiChange }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    el.scrollTop = ui?.scrollTop || 0;
    const onScroll = () => onUiChange?.({ scrollTop: el.scrollTop });
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [calculatorId]); // eslint-disable-line react-hooks/exhaustive-deps

  const draft = ui?.draft || {};

  const setField = (key, value) => {
    onUiChange?.({
      draft: { ...draft, [key]: value },
    });
  };

  return (
    <div className="fw-calc-placeholder" ref={scrollRef} data-calculator-id={calculatorId}>
      <header className="fw-placeholder-hero">
        <p className="fw-placeholder-stage">Calculator</p>
        <h2 className="fw-placeholder-title">{label}</h2>
        <p className="fw-placeholder-copy">
          Calculator logic will be connected in a later phase. Entered values are preserved while you
          navigate the workspace.
        </p>
      </header>

      <div className="fw-calc-placeholder-grid">
        <label className="fw-placeholder-field">
          <span>Amount</span>
          <input
            type="text"
            inputMode="decimal"
            value={draft.amount ?? ''}
            placeholder="e.g. 10000"
            onChange={(e) => setField('amount', e.target.value)}
          />
        </label>
        <label className="fw-placeholder-field">
          <span>Tenure / Period</span>
          <input
            type="text"
            value={draft.tenure ?? ''}
            placeholder="e.g. 10 years"
            onChange={(e) => setField('tenure', e.target.value)}
          />
        </label>
        <label className="fw-placeholder-field">
          <span>Notes</span>
          <textarea
            rows={4}
            value={draft.notes ?? ''}
            placeholder="Unsaved notes stay with this calculator…"
            onChange={(e) => setField('notes', e.target.value)}
          />
        </label>
      </div>
    </div>
  );
}
