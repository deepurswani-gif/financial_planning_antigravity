import { X } from 'lucide-react';
import { useDrilldown } from '../hooks/useAnalyticsQuery';
import { DRILLDOWN_COLUMNS } from '../services/analyticsExport';
import ExportMenu from './ExportMenu';

export default function DrillDownPanel({ metricId, title, filters, onClose, onOpenUser }) {
  const { data, loading, error, offset, pageSize, nextPage, prevPage } = useDrilldown(
    metricId,
    filters,
    Boolean(metricId),
  );

  const rows = data?.rows || [];

  return (
    <div className="ba-drawer-backdrop" onClick={onClose}>
      <aside className="ba-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="ba-drawer__header">
          <div>
            <h2>{title || metricId}</h2>
            <p>{data?.total ?? 0} matching users</p>
          </div>
          <button type="button" className="ba-icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="ba-drawer__toolbar">
          <ExportMenu title={title || metricId} columns={DRILLDOWN_COLUMNS} rows={rows} />
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
                  {DRILLDOWN_COLUMNS.slice(0, 8).map((col) => (
                    <th key={col.key}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8}>No rows</td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={`${row.user_id}-${row.plan_id}`}>
                      <td>
                        <button
                          type="button"
                          className="ba-link-btn"
                          onClick={() => onOpenUser?.(row)}
                        >
                          {row.user_full_name || '—'}
                        </button>
                      </td>
                      <td>{row.user_email}</td>
                      <td>{row.advisor_name || '—'}</td>
                      <td>{row.wealthmap_status}</td>
                      <td>{row.funnel_step}</td>
                      <td>{row.wellness_score ?? '—'}</td>
                      <td>{formatNum(row.net_worth)}</td>
                      <td>{formatNum(row.sip_monthly)}</td>
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

function formatNum(value) {
  if (value === null || value === undefined) return '—';
  return Number(value).toLocaleString('en-IN');
}
