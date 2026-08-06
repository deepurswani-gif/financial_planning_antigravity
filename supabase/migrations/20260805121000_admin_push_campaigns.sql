-- Admin push campaigns: templates, campaigns, deliveries
-- Audience: all_push | cohort (FK to shared cohorts)

create table if not exists public.push_notification_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  title text not null,
  body text not null,
  image_url text,
  deep_link_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.push_campaigns (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.push_notification_templates(id) on delete set null,
  title text not null,
  body text not null,
  image_url text,
  deep_link_url text,
  audience_type text not null default 'all_push'
    check (audience_type in ('all_push', 'cohort')),
  cohort_id uuid references public.cohorts(id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled')),
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  stats jsonb not null default '{"targeted":0,"sent":0,"failed":0}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint push_campaigns_cohort_required check (
    audience_type <> 'cohort' or cohort_id is not null
  )
);

create index if not exists push_campaigns_status_scheduled_idx
  on public.push_campaigns (status, scheduled_at)
  where status = 'scheduled';

create table if not exists public.push_campaign_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.push_campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  token_suffix text,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'failed', 'skipped')),
  fcm_name text,
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists push_campaign_deliveries_campaign_id_idx
  on public.push_campaign_deliveries (campaign_id);

create index if not exists push_campaign_deliveries_user_id_idx
  on public.push_campaign_deliveries (user_id);

comment on table public.push_notification_templates is
  'Saved push notification designs for admin reuse.';
comment on table public.push_campaigns is
  'Admin push send/schedule jobs targeting all_push or a shared cohort.';
comment on table public.push_campaign_deliveries is
  'Per-user/token delivery outcomes for push campaigns.';

alter table public.push_notification_templates enable row level security;
alter table public.push_campaigns enable row level security;
alter table public.push_campaign_deliveries enable row level security;

drop policy if exists "Admins manage push templates" on public.push_notification_templates;
create policy "Admins manage push templates"
  on public.push_notification_templates
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins manage push campaigns" on public.push_campaigns;
create policy "Admins manage push campaigns"
  on public.push_campaigns
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins manage push deliveries" on public.push_campaign_deliveries;
create policy "Admins manage push deliveries"
  on public.push_campaign_deliveries
  for all
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.push_notification_templates to authenticated;
grant select, insert, update, delete on public.push_campaigns to authenticated;
grant select, insert, update, delete on public.push_campaign_deliveries to authenticated;

-- Optional: schedule processing via pg_cron (enable extension in dashboard if needed).
-- Example (run manually after deploy; replace PROJECT_REF and SERVICE_ROLE_KEY):
--   select cron.schedule(
--     'process-push-campaigns',
--     '* * * * *',
--     $$
--     select net.http_post(
--       url := 'https://PROJECT_REF.supabase.co/functions/v1/send-push-notification',
--       headers := jsonb_build_object(
--         'Content-Type', 'application/json',
--         'Authorization', 'Bearer SERVICE_ROLE_KEY'
--       ),
--       body := '{"action":"admin_process_due"}'::jsonb
--     );
--     $$
--   );
