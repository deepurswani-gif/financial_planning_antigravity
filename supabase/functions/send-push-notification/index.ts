import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { create, getNumericDate } from 'https://deno.land/x/djwt@v3.0.2/mod.ts';

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

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

const pemToArrayBuffer = (pem: string): ArrayBuffer => {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};

const importPrivateKey = async (pem: string): Promise<CryptoKey> => {
  return crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(pem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
};

const getGoogleAccessToken = async (sa: ServiceAccount): Promise<string> => {
  const key = await importPrivateKey(sa.private_key);
  const jwt = await create(
    { alg: 'RS256', typ: 'JWT' },
    {
      iss: sa.client_email,
      sub: sa.client_email,
      aud: 'https://oauth2.googleapis.com/token',
      iat: getNumericDate(0),
      exp: getNumericDate(60 * 60),
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
    },
    key,
  );

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'Failed to get Google access token');
  }
  return data.access_token as string;
};

/**
 * Data-only web push so our FCM service worker always owns display.
 * (webpush.notification auto-display is unreliable on Chrome Android and
 * previously made our SW skip showing — resulting in zero tray notifications.)
 */
const sendFcmMessage = async ({
  accessToken,
  projectId,
  token,
  title,
  body,
  data,
  origin,
}: {
  accessToken: string;
  projectId: string;
  token: string;
  title: string;
  body: string;
  data: Record<string, string>;
  origin: string;
}) => {
  const base = origin.replace(/\/$/, '') || 'https://wealthmap.app';
  const icon = `${base}/pwa-192x192.png`;
  const link = `${base}/`;

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token,
          data: {
            title,
            body,
            icon,
            url: link,
            ...data,
          },
          webpush: {
            headers: {
              Urgency: 'high',
              TTL: '86400',
            },
            // Valid absolute icon is required — relative/404 icons cause Chrome Android to drop the tray entry.
            notification: {
              title,
              body,
              icon,
            },
            fcm_options: {
              link,
            },
          },
        },
      }),
    },
  );

  const payload = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, payload };
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
  const saRaw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON');

  if (!supabaseUrl || !supabaseAnonKey) {
    return json(500, { success: false, error: 'Missing Supabase environment variables' });
  }
  if (!saRaw) {
    return json(500, {
      success: false,
      error:
        'Missing FIREBASE_SERVICE_ACCOUNT_JSON secret (Firebase Console → Project settings → Service accounts → Generate new private key)',
    });
  }

  let serviceAccount: ServiceAccount;
  try {
    serviceAccount = JSON.parse(saRaw) as ServiceAccount;
  } catch {
    return json(500, { success: false, error: 'FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON' });
  }

  if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
    return json(500, {
      success: false,
      error: 'Service account JSON must include project_id, client_email, private_key',
    });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
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
  const title = String(body.title || 'Finbrella');
  const messageBody = String(body.body || '');
  const preferredToken =
    typeof body.token === 'string' && body.token.trim() ? body.token.trim() : '';
  const dataObj =
    body.data && typeof body.data === 'object' && !Array.isArray(body.data)
      ? (body.data as Record<string, unknown>)
      : {};
  const data: Record<string, string> = {};
  for (const [k, v] of Object.entries(dataObj)) {
    data[k] = String(v ?? '');
  }

  if (action !== 'send_to_self') {
    return json(400, {
      success: false,
      error: 'Unsupported action. Use send_to_self.',
    });
  }

  let tokenQuery = supabase
    .from('user_push_tokens')
    .select('token, updated_at, user_agent')
    .eq('user_id', user.id)
    .eq('enabled', true)
    .order('updated_at', { ascending: false });

  if (preferredToken) {
    tokenQuery = tokenQuery.eq('token', preferredToken);
  }

  const { data: tokens, error: tokenError } = await tokenQuery;

  if (tokenError) {
    return json(500, { success: false, error: tokenError.message });
  }

  if (!tokens?.length) {
    return json(400, {
      success: false,
      error: preferredToken
        ? 'Preferred device token not found for this user. Toggle push off/on and retry.'
        : 'No enabled push tokens for this user. Enable notifications in Settings first.',
    });
  }

  let accessToken: string;
  try {
    accessToken = await getGoogleAccessToken(serviceAccount);
  } catch (err) {
    return json(500, {
      success: false,
      error: err instanceof Error ? err.message : 'Google auth failed',
    });
  }

  const originHeader = req.headers.get('origin') || '';
  const siteUrl = Deno.env.get('SITE_URL') || '';
  const origin =
    (originHeader.startsWith('http') ? originHeader : '') ||
    (siteUrl.startsWith('http') ? siteUrl : '') ||
    'https://wealthmap.app';

  console.log(
    JSON.stringify({
      msg: 'send-push-notification start',
      userId: user.id,
      tokenCount: tokens.length,
      preferred: Boolean(preferredToken),
      origin,
    }),
  );

  const results = [];
  for (const row of tokens) {
    const result = await sendFcmMessage({
      accessToken,
      projectId: serviceAccount.project_id,
      token: row.token,
      title,
      body: messageBody,
      data,
      origin,
    });
    const summary = {
      tokenSuffix: String(row.token).slice(-12),
      userAgent: row.user_agent ? String(row.user_agent).slice(0, 80) : null,
      ok: result.ok,
      status: result.status,
      fcmName: (result.payload as { name?: string })?.name || null,
      fcmError:
        (result.payload as { error?: { status?: string; message?: string } })?.error?.status ||
        (result.payload as { error?: { message?: string } })?.error?.message ||
        null,
    };
    results.push(summary);
    console.log(JSON.stringify({ msg: 'fcm-result', ...summary }));

    if (
      !result.ok &&
      typeof summary.fcmError === 'string' &&
      /UNREGISTERED|INVALID_ARGUMENT|NOT_FOUND/i.test(summary.fcmError)
    ) {
      await supabase.from('user_push_tokens').delete().eq('token', row.token);
    }
  }

  const sent = results.filter((r) => r.ok).length;
  console.log(
    JSON.stringify({
      msg: 'send-push-notification done',
      sent,
      total: results.length,
    }),
  );

  return json(200, {
    success: sent > 0,
    sent,
    total: results.length,
    results,
    error: sent === 0 ? 'All FCM sends failed' : undefined,
  });
});
