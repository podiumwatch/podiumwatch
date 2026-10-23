-- Podium Watch -- Podium Play: Guess the Logo (2026-10-23)
--
-- Purpose:
--   Adds a 14th game to podium_play_accounts, same server-authoritative
--   design as install/41/42/43: every value here is computed by
--   lib/podium_play_service.mjs from a raw client-reported result
--   (guessesUsed, solved), never trusted directly from the client.
--   Applies equally to a signed-in row (user_id) and a guest row
--   (install_id).
--
--   Guess the Logo is a different shape from the other 13 games on this
--   table: one real daily puzzle (same Ohio school logo for everyone,
--   picked deterministically client-side from the public school-logo
--   pool), not an instantly-replayable arcade round. That's what
--   guess_logo_last_played_date is for -- lib/podium_play_service.mjs
--   rejects a second real submission for an account on the same
--   calendar day outright, rather than silently awarding zero points.
--
--   - guess_logo_best_score: the best single-day score ever earned
--     (fewer guesses used to solve = higher score).
--   - guess_logo_current_streak: consecutive real calendar days solved
--     with no gap -- resets to 0 on a miss or a skipped day, same as a
--     real daily-puzzle streak.
--   - guess_logo_best_streak: the longest current_streak this account
--     has ever reached.
--   - guess_logo_last_played_date: the last real calendar day (UTC,
--     YYYY-MM-DD) this account submitted a Guess the Logo result --
--     both the once-per-day gate and the streak-continuity check.
--
-- Safety:
--   Purely additive. Adds four new nullable columns to the existing
--   table. Does not alter or drop any existing column or row -- every
--   already-signed-in and already-guest account's real points, records,
--   and identity are completely untouched.

begin;

alter table public.podium_play_accounts
  add column if not exists guess_logo_best_score integer,
  add column if not exists guess_logo_current_streak integer,
  add column if not exists guess_logo_best_streak integer,
  add column if not exists guess_logo_last_played_date text;

commit;
