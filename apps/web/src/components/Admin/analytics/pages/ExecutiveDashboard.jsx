import AnalyticsChart from '../components/AnalyticsChart';
import AnalyticsPageLayout from '../components/AnalyticsPageLayout';
import KpiCard from '../components/KpiCard';
import { useExecutiveAnalytics, useUpcomingMaturities } from '../hooks/useAnalyticsQuery';
import { getChartsForModule } from '../registry/charts';
import { getKpisForModule } from '../registry/kpis';
import { formatKpiValue } from '../components/formatKpi';

export default function ExecutiveDashboard({ filters, onDrillDown }) {
  const { data, loading, error } = useExecutiveAnalytics(filters);
  const { data: maturities } = useUpcomingMaturities(filters);
  const kpis = getKpisForModule('executive');
  const charts = getChartsForModule('executive');
  const kpiValues = data?.kpis || {};

  const exportRows = kpis.map((kpi) => ({
    label: kpi.label,
    group: kpi.group,
    value: formatKpiValue(
      kpiValues[kpi.kpiKey],
      kpi.format,
      { unavailable: kpi.unavailableKey ? kpiValues[kpi.unavailableKey] === false : false },
    ),
  }));

  const groups = [...new Set(kpis.map((k) => k.group))];

  return (
    <AnalyticsPageLayout
      title="Executive Dashboard"
      subtitle="CEO view — cards and charts drill into user-level detail"
      exportRows={exportRows}
    >
      {loading && <div className="ba-empty">Loading executive KPIs…</div>}
      {error && <div className="ba-error">{error}</div>}
      {!loading && !error && (
        <>
          {groups.map((group) => (
            <section key={group} className="ba-section">
              <h3 className="ba-section__title">{group}</h3>
              <div className="ba-kpi-grid">
                {kpis
                  .filter((k) => k.group === group)
                  .map((kpi) => (
                    <KpiCard
                      key={kpi.id}
                      kpi={kpi}
                      value={kpiValues[kpi.kpiKey]}
                      unavailable={
                        kpi.unavailableKey ? kpiValues[kpi.unavailableKey] === false : false
                      }
                      onDrillDown={(k) => onDrillDown(k.drilldownMetricId, k.label)}
                    />
                  ))}
              </div>
            </section>
          ))}

          <section className="ba-section">
            <h3 className="ba-section__title">Trends</h3>
            <div className="ba-chart-grid">
              {charts.map((chart) => (
                <AnalyticsChart
                  key={chart.id}
                  definition={chart}
                  data={data?.series?.[chart.seriesKey] || []}
                  onDrillDown={(c) => onDrillDown(c.drilldownMetricId, c.title)}
                />
              ))}
            </div>
          </section>

          <section className="ba-section">
            <h3 className="ba-section__title">Upcoming Maturities (12 months)</h3>
            <div className="ba-table-wrap">
              <table className="ba-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>User</th>
                    <th>Label</th>
                    <th>Maturity</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(maturities || []).length === 0 ? (
                    <tr>
                      <td colSpan={5}>No upcoming maturities in filter scope</td>
                    </tr>
                  ) : (
                    maturities.slice(0, 25).map((row, idx) => (
                      <tr key={`${row.kind}-${row.user_id}-${idx}`}>
                        <td>{row.kind}</td>
                        <td>{row.user_full_name || row.user_email}</td>
                        <td>{row.label}</td>
                        <td>{row.maturity_date}</td>
                        <td>{Number(row.amount || 0).toLocaleString('en-IN')}</td>
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
