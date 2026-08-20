-- Fix: CSV roster bulk import (Team Roster page -> "Upload a full roster")
-- fails outright on every attempt with:
--   null value in column "athlete_name" of relation "team_roster_entries"
--   violates not-null constraint
--
-- Root cause, confirmed directly against production: team_roster_entries
-- .athlete_name is a real, not-null, denormalized name snapshot column
-- (team_roster_entries has no first_name/last_name of its own -- see the
-- comment above entryPayload in lib/team_roster_service.mjs's saveAthlete(),
-- dated 2026-08-13, which fixed this same gap for the single "Add athlete"
-- save path). The CSV bulk-import path goes through a different code path
-- entirely -- a Postgres function, team_commit_roster_import_v1, that was
-- created directly against this Supabase project at some point and was
-- never captured in this repo's install/ migrations (confirmed: it does
-- not appear in any file here). Its actual source is not something this
-- repo can read or edit, and black-box testing (explicitly supplying an
-- "athlete_name" field on the JSON rows passed in) confirmed it does not
-- read one from its input either way -- it simply never sets the column on
-- INSERT. Since team_roster_entries had zero real rows in production before
-- the 2026-08-13 fix (per that same comment), this means CSV import had
-- likely never actually succeeded for a real coach before now.
--
-- Given that function's source can't be safely rewritten blind from here,
-- this migration works around it at the schema layer instead:
--   1. Relax the not-null constraint so the existing RPC's insert/update
--      succeeds instead of erroring outright.
--   2. Add a small, new, separately-owned backfill function that
--      lib/team_roster_service.mjs's commitImport() calls immediately
--      after the RPC succeeds, to set athlete_name correctly from
--      team_athletes.display_name (the exact same value the single-save
--      path already uses) for every row the import just touched.
-- The net effect: the column is still always correctly populated in
-- practice, just via a follow-up step this repo actually owns and can
-- verify, rather than trusting an opaque function that has been silently
-- broken since it was created.

begin;

alter table public.team_roster_entries
  alter column athlete_name drop not null;

create or replace function public.team_backfill_roster_entry_names_v1(p_season_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  with updated as (
    update public.team_roster_entries tre
    set athlete_name = ta.display_name
    from public.team_athletes ta
    where tre.athlete_id = ta.id
      and tre.season_id = p_season_id
      and tre.athlete_name is distinct from ta.display_name
    returning tre.id
  )
  select count(*)::integer from updated;
$$;

revoke all on function public.team_backfill_roster_entry_names_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.team_backfill_roster_entry_names_v1(uuid)
  to service_role;

commit;
