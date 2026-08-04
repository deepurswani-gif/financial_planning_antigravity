import { ChevronRight } from 'lucide-react';
import { formatKpiValue } from './formatKpi';

export default function KpiCard({ kpi, value, unavailable = false, onDrillDown }) {
  return (
    <button
      type="button"
      className="ba-kpi-card"
      onClick={() => onDrillDown?.(kpi)}
      disabled={unavailable}
      title={unavailable ? kpi.description || 'Available in a later phase' : `Drill down: ${kpi.label}`}
    >
      <div className="ba-kpi-card__meta">
        <span className="ba-kpi-card__group">{kpi.group}</span>
        <span className="ba-kpi-card__label">{kpi.label}</span>
      </div>
      <div className="ba-kpi-card__value">
        {formatKpiValue(value, kpi.format, { unavailable })}
      </div>
      {!unavailable && (
        <span className="ba-kpi-card__action">
          Details <ChevronRight size={14} />
        </span>
      )}
      {unavailable && <span className="ba-kpi-card__soon">Phase {kpi.phase || 2}</span>}
    </button>
  );
}
