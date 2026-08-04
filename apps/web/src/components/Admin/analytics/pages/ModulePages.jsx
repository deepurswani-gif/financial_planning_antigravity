import AnalyticsChart from '../components/AnalyticsChart';
import AnalyticsPageLayout from '../components/AnalyticsPageLayout';
import KpiCard from '../components/KpiCard';
import { formatKpiValue } from '../components/formatKpi';
import { useExecutiveAnalytics } from '../hooks/useAnalyticsQuery';
import { getChartsForModule } from '../registry/charts';
import { getKpisForModule } from '../registry/kpis';

function ModuleAnalyticsPage({ moduleId, title, subtitle, filters, onDrillDown }) {
  const { data, loading, error } = useExecutiveAnalytics(filters);
  const kpis = getKpisForModule(moduleId);
  const charts = getChartsForModule(moduleId);
  const kpiValues = data?.kpis || {};

  const exportRows = kpis.map((kpi) => ({
    label: kpi.label,
    group: kpi.group,
    value: formatKpiValue(kpiValues[kpi.kpiKey], kpi.format, {
      unavailable: kpi.unavailableKey ? kpiValues[kpi.unavailableKey] === false : false,
    }),
  }));

  return (
    <AnalyticsPageLayout title={title} subtitle={subtitle} exportRows={exportRows}>
      {loading && <div className="ba-empty">Loading…</div>}
      {error && <div className="ba-error">{error}</div>}
      {!loading && !error && (
        <>
          <div className="ba-kpi-grid">
            {kpis.map((kpi) => (
              <KpiCard
                key={kpi.id}
                kpi={kpi}
                value={kpiValues[kpi.kpiKey]}
                unavailable={kpi.unavailableKey ? kpiValues[kpi.unavailableKey] === false : false}
                onDrillDown={(k) => onDrillDown(k.drilldownMetricId, k.label)}
              />
            ))}
          </div>
          {charts.length > 0 && (
            <div className="ba-chart-grid" style={{ marginTop: '1.5rem' }}>
              {charts.map((chart) => (
                <AnalyticsChart
                  key={chart.id}
                  definition={chart}
                  data={data?.series?.[chart.seriesKey] || []}
                  onDrillDown={(c) => onDrillDown(c.drilldownMetricId, c.title)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </AnalyticsPageLayout>
  );
}

export function UsersAnalytics(props) {
  return (
    <ModuleAnalyticsPage
      moduleId="users"
      title="Users"
      subtitle="User base and subscription penetration"
      {...props}
    />
  );
}

export function FunnelAnalytics(props) {
  return (
    <ModuleAnalyticsPage
      moduleId="funnel"
      title="WealthMap Funnel"
      subtitle="Step completion and drop-off from plan progress"
      {...props}
    />
  );
}

export function FinancialIntelligence(props) {
  return (
    <ModuleAnalyticsPage
      moduleId="financial"
      title="Financial Intelligence"
      subtitle="Wellness, surplus, and gap analytics from plan facts"
      {...props}
    />
  );
}

export function InvestmentInsurance(props) {
  return (
    <ModuleAnalyticsPage
      moduleId="investment"
      title="Investment & Insurance"
      subtitle="SIP, net worth, cover, and portfolio insurance signals"
      {...props}
    />
  );
}

export function RevenueSubscription(props) {
  return (
    <ModuleAnalyticsPage
      moduleId="revenue"
      title="Revenue & Subscription"
      subtitle="Checkout revenue and subscription rate"
      {...props}
    />
  );
}
