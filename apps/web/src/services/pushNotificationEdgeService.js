import { supabase } from '../lib/supabase';

const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push-notification`;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function invokePushFunction(payload) {
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
        error: new Error(result?.error || `Push send failed (${response.status})`),
      };
    }
    return { data: result, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

/** Phase 3: send a notification to the current user's stored devices. */
export const sendTestPushToSelf = async ({ title, body, data } = {}) =>
  invokePushFunction({
    action: 'send_to_self',
    title: title || 'Finbrella',
    body: body || 'Test notification',
    data: data || {},
  });

/** Registry-driven coach push (same transport as test send). */
export const sendPushToSelf = async ({ title, body, data } = {}) =>
  invokePushFunction({
    action: 'send_to_self',
    title: title || 'Finbrella',
    body: body || '',
    data: data || {},
  });
