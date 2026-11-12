# Split Watch for Track: Progress

The plan is `docs/SPLIT_WATCH_TRACK_HANDOFF.md`. One phase per session; Zachary approves each before the next starts. Nothing here has been pushed or deployed unless it says so.

| Phase | Status | Date | Commit |
|---|---|---|---|
| 1. Close the hang paths and the offline reload gap | Done, committed locally, not pushed | 2026-11-12 | see the Phase 1 entry below |
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
