-- Event drill-down lists + richer product analytics series (report dwell, least used, top users, etc.)

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

  -- CTE must live in the same statement as all references to "scoped"
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

-- Enrich events aggregate with report dwell, least-used, top users, hourly pattern, conversions
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
        where event_name in ('screen_exit', 'report_exit')
          and (properties->>'durationMs') ~ '^[0-9]+(\.[0-9]+)?$'
      ), 0) as avg_screen_duration_ms,
      round(avg((properties->>'durationMs')::numeric) filter (
        where event_name = 'report_exit'
          and (properties->>'durationMs') ~ '^[0-9]+(\.[0-9]+)?$'
      ), 0) as avg_report_duration_ms,
      case
        when count(*) filter (where event_name = 'recommendation_view') = 0 then 0
        else round(
          100.0 * count(*) filter (where event_name = 'recommendation_accept')
            / nullif(count(*) filter (where event_name = 'recommendation_view'), 0),
          2
        )
      end as recommendation_accept_rate,
      case
        when count(*) filter (where event_name = 'smart_edit_open') = 0 then 0
        else round(
          100.0 * count(*) filter (where event_name = 'smart_edit_save')
            / nullif(count(*) filter (where event_name = 'smart_edit_open'), 0),
          2
        )
      end as smart_edit_save_rate,
      case
        when count(*) filter (where event_name = 'report_view') = 0 then 0
        else round(
          100.0 * count(*) filter (where event_name = 'cta_click')
            / nullif(count(*) filter (where event_name = 'report_view'), 0),
          2
        )
      end as report_to_cta_rate
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
          from scoped group by 1 order by 1 limit 90
        ) s
      ),
      'topScreens', (
        select coalesce(jsonb_agg(jsonb_build_object('label', screen, 'count', c) order by c desc), '[]'::jsonb)
        from (
          select coalesce(nullif(screen, ''), '(unknown)') as screen, count(*)::int as c
          from scoped where event_name = 'screen_view'
          group by 1 order by c desc limit 15
        ) s
      ),
      'topReports', (
        select coalesce(jsonb_agg(jsonb_build_object('label', report, 'count', c) order by c desc), '[]'::jsonb)
        from (
          select coalesce(nullif(properties->>'section', ''), screen, '(unknown)') as report,
                 count(*)::int as c
          from scoped where event_name = 'report_view'
          group by 1 order by c desc limit 15
        ) s
      ),
      'leastReports', (
        select coalesce(jsonb_agg(jsonb_build_object('label', report, 'count', c) order by c asc), '[]'::jsonb)
        from (
          select coalesce(nullif(properties->>'section', ''), screen, '(unknown)') as report,
                 count(*)::int as c
          from scoped where event_name = 'report_view'
          group by 1 order by c asc limit 10
        ) s
      ),
      'topFeatures', (
        select coalesce(jsonb_agg(jsonb_build_object('label', feat, 'count', c) order by c desc), '[]'::jsonb)
        from (
          select coalesce(nullif(feature, ''), nullif(component, ''), event_name) as feat,
                 count(*)::int as c
          from scoped
          where event_name in ('feature_click', 'component_click', 'cta_click')
          group by 1 order by c desc limit 15
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
          from scoped where event_name = 'cta_click'
          group by 1 order by c desc limit 15
        ) s
      ),
      'smartEditFields', (
        select coalesce(jsonb_agg(jsonb_build_object('label', field, 'count', c) order by c desc), '[]'::jsonb)
        from (
          select coalesce(nullif(properties->>'fieldId', ''), '(unknown)') as field,
                 count(*)::int as c
          from scoped where event_name = 'smart_edit_save'
          group by 1 order by c desc limit 15
        ) s
      ),
      'recommendationActions', (
        select coalesce(jsonb_agg(jsonb_build_object('label', action, 'count', c) order by c desc), '[]'::jsonb)
        from (
          select event_name as action, count(*)::int as c
          from scoped
          where event_name in ('recommendation_view', 'recommendation_accept', 'recommendation_ignore')
          group by 1 order by c desc
        ) s
      ),
      'eventNameBreakdown', (
        select coalesce(jsonb_agg(jsonb_build_object('label', event_name, 'count', c) order by c desc), '[]'::jsonb)
        from (
          select event_name, count(*)::int as c
          from scoped group by 1 order by c desc limit 20
        ) s
      ),
      'reportDurations', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'label', report,
          'count', views,
          'avgDurationMs', avg_ms,
          'avgDurationSec', round(avg_ms / 1000.0, 1)
        ) order by avg_ms desc), '[]'::jsonb)
        from (
          select
            coalesce(
              nullif(properties->>'section', ''),
              nullif(screen, ''),
              '(unknown)'
            ) as report,
            count(*)::int as views,
            round(avg(public.analytics_num(properties->>'durationMs')), 0) as avg_ms
          from scoped
          where event_name = 'report_exit'
            and (properties->>'durationMs') ~ '^[0-9]+(\.[0-9]+)?$'
            and public.analytics_num(properties->>'durationMs') > 0
          group by 1
          order by avg_ms desc
          limit 20
        ) s
      ),
      'topActiveUsers', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'userId', user_id,
          'name', user_name,
          'email', user_email,
          'events', c
        ) order by c desc), '[]'::jsonb)
        from (
          select
            s.user_id,
            max(up.full_name) as user_name,
            max(up.email) as user_email,
            count(*)::int as c
          from scoped s
          left join public.user_profiles up on up.id = s.user_id
          where s.user_id is not null
          group by s.user_id
          order by c desc
          limit 15
        ) u
      ),
      'activityByHour', (
        select coalesce(jsonb_agg(jsonb_build_object('label', hour_label, 'count', c) order by hour_num), '[]'::jsonb)
        from (
          select
            extract(hour from occurred_at at time zone 'Asia/Kolkata')::int as hour_num,
            lpad(extract(hour from occurred_at at time zone 'Asia/Kolkata')::int::text, 2, '0') || ':00' as hour_label,
            count(*)::int as c
          from scoped
          group by 1, 2
          order by 1
        ) h
      ),
      'recentActivity', (
        select coalesce(jsonb_agg(row_to_json(r)::jsonb), '[]'::jsonb)
        from (
          select
            e.occurred_at,
            e.event_name,
            e.screen,
            e.feature,
            coalesce(
              nullif(e.properties->>'section', ''),
              nullif(e.properties->>'analyticsEvent', ''),
              nullif(e.properties->>'ctaId', ''),
              e.screen,
              e.event_name
            ) as label,
            public.analytics_num(e.properties->>'durationMs') as duration_ms,
            up.full_name as user_full_name,
            up.email as user_email,
            e.user_id
          from scoped e
          left join public.user_profiles up on up.id = e.user_id
          order by e.occurred_at desc
          limit 25
        ) r
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
