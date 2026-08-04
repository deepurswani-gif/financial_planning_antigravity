import { useMemo, useState } from 'react';
import { LayoutDashboard } from 'lucide-react';
import AnalyticsFilterBar from './components/AnalyticsFilterBar';
import DrillDownPanel from './components/DrillDownPanel';
import EventDrillDownPanel from './components/EventDrillDownPanel';
import PhasePlaceholder from './components/PhasePlaceholder';
import { useAnalyticsFilters } from './hooks/useAnalyticsFilters';
import AdvisorsAnalytics from './pages/AdvisorsAnalytics';
import ExecutiveDashboard from './pages/ExecutiveDashboard';
import {
  AiAnalytics,
  EngagementAnalytics,
  ProductAnalytics,
} from './pages/EventModulePages';
import {
  FinancialIntelligence,
  FunnelAnalytics,
  InvestmentInsurance,
  RevenueSubscription,
  UsersAnalytics,
} from './pages/ModulePages';
import {
  ANALYTICS_MODULES,
  DEFAULT_ANALYTICS_MODULE,
  getModuleById,
  isModuleAvailable,
} from './registry/modules';
import './styles/analytics.css';

const CURRENT_PHASE = 2;

export default function BusinessAnalyticsShell({ onOpenClient }) {
  const [activeModuleId, setActiveModuleId] = useState(DEFAULT_ANALYTICS_MODULE);
  const [drilldown, setDrilldown] = useState(null);
  const [eventDrilldown, setEventDrilldown] = useState(null);
  const filterState = useAnalyticsFilters();

  const activeModule = getModuleById(activeModuleId);
  const filtersKey = useMemo(
    () => JSON.stringify(filterState.filters),
    [filterState.filters],
  );

  const filters = useMemo(
    () => filterState.filters,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtersKey],
  );

  const drilldownFilters = useMemo(() => {
    if (!drilldown?.filterOverrides) return filters;
    return { ...filters, ...drilldown.filterOverrides };
  }, [filters, drilldown]);

  const openDrilldown = (metricId, title, filterOverrides = null) => {
    setEventDrilldown(null);
    setDrilldown({ metricId, title, filterOverrides });
  };

  const openEventDrilldown = (title, eventFilter) => {
    setDrilldown(null);
    setEventDrilldown({ title, eventFilter: eventFilter || {} });
  };

  return (
    <div className="ba-shell">
      <div className="ba-shell__top">
        <div>
          <h2 className="ba-shell__title">
            <LayoutDashboard size={22} /> Business Analytics
          </h2>
          <p className="ba-shell__subtitle">
            Phase {CURRENT_PHASE} live · later modules reserved in navigation
          </p>
        </div>
      </div>

      <nav className="ba-nav" aria-label="Business Analytics">
        {ANALYTICS_MODULES.map((mod) => {
          const available = isModuleAvailable(mod, CURRENT_PHASE);
          return (
            <button
              key={mod.id}
              type="button"
              className={`ba-nav__item ${activeModuleId === mod.id ? 'active' : ''} ${available ? '' : 'soon'}`}
              onClick={() => setActiveModuleId(mod.id)}
            >
              {mod.label}
              {!available && <span className="ba-nav__badge">P{mod.phase}</span>}
            </button>
          );
        })}
      </nav>

      {isModuleAvailable(activeModule, CURRENT_PHASE) && (
        <AnalyticsFilterBar
          filters={filterState.filters}
          updateFilter={filterState.updateFilter}
          updateHyper={filterState.updateHyper}
          resetFilters={filterState.resetFilters}
          advisorOptions={filterState.advisorOptions}
          presets={filterState.presets}
          applyPreset={filterState.applyPreset}
          saveCurrentPreset={filterState.saveCurrentPreset}
          removePreset={filterState.removePreset}
        />
      )}

      {filterState.optionsError && (
        <div className="ba-error" style={{ marginBottom: '1rem' }}>
          {filterState.optionsError}
        </div>
      )}

      <div className="ba-shell__content">
        {!isModuleAvailable(activeModule, CURRENT_PHASE) ? (
          <PhasePlaceholder module={activeModule} />
        ) : activeModuleId === 'executive' ? (
          <ExecutiveDashboard filters={filters} onDrillDown={openDrilldown} />
        ) : activeModuleId === 'users' ? (
          <UsersAnalytics filters={filters} onDrillDown={openDrilldown} />
        ) : activeModuleId === 'funnel' ? (
          <FunnelAnalytics filters={filters} onDrillDown={openDrilldown} />
        ) : activeModuleId === 'financial' ? (
          <FinancialIntelligence filters={filters} onDrillDown={openDrilldown} />
        ) : activeModuleId === 'investment' ? (
          <InvestmentInsurance filters={filters} onDrillDown={openDrilldown} />
        ) : activeModuleId === 'revenue' ? (
          <RevenueSubscription filters={filters} onDrillDown={openDrilldown} />
        ) : activeModuleId === 'advisors' ? (
          <AdvisorsAnalytics filters={filters} onDrillDown={openDrilldown} />
        ) : activeModuleId === 'engagement' ? (
          <EngagementAnalytics filters={filters} onEventDrillDown={openEventDrilldown} />
        ) : activeModuleId === 'product' ? (
          <ProductAnalytics filters={filters} onEventDrillDown={openEventDrilldown} />
        ) : activeModuleId === 'ai' ? (
          <AiAnalytics filters={filters} onEventDrillDown={openEventDrilldown} />
        ) : (
          <PhasePlaceholder module={activeModule} />
        )}
      </div>

      {drilldown && (
        <DrillDownPanel
          metricId={drilldown.metricId}
          title={drilldown.title}
          filters={drilldownFilters}
          onClose={() => setDrilldown(null)}
          onOpenUser={(row) => {
            onOpenClient?.(row);
            setDrilldown(null);
          }}
        />
      )}

      {eventDrilldown && (
        <EventDrillDownPanel
          title={eventDrilldown.title}
          eventFilter={eventDrilldown.eventFilter}
          filters={filters}
          onClose={() => setEventDrilldown(null)}
          onOpenUser={(row) => {
            onOpenClient?.(row);
            setEventDrilldown(null);
          }}
        />
      )}
    </div>
  );
}
