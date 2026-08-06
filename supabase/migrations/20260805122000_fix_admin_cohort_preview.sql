-- Harden cohort preview aggregation (idempotent replace)

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
