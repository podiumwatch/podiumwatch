-- Split Watch: Race Day Code -- always-viewable current code
-- Purpose:
--   Real coach feedback (2026-08-27): "Whenever I click share access
--   code with a timer, it says I have to regenerate code. I just want
--   one code per day -- once I give that code out, that device is good
--   to go." The second half was already true (a joined device's session
--   lasts 30 days, untouched by a later regenerate) -- the first half
--   wasn't. install/19's original design stored only a SHA-256 hash of
--   the code, so re-opening "Get volunteers timing" after the first
--   reveal showed no way to read the current code back at all, only
--   "Regenerate" -- which replaces it, breaking it for anyone who
--   hasn't joined with the OLD one yet. A coach adding a third helper
--   mid-afternoon had no way to hand out the same code already given to
--   the first two that morning.
--
--   team_race_day_codes.code now also stores the plaintext value,
--   purely so the coach's own dialog can show it again on demand.
--   code_hash remains the only thing verifyRaceDayCode() ever checks --
--   this column is display-only, never used to authorize anything. See
--   lib/race_day_auth.mjs's header comment for why this is a deliberate,
--   narrow exception made for THIS ONE code (a 4-digit, single-team,
--   rate-limited, instantly-revocable code that's *meant* to be spoken
--   aloud or written on a whiteboard for a whole timing crew) and not a
--   change to how athlete_invites/guardian_invites tokens work --
--   those stay single-recipient, hash-only, reveal-once, unchanged.
--
-- Safety:
--   Purely additive -- one new nullable column. A code generated before
--   this migration runs has code = null until the coach's next
--   Regenerate; getRaceDayCodeStatus()/the dialog already handle that
--   (falls back to today's "no code to show" state, same as before this
--   fix, for that one team until they regenerate once).

begin;

alter table public.team_race_day_codes
  add column if not exists code text;

commit;
