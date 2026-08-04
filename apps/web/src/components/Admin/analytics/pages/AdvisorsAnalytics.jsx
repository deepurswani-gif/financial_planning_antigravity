import AnalyticsPageLayout from '../components/AnalyticsPageLayout';
import ExportMenu from '../components/ExportMenu';
import { useAdvisorAnalytics } from '../hooks/useAnalyticsQuery';

const COLUMNS = [
  { key: 'advisor_name', label: 'Advisor' },
  { key: 'advisor_email', label: 'Email' },
  { key: 'advisor_company', label: 'Company' },
  { key: 'clients', label: 'Clients' },
  { key: 'completed_wealthmaps', label: 'Completed WealthMaps' },
  { key: 'avg_wellness', label: 'Avg Wellness' },
  { key: 'avg_net_worth', label: 'Avg Net Worth' },
  { key: 'avg_sip', label: 'Avg SIP' },
  { key: 'total_sip', label: 'Total SIP' },
];

export default function AdvisorsAnalytics({ filters, onDrillDown }) {
  const { data, loading, error } = useAdvisorAnalytics(filters);

  return (
    <AnalyticsPageLayout
      title="Advisors"
      subtitle="Client load and outcomes by advisor"
      exportRows={(data || []).map((row) => ({
        label: row.advisor_name || row.advisor_email,
        group: 'Advisors',
        value: `${row.clients} clients`,
      }))}
    >
      <div style={{ marginBottom: '1rem' }}>
        <ExportMenu title="Advisors" columns={COLUMNS} rows={data || []} />
      </div>
      {loading && <div className="ba-empty">Loading advisors…</div>}
      {error && <div className="ba-error">{error}</div>}
      {!loading && !error && (
        <div className="ba-table-wrap">
          <table className="ba-table">
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {(data || []).length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length + 1}>No advised clients in filter scope</td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr key={row.advisor_id}>
                    <td>{row.advisor_name || '—'}</td>
                    <td>{row.advisor_email}</td>
                    <td>{row.advisor_company || '—'}</td>
                    <td>{row.clients}</td>
                    <td>{row.completed_wealthmaps}</td>
                    <td>{row.avg_wellness ?? '—'}</td>
                    <td>{formatMoney(row.avg_net_worth)}</td>
                    <td>{formatMoney(row.avg_sip)}</td>
                    <td>{formatMoney(row.total_sip)}</td>
                    <td>
                      <button
                        type="button"
                        className="ba-link-btn"
                        onClick={() =>
                          onDrillDown('advised', `${row.advisor_name || 'Advisor'} clients`, {
                            advisorId: row.advisor_id,
                          })
                        }
                      >
                        Drill down
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </AnalyticsPageLayout>
  );
}

function formatMoney(value) {
  if (value === null || value === undefined) return '—';
  return Number(value).toLocaleString('en-IN');
}
