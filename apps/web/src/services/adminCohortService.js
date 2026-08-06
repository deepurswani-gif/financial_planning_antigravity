import { supabase } from '../lib/supabase';

export const COHORT_FILTER_TYPES = [
  { type: 'has_sip', label: 'Has SIP' },
  { type: 'income_gte', label: 'Monthly income ≥ amount', needsAmount: true },
  { type: 'no_life_insurance', label: 'No life insurance' },
  { type: 'no_health_insurance', label: 'No health insurance' },
  { type: 'protection_gap', label: 'Has protection gap' },
];

export function buildRules(filters) {
  return {
    op: 'and',
    filters: (filters || []).filter(Boolean),
  };
}

export async function listCohorts() {
  const { data, error } = await supabase
    .from('cohorts')
    .select('*')
    .order('created_at', { ascending: false });
  return { data: data || [], error };
}

export async function listActiveCohorts() {
  const { data, error } = await supabase
    .from('cohorts')
    .select('id, name, member_count, last_refreshed_at, status')
    .eq('status', 'active')
    .order('name', { ascending: true });
  return { data: data || [], error };
}

export async function createCohort({ name, description, rules, createdBy }) {
  const { data, error } = await supabase
    .from('cohorts')
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      rules,
      created_by: createdBy || null,
      status: 'active',
    })
    .select('*')
    .single();
  return { data, error };
}

export async function archiveCohort(cohortId) {
  const { data, error } = await supabase
    .from('cohorts')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', cohortId)
    .select('*')
    .single();
  return { data, error };
}

export async function previewCohortRules(rules, sampleLimit = 20) {
  const { data, error } = await supabase.rpc('admin_cohort_preview', {
    p_rules: rules,
    p_sample_limit: sampleLimit,
  });
  return { data, error };
}

export async function refreshCohort(cohortId) {
  const { data, error } = await supabase.rpc('admin_cohort_refresh', {
    p_cohort_id: cohortId,
  });
  return { data, error };
}

export async function listCohortMembers(cohortId) {
  const { data, error } = await supabase
    .from('cohort_members')
    .select('*')
    .eq('cohort_id', cohortId)
    .order('display_name', { ascending: true, nullsFirst: false });
  return { data: data || [], error };
}
