-- Podium Watch: State Leaders computed in the database (WO-04)
-- Purpose:
--   lib/athlete_leaders_service.mjs pulled every 2026 5K performance into
--   the server and kept each athlete's fastest in JavaScript (and before
--   2026-11-09 it silently got only an arbitrary 1,000 of them). This
--   function does it in Postgres: public, non-archived xc_5k performances
--   for the season, public non-merged non-suspended profiles of that
--   gender, each athlete's fastest mark (DISTINCT ON), then ordered and
--   limited. School comes from the performance, falling back to the
--   profile's current school, so a known school never shows as
--   "Unattached". Division comes from ohio_school_divisions for that
--   season and gender. Nothing is estimated: a row with no school stays
--   null.
--
-- Safety:
--   Read-only function. Creates nothing else. Service role only.

begin;

create or replace function public.xc_leaders(
  p_gender text,
  p_season integer,
  p_grade integer default null,
  p_division integer default null,
  p_limit integer default 100
)
returns table (
  profile_id uuid,
  athlete_slug text,
  athlete_name text,
  school_id uuid,
  school_name text,
  school_city text,
  grade integer,
  mark_text text,
  mark_value numeric,
  meet_name text,
  meet_date date,
  division text,
  total_before_limit bigint
)
language sql
stable
as $$
  with fastest as (
    select distinct on (ap.profile_id)
      ap.profile_id,
      coalesce(ap.school_id, p.current_school_id) as school_id,
      ap.grade,
      ap.mark_text,
      ap.mark_value,
      ap.meet_name,
      ap.meet_date,
      p.slug,
      p.display_name
    from public.athlete_performances ap
    join public.athlete_profiles p on p.id = ap.profile_id
    where ap.event_key = 'xc_5k'
      and ap.sport = 'cross_country'
      and ap.season_year = p_season
      and ap.public_visible
      and ap.archived_at is null
      and ap.mark_value is not null
      and (p_grade is null or ap.grade = p_grade)
      and p.gender = p_gender
      and p.public_visible
      and not p.suspended
      and p.archived_at is null
      and p.merged_into_profile_id is null
    order by ap.profile_id, ap.mark_value asc, ap.meet_date asc
  ),
  with_division as (
    select f.*, sc.school_name, sc.city as school_city,
      (
        select d.division
        from public.ohio_school_divisions d
        where d.school_id = f.school_id
          and d.sport = 'cross_country'
          and d.gender = p_gender
          and d.season_start_year <= p_season
          and p_season <= d.season_end_year
        limit 1
      ) as division
    from fastest f
    left join public.ohio_schools sc on sc.id = f.school_id
  ),
  scoped as (
    select *
    from with_division w
    where p_division is null
      or w.division = (array['Division I', 'Division II', 'Division III', 'Division IV'])[p_division]
  )
  select s.profile_id, s.slug, s.display_name, s.school_id, s.school_name, s.school_city,
    s.grade, s.mark_text, s.mark_value, s.meet_name, s.meet_date, s.division,
    count(*) over () as total_before_limit
  from scoped s
  order by s.mark_value asc, s.meet_date asc, s.display_name asc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;

revoke all on function public.xc_leaders(text, integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.xc_leaders(text, integer, integer, integer, integer) to service_role;

commit;
