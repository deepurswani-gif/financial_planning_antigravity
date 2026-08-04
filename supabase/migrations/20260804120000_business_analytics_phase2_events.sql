-- Business Analytics Phase 2
-- Event aggregation RPCs for Engagement / Product / AI modules.
-- Requires analytics_events from Phase 1 migration.

create or replace function public.admin_analytics_events(
  filters jsonb default '{}'::jsonb,
  module_id text default 'engagement'
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
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  date_from := coalesce(nullif(filters->>'dateFrom', '')::timestamptz, now() - interval '90 days');
  date_to := coalesce(nullif(filters->>'dateTo', '')::timestamptz, now());

  with scoped as (
    select e.*
    from public.analytics_events e
    where e.occurred_at >= date_from
      and e.occurred_at <= date_to
      and (
        nullif(filters->>'advisorId', '') is null
        or exists (
          select 1
          from public.financial_plans p
          where p.user_id = e.user_id
            and p.agent_id = (filters->>'advisorId')::uuid
            and p.is_active = true
        )
      )
  ),
  kpis as (
    select
      count(*)::int as total_events,
      count(distinct user_id)::int as unique_users,
      count(distinct session_id)::int as session_count,
      count(*) filter (where event_name = 'session_start')::int as session_starts,
      count(*) filter (where event_name = 'screen_view')::int as screen_views,
      count(*) filter (where event_name = 'report_view')::int as report_views,
      count(*) filter (where event_name = 'feature_click')::int as feature_clicks,
      count(*) filter (where event_name = 'component_click')::int as component_clicks,
      count(*) filter (where event_name = 'cta_click')::int as cta_clicks,
      count(*) filter (where event_name = 'smart_edit_open')::int as smart_edit_opens,
      count(*) filter (where event_name = 'smart_edit_save')::int as smart_edit_saves,
      count(*) filter (where event_name = 'ai_prompt')::int as ai_prompts,
      count(*) filter (where event_name = 'recommendation_view')::int as recommendation_views,
      count(*) filter (where event_name = 'recommendation_accept')::int as recommendation_accepts,
      count(*) filter (where event_name = 'recommendation_ignore')::int as recommendation_ignores,
      count(distinct user_id) filter (
        where occurred_at >= now() - interval '1 day'
          and event_name in ('session_start', 'screen_view')
      )::int as dau,
      count(distinct user_id) filter (
        where occurred_at >= now() - interval '7 days'
          and event_name in ('session_start', 'screen_view')
      )::int as wau,
      count(distinct user_id) filter (
        where occurred_at >= now() - interval '30 days'
          and event_name in ('session_start', 'screen_view')
      )::int as mau,
      round(avg((properties->>'durationMs')::numeric) filter (
        where event_name = 'screen_exit'
          and (properties->>'durationMs') ~ '^[0-9]+(\.[0-9]+)?$'
      ), 0) as avg_screen_duration_ms,
      case
        when count(*) filter (where event_name = 'recommendation_view') = 0 then 0
        else round(
          100.0 * count(*) filter (where event_name = 'recommendation_accept')
            / nullif(count(*) filter (where event_name = 'recommendation_view'), 0),
          2
        )
      end as recommendation_accept_rate
    from scoped
  )
  select jsonb_build_object(
    'generatedAt', timezone('utc', now()),
    'phase', 2,
    'moduleId', module_id,
    'eventsAvailable', (select total_events > 0 from kpis),
    'kpis', (select to_jsonb(k) from kpis k),
    'series', jsonb_build_object(
      'eventsByDay', (
        select coalesce(jsonb_agg(jsonb_build_object('date', d, 'value', c) order by d), '[]'::jsonb)
        from (
          select date_trunc('day', occurred_at)::date as d, count(*)::int as c
          from scoped
          group by 1
          order by 1
          limit 90
        ) s
      ),
      'topScreens', (
        select coalesce(jsonb_agg(jsonb_build_object('label', screen, 'count', c) order by c desc), '[]'::jsonb)
        from (
          select coalesce(nullif(screen, ''), '(unknown)') as screen, count(*)::int as c
          from scoped
          where event_name = 'screen_view'
          group by 1
          order by c desc
          limit 15
        ) s
      ),
      'topReports', (
        select coalesce(jsonb_agg(jsonb_build_object('label', report, 'count', c) order by c desc), '[]'::jsonb)
        from (
          select coalesce(nullif(properties->>'section', ''), screen, '(unknown)') as report,
                 count(*)::int as c
          from scoped
          where event_name = 'report_view'
          group by 1
          order by c desc
          limit 15
        ) s
      ),
      'topFeatures', (
        select coalesce(jsonb_agg(jsonb_build_object('label', feat, 'count', c) order by c desc), '[]'::jsonb)
        from (
          select coalesce(nullif(feature, ''), nullif(component, ''), event_name) as feat,
                 count(*)::int as c
          from scoped
          where event_name in ('feature_click', 'component_click', 'cta_click')
          group by 1
          order by c desc
          limit 15
        ) s
      ),
      'topCtas', (
        select coalesce(jsonb_agg(jsonb_build_object('label', cta, 'count', c) order by c desc), '[]'::jsonb)
        from (
          select coalesce(
                   nullif(properties->>'analyticsEvent', ''),
                   nullif(properties->>'ctaId', ''),
                   'cta'
                 ) as cta,
                 count(*)::int as c
          from scoped
          where event_name = 'cta_click'
          group by 1
          order by c desc
          limit 15
        ) s
      ),
      'smartEditFields', (
        select coalesce(jsonb_agg(jsonb_build_object('label', field, 'count', c) order by c desc), '[]'::jsonb)
        from (
          select coalesce(nullif(properties->>'fieldId', ''), '(unknown)') as field,
                 count(*)::int as c
          from scoped
          where event_name = 'smart_edit_save'
          group by 1
          order by c desc
          limit 15
        ) s
      ),
      'recommendationActions', (
        select coalesce(jsonb_agg(jsonb_build_object('label', action, 'count', c) order by c desc), '[]'::jsonb)
        from (
          select event_name as action, count(*)::int as c
          from scoped
          where event_name in (
            'recommendation_view',
            'recommendation_accept',
            'recommendation_ignore'
          )
          group by 1
          order by c desc
        ) s
      ),
      'eventNameBreakdown', (
        select coalesce(jsonb_agg(jsonb_build_object('label', event_name, 'count', c) order by c desc), '[]'::jsonb)
        from (
          select event_name, count(*)::int as c
          from scoped
          group by 1
          order by c desc
          limit 20
        ) s
      )
    )
  )
  into result;

  return coalesce(result, jsonb_build_object(
    'generatedAt', timezone('utc', now()),
    'phase', 2,
    'moduleId', module_id,
    'eventsAvailable', false,
    'kpis', '{}'::jsonb,
    'series', '{}'::jsonb
  ));
end;
$$;

grant execute on function public.admin_analytics_events(jsonb, text) to authenticated;

-- Enrich executive KPIs with Active Users from events (DAU/WAU/MAU)
create or replace function public.admin_analytics_active_users(filters jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  date_from timestamptz;
  date_to timestamptz;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  date_from := coalesce(nullif(filters->>'dateFrom', '')::timestamptz, now() - interval '90 days');
  date_to := coalesce(nullif(filters->>'dateTo', '')::timestamptz, now());

  return (
    with scoped as (
      select user_id, occurred_at
      from public.analytics_events
      where occurred_at >= date_from
        and occurred_at <= date_to
        and event_name in ('session_start', 'screen_view')
        and user_id is not null
    )
    select jsonb_build_object(
      'activeUsersAvailable', exists (select 1 from scoped),
      'activeUsers', (select count(distinct user_id)::int from scoped where occurred_at >= now() - interval '30 days'),
      'dau', (select count(distinct user_id)::int from scoped where occurred_at >= now() - interval '1 day'),
      'wau', (select count(distinct user_id)::int from scoped where occurred_at >= now() - interval '7 days'),
      'mau', (select count(distinct user_id)::int from scoped where occurred_at >= now() - interval '30 days'),
      'tau', (select count(distinct user_id)::int from scoped)
    )
  );
end;
$$;

grant execute on function public.admin_analytics_active_users(jsonb) to authenticated;
