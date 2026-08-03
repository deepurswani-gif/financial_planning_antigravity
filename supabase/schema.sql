-- ============================================
-- FINANCIAL PLANNING APP - DATABASE SCHEMA
-- ============================================
-- Creates complete PostgreSQL schema for Supabase
-- Deploy this in Supabase SQL Editor

-- ============================================
-- 1. ENABLE REQUIRED EXTENSIONS
-- ============================================
create extension if not exists "uuid-ossp";

-- ============================================
-- 2. CREATE user_profiles TABLE
-- ============================================
create table if not exists public.user_profiles (
  id uuid references auth.users(id) on delete cascade not null primary key,
  email text unique not null,
  full_name text,
  avatar_url text,
  role text not null check (role in ('agent', 'user', 'admin')) default 'user',
  company_name text,
  phone text,
  is_approved boolean default false,
  subscription_active boolean default false,
  subscription_valid_until date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS helper: check admin without subquery recursion on user_profiles policies
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

-- Set up RLS for user_profiles
alter table public.user_profiles enable row level security;

drop policy if exists "Users can view own profile" on public.user_profiles;
drop policy if exists "Users can insert own profile" on public.user_profiles;
drop policy if exists "Users can update own profile" on public.user_profiles;

create policy "Users can view own profile"
  on public.user_profiles
  for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.user_profiles
  for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.user_profiles
  for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    AND email = (select up.email from public.user_profiles up where up.id = auth.uid())
    AND role = (select up.role from public.user_profiles up where up.id = auth.uid())
    AND is_approved = (select up.is_approved from public.user_profiles up where up.id = auth.uid())
    AND (
      subscription_active = (select up.subscription_active from public.user_profiles up where up.id = auth.uid())
      OR subscription_active = true
    )
  );

-- Admins: read all profiles (admin portal)
drop policy if exists "Admins can select all profiles" on public.user_profiles;
create policy "Admins can select all profiles"
  on public.user_profiles
  for select
  using (public.is_admin());

-- Admins: update any profile (e.g. agent approval)
drop policy if exists "Admins can update any profile" on public.user_profiles;
create policy "Admins can update any profile"
  on public.user_profiles
  for update
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================
-- 3. CREATE financial_plans TABLE
-- ============================================
create table if not exists public.financial_plans (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  agent_id uuid references auth.users(id) on delete set null,
  plan_name text not null default 'My Financial Plan',
  client_name text,
  client_email text,
  current_step integer default 1,
  family_members jsonb default '[]'::jsonb,
  income jsonb default '{"family":"","bonus":"","passive":"","other":""}'::jsonb,
  expense_categories jsonb default '{"household":{"grocery":"","rent":"","education":"","lifestyle":"","medical":"","travel":""},"emi":{"personalLoan":"","homeLoan":"","educationLoan":"","otherEmi":"","healthInsurance":"","carInsurance":"","bikeInsurance":"","otherInsurance":""},"savings":{"rd":"","fd":"","lifeInsurance":"","ppf":"","savingSchemes":"","mfSip":"","otherSaving":""}}'::jsonb,
  asset_categories jsonb default '{"realEstate": {"residential": "", "secondProperty": "", "landPlot": ""}, "vehicles": {"idv": ""}, "valuables": {"gold": "", "art": ""}, "cash": {"savings": ""}, "investments": {"equity": "", "mutualFunds": "", "fixedDeposit": "", "recurringDeposit": ""}, "insurance": {"savingPlans": "", "ulip": ""}, "retirement": {"epf": "", "ppf": "", "nps": ""}, "others": {"other": ""}, "custom": []}'::jsonb,
  liability_categories jsonb default '{"loans": {"home": "", "personal": "", "car": "", "education": "", "otherEmis": "", "creditCard": ""}, "custom": []}'::jsonb,
  goals jsonb default '[]'::jsonb,
  policies jsonb default '[]'::jsonb,
  contingency_fund numeric default 0,
  has_life_insurance boolean,
  has_health_insurance boolean,
  summary_life_cover numeric,
  summary_health_cover numeric,
  inflation_rates jsonb default '{"incomeIncrement": 10, "householdInflation": 6, "educationInflation": 8}'::jsonb,
  plan_start_month integer default 0,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add index for faster queries
create index if not exists financial_plans_user_id_idx on public.financial_plans(user_id);
create index if not exists financial_plans_agent_id_idx on public.financial_plans(agent_id);
create index if not exists financial_plans_is_active_idx on public.financial_plans(is_active);

-- Set up RLS for financial_plans
alter table public.financial_plans enable row level security;

drop policy if exists "Users can view own plans" on public.financial_plans;
drop policy if exists "Users can insert own plans" on public.financial_plans;
drop policy if exists "Users can update own plans" on public.financial_plans;
drop policy if exists "Users can delete own plans" on public.financial_plans;
drop policy if exists "Agents can view their client plans" on public.financial_plans;
drop policy if exists "Agents can insert plans for clients" on public.financial_plans;
drop policy if exists "Agents can update client plans" on public.financial_plans;
drop policy if exists "Agents can delete client plans" on public.financial_plans;

create policy "Users can view own plans"
  on public.financial_plans
  for select
  using (auth.uid() = user_id);

create policy "Agents can view their client plans"
  on public.financial_plans
  for select
  using (auth.uid() = agent_id);

create policy "Users can insert own plans"
  on public.financial_plans
  for insert
  with check (auth.uid() = user_id AND agent_id IS NULL);

create policy "Agents can insert plans for clients"
  on public.financial_plans
  for insert
  with check (auth.uid() = agent_id);

create policy "Users can update own plans"
  on public.financial_plans
  for update
  using (auth.uid() = user_id);

create policy "Agents can update client plans"
  on public.financial_plans
  for update
  using (auth.uid() = agent_id);

create policy "Users can delete own plans"
  on public.financial_plans
  for delete
  using (auth.uid() = user_id);

create policy "Agents can delete client plans"
  on public.financial_plans
  for delete
  using (auth.uid() = agent_id);

drop policy if exists "Admins can select all financial plans" on public.financial_plans;
create policy "Admins can select all financial plans"
  on public.financial_plans
  for select
  using (public.is_admin());

-- ============================================
-- 4. CREATE audit_logs TABLE
-- ============================================
create table if not exists public.audit_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  plan_id uuid references public.financial_plans(id) on delete cascade not null,
  action text not null check (action in ('CREATE', 'UPDATE', 'DELETE')),
  module text,
  changes jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add index for faster queries
create index if not exists audit_logs_user_id_idx on public.audit_logs(user_id);
create index if not exists audit_logs_plan_id_idx on public.audit_logs(plan_id);

-- Set up RLS for audit_logs
alter table public.audit_logs enable row level security;

drop policy if exists "Users can view own audit logs" on public.audit_logs;
drop policy if exists "Users can insert own audit logs" on public.audit_logs;

create policy "Users can view own audit logs"
  on public.audit_logs
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own audit logs"
  on public.audit_logs
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Admins can select all audit logs" on public.audit_logs;
create policy "Admins can select all audit logs"
  on public.audit_logs
  for select
  using (public.is_admin());

-- ============================================
-- 5. CREATE TRIGGERS FOR UPDATED_AT
-- ============================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists user_profiles_updated_at on public.user_profiles;
create trigger user_profiles_updated_at before update on public.user_profiles
  for each row execute function public.handle_updated_at();

drop trigger if exists financial_plans_updated_at on public.financial_plans;
create trigger financial_plans_updated_at before update on public.financial_plans
  for each row execute function public.handle_updated_at();

-- ============================================
-- 6. CREATE FUNCTION FOR NEW USER SIGNUP
-- ============================================
create or replace function public.handle_new_user()
returns trigger as $$
declare
  signup_role text;
begin
  -- Only "user" or "agent" from signup; "admin" must be set manually in SQL.
  signup_role := coalesce(new.raw_user_meta_data->>'role', 'user');
  if signup_role = 'agent' then
    signup_role := 'agent';
  else
    signup_role := 'user';
  end if;

  insert into public.user_profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    signup_role
  );

  insert into public.financial_plans (user_id, plan_name, family_members, income, expense_categories, asset_categories, liability_categories)
  values (
    new.id,
    'My Financial Plan',
    jsonb_build_array(jsonb_build_object(
      'name', '',
      'dob', '',
      'occupation', '',
      'retirementAge', 60,
      'relation', 'Self',
      'natureOfBusiness', '',
      'organizationName', '',
      'educationalQualification', ''
    )),
    jsonb_build_object(
      'self', '',
      'spouse', '',
      'bonus', '',
      'passive', '',
      'other', ''
    ),
    jsonb_build_object(
      'household', jsonb_build_object('grocery', '', 'rent', '', 'education', '', 'lifestyle', '', 'medical', '', 'travel', ''),
      'emi', jsonb_build_object('personalLoan', '', 'homeLoan', '', 'educationLoan', '', 'otherEmi', '', 'healthInsurance', '', 'carInsurance', '', 'bikeInsurance', '', 'otherInsurance', ''),
      'savings', jsonb_build_object('rd', '', 'fd', '', 'lifeInsurance', '', 'ppf', '', 'savingSchemes', '', 'mfSip', '', 'otherSaving', '')
    ),
    jsonb_build_object(
      'realEstate', jsonb_build_object('residential', '', 'secondProperty', '', 'landPlot', ''),
      'vehicles', jsonb_build_object('idv', ''),
      'valuables', jsonb_build_object('gold', '', 'art', ''),
      'cash', jsonb_build_object('savings', ''),
      'investments', jsonb_build_object('equity', '', 'mutualFunds', '', 'fixedDeposit', '', 'recurringDeposit', ''),
      'insurance', jsonb_build_object('savingPlans', '', 'ulip', ''),
      'retirement', jsonb_build_object('epf', '', 'ppf', '', 'nps', ''),
      'others', jsonb_build_object('other', ''),
      'custom', '[]'::jsonb
    ),
    jsonb_build_object(
      'loans', jsonb_build_object('home', '', 'personal', '', 'car', '', 'education', '', 'otherEmis', '', 'creditCard', ''),
      'custom', '[]'::jsonb
    )
  );

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Trigger for new user signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================
-- 7. CREATE checkout_transactions TABLE
-- ============================================
create table if not exists public.checkout_transactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  plan_id uuid references public.financial_plans(id) on delete set null,
  amount_inr numeric not null default 0,
  currency text not null default 'INR',
  status text not null default 'SUCCESS',
  payment_provider text not null,
  payment_method text not null,
  coupon_code text,
  provider_payment_id text,
  provider_order_id text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists checkout_transactions_user_id_idx on public.checkout_transactions(user_id);
create index if not exists checkout_transactions_plan_id_idx on public.checkout_transactions(plan_id);

alter table public.checkout_transactions enable row level security;

drop policy if exists "Users can view own checkout transactions" on public.checkout_transactions;
drop policy if exists "Users can insert own checkout transactions" on public.checkout_transactions;

create policy "Users can view own checkout transactions"
  on public.checkout_transactions
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own checkout transactions"
  on public.checkout_transactions
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Admins can select all checkout transactions" on public.checkout_transactions;
create policy "Admins can select all checkout transactions"
  on public.checkout_transactions
  for select
  using (public.is_admin());

-- ============================================
-- 7b. CREATE coupon_codes TABLE
-- ============================================
create table if not exists public.coupon_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  target_email text not null,
  is_used boolean not null default false,
  used_at timestamp with time zone,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  constraint coupon_codes_code_unique unique (code),
  constraint coupon_codes_code_format check (length(trim(code)) >= 4)
);

create unique index if not exists coupon_codes_one_unused_per_email
  on public.coupon_codes (lower(trim(target_email)))
  where not is_used;

create index if not exists coupon_codes_target_email_idx on public.coupon_codes (lower(trim(target_email)));

alter table public.coupon_codes enable row level security;

drop policy if exists "Admins can select all coupons" on public.coupon_codes;
drop policy if exists "Admins can insert coupons" on public.coupon_codes;
drop policy if exists "Admins can update any coupon" on public.coupon_codes;
drop policy if exists "Users can view own coupon rows" on public.coupon_codes;
drop policy if exists "Users can redeem own unused coupon" on public.coupon_codes;

create policy "Admins can select all coupons"
  on public.coupon_codes for select
  using (public.is_admin());

create policy "Admins can insert coupons"
  on public.coupon_codes for insert
  with check (public.is_admin());

create policy "Admins can update any coupon"
  on public.coupon_codes for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "Users can view own coupon rows"
  on public.coupon_codes for select
  using (
    lower(trim(target_email)) = lower(trim(coalesce(auth.jwt()->>'email', '')))
  );

create policy "Users can redeem own unused coupon"
  on public.coupon_codes for update
  using (
    not is_used
    and lower(trim(target_email)) = lower(trim(coalesce(auth.jwt()->>'email', '')))
  )
  with check (
    lower(trim(target_email)) = lower(trim(coalesce(auth.jwt()->>'email', '')))
    and is_used = true
  );

drop trigger if exists coupon_codes_updated_at on public.coupon_codes;
create trigger coupon_codes_updated_at
  before update on public.coupon_codes
  for each row execute function public.handle_updated_at();

-- ============================================
-- 8. GRANTS FOR AUTHENTICATED USERS
-- ============================================
revoke all on schema public from authenticated;
revoke all privileges on all tables in schema public from authenticated;
revoke all privileges on all sequences in schema public from authenticated;
revoke execute on all functions in schema public from authenticated;

grant usage on schema public to authenticated;

grant execute on function public.is_admin() to authenticated;

-- Table-level grants (RLS still applies).
-- Keep these intentionally narrow; do not grant blanket privileges.
grant select, insert, update on public.user_profiles to authenticated;
grant select, insert, update on public.financial_plans to authenticated;
grant select, insert on public.audit_logs to authenticated;
grant select, insert on public.checkout_transactions to authenticated;
grant select, insert, update on public.coupon_codes to authenticated;