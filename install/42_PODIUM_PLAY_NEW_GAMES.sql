-- Podium Watch -- Podium Play: Tap Sprint, Beat the Runner, Memory Match
--
-- Purpose:
--   Three new launch games (2026-09-01), each getting the same
--   server-authoritative record columns every existing game already has
--   on podium_play_accounts (install/41, already run) -- computed from
--   raw inputs by lib/podium_play_service.mjs, never trusted from the
--   client. Applies equally to a signed-in row (user_id) and a guest row
--   (install_id); nothing about the two-identity-kind design from
--   install/41 changes here.
--
--   - tap_sprint_best_distance: the spec's single best-distance record.
--   - beat_the_runner_best_round: "save the player's highest COMPLETED
--     round" -- the highest round number (1-8) ever successfully
--     defeated, not merely reached.
--   - memory_match_best_time_ms / memory_match_fewest_moves: two
--     independent bests, per spec ("save the player's fastest time and
--     fewest moves") -- a single run can set either, or both, or
--     neither, same as Hurdle Dash's three independent bests.
--
-- Safety:
--   Purely additive. Adds four new nullable columns to the existing
--   table. Does not alter or drop any existing column or row -- every
--   already-signed-in and already-guest account's real points, records,
--   and identity are completely untouched.

begin;

alter table public.podium_play_accounts
  add column if not exists tap_sprint_best_distance integer,
  add column if not exists beat_the_runner_best_round integer,
  add column if not exists memory_match_best_time_ms integer,
  add column if not exists memory_match_fewest_moves integer;

commit;
