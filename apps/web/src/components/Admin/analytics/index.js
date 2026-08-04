/**
 * Business Analytics module entry.
 * Mounted inside Admin Portal — do not create a separate app.
 */
export { default as BusinessAnalyticsShell } from './BusinessAnalyticsShell';
export { ANALYTICS_MODULES, DEFAULT_ANALYTICS_MODULE } from './registry/modules';
export { KPI_DEFINITIONS, getKpisForModule } from './registry/kpis';
export { CHART_DEFINITIONS, getChartsForModule } from './registry/charts';
export { trackAnalyticsEvent, AnalyticsEventName } from './services/trackAnalyticsEvent';
