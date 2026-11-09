-- Podium Watch: prepare for the 2026 postseason import (WO-05)
-- Purpose:
--   1. Results link to their meet by id, not only by meet name and date:
--      meet_id on athlete_performances and result_team_scores, with an
--      index, backfilled only where exactly one meet has the same name
--      and date (nothing is guessed; rows that don't match stay null and
--      are listed by the preview query below).
--   2. honor_label on athlete_performances for state-meet honors such as
--      "All-Ohio first team" (Division I places 1-20 first team, 21-40
--      second team; Divisions II-IV 1-24 and 25-48, OATCCC cut lines). A
--      label, not a new number.
--   3. ohio_schools.ohsaa_school_id becomes optional (still unique). The
--      approved school mapping adds 53 schools that ran in the 2026
--      postseason but are missing from the table; their OHSAA school ids
--      aren't in our data and are never made up. They are marked in
--      metadata as added from the 2026 postseason results and can be
--      filled in later.
--
-- Safety:
--   Additive: two new nullable columns, one dropped NOT NULL, indexes, and
--   a backfill that only sets meet_id where it is null and the match is
--   exact and unique. No rows are deleted.

begin;

alter table public.athlete_performances
  add column if not exists meet_id uuid references public.meets(id) on delete set null,
  add column if not exists honor_label text check (honor_label is null or char_length(honor_label) <= 80);

alter table public.result_team_scores
  add column if not exists meet_id uuid references public.meets(id) on delete set null;

create index if not exists athlete_performances_meet_id_index on public.athlete_performances (meet_id);
create index if not exists result_team_scores_meet_id_index on public.result_team_scores (meet_id);

alter table public.ohio_schools alter column ohsaa_school_id drop not null;

-- Backfill: exactly one meet with the same name (case-insensitive) and date.
with unique_meets as (
  select lower(btrim(name)) as key_name, meet_date, min(id::text)::uuid as meet_id
  from public.meets
  group by lower(btrim(name)), meet_date
  having count(*) = 1
)
update public.athlete_performances ap
set meet_id = um.meet_id
from unique_meets um
where ap.meet_id is null
  and lower(btrim(ap.meet_name)) = um.key_name
  and ap.meet_date = um.meet_date;

with unique_meets as (
  select lower(btrim(name)) as key_name, meet_date, min(id::text)::uuid as meet_id
  from public.meets
  group by lower(btrim(name)), meet_date
  having count(*) = 1
)
update public.result_team_scores rts
set meet_id = um.meet_id
from unique_meets um
where rts.meet_id is null
  and lower(btrim(rts.meet_name)) = um.key_name
  and rts.meet_date = um.meet_date;

commit;

-- Preview after running: results that still have no meet (expected for
-- most regular-season results until those meets get pages).
-- select meet_name, meet_date, count(*) from public.athlete_performances
-- where meet_id is null group by 1, 2 order by 3 desc limit 50;
