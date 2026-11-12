-- Split Watch for track, Phase 2: lap mode (3200, 1600, 800)
-- docs/SPLIT_WATCH_TRACK_HANDOFF.md, 2026-11-12
--
-- What it adds (additive only; nothing existing is dropped, renamed or
-- changed, and every existing row keeps today's behavior):
--
--   race_sessions
--     tap_mode           'checkpoint' (today's behavior: a tap records at the
--                        checkpoint the phone has selected) or 'lap' (a tap
--                        records that runner's own next lap). Default
--                        'checkpoint', so every existing race is unchanged.
--     event_key          the track event a race was built from ('3200',
--                        '1600', '800'; relays come in Phase 3). Null for
--                        cross country and custom races.
--     lap_length_meters  the track's lap (400 outdoor, 200 most indoor
--                        tracks). Null for cross country.
--
--   race_checkpoints
--     location           where on the track the checkpoint is: 'finish_line'
--                        or 'mark_200'. Null for cross country.
--     is_exchange        relay exchange checkpoint (used from Phase 3).
--                        Default false.
--
--   race_participants
--     disqualified       a DQ mark, so the entry drops out of the lap order.
--                        Default false. (status already has 'dns' and 'dnf';
--                        a separate flag avoids touching that check
--                        constraint.)
--
--   race_splits
--     clock_offset_ms        the clock correction (server time minus phone
--                            time) the phone used for this tap (Phase 1 race
--                            clock accuracy). Null when it had none, and for
--                            every existing row.
--     clock_uncertainty_ms   that correction's error bar (half the best
--                            round trip). Null when unknown.
--
-- Safety: new nullable or defaulted columns only, plus two check
-- constraints on the NEW columns. No data is written. Safe to run while
-- Split Watch is in use; safe to run twice.
--
-- Run it BEFORE pushing the Phase 2 code. (The code also works without it:
-- it leaves the new fields out until these columns exist, so cross country
-- keeps working either way, but lap mode needs them.)
--
-- To undo (only if no lap race has been created yet; this deletes the new
-- columns and anything stored in them):
--   alter table public.race_splits drop column if exists clock_uncertainty_ms, drop column if exists clock_offset_ms;
--   alter table public.race_participants drop column if exists disqualified;
--   alter table public.race_checkpoints drop column if exists is_exchange, drop column if exists location;
--   alter table public.race_sessions drop column if exists lap_length_meters, drop column if exists event_key, drop column if exists tap_mode;

begin;

alter table public.race_sessions
  add column if not exists tap_mode text not null default 'checkpoint',
  add column if not exists event_key text,
  add column if not exists lap_length_meters numeric;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'race_sessions_tap_mode_check') then
    alter table public.race_sessions
      add constraint race_sessions_tap_mode_check check (tap_mode in ('checkpoint', 'lap'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'race_sessions_lap_length_check') then
    alter table public.race_sessions
      add constraint race_sessions_lap_length_check check (lap_length_meters is null or lap_length_meters > 0);
  end if;
end $$;

alter table public.race_checkpoints
  add column if not exists location text,
  add column if not exists is_exchange boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'race_checkpoints_location_check') then
    alter table public.race_checkpoints
      add constraint race_checkpoints_location_check check (location is null or location in ('finish_line', 'mark_200'));
  end if;
end $$;

alter table public.race_participants
  add column if not exists disqualified boolean not null default false;

alter table public.race_splits
  add column if not exists clock_offset_ms numeric,
  add column if not exists clock_uncertainty_ms numeric;

commit;

-- Check (read only): every new column should be listed.
-- select table_name, column_name, data_type, column_default
-- from information_schema.columns
-- where table_schema = 'public'
--   and (table_name, column_name) in (
--     ('race_sessions','tap_mode'), ('race_sessions','event_key'), ('race_sessions','lap_length_meters'),
--     ('race_checkpoints','location'), ('race_checkpoints','is_exchange'),
--     ('race_participants','disqualified'),
--     ('race_splits','clock_offset_ms'), ('race_splits','clock_uncertainty_ms'))
-- order by table_name, column_name;
