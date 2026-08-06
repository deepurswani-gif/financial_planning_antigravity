import { supabase } from '../lib/supabase';

const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push-notification`;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function invokeAdminPush(payload) {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.access_token) {
    return { data: null, error: new Error('Not authenticated') };
  }

  try {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        ...(supabaseAnonKey ? { apikey: supabaseAnonKey } : {}),
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result?.success === false) {
      return {
        data: null,
        error: new Error(result?.error || `Push campaign failed (${response.status})`),
      };
    }
    return { data: result, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function listPushTemplates() {
  const { data, error } = await supabase
    .from('push_notification_templates')
    .select('*')
    .order('updated_at', { ascending: false });
  return { data: data || [], error };
}

export async function savePushTemplate(payload) {
  const row = {
    name: payload.name.trim(),
    title: payload.title.trim(),
    body: payload.body.trim(),
    image_url: payload.imageUrl?.trim() || null,
    deep_link_url: payload.deepLinkUrl?.trim() || null,
    updated_at: new Date().toISOString(),
  };
  if (payload.id) {
    const { data, error } = await supabase
      .from('push_notification_templates')
      .update(row)
      .eq('id', payload.id)
      .select('*')
      .single();
    return { data, error };
  }
  const { data, error } = await supabase
    .from('push_notification_templates')
    .insert({ ...row, created_by: payload.createdBy || null })
    .select('*')
    .single();
  return { data, error };
}

export async function deletePushTemplate(id) {
  const { error } = await supabase.from('push_notification_templates').delete().eq('id', id);
  return { error };
}

export async function listPushCampaigns() {
  const { data, error } = await supabase
    .from('push_campaigns')
    .select('*, cohorts(name)')
    .order('created_at', { ascending: false });
  return { data: data || [], error };
}

export async function createPushCampaign(payload) {
  const row = {
    template_id: payload.templateId || null,
    title: payload.title.trim(),
    body: payload.body.trim(),
    image_url: payload.imageUrl?.trim() || null,
    deep_link_url: payload.deepLinkUrl?.trim() || null,
    audience_type: payload.audienceType || 'all_push',
    cohort_id: payload.audienceType === 'cohort' ? payload.cohortId : null,
    status: payload.scheduledAt ? 'scheduled' : 'draft',
    scheduled_at: payload.scheduledAt || null,
    created_by: payload.createdBy || null,
  };
  const { data, error } = await supabase
    .from('push_campaigns')
    .insert(row)
    .select('*')
    .single();
  return { data, error };
}

export async function sendPushCampaignNow(campaignId) {
  return invokeAdminPush({
    action: 'admin_send_campaign',
    campaignId,
  });
}

export async function processDuePushCampaigns() {
  return invokeAdminPush({ action: 'admin_process_due' });
}

export async function listCampaignDeliveries(campaignId) {
  const { data: rows, error } = await supabase
    .from('push_campaign_deliveries')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false });
  if (error) return { data: [], error };

  const userIds = [...new Set((rows || []).map((r) => r.user_id).filter(Boolean))];
  let profilesById = {};
  if (userIds.length) {
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, full_name, email')
      .in('id', userIds);
    profilesById = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
  }

  const data = (rows || []).map((r) => ({
    ...r,
    full_name: profilesById[r.user_id]?.full_name || null,
    email: profilesById[r.user_id]?.email || null,
  }));
  return { data, error: null };
}
