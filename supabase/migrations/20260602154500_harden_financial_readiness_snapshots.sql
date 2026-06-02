-- Optional hardening for monthly readiness snapshots table
-- Safe to run after table + RLS/policies already exist.

alter table if exists public.financial_readiness_snapshots
  alter column pillars set default '[]'::jsonb,
  alter column meta set default '{}'::jsonb;

update public.financial_readiness_snapshots
set meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('schema_version', 1)
where coalesce(meta, '{}'::jsonb) ? 'schema_version' = false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ck_fin_readiness_pillars_is_array'
  ) then
    alter table public.financial_readiness_snapshots
      add constraint ck_fin_readiness_pillars_is_array
      check (jsonb_typeof(pillars) = 'array');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ck_fin_readiness_meta_is_object'
  ) then
    alter table public.financial_readiness_snapshots
      add constraint ck_fin_readiness_meta_is_object
      check (jsonb_typeof(meta) = 'object');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ck_fin_readiness_meta_schema_version'
  ) then
    alter table public.financial_readiness_snapshots
      add constraint ck_fin_readiness_meta_schema_version
      check (
        (meta ? 'schema_version') and
        ((meta ->> 'schema_version') ~ '^[0-9]+$')
      );
  end if;
end $$;
