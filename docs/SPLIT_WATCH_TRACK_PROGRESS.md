# Split Watch for Track: Progress

The plan is `docs/SPLIT_WATCH_TRACK_HANDOFF.md`. One phase per session; Zachary approves each before the next starts. Nothing here has been pushed or deployed unless it says so.

| Phase | Status | Date | Commit |
|---|---|---|---|
| 1. Close the hang paths and the offline reload gap | Done, approved, pushed | 2026-11-12 | f2afd1fa, 9d43cdf9 (clock) |
| 2. Lap mode (3200, 1600, 800) | Done, approved, pushed; install/96 run | 2026-11-12 | cc5b2879 |
| 3. Relays | Done, committed locally (D: working copy), not pushed; needs install/97 | 2026-11-12 | 871fab6f |
| 4. Meet wide crews and stronger codes | Not started | | |
| 5. Full offline (service worker, offline start) | Not started | | |
| 6. Public viewer for track | Not started | | |
| 7. Rehearsal mode and a dress rehearsal | Not started | | |

## Phase 1 (2026-11-12)

**What it does**

- One shared request helper, `public/scripts/split-watch-request.js`: every Split Watch request has a 15 second limit covering the whole round trip, one error shape, and one standard failure panel with Try again. Used by all nine pages: hub, helper race list, code entry, plan, live, review, public race page, meet center, guardian page.
- Hang paths closed that the August 31 fix missed:
  - Code entry and position confirmation buttons could stay greyed out forever. They now show "Checking..." or "Saving..." and always come back with a message.
  - Plan, review, public page, meet center and guardian page had no limit at all.
  - The sign-in token load (`team-auth-client.js`, `/api/team/config/`) had no limit and ran before every page's own request, so a stall there hung the page before its 15 second timer even started. Now bounded, and a failure is no longer remembered, so Try again can recover.
  - The sign-in checks (`getUser`) awaited on the hub, plan, meet center and guardian page had no limit. Bounded. On the live page it now runs in the background, so it can never hold up the start or live screen.
  - The account library (Supabase, from a CDN) was loaded with `defer`, so a stalled download blocked the page's own script from ever running. Split Watch pages now load it `async`, and the auth client waits for it (up to 8 seconds) only when it needs it.
  - The public race page used to replace a race already on screen with "Can't watch this race" (and retitle the tab "Race Not Found") on any brief wifi blip. A connection problem now keeps the race on screen and the poller retries; only a real "not found" answer shows that message.
- Live page works offline when it can load but can't reach the server: it opens the race from the copy saved on the phone (the race must already have started), shows a "WORKING OFFLINE" banner, keeps recording, and syncs on reconnect. The saved copy now also holds every device's last-known splits, this phone's role and position, and its clock correction, refreshed after each background pull. The banner clears on the first successful request.
- Leaving or closing the live page while taps are waiting to send shows the browser's leave-page warning.

**Limits (by design for Phase 1)**

- A reload in airplane mode still can't load the page itself: Split Watch pages are sent with `Cache-Control: max-age=0, must-revalidate` and there is no service worker yet. That is Phase 5. Phase 1 covers the common stadium case: the page loads (or is already open) but the server can't be reached or stalls.
- A race that hasn't started can't be opened offline, and starting a race still needs a connection (Phase 5).

**Checks**

- `scripts/test-split-watch-load-timeout.mjs` (in `npm test`): source checks across all nine pages plus the helper's behaviour with a fake network.
- `scripts/test-split-watch-browser.mjs` (`npm.cmd run test:split-watch-browser`, needs a build and Chrome; not in the main chain): every screen reaches Try again within 16 s with the network stalled (measured 10.2 to 15.5 s), and the offline reload, offline taps, leave warning, reconnect sync and no-duplicate resend all pass.
- Full `npm test` passes. Two older tests were updated to the new structure without changing what they guard: `test-race-day-access.mjs` (the 401 redirect now runs through the helper) and `test-helper-race-selection.mjs` (a text search made order-safe).

## Phase 1 addition: race clock accuracy (2026-11-12)

**The problem:** in live cross country tests, started at the gun, the Split Watch clock was about 15 s off the official clock by the finish (about 17 minutes), sometimes ahead and sometimes behind.

**Cause (found before fixing):**

1. The start was taken AFTER the "Start this race now?" confirm box was answered (late by however long that took), and in the starting phone's own clock, not server time. It was not the server's receive time.
2. Elapsed time was never built from adding up ticks (that was fine).
3. The starting phone timed with `performance.now()` while the page stayed open; on Android it can stop while the phone sleeps, so a screen lock made that phone fall behind.
4. The phone-to-server correction was one sample per request, replaced on every request (every 8 to 11 s), with the server's processing time inside it; one slow or lopsided round trip moved it by seconds, in either direction.
5. Different time sources: the starting phone used `performance.now()`; every other phone (and the starting phone after a reload) used its own clock plus the noisy correction, measured against a start stored in the starting phone's UNcorrected clock. So every other phone was off by however far the starting phone's clock was off (the biggest part of the 15 s).

**Fix:**

- One time source on every phone: (this phone's clock + its correction to server time) minus the official start, in server time (`public/scripts/race-timer.js`).
- The start is the moment Start is tapped (taken before the confirm box), converted to server time, and sent with the request. If no correction has been measured yet, the page waits briefly for one; the tap moment is already fixed, so the wait never moves the start.
- The correction (`public/scripts/race-clock-sync.js`) comes from NTP-style samples: the server returns when the request arrived and when the reply left (`api/split-watch/clock.js`, a tiny endpoint with no sign-in and no database; sync and sessions replies carry the same two times), so server processing time isn't measured. The sample with the shortest round trip wins; samples slower than 1.5 s are thrown away; samples are kept 10 minutes (the best one is kept longer if no newer one arrives, e.g. offline); a phone clock change is detected and the samples restart. Measured on load (5 samples), every minute (3), when the page becomes visible again, and on reconnect.
- The screen stays awake during a live race (the existing wake lock, re-requested when the page is shown again).
- Each tap stores the correction it used and its error bar (`clock_offset_ms`, `clock_uncertainty_ms`) on the phone and sends them with the tap. The server doesn't store them yet: that needs a database column (proposed for the Phase 2 migration).
- Clock status under the race clock: "Clock synced (±0.1 s)", "Clock synced 4 min ago (±0.4 s)", "-- working offline", or "Clock not synced yet -- using this phone's time".
- Tap capture times (`wall_clock_captured_at`) are now in server time too, consistent with the start.
- The manual "set to official elapsed time" adjustment is unchanged.

**Checks:**

- `scripts/test-split-watch-clock.mjs` (in `npm test`): a simulated 17 minute race with fake clocks (phone A 15 s behind and drifting 40 ppm, phone B 8 s ahead and drifting -35 ppm) over an uneven network (each leg up to 1.2 s, server work up to 2 s, a few legs up to 4 s): the start is within 0.22 s of the tap with the start request delayed 8 s; at 17:00, after a 4 minute screen lock, a background stretch, a 2 s phone clock change and a reload, the starting phone is 0.20 s off and a phone that joined at minute 8 is 0.22 s off. The old design on the same race: 10.8 s off.
- `scripts/test-split-watch-browser.mjs` (real Chrome): server clock 15 s ahead, confirm answered after 2 s, start request held 8 s: start off by 0.03 s; starting phone, second phone and the starting phone after a reload all within 0.01 s.
- `scripts/test-split-watch.mjs`: the timer assertions were rewritten for the new design (two old ones are deliberately reversed: the live path now DOES apply the correction, and reset() keeps the correction, since it belongs to the phone's clock, not the race).

## Phase 2: lap mode (2026-11-12)

**Database:** `install/96_SPLIT_WATCH_LAP_MODE.sql` (run it in Supabase before pushing; additive only). Adds `race_sessions.tap_mode` (default `checkpoint`), `event_key`, `lap_length_meters`; `race_checkpoints.location` and `is_exchange`; `race_participants.disqualified`; `race_splits.clock_offset_ms` and `clock_uncertainty_ms` (each tap's clock correction, proposed in Phase 1). Number 96, not 95: 95 is used on the parked `wo-r0f` branch.

**What it does**

- Hub: Sport "Track" shows an event (3200, 1600, 800, or Custom) and the track's lap (400 or 200). An event builds its checkpoints (every lap at the finish line; for an 800 on a 400 m track, optional 200 m mark splits at 200 and 600) and creates a lap mode race. Custom keeps the usual checkpoint rows, without cross country's "Mile 1" placeholder.
- Live page, lap mode: one big button per entry with name, laps done of total, last lap and running total (to the tenth). A tap records that entry's next lap at the place the phone is timing (a "I'm timing at" picker appears only when the race has 200 m mark splits). A second tap inside the double tap window (15 s for 400 m laps, 8 s for 200 m; constants in `lib/race_laps.mjs`) is ignored; a tap past the finish is refused. Undo last lap goes through the revision history. DNS, DNF and DQ drop an entry out of the order. Buttons are ordered by expected next pass (last pass + last lap) and re-sorted only after a tap settles (1.5 s). No checkpoint tabs or pack capture in lap mode.
- Server: a new lap tap is placed by TIME, not by the lap the phone guessed (`resolveLapTap`): within the window of a recorded pass = the same pass (first saved wins); later than every recorded pass = the next open lap (the phone is told which); earlier = it fills the missed lap, moving later passes up one lap (`planLapWrites`; when the free lap holds an undone row, the times shift through the rows as revisions instead, so nothing collides or is lost).
- Review: a Lap column (lap split and its distance when it isn't a full lap) and tenths, for lap mode races only.
- Each tap's clock correction is saved on the server once install/96 has run (the code checks for the columns first, so cross country keeps working before the SQL runs).

**Checked**

- `scripts/test-split-watch-laps.mjs` (in `npm test`): checkpoints for every event and track; a simulated 3200 with 24 fake entries (6 lapped once, 17 twice): all 192 laps on the right lap, 36 double taps ignored, no tap past the finish, the next runner to cross always in the top 3 of the order (first 117 of 144 times); the two phone stale lap sequence lands on lap 3 and the same pass from the other phone is a duplicate; a late tap fills a missed lap (and the undone-row case shifts times with revisions); undo, double tap, finish; browser copy identical to the server copy; cross country stays on its old path.
- `scripts/test-split-watch-browser.mjs`: lap mode on the live page (buttons, lap 1, double tap ignored, undo, one lap tap sent); every earlier check still passes. The first load of the live page, race list, review and public page now gives up 15 s after the page STARTED loading (a cold load pushed the live page to 16.1 s); retries keep the full 15 s.

**Not done (as planned)**

- Pack capture is select-then-capture today, not "tap now, assign after", so it stays a checkpoint-mode feature; lap mode hides it.
- Helpers with a single-checkpoint position can only tap that checkpoint; until Phase 4 (meet-wide, location-based positions), give lap mode helpers a "backup" position.

## Phase 3: relays (2026-11-12)

**Where the work is:** the C: drive was full (0 MB free), so this phase was built and committed in a separate working copy on the D: drive, `D:\PodiumWatch\pw_site_phase3` (a clone of the C: repo, with `node_modules` linked from C:). Nothing was pushed. To bring the commit into the C: repo once there's space: `git pull D:/PodiumWatch/pw_site_phase3 main` from the C: repo (a fast-forward).

**Database:** `install/97_SPLIT_WATCH_RELAYS.sql` (additive only). Adds `race_sessions.relay_leg_meters` (the leg distances in order; null for everything that isn't a relay), `race_participants.entry_type` (`individual` default, or `relay`), and a new `race_relay_legs` table (leg order, distance, and a rostered athlete, a typed name, or neither = TBD; never both; server-only access like every race_ table).

**How relays are modeled:** a relay team is ONE entry (a race_participants row, `entry_type` relay, `manual_name` = the team's name) that runs laps. So lap mode, the double tap guard, undo, time-based placement and the two phone rules from Phase 2 all apply unchanged. Legs are a layer on top. Exchanges are checkpoints with `is_exchange`. A leg split is never stored: it's the exchange time minus the previous exchange (or the start), worked out when shown, so changing who runs a leg only changes names.

**What it does**

- Hub: Track events now include 4x800, 4x400, 4x200, 4x100 (finish only) and Custom relay (leg distances typed in order, e.g. 1200, 400, 800, 1600 for a DMR; 2 to 8 legs, steps of 100 m, at most 10,000 m). Checkpoints are built from the legs and the track's lap: a split at the finish line every lap, the ones at a leg's end flagged as exchanges. An exchange halfway round a 400 m track (the 4x200's 200 and 600, an SMR's 200) is optional ("Also time the exchanges at the 200 m mark") and labeled approximate because of the stagger. An exchange that can't be tapped from either place (after a 100 m leg) has no checkpoint; those legs show together.
- Plan page: for a relay, "Add runners" is replaced by "Relay teams": add teams (named A team, B team... automatically, editable), pick each leg's runner from the roster, type a name, or leave TBD. Editable up to and during the race. The server checks each leg runner is on this team's roster, one runner per leg, unique team names, the right number of legs, and refuses to remove a team that already has times (mark it DNS/DNF instead). The individual-runner save is refused on a relay (it would have deleted the teams).
- Live page: each relay button shows the team, who's running now ("Leg 2: name"; "Legs 1-2" when the exchange between them isn't timed), laps done, and the last leg split. A tap at an exchange closes that leg and shows its split straight away. Leg names are in the saved copy, so they still show offline, and a leg change made mid race reaches the phones on the next background pull.
- Review: a team's review adds a Legs table (leg, runner, distance, leg split to the tenth) and the team total; the lap column already gives the 400s inside an 800 leg.
- Rehearsal: "Practice this race" now copies lap mode fields (tap mode, event, lap length, checkpoint locations and exchanges) and relay teams with their legs. **Found and fixed here:** before this, a rehearsal of a Phase 2 lap mode race (a 1600) came out as an ordinary checkpoint race.

**Checked**

- `scripts/test-split-watch-relays.mjs` (new, in `npm test`): presets for every relay on 400 m and 200 m tracks; the REAL service (create, save teams, lap taps through pushSplits, review) against an in-memory fake database: 4x800 and 4x400 with two fake teams each, leg splits sum to the team total and the right athlete is on every leg, 400s inside 800 legs; changing the leg order mid race moves names and changes no recorded time; a custom 1200/400/800/1600 relay's exchanges and leg splits; lapped relay teams; validation; browser/server parity; cross country and individual races unchanged. (A deliberately broken copy of the test fails, so the checks are real.)
- `scripts/test-split-watch-browser.mjs`: a relay on the live page in real Chrome (leg runner on the button, leg split shown at the exchange, next leg's runner after); every earlier check still passes.
- A one-off browser check of the plan page relay editor at phone width (add a team, pick roster / typed / TBD legs, save, reload): no page errors, no sideways scroll.
- Full `npm test` passes.

**Not done / open**

- The public parent page shows a relay team by its team name only; leg names and leg splits for parents are Phase 6.
- A relay leg runner doesn't show the race on that athlete's own Split Watch view (athlete and guardian pages find races by entry, and a relay entry is the team). Worth deciding with the profile question in section 7.
