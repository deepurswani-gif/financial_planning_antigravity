import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export default function AnalyticsChart({ definition, data = [], onDrillDown }) {
  const chartData = Array.isArray(data) ? data : [];
  const xKey = definition.xKey || 'label';
  const yKey = definition.yKey || 'value';

  const openDrill = (clickedLabel = null) => {
    onDrillDown?.({
      ...definition,
      clickedLabel: clickedLabel || null,
    });
  };

  return (
    <div className="ba-chart-card">
      <div className="ba-chart-card__header">
        <h3>{definition.title}</h3>
        <button type="button" className="ba-link-btn" onClick={() => openDrill()}>
          View events
        </button>
      </div>
      <div className="ba-chart-card__body">
        {chartData.length === 0 ? (
          <div className="ba-empty">No data for current filters</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            {definition.type === 'line' ? (
              <LineChart
                data={chartData}
                onClick={(state) => {
                  const label = state?.activePayload?.[0]?.payload?.[xKey];
                  if (label != null) openDrill(String(label));
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey={yKey} stroke="var(--primary)" strokeWidth={2} dot={false} />
              </LineChart>
            ) : definition.type === 'area' ? (
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey={yKey} stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.15} />
              </AreaChart>
            ) : (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey={xKey} tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar
                  dataKey={yKey}
                  fill="var(--primary)"
                  radius={[4, 4, 0, 0]}
                  cursor="pointer"
                  onClick={(entry) => {
                    const label = entry?.payload?.[xKey] ?? entry?.[xKey];
                    if (label != null) openDrill(String(label));
                    else openDrill();
                  }}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
      <p className="ba-chart-card__hint">Click a bar to see the event list for that item</p>
    </div>
  );
}
