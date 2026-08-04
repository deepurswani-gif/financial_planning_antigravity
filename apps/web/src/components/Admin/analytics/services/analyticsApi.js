import { supabase } from '../../../../lib/supabase';
import { serializeFilters } from '../registry/filters';

function rpcErrorMessage(error) {
  if (!error) return null;
  if (error.message?.includes('Could not find the function') || error.code === 'PGRST202') {
    return 'Analytics RPCs are not deployed yet. Apply the Business Analytics migrations in Supabase (phase1 + phase2 event RPCs).';
  }
  return error.message || 'Analytics request failed';
}

export async function fetchExecutiveAnalytics(filters) {
  const { data, error } = await supabase.rpc('admin_analytics_executive', {
    filters: serializeFilters(filters),
  });
  if (error) throw new Error(rpcErrorMessage(error));
  return data;
}

export async function fetchAnalyticsDrilldown(metricId, filters, pageSize = 50, pageOffset = 0) {
  const { data, error } = await supabase.rpc('admin_analytics_drilldown', {
    metric_id: metricId,
    filters: serializeFilters(filters),
    page_size: pageSize,
    page_offset: pageOffset,
  });
  if (error) throw new Error(rpcErrorMessage(error));
  return data;
}

export async function fetchAdvisorAnalytics(filters) {
  const { data, error } = await supabase.rpc('admin_analytics_advisors', {
    filters: serializeFilters(filters),
  });
  if (error) throw new Error(rpcErrorMessage(error));
  return data || [];
}

export async function fetchFilterOptions() {
  const { data, error } = await supabase.rpc('admin_analytics_filter_options');
  if (error) throw new Error(rpcErrorMessage(error));
  return data || { advisors: [] };
}

export async function fetchUpcomingMaturities(filters, withinMonths = 12) {
  const { data, error } = await supabase.rpc('admin_analytics_upcoming_maturities', {
    filters: serializeFilters(filters),
    within_months: withinMonths,
  });
  if (error) throw new Error(rpcErrorMessage(error));
  return data || [];
}

export async function fetchEventsAnalytics(filters, moduleId = 'engagement') {
  const { data, error } = await supabase.rpc('admin_analytics_events', {
    filters: serializeFilters(filters),
    module_id: moduleId,
  });
  if (error) throw new Error(rpcErrorMessage(error));
  return data;
}

export async function fetchActiveUsersAnalytics(filters) {
  const { data, error } = await supabase.rpc('admin_analytics_active_users', {
    filters: serializeFilters(filters),
  });
  if (error) {
    if (error.code === 'PGRST202' || error.message?.includes('Could not find the function')) {
      return { activeUsersAvailable: false, activeUsers: null, dau: null, wau: null, mau: null, tau: null };
    }
    throw new Error(rpcErrorMessage(error));
  }
  return data || { activeUsersAvailable: false };
}

export async function fetchEventDrilldown(eventFilter, filters, pageSize = 50, pageOffset = 0) {
  const { data, error } = await supabase.rpc('admin_analytics_event_drilldown', {
    event_filter: eventFilter || {},
    filters: serializeFilters(filters),
    page_size: pageSize,
    page_offset: pageOffset,
  });
  if (error) throw new Error(rpcErrorMessage(error));
  return data;
}

export async function listFilterPresets() {
  const { data, error } = await supabase
    .from('analytics_filter_presets')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) {
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      return [];
    }
    throw new Error(error.message);
  }
  return data || [];
}

export async function saveFilterPreset({ name, description, filterTree, isShared = false }) {
  const { data: auth } = await supabase.auth.getUser();
  const ownerId = auth?.user?.id;
  if (!ownerId) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('analytics_filter_presets')
    .insert({
      owner_id: ownerId,
      name,
      description: description || null,
      filter_tree: filterTree,
      is_shared: isShared,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteFilterPreset(id) {
  const { error } = await supabase.from('analytics_filter_presets').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
