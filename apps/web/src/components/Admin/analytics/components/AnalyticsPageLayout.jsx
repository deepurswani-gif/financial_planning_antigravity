import ExportMenu from './ExportMenu';
import { DRILLDOWN_COLUMNS } from '../services/analyticsExport';

/**
 * Shared page chrome: title, export of current KPI snapshot, children.
 */
export default function AnalyticsPageLayout({ title, subtitle, exportRows = [], children }) {
  const columns = [
    { key: 'label', label: 'Metric' },
    { key: 'value', label: 'Value' },
    { key: 'group', label: 'Group' },
  ];

  return (
    <div className="ba-page">
      <div className="ba-page__header">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <ExportMenu
          title={title}
          columns={exportRows.length ? columns : DRILLDOWN_COLUMNS}
          rows={exportRows}
        />
      </div>
      {children}
    </div>
  );
}
