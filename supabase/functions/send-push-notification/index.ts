import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { create, getNumericDate } from 'https://deno.land/x/djwt@v3.0.2/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret',
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

type CampaignRow = {
  id: string;
  title: string;
  body: string;
  image_url: string | null;
  deep_link_url: string | null;
  audience_type: 'all_push' | 'cohort';
  cohort_id: string | null;
  status: string;
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
  const link = data.url || `${base}/`;

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

const resolveOrigin = (req: Request) => {
  const originHeader = req.headers.get('origin') || '';
  const siteUrl = Deno.env.get('SITE_URL') || '';
  return (
    (originHeader.startsWith('http') ? originHeader : '') ||
    (siteUrl.startsWith('http') ? siteUrl : '') ||
    'https://wealthmap.app'
  );
};

const assertAdmin = async (supabase: SupabaseClient, userId: string) => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data?.role !== 'admin') {
    throw new Error('Admin access required');
  }
};

const loadServiceAccount = (): ServiceAccount => {
  const saRaw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON');
  if (!saRaw) {
    throw new Error(
      'Missing FIREBASE_SERVICE_ACCOUNT_JSON secret (Firebase Console → Project settings → Service accounts → Generate new private key)',
    );
  }
  let serviceAccount: ServiceAccount;
  try {
    serviceAccount = JSON.parse(saRaw) as ServiceAccount;
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON');
  }
  if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error('Service account JSON must include project_id, client_email, private_key');
  }
  return serviceAccount;
};

const resolveAudienceUserIds = async (
  adminClient: SupabaseClient,
  campaign: CampaignRow,
): Promise<string[]> => {
  if (campaign.audience_type === 'cohort') {
    if (!campaign.cohort_id) return [];
    const { data, error } = await adminClient
      .from('cohort_members')
      .select('user_id')
      .eq('cohort_id', campaign.cohort_id);
    if (error) throw new Error(error.message);
    return [...new Set((data || []).map((r) => r.user_id as string))];
  }

  const { data, error } = await adminClient
    .from('user_push_tokens')
    .select('user_id')
    .eq('enabled', true);
  if (error) throw new Error(error.message);
  return [...new Set((data || []).map((r) => r.user_id as string))];
};

const executeCampaign = async ({
  adminClient,
  serviceAccount,
  campaign,
  origin,
  accessToken,
}: {
  adminClient: SupabaseClient;
  serviceAccount: ServiceAccount;
  campaign: CampaignRow;
  origin: string;
  accessToken: string;
}) => {
  const now = new Date().toISOString();
  await adminClient
    .from('push_campaigns')
    .update({ status: 'sending', started_at: now, updated_at: now })
    .eq('id', campaign.id);

  const userIds = await resolveAudienceUserIds(adminClient, campaign);
  let sent = 0;
  let failed = 0;
  let targeted = 0;

  const deepLink =
    campaign.deep_link_url && String(campaign.deep_link_url).startsWith('http')
      ? String(campaign.deep_link_url)
      : `${origin.replace(/\/$/, '')}/`;

  for (const userId of userIds) {
    const { data: tokens, error: tokenError } = await adminClient
      .from('user_push_tokens')
      .select('token')
      .eq('user_id', userId)
      .eq('enabled', true);

    if (tokenError) {
      failed += 1;
      await adminClient.from('push_campaign_deliveries').insert({
        campaign_id: campaign.id,
        user_id: userId,
        status: 'failed',
        error: tokenError.message,
      });
      continue;
    }

    if (!tokens?.length) {
      await adminClient.from('push_campaign_deliveries').insert({
        campaign_id: campaign.id,
        user_id: userId,
        status: 'skipped',
        error: 'No enabled push token',
      });
      continue;
    }

    for (const row of tokens) {
      targeted += 1;
      const result = await sendFcmMessage({
        accessToken,
        projectId: serviceAccount.project_id,
        token: row.token,
        title: campaign.title,
        body: campaign.body,
        data: {
          url: deepLink,
          campaignId: campaign.id,
        },
        origin,
      });

      const fcmError =
        (result.payload as { error?: { status?: string; message?: string } })?.error?.status ||
        (result.payload as { error?: { message?: string } })?.error?.message ||
        null;
      const fcmName = (result.payload as { name?: string })?.name || null;

      if (result.ok) {
        sent += 1;
        await adminClient.from('push_campaign_deliveries').insert({
          campaign_id: campaign.id,
          user_id: userId,
          token_suffix: String(row.token).slice(-12),
          status: 'sent',
          fcm_name: fcmName,
          sent_at: new Date().toISOString(),
        });
      } else {
        failed += 1;
        await adminClient.from('push_campaign_deliveries').insert({
          campaign_id: campaign.id,
          user_id: userId,
          token_suffix: String(row.token).slice(-12),
          status: 'failed',
          error: typeof fcmError === 'string' ? fcmError : `HTTP ${result.status}`,
          fcm_name: fcmName,
        });
        if (
          typeof fcmError === 'string' &&
          /UNREGISTERED|INVALID_ARGUMENT|NOT_FOUND/i.test(fcmError)
        ) {
          await adminClient.from('user_push_tokens').delete().eq('token', row.token);
        }
      }
    }
  }

  const finalStatus = sent > 0 ? 'sent' : failed > 0 ? 'failed' : 'sent';
  const completedAt = new Date().toISOString();
  await adminClient
    .from('push_campaigns')
    .update({
      status: finalStatus,
      completed_at: completedAt,
      updated_at: completedAt,
      stats: { targeted, sent, failed },
    })
    .eq('id', campaign.id);

  console.log(
    JSON.stringify({
      msg: 'admin campaign done',
      campaignId: campaign.id,
      targeted,
      sent,
      failed,
      finalStatus,
    }),
  );

  return { targeted, sent, failed, status: finalStatus };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json(405, { success: false, error: 'Method not allowed' });
  }

  const authHeader = req.headers.get('Authorization') || '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const cronSecret = Deno.env.get('PUSH_CRON_SECRET') || '';

  if (!supabaseUrl || !supabaseAnonKey) {
    return json(500, { success: false, error: 'Missing Supabase environment variables' });
  }

  let serviceAccount: ServiceAccount;
  try {
    serviceAccount = loadServiceAccount();
  } catch (err) {
    return json(500, {
      success: false,
      error: err instanceof Error ? err.message : 'Service account error',
    });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json(400, { success: false, error: 'Invalid JSON payload' });
  }

  const action = String(body.action || '');
  const origin = resolveOrigin(req);

  const isCron =
    Boolean(cronSecret && req.headers.get('x-cron-secret') === cronSecret) ||
    Boolean(serviceRoleKey && authHeader === `Bearer ${serviceRoleKey}`);

  const adminClient = createClient(
    supabaseUrl,
    serviceRoleKey || supabaseAnonKey,
    serviceRoleKey
      ? { auth: { persistSession: false, autoRefreshToken: false } }
      : { global: { headers: { Authorization: authHeader } } },
  );

  // --- Cron / due scheduled campaigns ---
  if (action === 'admin_process_due') {
    if (!isCron) {
      // Also allow signed-in admins to flush due jobs from the UI
      if (!authHeader) {
        return json(401, { success: false, error: 'Missing authorization' });
      }
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const {
        data: { user },
        error: userError,
      } = await userClient.auth.getUser();
      if (userError || !user) {
        return json(401, { success: false, error: 'Unauthorized' });
      }
      try {
        await assertAdmin(userClient, user.id);
      } catch (err) {
        return json(403, {
          success: false,
          error: err instanceof Error ? err.message : 'Forbidden',
        });
      }
    }

    const { data: due, error: dueError } = await adminClient
      .from('push_campaigns')
      .select('id, title, body, image_url, deep_link_url, audience_type, cohort_id, status')
      .eq('status', 'scheduled')
      .lte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(10);

    if (dueError) {
      return json(500, { success: false, error: dueError.message });
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

    const processed = [];
    for (const campaign of (due || []) as CampaignRow[]) {
      const result = await executeCampaign({
        adminClient,
        serviceAccount,
        campaign,
        origin,
        accessToken,
      });
      processed.push({ campaignId: campaign.id, ...result });
    }

    return json(200, { success: true, processed, count: processed.length });
  }

  // --- Authenticated user actions ---
  if (!authHeader) {
    return json(401, { success: false, error: 'Missing authorization header' });
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

  // --- Admin send campaign ---
  if (action === 'admin_send_campaign') {
    try {
      await assertAdmin(supabase, user.id);
    } catch (err) {
      return json(403, {
        success: false,
        error: err instanceof Error ? err.message : 'Forbidden',
      });
    }

    const campaignId = String(body.campaignId || '');
    if (!campaignId) {
      return json(400, { success: false, error: 'campaignId is required' });
    }

    const { data: campaign, error: campaignError } = await adminClient
      .from('push_campaigns')
      .select('id, title, body, image_url, deep_link_url, audience_type, cohort_id, status')
      .eq('id', campaignId)
      .maybeSingle();

    if (campaignError || !campaign) {
      return json(404, { success: false, error: campaignError?.message || 'Campaign not found' });
    }

    if (!['draft', 'scheduled', 'failed'].includes(campaign.status)) {
      return json(400, {
        success: false,
        error: `Campaign cannot be sent from status "${campaign.status}"`,
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

    const result = await executeCampaign({
      adminClient,
      serviceAccount,
      campaign: campaign as CampaignRow,
      origin,
      accessToken,
    });

    return json(200, { success: result.sent > 0 || result.targeted === 0, ...result });
  }

  // --- send_to_self (unchanged behavior) ---
  if (action !== 'send_to_self') {
    return json(400, {
      success: false,
      error: 'Unsupported action. Use send_to_self, admin_send_campaign, or admin_process_due.',
    });
  }

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

    if (
      !result.ok &&
      typeof summary.fcmError === 'string' &&
      /UNREGISTERED|INVALID_ARGUMENT|NOT_FOUND/i.test(summary.fcmError)
    ) {
      await supabase.from('user_push_tokens').delete().eq('token', row.token);
    }
  }

  const sent = results.filter((r) => r.ok).length;
  return json(200, {
    success: sent > 0,
    sent,
    total: results.length,
    results,
    error: sent === 0 ? 'All FCM sends failed' : undefined,
  });
});
