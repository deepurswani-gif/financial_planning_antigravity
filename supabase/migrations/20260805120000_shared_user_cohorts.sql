-- Shared cohorts platform (push + future analytics)
-- Materialized membership; live FCM tokens still come from user_push_tokens at send time.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.cohorts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  rules jsonb not null default '{"op":"and","filters":[]}'::jsonb,
  status text not null default 'active'
    check (status in ('active', 'archived')),
  member_count integer not null default 0,
  last_refreshed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists cohorts_active_name_uidx
  on public.cohorts (lower(name))
  where status = 'active';

create table if not exists public.cohort_members (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  cohort_name text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text,
  email text,
  fcm_token text,
  has_push_enabled boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  refreshed_at timestamptz not null default timezone('utc'::text, now()),
  constraint cohort_members_cohort_user_key unique (cohort_id, user_id)
);

create index if not exists cohort_members_cohort_id_idx
  on public.cohort_members (cohort_id);

create index if not exists cohort_members_user_id_idx
  on public.cohort_members (user_id);

comment on table public.cohorts is
  'Reusable audience definitions for push campaigns and future analytics.';
comment on table public.cohort_members is
  'Materialized cohort membership snapshot; fcm_token is informational — send uses user_push_tokens.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.cohorts enable row level security;
alter table public.cohort_members enable row level security;

drop policy if exists "Admins manage cohorts" on public.cohorts;
create policy "Admins manage cohorts"
  on public.cohorts
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins manage cohort members" on public.cohort_members;
create policy "Admins manage cohort members"
  on public.cohort_members
  for all
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.cohorts to authenticated;
grant select, insert, update, delete on public.cohort_members to authenticated;

-- ---------------------------------------------------------------------------
-- Rule matcher → user_ids from plan facts
-- rules: { "op": "and", "filters": [ { "type": "has_sip" }, { "type": "income_gte", "amount": 100000 } ] }
-- ---------------------------------------------------------------------------
create or replace function public.admin_cohort_match_user_ids(p_rules jsonb)
returns table (user_id uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  filters jsonb := coalesce(p_rules->'filters', '[]'::jsonb);
  filter_count integer := jsonb_array_length(filters);
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  if filter_count is null or filter_count = 0 then
    return;
  end if;

  return query
  select distinct f.user_id
  from public.v_plan_analytics_facts f
  where
    -- every filter must match (AND)
    (
      select bool_and(
        case coalesce(elem->>'type', '')
          when 'has_sip' then coalesce(f.sip_monthly, 0) > 0
          when 'income_gte' then coalesce(f.income_monthly, 0) >= coalesce((elem->>'amount')::numeric, 0)
          when 'no_life_insurance' then coalesce(f.has_life_insurance, false) = false
          when 'no_health_insurance' then coalesce(f.has_health_insurance, false) = false
          when 'protection_gap' then coalesce(f.protection_gap, 0) > 0
          else false
        end
      )
      from jsonb_array_elements(filters) elem
    );
end;
$$;

revoke all on function public.admin_cohort_match_user_ids(jsonb) from public;
grant execute on function public.admin_cohort_match_user_ids(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Preview: count + sample rows (before save)
-- ---------------------------------------------------------------------------
create or replace function public.admin_cohort_preview(p_rules jsonb, p_sample_limit integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_sample jsonb;
  v_limit integer := greatest(1, least(coalesce(p_sample_limit, 20), 50));
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select count(*)::integer into v_count
  from public.admin_cohort_match_user_ids(p_rules) matched;

  select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb)
  into v_sample
  from (
    select
      m.user_id,
      coalesce(up.full_name, f.user_full_name, f.client_name) as display_name,
      coalesce(up.email, f.user_email, f.client_email) as email,
      coalesce(f.sip_monthly, 0) as sip_monthly,
      coalesce(f.income_monthly, 0) as income_monthly,
      coalesce(f.has_life_insurance, false) as has_life_insurance,
      coalesce(f.has_health_insurance, false) as has_health_insurance,
      coalesce(f.protection_gap, 0) as protection_gap,
      exists (
        select 1 from public.user_push_tokens t
        where t.user_id = m.user_id and t.enabled = true
      ) as has_push_enabled
    from public.admin_cohort_match_user_ids(p_rules) m
    left join public.user_profiles up on up.id = m.user_id
    left join lateral (
      select
        f2.user_full_name,
        f2.client_name,
        f2.user_email,
        f2.client_email,
        f2.sip_monthly,
        f2.income_monthly,
        f2.has_life_insurance,
        f2.has_health_insurance,
        f2.protection_gap
      from public.v_plan_analytics_facts f2
      where f2.user_id = m.user_id
      limit 1
    ) f on true
    order by coalesce(up.full_name, up.email, m.user_id::text)
    limit v_limit
  ) s;

  return jsonb_build_object(
    'count', coalesce(v_count, 0),
    'sample', coalesce(v_sample, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_cohort_preview(jsonb, integer) from public;
grant execute on function public.admin_cohort_preview(jsonb, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Refresh: rebuild cohort_members for a cohort
-- ---------------------------------------------------------------------------
create or replace function public.admin_cohort_refresh(p_cohort_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cohort public.cohorts%rowtype;
  v_now timestamptz := timezone('utc'::text, now());
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select * into v_cohort
  from public.cohorts
  where id = p_cohort_id
  for update;

  if not found then
    raise exception 'cohort not found';
  end if;

  if v_cohort.status = 'archived' then
    raise exception 'cannot refresh archived cohort';
  end if;

  delete from public.cohort_members where cohort_id = p_cohort_id;

  insert into public.cohort_members (
    cohort_id,
    cohort_name,
    user_id,
    display_name,
    email,
    fcm_token,
    has_push_enabled,
    created_at,
    refreshed_at
  )
  select
    v_cohort.id,
    v_cohort.name,
    m.user_id,
    coalesce(up.full_name, f.user_full_name, f.client_name),
    coalesce(up.email, f.user_email, f.client_email),
    tok.token,
    tok.token is not null,
    v_now,
    v_now
  from public.admin_cohort_match_user_ids(v_cohort.rules) m
  left join public.user_profiles up on up.id = m.user_id
  left join lateral (
    select * from public.v_plan_analytics_facts f2
    where f2.user_id = m.user_id
    limit 1
  ) f on true
  left join lateral (
    select t.token
    from public.user_push_tokens t
    where t.user_id = m.user_id and t.enabled = true
    order by t.updated_at desc nulls last
    limit 1
  ) tok on true;

  get diagnostics v_count = row_count;

  update public.cohorts
  set
    member_count = coalesce(v_count, 0),
    last_refreshed_at = v_now,
    updated_at = v_now
  where id = p_cohort_id;

  return jsonb_build_object(
    'cohort_id', p_cohort_id,
    'member_count', coalesce(v_count, 0),
    'refreshed_at', v_now
  );
end;
$$;

revoke all on function public.admin_cohort_refresh(uuid) from public;
grant execute on function public.admin_cohort_refresh(uuid) to authenticated;
