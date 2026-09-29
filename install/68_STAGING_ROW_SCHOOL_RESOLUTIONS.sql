-- Permanent, per-row manual school identity resolution table.
--
-- Replaces the earlier ad hoc pattern (directly setting matched_school_id
-- on a specific set of rows via a one-off script, e.g.
-- dataimports/mock-meet-export/manually-resolve-lakewood-fairfield.mjs)
-- with a real, queryable, auditable record that resolveJobIdentities can
-- check on every run. That earlier pattern had a real, confirmed bug:
-- resolveJobIdentities recomputes matched_school_id from the raw
-- school_name text on EVERY row on every call, with no awareness of a
-- manual override that has no backing alias (an alias can't be created
-- for "Lakewood"/"Fairfield" globally -- those labels are genuinely
-- ambiguous across real Ohio schools; only THIS specific staging row, in
-- THIS specific job, verified against its own meet, was ever safe to
-- resolve). Every resolveJobIdentities rerun since the manual fix was
-- first applied has silently reverted it back to AMBIGUOUS_IDENTITY --
-- confirmed twice, 2026-09-29. This table gives resolveJobIdentities a
-- durable, row-scoped record to check FIRST, before falling back to the
-- normal alias-table lookup, so a reviewed resolution survives any number
-- of reruns.
--
-- One resolution per staging row (unique constraint on staging_row_id --
-- a row's school identity, once reviewed, has exactly one answer).
begin;

create table if not exists public.result_staging_row_school_resolutions (
  id uuid primary key default gen_random_uuid(),
  staging_row_id uuid not null unique references public.result_staging_rows(id) on delete cascade,
  job_id uuid not null references public.result_ingestion_jobs(id) on delete cascade,
  raw_school_label text not null,
  resolved_school_id uuid not null references public.ohio_schools(id),
  reviewer text not null,
  resolved_at timestamptz not null default now(),
  evidence_note text not null,
  created_at timestamptz not null default now()
);

create index if not exists result_staging_row_school_resolutions_job_id_idx
  on public.result_staging_row_school_resolutions (job_id);

-- Postcondition checks -- fail loudly rather than silently leaving a
-- half-correct table behind.
do $$
begin
  if to_regclass('public.result_staging_row_school_resolutions') is null then
    raise exception 'result_staging_row_school_resolutions was not created';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'result_staging_row_school_resolutions'
      and column_name = 'staging_row_id'
  ) then
    raise exception 'result_staging_row_school_resolutions is missing staging_row_id';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.result_staging_row_school_resolutions'::regclass
      and contype = 'u'
  ) then
    raise exception 'result_staging_row_school_resolutions is missing its unique constraint on staging_row_id';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'result_staging_row_school_resolutions'
      and indexname = 'result_staging_row_school_resolutions_job_id_idx'
  ) then
    raise exception 'result_staging_row_school_resolutions_job_id_idx was not created';
  end if;
end $$;

commit;
