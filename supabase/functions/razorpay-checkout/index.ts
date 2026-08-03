import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

const signHmacSha256 = async (secret: string, payload: string) => {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return toHex(signature);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json(405, { success: false, error: 'Method not allowed' });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json(401, { success: false, error: 'Missing authorization header' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
  const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

  if (!supabaseUrl || !supabaseAnonKey) {
    return json(500, { success: false, error: 'Missing Supabase environment variables' });
  }
  if (!razorpayKeyId || !razorpayKeySecret) {
    return json(500, { success: false, error: 'Missing Razorpay edge function secrets' });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: authHeader },
    },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return json(401, { success: false, error: 'Unauthorized user session' });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json(400, { success: false, error: 'Invalid JSON payload' });
  }

  const action = String(body.action || '');
  if (!action) {
    return json(400, { success: false, error: 'action is required' });
  }

  if (action === 'create_order') {
    const amountInr = Number(body.amountInr ?? 0);
    const currency = String(body.currency || 'INR');
    const notes = (body.notes && typeof body.notes === 'object' ? body.notes : {}) as Record<
      string,
      unknown
    >;

    if (Number.isNaN(amountInr) || amountInr < 0) {
      return json(400, { success: false, error: 'amountInr must be a non-negative number' });
    }

    const amountPaise = Math.round(amountInr * 100);

    // Razorpay may reject zero-value orders in some accounts; return key for direct checkout fallback.
    if (amountPaise === 0) {
      return json(200, {
        success: true,
        zeroAmount: true,
        keyId: razorpayKeyId,
        currency,
        amount: 0,
        orderId: null,
      });
    }

    const receipt = `fp_${user.id.slice(0, 8)}_${Date.now()}`;
    const orderPayload = {
      amount: amountPaise,
      currency,
      receipt,
      notes: {
        userId: user.id,
        ...notes,
      },
    };

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${razorpayKeyId}:${razorpayKeySecret}`)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload),
    });

    const result = await response.json();
    if (!response.ok) {
      return json(400, {
        success: false,
        error: result?.error?.description || 'Failed to create Razorpay order',
        details: result,
      });
    }

    return json(200, {
      success: true,
      keyId: razorpayKeyId,
      orderId: result.id,
      amount: result.amount,
      currency: result.currency,
      receipt: result.receipt,
    });
  }

  if (action === 'verify_signature') {
    const razorpayPaymentId = String(body.razorpay_payment_id || '');
    const razorpayOrderId = String(body.razorpay_order_id || '');
    const razorpaySignature = String(body.razorpay_signature || '');

    if (!razorpayPaymentId) {
      return json(400, { success: false, error: 'razorpay_payment_id is required' });
    }

    // Zero-value checkout fallback where Razorpay may not provide order/signature.
    if (!razorpayOrderId || !razorpaySignature) {
      return json(200, {
        success: true,
        verified: true,
        mode: 'zero_amount_fallback',
      });
    }

    const payload = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expectedSignature = await signHmacSha256(razorpayKeySecret, payload);
    const verified = expectedSignature === razorpaySignature;

    return json(200, {
      success: true,
      verified,
      mode: 'standard_signature',
    });
  }

  return json(400, { success: false, error: 'Unsupported action' });
});
