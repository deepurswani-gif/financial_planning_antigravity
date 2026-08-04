import { supabase, isSupabaseEnabled } from '../lib/supabase';

/**
 * Persist FCM registration tokens for the signed-in user.
 * Unique on `token`: switching accounts on the same browser reassigns the row
 * to the current user_id via upsert.
 */
export async function upsertPushToken({ userId, token }) {
  if (!isSupabaseEnabled) {
    return { data: null, error: new Error('Supabase is not configured') };
  }
  if (!userId || !token) {
    return { data: null, error: new Error('userId and token are required') };
  }

  const row = {
    user_id: userId,
    token,
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 500) : null,
    enabled: true,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('user_push_tokens')
    .upsert(row, { onConflict: 'token' })
    .select()
    .maybeSingle();

  return { data, error };
}

export async function removePushToken({ userId, token }) {
  if (!isSupabaseEnabled || !userId || !token) {
    return { error: null };
  }

  const { error } = await supabase
    .from('user_push_tokens')
    .delete()
    .eq('user_id', userId)
    .eq('token', token);

  return { error };
}

export async function disableAllPushTokensForUser(userId) {
  if (!isSupabaseEnabled || !userId) {
    return { error: null };
  }

  const { error } = await supabase
    .from('user_push_tokens')
    .update({ enabled: false, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  return { error };
}

/** True when this account has at least one enabled token row. */
export async function hasEnabledPushToken(userId) {
  if (!isSupabaseEnabled || !userId) {
    return { ok: false, error: null };
  }

  const { count, error } = await supabase
    .from('user_push_tokens')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('enabled', true);

  if (error) return { ok: false, error };
  return { ok: (count ?? 0) > 0, error: null };
}
