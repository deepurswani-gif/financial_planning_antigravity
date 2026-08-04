-- Fix: admin_analytics_drilldown referenced CTE "facts" outside its statement scope.
-- Run this in Supabase SQL Editor, then refresh Business Analytics drill-down.

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

grant execute on function public.admin_analytics_drilldown(text, jsonb, int, int) to authenticated;
