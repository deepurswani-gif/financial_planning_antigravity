import { supabase } from '../lib/supabase';

export const createCheckoutTransaction = async ({
  planId = null,
  amountInr = 0,
  currency = 'INR',
  status = 'SUCCESS',
  paymentProvider = 'COUPON',
  paymentMethod = 'COUPON_100_OFF',
  couponCode = null,
  providerPaymentId = null,
  providerOrderId = null,
  metadata = {},
}) => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const payload = {
      user_id: user.id,
      plan_id: planId,
      amount_inr: amountInr,
      currency,
      status,
      payment_provider: paymentProvider,
      payment_method: paymentMethod,
      coupon_code: couponCode,
      provider_payment_id: providerPaymentId,
      provider_order_id: providerOrderId,
      metadata,
    };

    const { data, error } = await supabase
      .from('checkout_transactions')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error creating checkout transaction:', error);
    return { data: null, error };
  }
};
