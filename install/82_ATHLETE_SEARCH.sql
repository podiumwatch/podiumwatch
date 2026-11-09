-- Podium Watch: athlete directory search in the database (WO-03)
-- Purpose:
--   /api/athletes/ loaded every public profile (8,884 on 2026-11-09) plus
--   their rankings, performances and aliases on every request, then
--   searched and paged in JavaScript (about 9 seconds). This moves search,
--   filters and paging into Postgres:
--     - pw_normalize_lookup(text): the same normalization as
--       normalizeLookup() in lib/ohio_foundation_service.mjs, so a query
--       normalized in JS matches text normalized here.
--     - athlete_search_index: one row of normalized search text per
--       profile (name, name aliases, school, city, district, class year,
--       current ranking title and division, events, college commitment),
--       with a trigram index for fast "contains" search. Kept in its own
--       table so refreshing it never touches athlete_profiles.updated_at.
--     - Triggers keep it current when a profile, alias or ranking changes.
--       refresh_athlete_search_index(null) rebuilds every row (run it
--       after renaming schools in bulk).
--     - search_athletes(...): the directory's filters, ordered by current
--       ranking then name, one page at a time, with the total.
--
-- Safety:
--   Additive only: an extension, one new table, functions and triggers.
--   No existing rows change. Service role only.

begin;

create extension if not exists pg_trgm;

-- Mirrors normalizeLookup(): accents stripped, lowercase, & -> and,
-- saint -> st, "high school" and "senior" dropped, anything else that
-- isn't a letter or digit becomes one space.
create or replace function public.pw_normalize_lookup(value text)
returns text
language sql
immutable
as $$
  select btrim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            replace(
              translate(
                lower(left(coalesce(value, ''), 500)),
                'àáâãäåāèéêëēìíîïīòóôõöøōùúûüūñçýÿ',
                'aaaaaaaeeeeeiiiiioooooooouuuuuncyy'
              ),
              '&', ' and '
            ),
            '\msaint\M', 'st', 'g'
          ),
          '\mhigh school\M', '', 'g'
        ),
        '\msenior\M', '', 'g'
      ),
      '[^a-z0-9]+', ' ', 'g'
    )
  );
$$;

create table if not exists public.athlete_search_index (
  profile_id uuid primary key references public.athlete_profiles(id) on delete cascade,
  search_text text not null default '',
  updated_at timestamptz not null default now()
);

create index if not exists athlete_search_index_trgm
  on public.athlete_search_index using gin (search_text gin_trgm_ops);

alter table public.athlete_search_index enable row level security;
revoke all on table public.athlete_search_index from anon, authenticated;
grant all on table public.athlete_search_index to service_role;

create or replace function public.athlete_search_text(p_profile_id uuid)
returns text
language sql
stable
as $$
  select public.pw_normalize_lookup(concat_ws(' ',
    p.display_name,
    (select string_agg(a.alias, ' ') from public.athlete_profile_aliases a where a.profile_id = p.id and a.alias_type = 'name'),
    coalesce(sc.school_name, tp.school_name),
    sc.city,
    sc.athletic_district,
    p.graduation_year::text,
    r.ranking_title,
    r.division,
    array_to_string(p.primary_events, ' '),
    p.college_commitment
  ))
  from public.athlete_profiles p
  left join public.ohio_schools sc on sc.id = p.current_school_id
  left join public.team_pages tp on tp.id = p.current_team_id
  left join lateral (
    select re.ranking_title, re.division
    from public.athlete_ranking_entries re
    where re.profile_id = p.id and re.current
    order by re.updated_date desc nulls last, re.rank
    limit 1
  ) r on true
  where p.id = p_profile_id;
$$;

-- Rebuild one profile's row, or every row when p_profile_id is null.
create or replace function public.refresh_athlete_search_index(p_profile_id uuid default null)
returns integer
language plpgsql
as $$
declare
  v_count integer;
begin
  insert into public.athlete_search_index (profile_id, search_text, updated_at)
  select p.id, coalesce(public.athlete_search_text(p.id), ''), now()
  from public.athlete_profiles p
  where p_profile_id is null or p.id = p_profile_id
  on conflict (profile_id) do update
    set search_text = excluded.search_text, updated_at = excluded.updated_at;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.athlete_search_index_profile_trigger()
returns trigger
language plpgsql
as $$
begin
  perform public.refresh_athlete_search_index(new.id);
  return null;
end;
$$;

create or replace function public.athlete_search_index_child_trigger()
returns trigger
language plpgsql
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.refresh_athlete_search_index(old.profile_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.profile_id is distinct from old.profile_id) then
    perform public.refresh_athlete_search_index(new.profile_id);
  end if;
  return null;
end;
$$;

drop trigger if exists athlete_search_index_profile on public.athlete_profiles;
create trigger athlete_search_index_profile
  after insert or update of display_name, current_school_id, current_team_id, graduation_year, primary_events, college_commitment
  on public.athlete_profiles
  for each row execute function public.athlete_search_index_profile_trigger();

drop trigger if exists athlete_search_index_alias on public.athlete_profile_aliases;
create trigger athlete_search_index_alias
  after insert or update or delete on public.athlete_profile_aliases
  for each row execute function public.athlete_search_index_child_trigger();

drop trigger if exists athlete_search_index_ranking on public.athlete_ranking_entries;
create trigger athlete_search_index_ranking
  after insert or update or delete on public.athlete_ranking_entries
  for each row execute function public.athlete_search_index_child_trigger();

-- The directory's filters, one page at a time. p_q, p_school and p_event
-- arrive already normalized by the API (normalizeLookup), so they compare
-- directly with normalized text. Order: current ranking, then name.
create or replace function public.search_athletes(
  p_q text default null,
  p_gender text default null,
  p_grad_year integer default null,
  p_division integer default null,
  p_school text default null,
  p_event text default null,
  p_verification text default null,
  p_recruiting_only boolean default false,
  p_page integer default 1,
  p_page_size integer default 24
)
returns table (profile_id uuid, total bigint)
language sql
stable
as $$
  with base as (
    select p.id, p.display_name, r.rank
    from public.athlete_profiles p
    join public.athlete_search_index s on s.profile_id = p.id
    left join public.ohio_schools sc on sc.id = p.current_school_id
    left join public.team_pages tp on tp.id = p.current_team_id
    left join lateral (
      select re.rank, re.division_number, re.event_name, re.mark_snapshot
      from public.athlete_ranking_entries re
      where re.profile_id = p.id and re.current
      order by re.updated_date desc nulls last, re.rank
      limit 1
    ) r on true
    where p.public_visible
      and not p.suspended
      and p.archived_at is null
      and p.merged_into_profile_id is null
      and (nullif(p_q, '') is null or s.search_text like '%' || p_q || '%')
      and (nullif(p_gender, '') is null or p.gender = p_gender)
      and (p_grad_year is null or p.graduation_year = p_grad_year)
      and (p_division is null or r.division_number = p_division)
      and (nullif(p_school, '') is null or public.pw_normalize_lookup(coalesce(sc.school_name, tp.school_name, '')) like '%' || p_school || '%')
      and (nullif(p_event, '') is null or public.pw_normalize_lookup(concat_ws(' ', r.event_name, r.mark_snapshot, array_to_string(p.primary_events, ' '))) like '%' || p_event || '%')
      and (
        nullif(p_verification, '') is null
        or (p_verification = 'verified' and p.verified)
        or (p_verification = 'source_linked' and p.verification_status in ('editorial_source_linked', 'team_roster_linked', 'source_verified', 'admin_verified'))
        or p_verification not in ('verified', 'source_linked')
      )
      and (not coalesce(p_recruiting_only, false) or p.recruiting_enabled)
  )
  select base.id, count(*) over ()
  from base
  order by coalesce(base.rank, 999999), base.display_name
  limit greatest(1, least(coalesce(p_page_size, 24), 100))
  offset (greatest(coalesce(p_page, 1), 1) - 1) * greatest(1, least(coalesce(p_page_size, 24), 100));
$$;

revoke all on function public.search_athletes(text, text, integer, integer, text, text, text, boolean, integer, integer) from public, anon, authenticated;
grant execute on function public.search_athletes(text, text, integer, integer, text, text, text, boolean, integer, integer) to service_role;
revoke all on function public.refresh_athlete_search_index(uuid) from public, anon, authenticated;
grant execute on function public.refresh_athlete_search_index(uuid) to service_role;

-- Fill the index for every existing profile.
select public.refresh_athlete_search_index(null);

commit;
