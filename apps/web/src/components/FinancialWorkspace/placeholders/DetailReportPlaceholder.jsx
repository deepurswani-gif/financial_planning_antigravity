import React, { useEffect, useRef } from 'react';

/**
 * Lightweight Phase 2 placeholder for detail journey reports.
 * Persists scroll + simple UI draft via workspace state.
 */
export default function DetailReportPlaceholder({ reportId, label, stage, ui, onUiChange }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    el.scrollTop = ui?.scrollTop || 0;

    const onScroll = () => {
      onUiChange?.({ scrollTop: el.scrollTop });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [reportId]); // eslint-disable-line react-hooks/exhaustive-deps -- restore once per mount/id

  const note = ui?.draft?.note ?? '';
  const expanded = Boolean(ui?.expanded?.demo);

  return (
    <div className="fw-placeholder-pane" ref={scrollRef} data-report-id={reportId}>
      <header className="fw-placeholder-hero">
        {stage && <p className="fw-placeholder-stage">{stage}</p>}
        <h2 className="fw-placeholder-title">{label}</h2>
        <p className="fw-placeholder-copy">
          Report content will load here in a later phase. Navigation and state are active now.
        </p>
      </header>

      <div className="fw-placeholder-card">
        <button
          type="button"
          className="fw-placeholder-accordion"
          onClick={() =>
            onUiChange?.({
              expanded: { ...(ui?.expanded || {}), demo: !expanded },
            })
          }
        >
          {expanded ? '▾' : '▸'} Sample section (state preserved)
        </button>
        {expanded && (
          <p className="fw-placeholder-copy">
            Expanded sections, scroll position, and notes are restored when you return to this tab.
          </p>
        )}
      </div>

      <label className="fw-placeholder-field">
        <span>Session note</span>
        <textarea
          value={note}
          rows={3}
          placeholder="Type to verify state persistence…"
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
