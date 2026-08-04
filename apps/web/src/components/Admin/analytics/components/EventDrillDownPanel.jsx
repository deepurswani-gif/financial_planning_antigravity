import { X } from 'lucide-react';
import { useEventDrilldown } from '../hooks/useAnalyticsQuery';
import { EVENT_DRILLDOWN_COLUMNS } from '../registry/eventDrilldown';
import ExportMenu from './ExportMenu';

export default function EventDrillDownPanel({
  title,
  eventFilter,
  filters,
  onClose,
  onOpenUser,
}) {
  const { data, loading, error, offset, pageSize, nextPage, prevPage } = useEventDrilldown(
    eventFilter,
    filters,
    Boolean(eventFilter),
  );

  const rows = (data?.rows || []).map((row) => ({
    ...row,
    occurred_at: row.occurred_at ? new Date(row.occurred_at).toLocaleString() : '—',
    duration_ms: row.duration_ms > 0 ? row.duration_ms : '—',
  }));

  return (
    <div className="ba-drawer-backdrop" onClick={onClose}>
      <aside className="ba-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="ba-drawer__header">
          <div>
            <h2>{title || 'Event list'}</h2>
            <p>{data?.total ?? 0} matching events</p>
          </div>
          <button type="button" className="ba-icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="ba-drawer__toolbar">
          <ExportMenu title={title || 'events'} columns={EVENT_DRILLDOWN_COLUMNS} rows={rows} />
          <div className="ba-pager">
            <button type="button" className="ba-secondary-btn" disabled={offset <= 0} onClick={prevPage}>
              Prev
            </button>
            <span>
              {offset + 1}–{Math.min(offset + pageSize, data?.total || 0)}
            </span>
            <button
              type="button"
              className="ba-secondary-btn"
              disabled={offset + pageSize >= (data?.total || 0)}
              onClick={nextPage}
            >
              Next
            </button>
          </div>
        </div>

        {loading && <div className="ba-empty">Loading…</div>}
        {error && <div className="ba-error">{error}</div>}
        {!loading && !error && (
          <div className="ba-table-wrap">
            <table className="ba-table">
              <thead>
                <tr>
                  {EVENT_DRILLDOWN_COLUMNS.map((col) => (
                    <th key={col.key}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={EVENT_DRILLDOWN_COLUMNS.length}>No events</td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id || `${row.occurred_at}-${row.user_id}-${row.event_name}`}>
                      <td>{row.occurred_at}</td>
                      <td>
                        {row.user_id ? (
                          <button
                            type="button"
                            className="ba-link-btn"
                            onClick={() => onOpenUser?.(row)}
                          >
                            {row.user_full_name || '—'}
                          </button>
                        ) : (
                          row.user_full_name || '—'
                        )}
                      </td>
                      <td>{row.user_email || '—'}</td>
                      <td>{row.event_name}</td>
                      <td>{row.event_label || '—'}</td>
                      <td>{row.screen || '—'}</td>
                      <td>{row.feature || '—'}</td>
                      <td>{row.duration_ms}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </aside>
    </div>
  );
}
