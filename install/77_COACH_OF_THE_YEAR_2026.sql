-- Podium Watch 2026 Coach of the Year
-- Purpose:
--   Adds 8 Coach of the Year categories (Boys and Girls, Divisions I-IV) to
--   the 2026 yearly awards from install/76_YEARLY_AWARDS_2026.sql, on the
--   same schedule and the same nomination, finalist and voting flow.
--
-- Nominees:
--   Open to every Ohio school in public/data/yearly-awards-2026-pool.json
--   ("coaches", built from ohio_schools by
--   scripts/build-yearly-awards-2026-pool.mjs). nominee_key is the
--   ohio_schools id. Podium Watch does not have every coach's name, so the
--   nominator types it; it is stored in the new coach_name column and only
--   shown to the admin until finalists are picked.
--
-- Divisions:
--   Schools are filed by their ohio_schools division (the boys cross
--   country division), except girls programs whose 2026 state meet division
--   is known, which use that. Decided with Zachary 2026-11-08.
--
-- Safety:
--   Additive only. Widens the award check to include 'coach', adds one
--   nullable column, and seeds 8 category rows. Existing rows are untouched.

begin;

alter table public.yearly_award_categories
  drop constraint if exists yearly_award_categories_award_check;

alter table public.yearly_award_categories
  add constraint yearly_award_categories_award_check
  check (award in ('athlete', 'team', 'coach'));

alter table public.yearly_award_nominations
  add column if not exists coach_name text
  check (coach_name is null or char_length(coach_name) <= 60);

insert into public.yearly_award_categories
  (slug, award, gender, division, label, nominations_open_at, nominations_close_at, voting_open_at, voting_close_at)
select v.slug, v.award, v.gender, v.division, v.label,
  timestamptz '2026-11-08 00:00:00+00',
  timestamptz '2026-11-10 02:00:00+00',
  timestamptz '2026-11-10 05:00:00+00',
  timestamptz '2026-11-14 02:00:00+00'
from (values
  ('coach-boys-d1', 'coach', 'boys', 1, 'Boys Division I Coach of the Year'),
  ('coach-boys-d2', 'coach', 'boys', 2, 'Boys Division II Coach of the Year'),
  ('coach-boys-d3', 'coach', 'boys', 3, 'Boys Division III Coach of the Year'),
  ('coach-boys-d4', 'coach', 'boys', 4, 'Boys Division IV Coach of the Year'),
  ('coach-girls-d1', 'coach', 'girls', 1, 'Girls Division I Coach of the Year'),
  ('coach-girls-d2', 'coach', 'girls', 2, 'Girls Division II Coach of the Year'),
  ('coach-girls-d3', 'coach', 'girls', 3, 'Girls Division III Coach of the Year'),
  ('coach-girls-d4', 'coach', 'girls', 4, 'Girls Division IV Coach of the Year')
) as v(slug, award, gender, division, label)
on conflict (slug) do nothing;

commit;
