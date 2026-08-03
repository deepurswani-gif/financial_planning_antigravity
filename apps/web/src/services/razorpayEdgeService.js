import { supabase } from '../lib/supabase';

const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/razorpay-checkout`;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const invokeRazorpayFunction = async (payload) => {
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

    const result = await response.json();
    if (!response.ok || result?.success === false) {
      return { data: null, error: new Error(result?.error || 'Edge function request failed') };
    }

    return { data: result, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

export const createRazorpayOrder = async ({ amountInr, currency = 'INR', notes = {} }) =>
  invokeRazorpayFunction({
    action: 'create_order',
    amountInr,
    currency,
    notes,
  });

export const verifyRazorpaySignature = async ({
  razorpay_payment_id,
  razorpay_order_id,
  razorpay_signature,
}) =>
  invokeRazorpayFunction({
    action: 'verify_signature',
    razorpay_payment_id,
    razorpay_order_id,
    razorpay_signature,
  });
