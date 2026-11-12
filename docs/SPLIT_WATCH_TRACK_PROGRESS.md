# Split Watch for Track: Progress

The plan is `docs/SPLIT_WATCH_TRACK_HANDOFF.md`. One phase per session; Zachary approves each before the next starts. Nothing here has been pushed or deployed unless it says so.

| Phase | Status | Date | Commit |
|---|---|---|---|
| 1. Close the hang paths and the offline reload gap | Done, committed locally, not pushed | 2026-11-12 | f2afd1fa |
| 2. Lap mode (3200, 1600, 800) | Not started | | |
| 3. Relays | Not started | | |
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
