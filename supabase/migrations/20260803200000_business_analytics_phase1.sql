-- Business Analytics Phase 1
-- Extensible admin analytics: facts view, KPI/drilldown RPCs, filter presets,
-- and Phase 2 analytics_events scaffold.

-- ---------------------------------------------------------------------------
-- 0. Ensure readiness snapshots table exists (may already exist in prod)
-- ---------------------------------------------------------------------------
create table if not exists public.financial_readiness_snapshots (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  plan_id uuid references public.financial_plans(id) on delete cascade not null,
  snapshot_month date not null,
  total_score numeric,
  overall_category text,
  confidence_pct numeric,
  pillars jsonb default '[]'::jsonb,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null,
  unique (user_id, plan_id, snapshot_month)
);

alter table public.financial_readiness_snapshots enable row level security;

drop policy if exists "Admins can select all readiness snapshots" on public.financial_readiness_snapshots;
create policy "Admins can select all readiness snapshots"
  on public.financial_readiness_snapshots
  for select
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 1. Phase 2 event scaffold (empty until instrumentation)
-- ---------------------------------------------------------------------------
create table if not exists public.analytics_events (
  id uuid default gen_random_uuid() primary key,
  occurred_at timestamptz not null default timezone('utc'::text, now()),
  user_id uuid references auth.users(id) on delete set null,
  plan_id uuid references public.financial_plans(id) on delete set null,
  session_id text,
  event_name text not null,
  event_category text not null default 'product',
  screen text,
  component text,
  feature text,
  properties jsonb not null default '{}'::jsonb,
  device jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists analytics_events_occurred_at_idx
  on public.analytics_events (occurred_at desc);
create index if not exists analytics_events_user_id_idx
  on public.analytics_events (user_id);
create index if not exists analytics_events_name_idx
  on public.analytics_events (event_name);
create index if not exists analytics_events_category_idx
  on public.analytics_events (event_category);
create index if not exists analytics_events_props_gin
  on public.analytics_events using gin (properties);

alter table public.analytics_events enable row level security;

drop policy if exists "Users can insert own analytics events" on public.analytics_events;
create policy "Users can insert own analytics events"
  on public.analytics_events
  for insert
  with check (auth.uid() is not null and (user_id is null or user_id = auth.uid()));

drop policy if exists "Admins can select all analytics events" on public.analytics_events;
create policy "Admins can select all analytics events"
  on public.analytics_events
  for select
  using (public.is_admin());

grant select, insert on public.analytics_events to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Saved hyper-filter presets
-- ---------------------------------------------------------------------------
create table if not exists public.analytics_filter_presets (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  filter_tree jsonb not null default '{"op":"AND","conditions":[]}'::jsonb,
  is_shared boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists analytics_filter_presets_owner_idx
  on public.analytics_filter_presets (owner_id);

alter table public.analytics_filter_presets enable row level security;

drop policy if exists "Admins manage own filter presets" on public.analytics_filter_presets;
create policy "Admins manage own filter presets"
  on public.analytics_filter_presets
  for all
  using (public.is_admin() and owner_id = auth.uid())
  with check (public.is_admin() and owner_id = auth.uid());

drop policy if exists "Admins read shared filter presets" on public.analytics_filter_presets;
create policy "Admins read shared filter presets"
  on public.analytics_filter_presets
  for select
  using (public.is_admin() and is_shared = true);

grant select, insert, update, delete on public.analytics_filter_presets to authenticated;

-- ---------------------------------------------------------------------------
-- 3. JSON helpers for plan metric extraction
-- ---------------------------------------------------------------------------
create or replace function public.analytics_num(val text)
returns numeric
language sql
immutable
as $$
  select case
    when val is null or btrim(val) = '' then 0
    when val ~ '^-?[0-9]+(\.[0-9]+)?$' then val::numeric
    else 0
  end;
$$;

create or replace function public.analytics_json_num(j jsonb, key text)
returns numeric
language sql
immutable
as $$
  select case
    when j is null then 0
    when jsonb_typeof(j -> key) = 'number' then (j ->> key)::numeric
    when jsonb_typeof(j -> key) = 'string' then public.analytics_num(j ->> key)
    when jsonb_typeof(j -> key) = 'object' then public.analytics_num(j -> key ->> 'amount')
    else 0
  end;
$$;

create or replace function public.analytics_savings_sip(expense jsonb)
returns numeric
language sql
immutable
as $$
  select greatest(
    public.analytics_json_num(expense, 'summaryMonthlyInvestments'),
    public.analytics_json_num(coalesce(expense -> 'savings', '{}'::jsonb), 'sip')
      + public.analytics_json_num(coalesce(expense -> 'savings', '{}'::jsonb), 'ppf')
      + public.analytics_json_num(coalesce(expense -> 'savings', '{}'::jsonb), 'nps')
  );
$$;

create or replace function public.analytics_household_monthly(expense jsonb)
returns numeric
language sql
immutable
as $$
  select public.analytics_json_num(expense, 'summaryHouseholdTotal');
$$;

create or replace function public.analytics_emi_monthly(expense jsonb)
returns numeric
language sql
immutable
as $$
  select public.analytics_json_num(expense, 'summaryEmiTotal');
$$;

create or replace function public.analytics_insurance_monthly(expense jsonb)
returns numeric
language sql
immutable
as $$
  select public.analytics_json_num(expense, 'summaryInsuranceTotal')
    + public.analytics_json_num(coalesce(expense -> 'insurance', '{}'::jsonb), 'health')
    + public.analytics_json_num(coalesce(expense -> 'insurance', '{}'::jsonb), 'car')
    + public.analytics_json_num(coalesce(expense -> 'insurance', '{}'::jsonb), 'bike');
$$;

create or replace function public.analytics_income_monthly(income jsonb)
returns numeric
language sql
immutable
as $$
  select
    public.analytics_json_num(income, 'self')
    + public.analytics_json_num(income, 'spouse')
    + public.analytics_json_num(income, 'family')
    + public.analytics_json_num(income, 'selfBonus') / 12.0
    + public.analytics_json_num(income, 'spouseBonus') / 12.0
    + public.analytics_json_num(income, 'bonus') / 12.0
    + public.analytics_json_num(income, 'passive')
    + public.analytics_json_num(coalesce(income -> 'selfDetail', '{}'::jsonb), 'inHandSalary')
    + public.analytics_json_num(coalesce(income -> 'selfDetail', '{}'::jsonb), 'takeHomeProfit')
    + public.analytics_json_num(coalesce(income -> 'selfDetail', '{}'::jsonb), 'netPension')
    + public.analytics_json_num(coalesce(income -> 'selfDetail', '{}'::jsonb), 'passiveIncome')
    + public.analytics_json_num(coalesce(income -> 'spouseDetail', '{}'::jsonb), 'inHandSalary')
    + public.analytics_json_num(coalesce(income -> 'spouseDetail', '{}'::jsonb), 'takeHomeProfit');
$$;

create or replace function public.analytics_asset_total(assets jsonb)
returns numeric
language sql
immutable
as $$
  select
    public.analytics_json_num(assets, 'summaryPortfolioValue')
    + public.analytics_json_num(assets, 'summaryLiquidCash')
    + public.analytics_json_num(assets, 'summaryRealEstateAssets');
$$;

create or replace function public.analytics_liability_total(liab jsonb)
returns numeric
language sql
immutable
as $$
  select
    public.analytics_json_num(liab, 'summaryOutstandingLoans')
    + public.analytics_json_num(liab, 'summaryCreditCardDues')
    + public.analytics_json_num(liab, 'summaryOtherPayables');
$$;

create or replace function public.analytics_life_cover(plan public.financial_plans)
returns numeric
language sql
immutable
as $$
  select coalesce(plan.summary_life_cover, 0);
$$;

create or replace function public.analytics_health_cover(plan public.financial_plans)
returns numeric
language sql
immutable
as $$
  select coalesce(plan.summary_health_cover, 0);
$$;

create or replace function public.analytics_has_vehicle_insurance(expense jsonb)
returns boolean
language sql
immutable
as $$
  select
    public.analytics_json_num(coalesce(expense -> 'insurance', '{}'::jsonb), 'car') > 0
    or public.analytics_json_num(coalesce(expense -> 'insurance', '{}'::jsonb), 'bike') > 0;
$$;

create or replace function public.analytics_has_life_insurance_asset(assets jsonb)
returns boolean
language sql
immutable
as $$
  select
    public.analytics_json_num(coalesce(assets -> 'insurance', '{}'::jsonb), 'savingPlans') > 0
    or public.analytics_json_num(coalesce(assets -> 'insurance', '{}'::jsonb), 'ulip') > 0;
$$;

create or replace function public.analytics_goal_count(goals jsonb)
returns integer
language sql
immutable
as $$
  select case
    when goals is null or jsonb_typeof(goals) <> 'array' then 0
    else jsonb_array_length(goals)
  end;
$$;

create or replace function public.analytics_wealthmap_status(plan public.financial_plans)
returns text
language sql
immutable
as $$
  select case
    when plan.summary_report_generated_at is not null then 'completed'
    when coalesce(plan.current_step, 1) >= 6
      or public.analytics_goal_count(plan.goals) > 0 then 'in_progress'
    when plan.family_members is not null
      and jsonb_typeof(plan.family_members) = 'array'
      and jsonb_array_length(plan.family_members) > 0 then 'started'
    else 'not_started'
  end;
$$;

create or replace function public.analytics_funnel_step(plan public.financial_plans)
returns integer
language sql
immutable
as $$
  -- 0 reg implied by profile; 1 profile … 8 wealthmap complete
  select case
    when plan.summary_report_generated_at is not null then 8
    when public.analytics_goal_count(plan.goals) > 0 then 7
    when public.analytics_liability_total(plan.liability_categories) > 0
      or (plan.liability_categories ? 'summaryOutstandingLoans') then 6
    when public.analytics_asset_total(plan.asset_categories) > 0 then 5
    when public.analytics_savings_sip(plan.expense_categories) > 0
      or public.analytics_json_num(plan.expense_categories, 'summaryOtherSavings') > 0 then 4
    when public.analytics_income_monthly(plan.income) > 0
      or public.analytics_household_monthly(plan.expense_categories) > 0 then 3
    when plan.family_members is not null
      and jsonb_typeof(plan.family_members) = 'array'
      and jsonb_array_length(plan.family_members) > 0 then 2
    else 1
  end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Plan analytics facts view (one row per active plan + user)
-- ---------------------------------------------------------------------------
create or replace view public.v_plan_analytics_facts
with (security_invoker = true)
as
with latest_readiness as (
  select distinct on (plan_id)
    plan_id,
    total_score,
    overall_category,
    confidence_pct,
    snapshot_month,
    pillars
  from public.financial_readiness_snapshots
  order by plan_id, snapshot_month desc
)
select
  p.id as plan_id,
  p.user_id,
  p.agent_id,
  p.plan_name,
  p.client_name,
  p.client_email,
  p.current_step,
  p.summary_report_generated_at,
  p.created_at as plan_created_at,
  p.updated_at as plan_updated_at,
  p.is_active,
  up.email as user_email,
  up.full_name as user_full_name,
  up.role as user_role,
  up.subscription_active,
  up.subscription_valid_until,
  up.created_at as user_created_at,
  up.updated_at as user_updated_at,
  agent.full_name as advisor_name,
  agent.email as advisor_email,
  agent.company_name as advisor_company,
  public.analytics_wealthmap_status(p) as wealthmap_status,
  public.analytics_funnel_step(p) as funnel_step,
  (p.summary_report_generated_at is not null) as wealthmap_completed,
  public.analytics_income_monthly(p.income) as income_monthly,
  public.analytics_household_monthly(p.expense_categories) as household_monthly,
  public.analytics_emi_monthly(p.expense_categories) as emi_monthly,
  public.analytics_insurance_monthly(p.expense_categories) as insurance_premium_monthly,
  public.analytics_savings_sip(p.expense_categories) as sip_monthly,
  greatest(
    0,
    public.analytics_income_monthly(p.income)
      - public.analytics_household_monthly(p.expense_categories)
      - public.analytics_emi_monthly(p.expense_categories)
      - public.analytics_insurance_monthly(p.expense_categories)
  ) as monthly_surplus,
  greatest(
    0,
    public.analytics_income_monthly(p.income)
      - public.analytics_household_monthly(p.expense_categories)
      - public.analytics_emi_monthly(p.expense_categories)
      - public.analytics_insurance_monthly(p.expense_categories)
      - public.analytics_savings_sip(p.expense_categories)
  ) as unallocated_surplus,
  public.analytics_asset_total(p.asset_categories) as assets_total,
  public.analytics_liability_total(p.liability_categories) as liabilities_total,
  public.analytics_asset_total(p.asset_categories)
    - public.analytics_liability_total(p.liability_categories) as net_worth,
  coalesce(p.summary_life_cover, 0) as life_cover,
  coalesce(p.summary_health_cover, 0) as health_cover,
  coalesce(p.has_life_insurance, false) as has_life_insurance,
  coalesce(p.has_health_insurance, false) as has_health_insurance,
  public.analytics_has_vehicle_insurance(p.expense_categories) as has_vehicle_insurance,
  public.analytics_has_life_insurance_asset(p.asset_categories) as portfolio_has_life_insurance,
  greatest(
    0,
    (public.analytics_household_monthly(p.expense_categories)
      + public.analytics_emi_monthly(p.expense_categories)) * 200
      - coalesce(p.summary_life_cover, 0)
  ) as protection_gap,
  greatest(0, 1000000 - coalesce(p.summary_health_cover, 0)) as health_insurance_gap,
  public.analytics_goal_count(p.goals) as goal_count,
  coalesce(lr.total_score, null) as wellness_score,
  lr.overall_category as wellness_category,
  lr.confidence_pct as wellness_confidence,
  (
    select public.analytics_num(elem->>'score')
    from jsonb_array_elements(coalesce(lr.pillars, '[]'::jsonb)) elem
    where elem->>'id' = 'goal-readiness'
    limit 1
  ) as goal_readiness_score,
  (
    select public.analytics_num(elem->>'score')
    from jsonb_array_elements(coalesce(lr.pillars, '[]'::jsonb)) elem
    where elem->>'id' = 'wealth-building'
    limit 1
  ) as wealth_building_score,
  coalesce(p.contingency_fund, 0) as contingency_fund,
  case
    when public.analytics_goal_count(p.goals) = 0 then 'none'
    when p.summary_report_generated_at is not null then 'active'
    else 'defined'
  end as goal_status
from public.financial_plans p
join public.user_profiles up on up.id = p.user_id
left join public.user_profiles agent on agent.id = p.agent_id
left join latest_readiness lr on lr.plan_id = p.id
where p.is_active = true
  and up.role = 'user';

grant select on public.v_plan_analytics_facts to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Filter application helper
-- ---------------------------------------------------------------------------
create or replace function public.analytics_fact_matches_filters(
  f public.v_plan_analytics_facts,
  filters jsonb
)
returns boolean
language plpgsql
stable
as $$
declare
  date_from timestamptz;
  date_to timestamptz;
  advisor_id uuid;
  activity text;
  wm_status text;
  goal_status text;
  wellness_min numeric;
  wellness_max numeric;
  invest_min numeric;
  invest_max numeric;
  sip_min numeric;
  sip_max numeric;
  ins_min numeric;
  ins_max numeric;
  nw_min numeric;
  nw_max numeric;
  cond jsonb;
  op text;
  field text;
  operator text;
  value text;
  num_value numeric;
  matched boolean;
  group_op text;
  group_ok boolean;
  conds jsonb;
  i int;
begin
  if filters is null or filters = '{}'::jsonb then
    return true;
  end if;

  date_from := nullif(filters->>'dateFrom', '')::timestamptz;
  date_to := nullif(filters->>'dateTo', '')::timestamptz;
  if date_from is not null and f.user_created_at < date_from then
    return false;
  end if;
  if date_to is not null and f.user_created_at > date_to then
    return false;
  end if;

  if filters ? 'advisorId' and nullif(filters->>'advisorId', '') is not null then
    advisor_id := (filters->>'advisorId')::uuid;
    if f.agent_id is distinct from advisor_id then
      return false;
    end if;
  end if;

  activity := nullif(filters->>'userActivity', '');
  if activity = 'active_30d' and (f.user_updated_at is null or f.user_updated_at < now() - interval '30 days') then
    return false;
  elsif activity = 'inactive_30d' and f.user_updated_at >= now() - interval '30 days' then
    return false;
  elsif activity = 'active_7d' and (f.user_updated_at is null or f.user_updated_at < now() - interval '7 days') then
    return false;
  elsif activity = 'inactive_90d' and f.user_updated_at >= now() - interval '90 days' then
    return false;
  end if;

  wm_status := nullif(filters->>'wealthmapStatus', '');
  if wm_status is not null and f.wealthmap_status <> wm_status then
    return false;
  end if;

  goal_status := nullif(filters->>'goalStatus', '');
  if goal_status is not null and f.goal_status <> goal_status then
    return false;
  end if;

  wellness_min := nullif(filters->>'wellnessMin', '')::numeric;
  wellness_max := nullif(filters->>'wellnessMax', '')::numeric;
  if wellness_min is not null and (f.wellness_score is null or f.wellness_score < wellness_min) then
    return false;
  end if;
  if wellness_max is not null and (f.wellness_score is null or f.wellness_score > wellness_max) then
    return false;
  end if;

  invest_min := nullif(filters->>'investmentMin', '')::numeric;
  invest_max := nullif(filters->>'investmentMax', '')::numeric;
  if invest_min is not null and coalesce(f.assets_total, 0) < invest_min then
    return false;
  end if;
  if invest_max is not null and coalesce(f.assets_total, 0) > invest_max then
    return false;
  end if;

  sip_min := nullif(filters->>'sipMin', '')::numeric;
  sip_max := nullif(filters->>'sipMax', '')::numeric;
  if sip_min is not null and coalesce(f.sip_monthly, 0) < sip_min then
    return false;
  end if;
  if sip_max is not null and coalesce(f.sip_monthly, 0) > sip_max then
    return false;
  end if;

  ins_min := nullif(filters->>'insuranceMin', '')::numeric;
  ins_max := nullif(filters->>'insuranceMax', '')::numeric;
  if ins_min is not null and (coalesce(f.life_cover, 0) + coalesce(f.health_cover, 0)) < ins_min then
    return false;
  end if;
  if ins_max is not null and (coalesce(f.life_cover, 0) + coalesce(f.health_cover, 0)) > ins_max then
    return false;
  end if;

  nw_min := nullif(filters->>'netWorthMin', '')::numeric;
  nw_max := nullif(filters->>'netWorthMax', '')::numeric;
  if nw_min is not null and coalesce(f.net_worth, 0) < nw_min then
    return false;
  end if;
  if nw_max is not null and coalesce(f.net_worth, 0) > nw_max then
    return false;
  end if;

  -- Hyper filter tree: { op: AND|OR, conditions: [{ field, op, value }] }
  if filters ? 'hyper' and filters->'hyper' is not null then
    group_op := upper(coalesce(filters->'hyper'->>'op', 'AND'));
    conds := coalesce(filters->'hyper'->'conditions', '[]'::jsonb);
    if jsonb_typeof(conds) = 'array' and jsonb_array_length(conds) > 0 then
      group_ok := case when group_op = 'OR' then false else true end;
      for i in 0 .. jsonb_array_length(conds) - 1 loop
        cond := conds -> i;
        field := cond->>'field';
        operator := lower(coalesce(cond->>'op', 'eq'));
        value := cond->>'value';
        matched := false;

        if field = 'wealthmap_status' then
          matched := case operator
            when 'eq' then f.wealthmap_status = value
            when 'neq' then f.wealthmap_status <> value
            else false
          end;
        elsif field = 'goal_status' then
          matched := case operator
            when 'eq' then f.goal_status = value
            when 'neq' then f.goal_status <> value
            else false
          end;
        elsif field = 'advisor_id' then
          matched := case operator
            when 'eq' then f.agent_id::text = value
            when 'neq' then f.agent_id::text is distinct from value
            when 'is_null' then f.agent_id is null
            when 'not_null' then f.agent_id is not null
            else false
          end;
        elsif field in ('wellness_score','sip_monthly','net_worth','protection_gap','assets_total','monthly_surplus') then
          num_value := nullif(value, '')::numeric;
          matched := case
            when operator = 'is_null' then
              case field
                when 'wellness_score' then f.wellness_score is null
                when 'sip_monthly' then f.sip_monthly is null
                when 'net_worth' then f.net_worth is null
                when 'protection_gap' then f.protection_gap is null
                when 'assets_total' then f.assets_total is null
                else f.monthly_surplus is null
              end
            when num_value is null then false
            when field = 'wellness_score' then
              case operator when 'gte' then f.wellness_score >= num_value when 'lte' then f.wellness_score <= num_value when 'eq' then f.wellness_score = num_value else false end
            when field = 'sip_monthly' then
              case operator when 'gte' then f.sip_monthly >= num_value when 'lte' then f.sip_monthly <= num_value when 'eq' then f.sip_monthly = num_value else false end
            when field = 'net_worth' then
              case operator when 'gte' then f.net_worth >= num_value when 'lte' then f.net_worth <= num_value when 'eq' then f.net_worth = num_value else false end
            when field = 'protection_gap' then
              case operator when 'gte' then f.protection_gap >= num_value when 'lte' then f.protection_gap <= num_value when 'eq' then f.protection_gap = num_value else false end
            when field = 'assets_total' then
              case operator when 'gte' then f.assets_total >= num_value when 'lte' then f.assets_total <= num_value when 'eq' then f.assets_total = num_value else false end
            else
              case operator when 'gte' then f.monthly_surplus >= num_value when 'lte' then f.monthly_surplus <= num_value when 'eq' then f.monthly_surplus = num_value else false end
          end;
        elsif field = 'subscription_active' then
          matched := case operator
            when 'eq' then f.subscription_active = (value in ('true','1','yes'))
            else false
          end;
        end if;

        if group_op = 'OR' then
          group_ok := group_ok or matched;
        else
          group_ok := group_ok and matched;
        end if;
      end loop;
      if not group_ok then
        return false;
      end if;
    end if;
  end if;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Admin RPCs
-- ---------------------------------------------------------------------------
create or replace function public.admin_analytics_executive(filters jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  with facts as (
    select * from public.v_plan_analytics_facts f
    where public.analytics_fact_matches_filters(f, filters)
  ),
  users as (
    select distinct user_id from facts
  ),
  revenue as (
    select
      coalesce(sum(ct.amount_inr) filter (where ct.status = 'SUCCESS'), 0) as total_revenue,
      count(*) filter (where ct.status = 'SUCCESS') as successful_checkouts
    from public.checkout_transactions ct
    where exists (
      select 1 from facts f where f.user_id = ct.user_id
    )
    and (
      nullif(filters->>'dateFrom','') is null
      or ct.created_at >= (filters->>'dateFrom')::timestamptz
    )
    and (
      nullif(filters->>'dateTo','') is null
      or ct.created_at <= (filters->>'dateTo')::timestamptz
    )
  ),
  profile_scope as (
    select
      count(*)::int as total_users,
      count(*) filter (
        where created_at >= coalesce((filters->>'dateFrom')::timestamptz, '-infinity'::timestamptz)
          and created_at <= coalesce((filters->>'dateTo')::timestamptz, 'infinity'::timestamptz)
      )::int as new_users,
      count(*) filter (where subscription_active = true)::int as subscribed_users
    from public.user_profiles
    where role = 'user'
      and (
        nullif(filters->>'advisorId','') is null
        or id in (select user_id from facts)
      )
  ),
  advisors as (
    select
      count(distinct agent_id) filter (where agent_id is not null)::int as advisor_count,
      count(*) filter (where agent_id is not null)::int as advised_clients
    from facts
  )
  select jsonb_build_object(
    'generatedAt', timezone('utc', now()),
    'phase', 1,
    'kpis', jsonb_build_object(
      'totalUsers', (select total_users from profile_scope),
      'newUsers', (select new_users from profile_scope),
      'activeUsers', null,
      'activeUsersAvailable', false,
      'wealthmapCompletionPct', case
        when (select count(*) from facts) = 0 then 0
        else round(100.0 * count(*) filter (where wealthmap_completed) / count(*), 2)
      end,
      'revenue', (select total_revenue from revenue),
      'successfulCheckouts', (select successful_checkouts from revenue),
      'subscriptionPct', case
        when (select total_users from profile_scope) = 0 then 0
        else round(100.0 * (select subscribed_users from profile_scope) / (select total_users from profile_scope), 2)
      end,
      'advisorCount', (select advisor_count from advisors),
      'advisedClients', (select advised_clients from advisors),
      'avgWellnessScore', round(avg(wellness_score) filter (where wellness_score is not null), 2),
      'avgNetWorth', round(avg(net_worth), 2),
      'avgMonthlySurplus', round(avg(monthly_surplus), 2),
      'avgSip', round(avg(sip_monthly), 2),
      'avgUnallocatedSurplus', round(avg(unallocated_surplus), 2),
      'avgProtectionGap', round(avg(protection_gap), 2),
      'avgHealthInsuranceGap', round(avg(health_insurance_gap), 2),
      'usersWithGoalsPct', case
        when count(*) = 0 then 0
        else round(100.0 * count(*) filter (where goal_count > 0) / count(*), 2)
      end,
      'goalCompletionGapPct', case
        when count(*) = 0 then 0
        else round(100.0 * count(*) filter (where goal_count = 0) / count(*), 2)
      end,
      'avgGoalReadinessScore', round(avg(goal_readiness_score) filter (where goal_readiness_score is not null), 2),
      'avgRetirementReadinessScore', round(avg(goal_readiness_score) filter (where goal_readiness_score is not null), 2),
      'vehicleInsuranceCoveragePct', case
        when count(*) = 0 then 0
        else round(100.0 * count(*) filter (where has_vehicle_insurance) / count(*), 2)
      end,
      'portfolioIncludesLifeInsurancePct', case
        when count(*) = 0 then 0
        else round(100.0 * count(*) filter (where portfolio_has_life_insurance) / count(*), 2)
      end,
      'funnelCompletionPct', case
        when count(*) = 0 then 0
        else round(100.0 * count(*) filter (where funnel_step >= 8) / count(*), 2)
      end,
      'plansInScope', count(*)::int
    ),
    'series', jsonb_build_object(
      'usersByDay', (
        select coalesce(jsonb_agg(jsonb_build_object('date', d, 'value', c) order by d), '[]'::jsonb)
        from (
          select date_trunc('day', user_created_at)::date as d, count(distinct user_id)::int as c
          from facts
          group by 1
          order by 1
          limit 90
        ) s
      ),
      'funnelSteps', (
        select jsonb_build_array(
          jsonb_build_object('step', 1, 'label', 'Registered', 'count', count(*)),
          jsonb_build_object('step', 2, 'label', 'Profile', 'count', count(*) filter (where funnel_step >= 2)),
          jsonb_build_object('step', 3, 'label', 'Cash Flow', 'count', count(*) filter (where funnel_step >= 3)),
          jsonb_build_object('step', 4, 'label', 'Savings', 'count', count(*) filter (where funnel_step >= 4)),
          jsonb_build_object('step', 5, 'label', 'Assets', 'count', count(*) filter (where funnel_step >= 5)),
          jsonb_build_object('step', 6, 'label', 'Liabilities', 'count', count(*) filter (where funnel_step >= 6)),
          jsonb_build_object('step', 7, 'label', 'Goals', 'count', count(*) filter (where funnel_step >= 7)),
          jsonb_build_object('step', 8, 'label', 'WealthMap Complete', 'count', count(*) filter (where funnel_step >= 8))
        )
        from facts
      ),
      'wellnessDistribution', (
        select coalesce(jsonb_agg(jsonb_build_object('bucket', bucket, 'count', c) order by bucket), '[]'::jsonb)
        from (
          select
            case
              when wellness_score is null then 'Unknown'
              when wellness_score < 20 then '0-19'
              when wellness_score < 40 then '20-39'
              when wellness_score < 60 then '40-59'
              when wellness_score < 80 then '60-79'
              else '80-100'
            end as bucket,
            count(*)::int as c
          from facts
          group by 1
        ) w
      ),
      'netWorthTrend', (
        select coalesce(jsonb_agg(jsonb_build_object('date', d, 'value', v) order by d), '[]'::jsonb)
        from (
          select date_trunc('month', plan_updated_at)::date as d,
                 round(avg(net_worth), 2) as v
          from facts
          group by 1
          order by 1
          limit 24
        ) t
      )
    )
  )
  into result
  from facts;

  return coalesce(result, jsonb_build_object(
    'generatedAt', timezone('utc', now()),
    'phase', 1,
    'kpis', '{}'::jsonb,
    'series', '{}'::jsonb
  ));
end;
$$;

create or replace function public.admin_analytics_drilldown(
  metric_id text,
  filters jsonb default '{}'::jsonb,
  page_size int default 50,
  page_offset int default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  page_size := least(greatest(coalesce(page_size, 50), 1), 200);
  page_offset := greatest(coalesce(page_offset, 0), 0);

  -- CTE must be in the same statement as all references to "facts"
  with facts as (
    select * from public.v_plan_analytics_facts f
    where public.analytics_fact_matches_filters(f, filters)
      and case metric_id
        when 'total_users' then true
        when 'new_users' then
          f.user_created_at >= coalesce((filters->>'dateFrom')::timestamptz, '-infinity'::timestamptz)
          and f.user_created_at <= coalesce((filters->>'dateTo')::timestamptz, 'infinity'::timestamptz)
        when 'wealthmap_completed' then f.wealthmap_completed
        when 'wealthmap_incomplete' then not f.wealthmap_completed
        when 'subscribed' then f.subscription_active
        when 'advised' then f.agent_id is not null
        when 'protection_gap' then f.protection_gap > 0
        when 'health_gap' then f.health_insurance_gap > 0
        when 'has_goals' then f.goal_count > 0
        when 'no_goals' then f.goal_count = 0
        when 'has_sip' then f.sip_monthly > 0
        when 'has_vehicle_insurance' then f.has_vehicle_insurance
        when 'portfolio_life_insurance' then f.portfolio_has_life_insurance
        when 'funnel_drop_profile' then f.funnel_step < 2
        when 'funnel_drop_cashflow' then f.funnel_step = 2
        when 'funnel_drop_savings' then f.funnel_step = 3
        when 'funnel_drop_assets' then f.funnel_step = 4
        when 'funnel_drop_liabilities' then f.funnel_step = 5
        when 'funnel_drop_goals' then f.funnel_step = 6
        when 'funnel_drop_complete' then f.funnel_step = 7
        when 'low_wellness' then f.wellness_score is not null and f.wellness_score < 40
        when 'high_net_worth' then f.net_worth >= 1000000
        else true
      end
  )
  select jsonb_build_object(
    'metricId', metric_id,
    'total', (select count(*)::int from facts),
    'pageSize', page_size,
    'offset', page_offset,
    'rows', coalesce((
      select jsonb_agg(row_to_json(r)::jsonb)
      from (
        select
          user_id,
          plan_id,
          user_full_name,
          user_email,
          advisor_name,
          wealthmap_status,
          funnel_step,
          wellness_score,
          net_worth,
          sip_monthly,
          monthly_surplus,
          unallocated_surplus,
          protection_gap,
          health_insurance_gap,
          life_cover,
          health_cover,
          goal_count,
          goal_status,
          subscription_active,
          user_created_at,
          plan_updated_at
        from facts
        order by plan_updated_at desc nulls last
        limit page_size
        offset page_offset
      ) r
    ), '[]'::jsonb)
  )
  into result;

  return result;
end;
$$;

create or replace function public.admin_analytics_advisors(filters jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return (
    with facts as (
      select * from public.v_plan_analytics_facts f
      where public.analytics_fact_matches_filters(f, filters)
        and f.agent_id is not null
    )
    select coalesce(jsonb_agg(row_to_json(a)::jsonb order by a.clients desc), '[]'::jsonb)
    from (
      select
        agent_id as advisor_id,
        max(advisor_name) as advisor_name,
        max(advisor_email) as advisor_email,
        max(advisor_company) as advisor_company,
        count(*)::int as clients,
        count(*) filter (where wealthmap_completed)::int as completed_wealthmaps,
        round(avg(wellness_score) filter (where wellness_score is not null), 2) as avg_wellness,
        round(avg(net_worth), 2) as avg_net_worth,
        round(avg(sip_monthly), 2) as avg_sip,
        round(sum(sip_monthly), 2) as total_sip
      from facts
      group by agent_id
    ) a
  );
end;
$$;

create or replace function public.admin_analytics_filter_options()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return jsonb_build_object(
    'advisors', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', id,
        'name', coalesce(full_name, email),
        'email', email,
        'company', company_name
      ) order by full_name nulls last), '[]'::jsonb)
      from public.user_profiles
      where role = 'agent'
    ),
    'phases', jsonb_build_object(
      'engagement', 2,
      'product', 2,
      'ai', 2,
      'notifications', 3
    ),
    'eventCategories', array[
      'screen', 'journey', 'feature', 'smart_edit', 'ai', 'recommendation', 'cta', 'session'
    ]
  );
end;
$$;

create or replace function public.admin_analytics_upcoming_maturities(
  filters jsonb default '{}'::jsonb,
  within_months int default 12
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  horizon date := (current_date + make_interval(months => greatest(coalesce(within_months, 12), 1)))::date;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return (
    with facts as (
      select f.*
      from public.v_plan_analytics_facts f
      where public.analytics_fact_matches_filters(f, filters)
    ),
    plans as (
      select p.id, p.user_id, p.policies, p.asset_categories, f.user_full_name, f.user_email
      from public.financial_plans p
      join facts f on f.plan_id = p.id
    ),
    life_rows as (
      select
        'life_insurance'::text as kind,
        pl.user_id,
        pl.user_full_name,
        pl.user_email,
        coalesce(pol->>'planName', pol->>'company', 'Life Policy') as label,
        nullif(pol->>'endDate', '')::date as maturity_date,
        public.analytics_num(pol->>'maturityAmount') as amount
      from plans pl
      cross join lateral jsonb_array_elements(coalesce(pl.policies, '[]'::jsonb)) pol
      where nullif(pol->>'endDate', '') is not null
        and lower(coalesce(pol->>'planType', 'life')) like '%life%'
    ),
    fd_rows as (
      select
        'fixed_deposit'::text as kind,
        pl.user_id,
        pl.user_full_name,
        pl.user_email,
        'Fixed Deposit'::text as label,
        make_date(
          public.analytics_num(fd->>'startYear')::int
            + public.analytics_num(fd->>'duration')::int,
          greatest(1, least(12, coalesce(nullif(public.analytics_num(fd->>'startMonth'), 0)::int, 1))),
          1
        ) as maturity_date,
        public.analytics_num(fd->>'amount') as amount
      from plans pl
      cross join lateral jsonb_array_elements(
        case
          when jsonb_typeof(pl.asset_categories -> 'investments' -> 'fixedDeposit') = 'array'
            then pl.asset_categories -> 'investments' -> 'fixedDeposit'
          else '[]'::jsonb
        end
      ) fd
      where public.analytics_num(fd->>'startYear') > 0
        and public.analytics_num(fd->>'duration') > 0
    ),
    rd_rows as (
      select
        'recurring_deposit'::text as kind,
        pl.user_id,
        pl.user_full_name,
        pl.user_email,
        'Recurring Deposit'::text as label,
        make_date(
          public.analytics_num(rd->>'startYear')::int
            + public.analytics_num(rd->>'duration')::int,
          greatest(1, least(12, coalesce(nullif(public.analytics_num(rd->>'startMonth'), 0)::int, 1))),
          1
        ) as maturity_date,
        public.analytics_num(rd->>'amount') as amount
      from plans pl
      cross join lateral jsonb_array_elements(
        case
          when jsonb_typeof(pl.asset_categories -> 'investments' -> 'recurringDeposit') = 'array'
            then pl.asset_categories -> 'investments' -> 'recurringDeposit'
          else '[]'::jsonb
        end
      ) rd
      where public.analytics_num(rd->>'startYear') > 0
        and public.analytics_num(rd->>'duration') > 0
    ),
    all_rows as (
      select * from life_rows
      union all select * from fd_rows
      union all select * from rd_rows
    )
    select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.maturity_date), '[]'::jsonb)
    from (
      select *
      from all_rows
      where maturity_date is not null
        and maturity_date >= current_date
        and maturity_date <= horizon
      limit 200
    ) x
  );
end;
$$;

grant execute on function public.admin_analytics_executive(jsonb) to authenticated;
grant execute on function public.admin_analytics_drilldown(text, jsonb, int, int) to authenticated;
grant execute on function public.admin_analytics_advisors(jsonb) to authenticated;
grant execute on function public.admin_analytics_filter_options() to authenticated;
grant execute on function public.admin_analytics_upcoming_maturities(jsonb, int) to authenticated;
