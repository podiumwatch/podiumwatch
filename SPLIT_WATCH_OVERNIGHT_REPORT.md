# Split Watch — Overnight Deep-Dive Report

Prepared per `SPLIT_WATCH_OVERNIGHT_DEEP_DIVE_HANDOFF.md`. Both prerequisite passes
(`SPLIT_WATCH_REBRAND_HANDOFF.md`, `SPLIT_WATCH_MOBILE_FIXES_HANDOFF.md`) were already
complete before this pass started — commits `5003c8f`…`721fad0` below cover the rebrand,
mobile fixes, and this pass, in that order.

## 1. Readiness verdict

**Ready with caveats.** The core loop — a coach plans a race, a volunteer times it on a
phone, a parent watches it live and reviews it after — works, is now reasonably scoped
by role, and survived a real concurrency test against production Supabase. But this
pass found one **blocker-severity** bug (§2) that would have silently and permanently
broken data collection from any device unlucky enough to hit it mid-race, and it was
only found by reading the schema directly, not by anything in the existing test suite —
which means there is real, uninspected surface area left. Nothing else found rose to
blocker. The honest caveats: this was a code-and-Playwright audit, not a device audit —
§4 lists exactly what still needs a real phone, a real course, and real users before
this should be called launch-ready without reservation.

## 2. Fixes made

### Priority 1 — Data exposure / scope correctness

**Plan page reachable by a race-day code, not just a coach.**
What was wrong: `/split-watch/plan/` — full roster editing, every runner's Goal A/B/C
and pacing strategy, and race deletion — had no gate beyond hiding one button. A
volunteer with just a timing code could reach it via the Live page's own race-switcher
(any draft/scheduled race for today appears there) or a direct/bookmarked URL. This is
the same gap the Hub had before the mobile-fixes pass fixed it there; Plan was missed.
What was changed: a visitor with no real Supabase user is now redirected to the Live
timing screen for that same race instead of ever rendering Plan's content.
Severity: **major**. Commit: `2b7db0c`.

Also confirmed and left alone (working as designed, not gaps): Guardian Access's
`getGuardianRaces()` derives which athletes a guardian can see *entirely* from their own
authenticated user ID server-side (`loadActiveGuardianLinks(userId)`) — there is no
client-supplied athlete/team ID anywhere in that path, so one family's account cannot be
made to return another family's data by any input manipulation. The spectator tier's
field allow-lists (`lib/race_viewer_service.mjs`) never include goals, targets, coach
notes, or device/internal columns. The Review page has no destructive action of any
kind (confirmed by re-reading it), so leaving it reachable by a race-day code was a
deliberate, correct choice, not a gap.

**Not fixed — flagged, per the doc's own instruction:** the race-day code's underlying
API authorization (`requireSplitWatchAccess()`) still treats a code session as fully
equivalent to a coach account. This pass closed the *pages* that expose that; it did not
touch the API itself. See §3.

### Priority 2 — Data integrity (severity: **blocker**)

**Two devices recording the same runner at the same checkpoint could permanently break
sync for one of them.** `race_splits` has two separate unique constraints: one on
`client_split_id` (the only one `pushSplits()`'s upsert resolves against) and a second,
independent `unique (race_participant_id, race_checkpoint_id)`. When two different
devices each mint their own new `client_split_id` for the same runner at the same
checkpoint — two volunteers covering one spot, or a coach tapping alongside a volunteer
as backup — the second device's insert hits the *second* constraint, which the upsert
never resolves, and threw a raw Postgres error. Because `pushSplits()` loops over an
entire sync batch with no per-split try/catch, this didn't just fail that one split: it
discarded every other split still queued in the same push, and because the losing
device's local record can never win that upsert, every future sync retried the same
doomed split first and failed identically — **permanently blocking that device from
syncing anything else for the rest of the race**, with only a vague "Sync needs
attention" label and no indication why.

Fixed in two halves: the server now catches this specific constraint violation, fetches
the already-recorded winning row, and reports it back flagged `conflicted: true` instead
of throwing, so the rest of the batch proceeds normally. The client reconciles a
conflicted result into its own local record (adopting the winning value, marked synced)
and shows a calm, specific message — *"Someone else already recorded a split for
[name] at this checkpoint — showing their time."* There was no conflict signal of any
kind before this fix.

**Verified against real production Supabase**, not a mock: created a real throwaway
session/2 participants/1 checkpoint under the existing test team, had two different
`client_split_id`s race for the same participant+checkpoint, confirmed the second is
correctly flagged conflicted with the actually-stored value, and — the specific bug —
confirmed an *unrelated* split in the same batch as the conflict still succeeds. Deleted
everything created. Commit: `2b7db0c`.

Also checked and confirmed already correct (no fix needed):
- **Runner who never gets an entry**: shows as `--:--`, never a fabricated `0` — checked
  directly in `formatSecondsToClock()`'s three call sites (Live, Review, Guardian Home).
- **DNS/DNF handling**: excluded from finish-time sorting/averages on Review, shown as a
  distinct hero value (`DNF`)/tag on Guardian Home rather than a misleading blank, never
  produces `NaN` (traced the numeric paths directly).
- **Out-of-order splits** (Mile 2 before Mile 1): nothing in the schema or service layer
  enforces sequential checkpoint order, and the UI doesn't assume it either — a
  checkpoint is only ever looked up by its own ID, not by position relative to others.
  Not a bug; genuinely order-independent by design.
- **Correction visibility without refresh**: the Live page polls every 11s and
  re-renders on change; Guardian Home polls (10s while any race is live, 30s otherwise,
  via the shared `race-poll.js` utility) and would eventually surface a correction to a
  parent. **Asymmetry worth knowing about**: the standalone coach Review page does *no*
  polling at all — a correction made there while a coach or volunteer already has that
  exact page open requires a manual reload to see. Not fixed (a real design decision
  about whether Review needs live-update, not a clear bug) — flagged in §3.
- **"Mistyped bib" scenario (Priority 2's own framing)**: doesn't apply to this
  codebase. There is no bib-number entry system anywhere in Split Watch — splits are
  recorded by tapping a name from a pre-populated roster list or an explicitly
  hand-typed guest-runner name (a coach/volunteer *decision*, not a lookup), so there is
  no "typo attaches the wrong runner's split" failure mode to begin with. Noted as a
  positive structural finding, not left as an open question.

### Priority 3 — Mobile rendering across real device variance

**iOS `100vh` issue, confirmed present.** The race-day-code dialog on both the Live and
Plan pages used `max-height: calc(100vh - 40px)` — the well-known issue where `100vh` on
mobile Safari reflects the *largest* possible viewport (browser chrome collapsed), not
what's actually visible, so the dialog could be sized taller than the real visible area
when the address bar is showing. Fixed to `100dvh`, matching a convention this codebase
already uses elsewhere for the identical problem (the mobile nav in `src/lib/html.mjs`).
Severity: minor. Commit: `721fad0`.

**Verified clean, both engines, both narrow widths**: ran the Live page through
Chromium and WebKit (the closest available proxy for Safari's rendering engine) at
375px and 360px (iPhone SE-class) — zero horizontal overflow in every combination, tap
targets measuring 96×56px (comfortably over the 44px minimum) in both engines, no
JavaScript errors in either. Landscape (812×375) showed no overflow and the race clock
stayed visible. A simulated slow/dropped connection (4-second artificial delay on the
critical data fetch) confirmed the existing "Loading live race… Please wait…" state
displays correctly the whole time — never a blank screen.

**Text scaling**: simulated a 200% root font-size increase (a common accessibility
setting for older users). No page-level overflow. One long runner name (`Jordan Smith`
vs. the shorter `Alex Chen`) hit its intentional `text-overflow: ellipsis` truncation —
this is the page's existing, deliberate one-line-per-runner density design, not new
breakage caused by zoom; confirmed the same truncation exists at 100% too.

Input font-size: verified every input on Live/Plan/Join inherits the page's base
font-size (no explicit override anywhere), and the site sets no root font-size smaller
than the 16px browser default anywhere — so the classic iOS zoom-on-focus trigger
(inputs under 16px) does not apply here.

### Priority 4 — Accessibility (severity: **major** for the one real failure)

Computed actual WCAG contrast ratios for every color combination in use on the Live,
Review, and Guardian Home pages — not visual impression. One real failure: the Live
page's "Behind target" pace badge (`.sw-pace-badge-at_risk`) used near-black (`#111827`)
text on its own 40%-opacity orange background, which blends down to only **2.09:1**
against the page's near-black backdrop — well under the 4.5:1 WCAG AA minimum, for
exactly the flag a coach or volunteer most needs to actually see, in exactly the
outdoor/glare-prone context this audience sits in. The identical color pairing on the
*light*-background Review and Guardian Home pages measures 14–15:1 (fine, untouched) —
the failure is specific to this one badge's use on the Live page's dark background.
Fixed to white text, matching the other three pace badges (all already white, all
6–13:1) — now 8.50:1. Commit: `721fad0`.

Every other checked combination passed comfortably (6.1–19.9:1): the Live page's
various muted white-at-reduced-opacity secondary text, the new Restart-race link's
amber-on-dark color, every button/badge text pairing, and every gray-secondary-text
combination on the light-background pages.

**Ground-truth correction**: the handoff doc's own "green for boys, pink for girls"
brand-palette premise does not hold for this codebase — checked `src/styles/main.css`
directly, and no `--pink` variable or pink hex value exists anywhere in it. The real
palette is `--black` (#090909), `--paper`/cream (#f6f4ee), `--green` (#0faf68) plus two
darker green shades. Worth knowing: `--green` used as *text* directly on the cream
background would fail contrast (2.60:1) — not currently a real bug anywhere checked
(green is consistently used as a button/badge *background* with dark text on top, which
passes at 6.9–15:1), but a caution if that ever changes.

Tap targets: every interactive element on the Live page's runner cards measures at or
above 44px (Tap buttons 56px tall, the "more" toggle and Undo/DNS/DNF buttons all
44px+). Icon-only controls: none found without a text label or `aria-label` on the pages
audited (the "more" toggle carries `aria-label="More options for [name]"`, computed per
runner, not a generic label).

### Priority 5 — Concurrency and real-time update behavior

**No memory leak, no runaway request pattern** — checked directly, not assumed.
`race-poll.js` (used by the public `/race/` page and Guardian Home) properly clears its
timer and its `visibilitychange` listener on `stop()`, pauses entirely while the tab is
hidden, and backs off exponentially on error (capped at 60s) rather than hammering
Supabase. This is a traditional multi-page site, not a client-side-routed SPA, so a full
browser navigation away from any page destroys its whole JS context (intervals
included) automatically — there is no "unmounted but still polling" failure mode to
guard against the way there would be in a single-page app.

The Live page's own intervals (an 8s sync push, an 11s remote-update pull, a 200ms
clock tick) are more aggressive and don't pause on tab-hidden — this is appropriate for
its actual audience (a coach or volunteer actively timing, screen-lock held open via the
Wake Lock API) rather than something a parent would leave open passively; browsers
already clamp `setInterval` heavily in backgrounded tabs regardless. Session
expiry mid-viewing: Supabase's own client handles token auto-refresh in the background
for signed-in users; a race-day cookie expiring mid-race surfaces as a real 401, which
every Split Watch client script already redirects to the join page for — a clear,
actionable state, not a silent freeze.

### Priority 6 — Predicted parent/athlete pain points

- **Multiple simultaneous races**: every Live/Plan/Review page has a working
  "switch race" dropdown scoped to today's other races, live ones first — confirmed
  functional, not just present in markup.
- **Common-name collisions**: a race's participant list is always scoped to one team's
  own roster (there is no multi-school combined view within a single Split Watch race),
  so cross-school collisions can't occur here structurally. There is also no
  name-*search* mechanism anywhere in the timing flow to begin with (participants are
  tapped from a pre-populated list, never typed/searched), so there's no ambiguous-match
  UI to get wrong in the first place.
- **New/unrostered athlete**: already handled — the Plan page has an explicit
  "add a guest runner" manual-entry path for exactly this case, separate from and
  alongside the roster list.
- **Notification copy honesty**: checked every "alert"/"notify"/"text" mention across
  Guardian Home, the public race page, and every Split Watch page. Exactly one exists
  (the public race page's "Want a text or push alert at each checkpoint?"), and it is
  already honest: the input and button are both disabled, labeled "Coming soon." No
  overpromising copy found anywhere else.
- **Battery/data usage — one real, flagged finding, not fixed**: `getGuardianRaces()`
  fetches a full spectator-safe leaderboard (`race.leaderboard`) for every
  `spectator_visible` race a guardian can see, but `guardian-home.js` never reads that
  field — it links out to the separate `/race/` page instead. This is a real, silently
  wasted extra database query per visible race *and* wasted JSON payload sent to the
  browser on every Guardian Home load, not a display bug. Not removed in this pass —
  flagged in §3, since it's unclear whether this was left in deliberately ahead of a
  near-term UI that would use it.

### Priority 7 — Cross-cutting error/empty states

Confirmed directly (by reading every `initialize()`/first-load path, not sampling) that
the Hub, Plan, Live, Review, the new race-selection page, and Guardian Home all follow
the same pattern: a real loading message on first load, replaced by a specific error
message with a way back if the load fails — never a blank screen. Empty states (no
races, no upcoming/past races, nothing recorded yet at a checkpoint) all have real,
worded copy, checked directly in each page's markup.

## 3. Flagged for Zachary's decision

1. **Race-day code API authorization** (carried over from the mobile-fixes pass,
   restated because this pass's Plan-page fix makes the same gap concrete a second
   time): the API still lets a race-day-code session call every action a coach can —
   create/delete sessions, edit any goal, toggle spectator visibility — not just
   timing actions. This pass closed the *pages* that exposed that; a technically-savvy
   volunteer could still reach those same actions by calling the API directly. Locking
   this down needs your call on exactly which actions a race-day code should be allowed
   to invoke before it's built (just `push_splits`/`pull_state`/`set_participant_status`?
   should a code be allowed to start/finish/restart a race itself?).
2. **Review page has no live-update.** Guardian Home and the Live page both poll;
   the coach/volunteer Review page does a single fetch on load only. If a correction is
   made to a race while someone already has Review open, they won't see it without a
   manual reload. Small, deliberate scope decision (add polling vs. leave as-is) rather
   than an obvious bug.
3. **Guardian Home fetches a `leaderboard` field it never uses.** Real wasted query +
   payload per spectator-visible race, every load. Could be removed (cheaper) or wired
   up to something visible (if it was left in on purpose ahead of a planned feature) —
   didn't touch it since either direction is a real product choice, not a bug fix.
4. **Environment note, not a code issue**: the machine this ran on hit `ENOSPC` (no
   space left on device) once mid-build — the C: drive is at 99% capacity (1.4GB free
   of 118GB). The retry succeeded, so this didn't block anything in this pass, but a
   drive this full risks a flaky failure on some future build/deploy. Nothing in this
   project's own folders is unusually large (checked directly: `node_modules` 123MB,
   `dist` 12MB, `.git` 6.8MB, every backup folder under 3MB) — this is disk pressure
   from elsewhere on the machine, outside this project's scope to fix.

## 4. Needs human/device verification

Per the handoff doc's own instruction, listed rather than guessed at:

- Actual behavior on a physical iPhone and Android device (this pass used Chromium and
  WebKit in a headless/automated environment — the closest available proxy for Safari,
  not the real thing).
- Actual cellular signal conditions at a real course/venue (simulated only via an
  artificial fetch delay, not real packet loss/latency variance).
- Actual outdoor screen readability in direct sunlight — contrast ratios were computed
  precisely (§2/§4 above), but real glare/reflection on a real screen is not something
  any of this tooling can measure.
- Real parent/coach reactions to copy, tone, and flow — including whether the new
  conflict message ("Someone else already recorded a split for…") reads as reassuring
  or confusing in the moment, and whether the new race-selection page's framing makes
  sense to an actual first-time volunteer.
- Real two-person-simultaneous-device testing at an actual live race (this pass proved
  the server-side conflict handling against real production Supabase with scripted
  concurrent requests — not two actual humans on two actual phones at the same time).

## 5. Marketing observations

*(Observation list only, per the doc's instruction — none of this drove a code change.)*

**Would look good in a 30–60s demo:**
- The Live page's checkpoint-switching + tap-to-record flow is genuinely fast and
  satisfying to watch — large tap targets, an immediate visual flash on record, a
  runner moving cleanly from "still need a time" to "recorded" in real time.
- The pace badges (ahead/on target/behind) turning a bare finish time into an
  instant, colored verdict is a strong, demo-friendly moment — especially now that the
  "behind" badge is actually legible.
- The race-day access code flow (type 8 characters, land straight on today's races,
  tap, start timing) is a clean, fast "no app to install" story for a skeptical
  coach who's imagining onboarding friction.

**Would look unfinished if shown to a skeptical coach today:**
- The public race page's alert signup ("Want a text or push alert?") being visibly
  disabled/"Coming soon" is honest, but also visibly unfinished — worth deciding whether
  to hide it entirely until it's real, rather than show a dead control during a pitch.
- Guardian Home's per-athlete cards are functional but plain next to the Live page's
  more polished dark-mode timing screen — the two don't feel like they're from the same
  finished product side by side.

**Suggested "first 30 seconds" for a parent**, given everything found in this audit:
open a text link straight into a `spectator_visible` race already in progress (no
sign-in, no code) — the public race page's live leaderboard updating in front of them
within a few seconds is the single most "wow" moment available in the current build,
and it's the one surface with zero login friction standing between a link and that
moment.

## 6. Test coverage summary — what was actually exercised

**Exercised, with evidence:**
- Lifecycle × role: live-race timing (coach and simulated race-day-code paths),
  finished-race review, upcoming/live/past on Guardian Home, the race-selection page's
  status filtering (live/scheduled shown, draft/cancelled excluded).
- Data condition: no-splits-yet, partial splits (one checkpoint recorded, one not),
  DNS/DNF, a real concurrent-write conflict at the same checkpoint (live database).
- Device condition: 375px and 360px in two rendering engines, landscape, 200% text
  zoom, a simulated slow/dropped connection, a simulated hard load failure (via code
  inspection of the catch-block path on every page).
- Access scope: race-day code vs. coach account, on both the Hub (prior pass) and Plan
  page (this pass); Guardian per-athlete scoping traced through the actual query code.

**Not reached — genuinely untested, not silently assumed:**
- Real multi-tab-open-to-the-same-race behavior beyond the one scripted two-request
  conflict test (e.g. what a THIRD device sees mid-conflict, or a device that's been
  offline for the entire conflict window and reconnects after).
- A "paused or delayed" race lifecycle state — checked the schema and found no such
  status value exists (`draft`/`scheduled`/`live`/`finished`/`reviewed`/`cancelled`
  only), so this state doesn't currently exist to test.
- Any real iOS/Android device, any real venue network condition, any real user's
  reaction — all listed in §4, not claimed as covered.
- Full Priority 3 device matrix (this checked width/engine/zoom/landscape/slow-network;
  it did not check every possible OS/browser/font-size combination exhaustively).

## Commits this pass

- `2b7db0c` — P1 (Plan page access gap) + P2 (same-checkpoint split conflict, blocker)
- `721fad0` — P3 (100vh→100dvh) + P4 (pace badge contrast failure)

Not pushed, no `vercel` command run, per the constraint.
