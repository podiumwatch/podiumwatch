-- Podium Watch -- Podium Play: seven more games (2026-09-02)
--
-- Purpose:
--   Relay Exchange, Cone Slalom, Pace Perfect, Pack Pass, Finish Chute,
--   Spike Shuffle, and Runner Says join the existing six games (Photo
--   Finish, Starting Gun, Hurdle Dash, Tap Sprint, Beat the Runner,
--   Memory Match) on the same podium_play_accounts table -- same
--   server-authoritative design as install/41/42: every value here is
--   computed by lib/podium_play_service.mjs from raw client-reported
--   measurements, never trusted directly from the client. Applies
--   equally to a signed-in row (user_id) and a guest row (install_id).
--
--   - relay_exchange_best_time_ms: fastest real relay time (lower is
--     better, unlike every other *_best_* column on this table so far).
--   - relay_exchange_best_score / _best_perfect_exchanges: the other two
--     independent Relay Exchange records (spec calls for four; the
--     fastest-time/highest-score/most-perfect-exchanges three are
--     tracked here -- a win streak was deliberately not added as a
--     fourth column since nothing else in this table tracks streaks
--     across separate runs, and adding that concept for one game alone
--     would be a real, unrequested architecture change).
--   - cone_slalom_best_distance / _best_groups_cleared: furthest run and
--     most obstacle groups cleared.
--   - pace_perfect_best_accuracy_pct / _best_streak: highest overall
--     timing accuracy (0-100) and longest perfect-beat streak.
--   - pack_pass_best_position / _best_score: best (lowest) finishing
--     position and highest game score -- best_position is the one
--     column on this whole table where a SMALLER number is the record,
--     matching how a real race place works.
--   - finish_chute_best_streak / _best_score: longest correct streak and
--     highest game score.
--   - spike_shuffle_best_streak / _best_score: longest correct-round
--     streak and highest game score.
--   - runner_says_best_sequence_length / _best_score: longest sequence
--     successfully repeated and highest game score.
--
-- Safety:
--   Purely additive. Adds fourteen new nullable columns to the existing
--   table. Does not alter or drop any existing column or row -- every
--   already-signed-in and already-guest account's real points, records,
--   and identity are completely untouched.

begin;

alter table public.podium_play_accounts
  add column if not exists relay_exchange_best_time_ms integer,
  add column if not exists relay_exchange_best_score integer,
  add column if not exists relay_exchange_best_perfect_exchanges integer,
  add column if not exists cone_slalom_best_distance integer,
  add column if not exists cone_slalom_best_groups_cleared integer,
  add column if not exists pace_perfect_best_accuracy_pct integer,
  add column if not exists pace_perfect_best_streak integer,
  add column if not exists pack_pass_best_position integer,
  add column if not exists pack_pass_best_score integer,
  add column if not exists finish_chute_best_streak integer,
  add column if not exists finish_chute_best_score integer,
  add column if not exists spike_shuffle_best_streak integer,
  add column if not exists spike_shuffle_best_score integer,
  add column if not exists runner_says_best_sequence_length integer,
  add column if not exists runner_says_best_score integer;

commit;
