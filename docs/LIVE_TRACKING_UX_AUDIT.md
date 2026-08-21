# Live Tracking / Race Command Center — UX Audit

Written 2026-08-21, against the real, current code — every finding below was
confirmed by reading the actual file before being listed, not inferred from
naming or assumption. Scope: every screen touching live splits entry or live
results viewing, for all three audiences (parent/spectator, coach, volunteer).

**One naming note up front:** this codebase calls the feature **Race Command
Center**, not "run command center" — same system the handoff doc describes
(manual split entry by volunteers/coaches at checkpoints, no GPS/chip
hardware), just the name that's actually in the code and UI.

## Screens covered

| Audience | Page | Files |
|---|---|---|
| Parent (anonymous, zero-friction) | `/race/?race=<id>` | `src/pages/racepublic.mjs`, `public/scripts/race-public.js`, `public/scripts/race-poll.js` |
| Parent (signed-in, persistent) | `/guardian-home/` | `src/pages/guardianhome.mjs`, `public/scripts/guardian-home.js` |
| Coach + volunteer (same page — a Race Day Access Code volunteer uses the identical UI as the coach) | `/race-command-center/live/` | `src/pages/racecommandcenterlive.mjs`, `public/scripts/race-command-center-live.js`, `public/scripts/race-local-store.js` |
| Coach (post-race) | `/race-command-center/review/` | `src/pages/racecommandcenterreview.mjs`, `public/scripts/race-command-center-review.js` |
| Server-side projection shared by the above | — | `lib/race_viewer_service.mjs`, `api/race/public.js` |

## Findings by screen

### Parent-facing, anonymous (`/race/`)

- ✅ **No login required at all.** Confirmed: `race-public.js` makes a plain
  unauthenticated `fetch`, no bearer token, no `team-auth-client.js` even
  loaded on this page. This is the actual "reach it without an account"
  requirement, already met.
- ✅ **Lightweight.** No Supabase client, no auth library on this route at
  all — just `race-poll.js` (77 lines) + `race-public.js` (146 lines). No
  autoplay media anywhere in the template.
- ✅ **Real polling, not a static snapshot.** `race-poll.js` polls every 10s
  while live, 30s once the race is over, pauses entirely when the tab isn't
  visible, and backs off on error — a genuinely well-built poller.
- ❌ **No single-runner view.** Everything is one shared table. A parent
  looking for their own kid has to scan every row, every poll — there's no
  "find my runner" of any kind.
- ❌ **Freshness is one global, absolute-clock timestamp** (`Updated
  3:42:07 PM`), and it reflects when the *page last polled*, not when any
  given runner's *own last split* was captured. A runner sitting between
  checkpoints for 8 minutes still shows under a page that says it updated
  10 seconds ago — the exact "stale data looks live" trap the handoff doc
  is worried about. Traced to the root cause: `wall_clock_captured_at` is
  fetched from the database in `lib/race_viewer_service.mjs`'s
  `SPLIT_FIELDS`, but silently dropped in `loadSpectatorRace()`'s final
  mapped output (`lib/race_viewer_service.mjs:238-252`) — the client
  literally has no way to show a per-runner freshness time today because
  the server never sends it.
- ❌ **No alert/notification opt-in anywhere on this page**, not even a stub.

### Parent-facing, signed-in (`/guardian-home/`)

- ✅ **Already single-runner (or single-family) focused** — a guardian only
  ever sees their own linked athlete(s)' race cards, each showing that
  child's own checkpoint-by-checkpoint goal-vs-actual. This already
  satisfies the "not a buried row in a full team table" bar well.
- ❌ **No live polling at all — loads once, never refreshes.** This is a
  real, confirmed bug, not a design choice: `race-poll.js`'s own header
  comment says it was "written generically enough for the guardian home
  page to reuse later," but `guardian-home.js` never calls it —
  `initialize()` fetches `/api/guardian/races/` exactly once. A parent
  who signs in to watch their kid's live race sees a frozen snapshot from
  the moment the page loaded, with no indication anything is stale, until
  they manually reload.
- ❌ **No freshness indicator of any kind**, not even a global one (the
  anonymous page at least has that much).

### Coach + volunteer, live entry (`/race-command-center/live/`)

The handoff doc's "coach view" and "volunteer/data-entry" sections both
map to this exact same page — a Race Day Access Code volunteer at a
checkpoint uses the identical UI a coach does, not a separate stripped-down
one.

- ✅ **Whole team shown at once**, ordered fastest-goal-first (built earlier
  this session specifically so a volunteer doesn't have to scroll for
  whoever's arriving next).
- ⚠️ **No manual sort toggle** — order is always goal-pace-driven; there's
  no way to re-sort alphabetically or by bib/number. Minor; flagging since
  the doc asked for "sortable."
- ❌ **No ahead/behind-target comparison shown anywhere on this page, live.**
  This is a real, deliberate tension worth naming plainly: earlier this
  session, the user explicitly asked for goal/target info to be *stripped
  out* of this exact view for information density ("Only show necessary
  information... I need more athletes available to press"), and it was —
  on purpose, and it was the right call for the *tap-to-record* list,
  where a coach's whole job in that exact moment is "which name, tap
  fast." The fix below resolves the tension rather than picking a side:
  add the ahead/behind comparison to the **Recorded** list only (a runner
  who already has a time), never to the **still-need-a-time** tap list,
  so the dense tap experience the user asked for is untouched.
- ❌ **No automatic visual flag for a runner significantly off pace.** Same
  root cause as above — there's currently no ahead/behind computation on
  this page at all to flag from. `RaceMath.computeGoalStatus()` already
  exists and is tested (used by Review) — reusable here directly.
- ✅ **One-tap Undo, in the coach's own normal view.** Confirmed: the
  Recorded list's `Undo` button is right there, not behind any
  admin-only panel.
- ✅ **Real offline-first queue, better than the doc assumes.**
  `race-local-store.js` is a genuine IndexedDB-backed local-first store;
  every tap is saved locally and re-rendered *before* any network call,
  and a real sync-status pill already shows `Synced` / `Syncing…` /
  `Saved on device` / `Offline — saved on device` / `Sync needs
  attention`. No fix needed here — flagging it as already-solved so it
  isn't accidentally "fixed" into something worse.
- ⚠️ **Tap confirmation exists but is easy to miss.** A successful tap
  immediately moves that runner from "still need a time" into "Recorded,"
  which *is* a real confirmation — but it's a list re-render, not
  something unmistakable if a coach's eyes are back up on the runners
  crossing the line rather than on the screen. Worth a brief, deliberate
  flash/highlight (and vibration where available) at the moment of tap.
- ❌ **No bib-based entry — architecture mismatch, not a bug.** The handoff
  doc assumes "numeric-first bib entry" with auto-advance. The real system
  has no bib numbers at all: a coach/volunteer taps a runner **by name**
  from a list, and the device's own running clock supplies the time —
  there's no manual time entry to auto-advance *into* in the normal case.
  This was a deliberate, already-validated design from earlier this
  session (large 56px tap targets, dense name list, zero typing for the
  common case). Recommendation: keep it — it already satisfies the
  *intent* behind the bib-entry ask (fast, minimal-taps identification)
  via a different, arguably better mechanism, and building a parallel bib
  system would fragment identification into two paths for no real gain.
  Flagging this explicitly rather than silently building bib entry nobody
  asked for by name.
- ❌ **No export/screenshot/copy-to-clipboard summary anywhere** — checked
  both this page and Review; neither has one.

### Coach, post-race (`/race-command-center/review/`)

- ✅ Ahead/behind/status tags already exist here (`ah-tag-ahead` etc.), so
  the "compare to seed pace" need is already met for the *post-race* view
  — it's specifically the *live* view that's missing it (see above).
- ❌ No export/copy/screenshot-friendly summary for pasting into a team
  group text. This is the more natural home for that feature than the
  live page (a coach texting a recap happens after the race, not mid-race
  while still tapping splits) — built here.

### Cross-cutting

- ❌ **No/stale/fresh states are not visually consistent across the three
  live-viewing surfaces.** The Live page has a real sync-status pill
  (good). The public spectator page has one global absolute timestamp
  (weak). The guardian page has nothing (missing entirely, since it
  doesn't even poll).
- ✅ **Error states already reasonably handled** on both parent-facing
  pages — a missing/not-visible/not-found race shows a clear "Can't watch
  this race" or "Your athlete's races could not be loaded" card with a
  real message, not a blank page or raw error. Live entry already has
  offline/error handling via the sync-status pill. No fix needed here.

## Fix plan (screen by screen, one commit per screen)

1. **Guardian Home** — wire up the already-built `race-poll.js`, add a
   real per-athlete freshness line.
2. **Public spectator page** — add `wall_clock_captured_at` to the server
   projection, add a per-runner relative freshness time, add a "find my
   runner" filter/focus, add an alerts-signup stub that's honest about
   being a placeholder.
3. **Coach Live page** — add ahead/behind-target to the Recorded list only
   (tap list untouched), auto-flag a significantly-off-pace runner there,
   add a brief tap-confirmation flash.
4. **Review page** — add a copy-to-clipboard team text summary.

## What could not be resolved without a decision (handing back, not guessing)

- **Alerts/notifications on the public spectator page**: built as an
  honest, functioning *opt-in capture* (email or phone, stored), not a
  real push/SMS send — there is no SMS provider or push infra anywhere in
  this codebase to send through, and standing this up (a Twilio/SMS
  account, a push service, real cost + compliance surface) is a genuinely
  separate decision, not something to wire up silently. Flagged in the UI
  itself as "we'll notify you once this is ready," and the capture point
  is built so a real send can be turned on later without changing the
  UI contract.
- **Bib-based volunteer entry**: recommend *not* building this — see the
  Live page section above. If there's a specific reason bib numbers are
  wanted (e.g., printed bibs already exist and a volunteer can't
  reliably tell runners apart by name/face at a distant checkpoint),
  that's a real, different problem worth a short conversation before
  building a second identification system.
- **Manual sort toggle on the Live page**: didn't build this — it's a
  minor, non-blocking gap, and picking a second sort mode (alphabetical?
  by bib, which don't exist? by last-tapped?) is a real product
  choice, not an obvious default.
