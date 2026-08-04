-- Fix: admin_analytics_event_drilldown referenced CTE "scoped" outside its statement.
-- Run this in Supabase SQL Editor, then retry Details / chart drill-down.

create or replace function public.admin_analytics_event_drilldown(
  event_filter jsonb default '{}'::jsonb,
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
  date_from timestamptz;
  date_to timestamptz;
  event_name_filter text;
  feature_filter text;
  screen_filter text;
  label_filter text;
  section_filter text;
  cta_filter text;
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  page_size := least(greatest(coalesce(page_size, 50), 1), 200);
  page_offset := greatest(coalesce(page_offset, 0), 0);

  date_from := coalesce(nullif(filters->>'dateFrom', '')::timestamptz, now() - interval '90 days');
  date_to := coalesce(nullif(filters->>'dateTo', '')::timestamptz, now());
  event_name_filter := nullif(event_filter->>'eventName', '');
  feature_filter := nullif(event_filter->>'feature', '');
  screen_filter := nullif(event_filter->>'screen', '');
  label_filter := nullif(event_filter->>'label', '');
  section_filter := nullif(event_filter->>'section', '');
  cta_filter := nullif(event_filter->>'cta', '');

  with scoped as (
    select
      e.id,
      e.occurred_at,
      e.user_id,
      e.plan_id,
      e.session_id,
      e.event_name,
      e.event_category,
      e.screen,
      e.component,
      e.feature,
      e.properties,
      up.full_name as user_full_name,
      up.email as user_email,
      coalesce(
        nullif(e.properties->>'section', ''),
        nullif(e.properties->>'analyticsEvent', ''),
        nullif(e.properties->>'ctaId', ''),
        nullif(e.properties->>'fieldId', ''),
        nullif(e.properties->>'recommendationId', ''),
        nullif(e.properties->>'experienceId', ''),
        nullif(e.screen, ''),
        e.event_name
      ) as event_label,
      public.analytics_num(e.properties->>'durationMs') as duration_ms
    from public.analytics_events e
    left join public.user_profiles up on up.id = e.user_id
    where e.occurred_at >= date_from
      and e.occurred_at <= date_to
      and (event_name_filter is null or e.event_name = event_name_filter)
      and (feature_filter is null or e.feature = feature_filter)
      and (screen_filter is null or e.screen = screen_filter or e.screen ilike '%' || screen_filter || '%')
      and (
        section_filter is null
        or e.properties->>'section' = section_filter
        or e.screen ilike '%' || section_filter || '%'
      )
      and (
        cta_filter is null
        or e.properties->>'analyticsEvent' = cta_filter
        or e.properties->>'ctaId' = cta_filter
      )
      and (
        label_filter is null
        or e.screen = label_filter
        or e.properties->>'section' = label_filter
        or e.properties->>'analyticsEvent' = label_filter
        or e.properties->>'ctaId' = label_filter
        or e.feature = label_filter
        or e.component = label_filter
        or coalesce(e.properties->>'fieldId', '') = label_filter
        or coalesce(e.properties->>'recommendationId', '') = label_filter
      )
      and (
        nullif(filters->>'advisorId', '') is null
        or exists (
          select 1 from public.financial_plans p
          where p.user_id = e.user_id
            and p.agent_id = (filters->>'advisorId')::uuid
            and p.is_active = true
        )
      )
  )
  select jsonb_build_object(
    'kind', 'events',
    'total', (select count(*)::int from scoped),
    'pageSize', page_size,
    'offset', page_offset,
    'rows', coalesce((
      select jsonb_agg(row_to_json(r)::jsonb)
      from (
        select
          id,
          occurred_at,
          user_id,
          plan_id,
          user_full_name,
          user_email,
          session_id,
          event_name,
          event_category,
          screen,
          component,
          feature,
          event_label,
          duration_ms,
          properties
        from scoped
        order by occurred_at desc
        limit page_size
        offset page_offset
      ) r
    ), '[]'::jsonb)
  )
  into result;

  return result;
end;
$$;

grant execute on function public.admin_analytics_event_drilldown(jsonb, jsonb, int, int) to authenticated;
