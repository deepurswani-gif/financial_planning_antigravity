import AnalyticsChart from '../components/AnalyticsChart';
import AnalyticsPageLayout from '../components/AnalyticsPageLayout';
import KpiCard from '../components/KpiCard';
import { formatKpiValue } from '../components/formatKpi';
import { useEventAnalytics } from '../hooks/useAnalyticsQuery';
import { getChartsForModule } from '../registry/charts';
import { resolveEventDrilldown } from '../registry/eventDrilldown';
import { getKpisForModule } from '../registry/kpis';

const MODULE_META = {
  engagement: {
    title: 'Engagement Analytics',
    subtitle: 'Sessions, active users, screen/report time, and hourly activity',
  },
  product: {
    title: 'Product Analytics',
    subtitle: 'Click a KPI or chart bar to see the exact CTA/report event list',
  },
  ai: {
    title: 'AI Analytics',
    subtitle: 'Smart Edit usage and recommendation outcomes',
  },
};

function formatDuration(ms) {
  if (ms == null || ms === '' || Number(ms) <= 0) return '—';
  const sec = Math.round(Number(ms) / 1000);
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

function EventAnalyticsPage({ moduleId, filters, onEventDrillDown }) {
  const { data, loading, error } = useEventAnalytics(filters, moduleId);
  const kpis = getKpisForModule(moduleId);
  const charts = getChartsForModule(moduleId).filter((c) => c.source === 'events');
  const kpiValues = data?.kpis || {};
  const series = data?.series || {};
  const meta = MODULE_META[moduleId] || { title: moduleId, subtitle: '' };

  const exportRows = kpis.map((kpi) => ({
    label: kpi.label,
    group: kpi.group,
    value: formatKpiValue(kpiValues[kpi.kpiKey], kpi.format),
  }));

  const openFromKpi = (kpi) => {
    const resolved = resolveEventDrilldown(kpi);
    if (resolved) onEventDrillDown?.(resolved.title, resolved.eventFilter);
  };

  const openFromChart = (definition) => {
    const resolved = resolveEventDrilldown(definition);
    if (resolved) onEventDrillDown?.(resolved.title, resolved.eventFilter);
  };

  const reportDurations = series.reportDurations || [];
  const topUsers = series.topActiveUsers || [];
  const recent = series.recentActivity || [];

  return (
    <AnalyticsPageLayout title={meta.title} subtitle={meta.subtitle} exportRows={exportRows}>
      {loading && <div className="ba-empty">Loading event analytics…</div>}
      {error && <div className="ba-error">{error}</div>}
      {!loading && !error && (
        <>
          {!data?.eventsAvailable && (
            <div className="ba-empty" style={{ marginBottom: '1rem' }}>
              No analytics events yet. Use the app (login, screens, Smart Edit, reports, CTAs) —
              events will appear here automatically.
            </div>
          )}
          <div className="ba-kpi-grid">
            {kpis.map((kpi) => (
              <KpiCard
                key={kpi.id}
                kpi={kpi}
                value={kpiValues[kpi.kpiKey]}
                onDrillDown={openFromKpi}
              />
            ))}
          </div>

          <div className="ba-chart-grid" style={{ marginTop: '1.5rem' }}>
            {charts.map((chart) => (
              <AnalyticsChart
                key={chart.id}
                definition={chart}
                data={series[chart.seriesKey] || []}
                onDrillDown={openFromChart}
              />
            ))}
          </div>

          {(moduleId === 'product' || moduleId === 'engagement') && (
            <section className="ba-section" style={{ marginTop: '1.5rem' }}>
              <h3 className="ba-section__title">Time spent on each report</h3>
              <p style={{ margin: '0 0 0.75rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Average dwell time after users leave a report (starts collecting with report_exit events).
                Click a row to see individual sessions.
              </p>
              <div className="ba-table-wrap">
                <table className="ba-table">
                  <thead>
                    <tr>
                      <th>Report</th>
                      <th>Exits tracked</th>
                      <th>Avg time</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {reportDurations.length === 0 ? (
                      <tr>
                        <td colSpan={4}>
                          No report timing yet — open reports in the app, then switch away so dwell time is recorded.
                        </td>
                      </tr>
                    ) : (
                      reportDurations.map((row) => (
                        <tr key={row.label}>
                          <td>{row.label}</td>
                          <td>{row.count}</td>
                          <td>{formatDuration(row.avgDurationMs)}</td>
                          <td>
                            <button
                              type="button"
                              className="ba-link-btn"
                              onClick={() =>
                                onEventDrillDown?.(`Report time: ${row.label}`, {
                                  eventName: 'report_exit',
                                  section: row.label,
                                })
                              }
                            >
                              View events
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {moduleId === 'engagement' && (
            <section className="ba-section" style={{ marginTop: '1.5rem' }}>
              <h3 className="ba-section__title">Most active users</h3>
              <div className="ba-table-wrap">
                <table className="ba-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Email</th>
                      <th>Events</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topUsers.length === 0 ? (
                      <tr>
                        <td colSpan={3}>No user activity in range</td>
                      </tr>
                    ) : (
                      topUsers.map((row) => (
                        <tr key={row.userId}>
                          <td>{row.name || '—'}</td>
                          <td>{row.email || '—'}</td>
                          <td>{row.events}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="ba-section" style={{ marginTop: '1.5rem' }}>
            <h3 className="ba-section__title">Recent activity</h3>
            <div className="ba-table-wrap">
              <table className="ba-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>User</th>
                    <th>Event</th>
                    <th>Detail</th>
                    <th>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.length === 0 ? (
                    <tr>
                      <td colSpan={5}>No recent events</td>
                    </tr>
                  ) : (
                    recent.map((row, idx) => (
                      <tr key={`${row.occurred_at}-${idx}`}>
                        <td>{row.occurred_at ? new Date(row.occurred_at).toLocaleString() : '—'}</td>
                        <td>{row.user_full_name || row.user_email || '—'}</td>
                        <td>{row.event_name}</td>
                        <td>{row.label || row.screen || '—'}</td>
                        <td>{formatDuration(row.duration_ms)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </AnalyticsPageLayout>
  );
}

export function EngagementAnalytics(props) {
  return <EventAnalyticsPage moduleId="engagement" {...props} />;
}

export function ProductAnalytics(props) {
  return <EventAnalyticsPage moduleId="product" {...props} />;
}

export function AiAnalytics(props) {
  return <EventAnalyticsPage moduleId="ai" {...props} />;
}
