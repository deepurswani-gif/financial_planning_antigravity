import React, { useEffect, useRef } from 'react';

/**
 * Lightweight Phase 2 placeholder for summary reports.
 */
export default function SummaryReportPlaceholder({ reportId, label, ui, onUiChange }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    el.scrollTop = ui?.scrollTop || 0;
    const onScroll = () => onUiChange?.({ scrollTop: el.scrollTop });
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [reportId]); // eslint-disable-line react-hooks/exhaustive-deps

  const note = ui?.draft?.note ?? '';

  return (
    <div className="fw-placeholder-pane" ref={scrollRef} data-report-id={reportId}>
      <header className="fw-placeholder-hero">
        <p className="fw-placeholder-stage">Summary Report</p>
        <h2 className="fw-placeholder-title">{label}</h2>
        <p className="fw-placeholder-copy">
          Summary report content will load here in a later phase.
        </p>
      </header>

      <label className="fw-placeholder-field">
        <span>Session note</span>
        <textarea
          value={note}
          rows={3}
          placeholder="Type to verify summary state persistence…"
          onChange={(e) =>
            onUiChange?.({
              draft: { ...(ui?.draft || {}), note: e.target.value },
            })
          }
        />
      </label>
    </div>
  );
}
