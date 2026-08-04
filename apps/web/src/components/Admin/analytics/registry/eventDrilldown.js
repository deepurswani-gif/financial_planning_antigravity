/**
 * Maps Product/Engagement/AI KPI cards and charts to event drill-down filters.
 */

export function resolveEventDrilldown(source) {
  if (!source) return null;

  // Chart click: definition + optional bar label from data point
  if (source.seriesKey || source.id) {
    const chartId = source.id;
    const label = source.clickedLabel || null;

    const chartMap = {
      top_screens: { eventName: 'screen_view', labelKey: 'label' },
      top_reports: { eventName: 'report_view', labelKey: 'section' },
      least_reports: { eventName: 'report_view', labelKey: 'section' },
      top_features: { eventName: null, labelKey: 'label' },
      top_ctas: { eventName: 'cta_click', labelKey: 'cta' },
      smart_edit_fields: { eventName: 'smart_edit_save', labelKey: 'label' },
      recommendation_actions: { eventName: label || null, labelKey: null },
      events_by_day: { eventName: null },
      event_name_breakdown: { eventName: label || null },
      activity_by_hour: { eventName: null },
      report_durations: { eventName: 'report_exit', labelKey: 'section' },
    };

    const mapped = chartMap[chartId];
    if (!mapped) {
      return {
        title: source.title || 'Events',
        eventFilter: label ? { label } : {},
      };
    }

    const eventFilter = {};
    if (mapped.eventName) eventFilter.eventName = mapped.eventName;
    if (label) {
      if (mapped.labelKey === 'section') eventFilter.section = label;
      else if (mapped.labelKey === 'cta') eventFilter.cta = label;
      else if (mapped.labelKey === 'label') eventFilter.label = label;
      else if (!mapped.eventName) eventFilter.eventName = label;
    }

    return {
      title: label ? `${source.title}: ${label}` : source.title || 'Events',
      eventFilter,
    };
  }

  // KPI card
  const kpiMap = {
    screen_views: { eventName: 'screen_view', title: 'Screen views' },
    report_views: { eventName: 'report_view', title: 'Report views' },
    feature_clicks: { eventName: 'feature_click', title: 'Feature clicks' },
    cta_clicks: { eventName: 'cta_click', title: 'CTA clicks' },
    session_count: { eventName: 'session_start', title: 'Sessions' },
    dau: { eventName: 'screen_view', title: 'Active user activity' },
    wau: { eventName: 'screen_view', title: 'Active user activity' },
    mau: { eventName: 'screen_view', title: 'Active user activity' },
    avg_screen_duration: { eventName: 'screen_exit', title: 'Screen exits (with duration)' },
    avg_report_duration: { eventName: 'report_exit', title: 'Report time spent' },
    smart_edit_opens: { eventName: 'smart_edit_open', title: 'Smart Edit opens' },
    smart_edit_saves: { eventName: 'smart_edit_save', title: 'Smart Edit saves' },
    recommendation_views: { eventName: 'recommendation_view', title: 'Recommendations viewed' },
    recommendation_accepts: { eventName: 'recommendation_accept', title: 'Recommendations accepted' },
    recommendation_accept_rate: { eventName: 'recommendation_accept', title: 'Recommendations accepted' },
    smart_edit_save_rate: { eventName: 'smart_edit_save', title: 'Smart Edit saves' },
    report_to_cta_rate: { eventName: 'cta_click', title: 'CTA clicks after reports' },
  };

  const kpi = kpiMap[source.id] || kpiMap[source.kpiKey];
  if (kpi) {
    return {
      title: kpi.title || source.label,
      eventFilter: { eventName: kpi.eventName },
    };
  }

  return null;
}

export const EVENT_DRILLDOWN_COLUMNS = [
  { key: 'occurred_at', label: 'When' },
  { key: 'user_full_name', label: 'User' },
  { key: 'user_email', label: 'Email' },
  { key: 'event_name', label: 'Event' },
  { key: 'event_label', label: 'Detail' },
  { key: 'screen', label: 'Screen' },
  { key: 'feature', label: 'Feature' },
  { key: 'duration_ms', label: 'Duration (ms)' },
];
