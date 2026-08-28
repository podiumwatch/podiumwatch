# My Podium Master Build Plan

Status: Projects 0–4 (and the homepage connection, Project 9) implemented 2026-08-28. Project 5 (two slices — see §7) implemented 2026-08-28. Projects 6–7 remain documented roadmap only — not implemented.

## 1. Product vision

Podium Watch should become the daily home of Ohio cross country and track and field, answering five questions immediately:

1. What happened today?
2. What changed for my school, athletes, division, and events?
3. What meet is next?
4. Where can I find the newest results?
5. What should I come back for tomorrow?

**My Podium** is the personalized layer that makes those answers relevant to each visitor. It works without an account: preferences are saved on the visitor's own device (`localStorage`) and used to filter/prioritize real, already-published Podium Watch data.

Long-term, My Podium combines: My Team, My Athletes, My Events, My Division, My Season, My Rankings, Upcoming meets, Recent results, Race day tools, Ohio tournament progress, Relevant stories, Community polls, Personal milestones, and Shareable Podium Cards. The first release ships a real, honest subset of that list — see §3 for exactly what shipped and §7 for what's deferred and why.

## 2. Repository architecture discovered (Project 0)

- **Static site generator.** `scripts/build.mjs` runs at build/deploy time (`npm run build`), importing ~65 page-builder functions from `src/pages/*.mjs` and writing static HTML into `dist/`. There is no server-side rendering at request time and no live database access at build time.
- **Live data is client-side only.** Meets, teams, athletes, and fan poll data live in Supabase and reach the browser exclusively through Vercel serverless functions under `api/*`, called via `fetch()` from `public/scripts/*.js` after the static page loads. This is why My Podium's dashboard is a client-rendered page, not build-time content — a build-time "next meet" would go stale the moment the calendar advanced.
- **Shared chrome.** `src/lib/html.mjs` exports `layout()`, `header()`, `footer()`, `mobileDock()`, `pageHero()`, `storyCard()`, `rankingCard()`, and JSON-LD helpers, all reused by every page builder. `src/config/site.mjs` holds the sitewide `navigation` array, footer links, and a `brand` color object.
- **Navigation.** Desktop: a grouped dropdown/accordion nav (`navGroup()`) driven by `site.navigation`, plus a separate "utility cluster" (Search, Pace Calculator, Split Watch, Watch, Instagram). Mobile (≤1320px): the same nav collapses into a full-height drawer (`site.js`'s `data-menu-button`/`data-site-nav` logic), with the Split Watch dropdown DOM-relocated higher (next to Meets) via JS. A separate, always-on mobile bottom dock (`mobileDock()`, ≤700px only) existed with 4 items (Home/Results/Rankings/Meets) before this build.
- **Design tokens already exist.** `src/styles/main.css`'s `:root` already defines `--black`, `--ink`, `--paper`, `--white`, `--green`, `--green-dark`, `--green-ink`, `--line`, matching this spec's requested palette exactly (same hex values). `--radius: 0` is the sitewide default (the site's existing look is deliberately square-cornered/editorial); My Podium's cards use a new `--radius-card` token instead of changing the global default, so the rest of the site is untouched.
- **Analytics already wired.** Vercel Analytics + Speed Insights (`window.va`/`window.si` queue functions) are injected in `layout()` for every page. No custom event vendor needed — My Podium's events use the existing `window.va('event', {...})` call.
- **No manifest or service worker exists.** Not added in this build (out of scope for Projects 0–4; a PWA install experience is listed under Project 7).
- **Testing.** `npm test` runs `check.mjs` (internal link/image/JS validation across the built `dist/`) plus 23 source-level Node test scripts (`scripts/test-*.mjs`) covering Split Watch, athlete foundation, recruiting, fan poll, engagement, etc. No browser-based test runner is configured in the repo; this build's own functional/responsive verification used a local Node harness + Playwright (not committed — see §6).

### Step 0.2: the `src/pages/adminteams.mjs` question

Re-verified directly, for at least the fourth time this project (see `docs/SESSION_LOG.md` for the earlier three): `src/pages/adminteams.mjs` **exists**, is git-tracked, is correctly imported at the top of `scripts/build.mjs` (`import { adminTeamsPage } from "../src/pages/adminteams.mjs"`), and is used once, correctly, at `writePage("/admin/teams/", adminTeamsPage(site))`. `npm run build` succeeds cleanly before and after every change in this build. **There is no missing-file build failure in this checkout.** No placeholder was created; none was needed.

### Step 0.3: data capability audit — see `docs/MY_PODIUM_DATA_MAP.md`

### A real, incidentally-discovered production bug (fixed as part of this build)

While auditing "Athlete identifiers" for My Podium's optional athlete-follow step, `POST /api/athletes/` was found returning a 500 in production (confirmed against the live site and again against real production Supabase data through a local harness). Root cause: `api/athletes/index.js` ran two `.in("profile_id", profileIds)` queries against the full athlete id list with no batching; PostgREST encodes `.in()` as a URL query parameter, and the athlete directory has grown to 846 public profiles — well past the point (empirically ~300–400 ids) where the request URL exceeds the server's length limit and PostgREST returns a bare "Bad Request". This silently broke the entire public `/athletes/` page for every visitor, unrelated to any change in this session. Fixed by batching both queries into chunks of 150 ids (`selectInBatches()`), merging and re-sorting the results client-side so per-profile "first entry wins" behavior is unchanged. Verified against real production data: 846 profiles, real school/team links, real ranking data, `HTTP 200`. See `docs/MY_PODIUM_DATA_MAP.md` for detail.

## 3. What was implemented (Projects 0–4, plus 9)

### Project 1 — Shared mobile visual system
- Two new CSS tokens added to the existing `:root` (not a new system): `--pale-green: #e6f5ee` and `--dock-inactive: #d9e2de`, plus a My-Podium-scoped `--radius-card: 14px` (does not touch the sitewide `--radius: 0`).
- Mobile bottom dock (`mobileDock()` in `src/lib/html.mjs`) expanded from 4 to 5 items: **Home, My Podium, Results, Rankings, Meets**. New `podium` icon added to `icon()`. Grid changed from `repeat(4,1fr)` to `repeat(5,1fr)`. Active-state, 44px touch targets, safe-area padding, focus-visible outline (sitewide `:focus-visible` rule, already present), hide-while-menu-open (`body.nav-open .mobile-dock{display:none}`), and body bottom padding (`calc(64px + env(safe-area-inset-bottom))`) were all already correct from an earlier pass in this project and needed no changes — verified fresh, not assumed.
- Mobile side menu / Split Watch access (Project 1.4): audited fresh against every numbered requirement in the spec. All of them were already satisfied by a prior pass in this same project (Coach Sign In first/primary, Enter Race Day Code second/secondary, both with supporting text, both ≥44px tall, dock hidden while menu open, Escape-key close with focus restore to the trigger, Tab-trap, real routes). No functional changes were needed; re-verified with fresh Playwright checks at 360/390/430px (see §6).

### Project 2 — My Podium route and onboarding
- New public route **`/my-podium/`** (`src/pages/mypodium.mjs`, `robots: index, follow` — this is a real, public, personalized-but-accountless page, not added to `layout()`'s private-route list).
- Added to: mobile dock (2nd item), desktop nav (new top-level `{label:"My Podium", href:"/my-podium/"}` entry in `site.navigation`, ahead of Rankings), mobile side menu (inherits the same `site.navigation`), and the homepage (Project 9).
- Onboarding is a 3-step, mobile-first sequence (`public/scripts/my-podium.js`): **1) Choose your school or team** (search via the existing `POST /api/teams/`, min 2 characters, debounced, real `id`/`slug` stored — never display text alone) → **2) Choose what you follow** (sport + gender, each a real, closed choice; division is *derived*, not asked — see below) → **3) Review and finish**. Every step can be skipped except picking a team is required to reach personalization (skipping goes straight to the unpersonalized "Explore without setting up" dashboard).
- **Division is never manually entered.** `team_pages` carries real `cross_country_boys_division` / `cross_country_girls_division` / `track_boys_division` / `track_girls_division` columns. Once a visitor picks a team + sport + gender, the division shown everywhere in My Podium is read directly from that team's own verified row — this is more accurate than asking a visitor to self-report a division, and impossible to get wrong relative to OHSAA's actual placement.
- Athlete follow is optional and additive: a second, independent search against the (now-fixed) `POST /api/athletes/` endpoint, storing the athlete's real `id` (database mode) — never a display name alone.

### Project 2.3 — local preference storage
- Shared module **`public/scripts/my-podium-store.js`**, versioned key `podiumWatch.myPodium.v1`. Exposes `getPreferences()`, `setTeam()`, `addAthlete()`, `removeAthlete()`, `clearAll()`, `hasPreferences()`, `onChange()` (a tiny pub/sub so the homepage preview and the My Podium page itself both stay in sync within one tab). Stored shape:
  ```json
  {
    "schemaVersion": 1,
    "team": { "id": "...", "slug": "...", "schoolName": "...", "sport": "cross_country", "gender": "girls" },
    "athletes": [{ "id": "...", "slug": "...", "displayName": "..." }],
    "updatedAt": "2026-08-28T00:00:00.000Z"
  }
  ```
  No email, phone, address, precise location, birth date, age, password, or training data is ever stored — the schema has no field for any of them.
- **Migration, not duplication**: this build's earlier "Follow Your School" homepage panel (`podium_followed_school` key, shipped two commits earlier in this project) is migrated into this store on first load (`migrateLegacyFollow()`) and the old key is removed — one canonical preference store, not two.
- Hardening: corrupted JSON, wrong `schemaVersion`, `localStorage` throwing (private browsing / quota / disabled) are all caught; every read falls back to an empty-but-valid preference object so the page always renders in useful unpersonalized mode rather than breaking.

### Project 3 — daily dashboard
Implemented as a single client-side adapter, **`public/scripts/my-podium-data.js`**, that the My Podium page and the homepage preview both call — one query layer, not logic repeated per card. It:
- Accepts only validated preference identifiers (never raw form text).
- Fires one bounded `POST /api/teams/detail/` (by slug) when a team is followed, one bounded `POST /api/athletes/` (by id, via the existing `search`/filter surface) per followed athlete capped at the visitor's own list length, and reuses the shared `PodiumOhioToday` module (`ohio-today.js`) for today/upcoming/results — no new endpoints, no new tables, no second copy of the meets list.
- Normalizes loading/empty/error per card; one card's fetch failing never blocks the others (`Promise.allSettled`, not `Promise.all`).
- Cards shipped: Personal context (team name/colors/logo when present, sport, gender, derived division, edit link), Next meet (from the team's real `team_meet_connections` schedule, filtered to the follower's own `sport_scope`/`program_scope` when the connection specifies one), Latest result (same schedule, most recent past meet with a real result link — `results_url`/`athleticnet_url`/`milesplit_url` — otherwise honestly labeled "Results pending"), Rankings (current rank + date only — **no movement**, since `previousRank` is empty for every row in every published CSV right now; the column exists in the schema for when real week-over-week snapshots exist), Stories (category-matched to the followed sport when a team is followed, otherwise the latest published story, worded generically), This week's poll (real Fan Poll status via the same `POST /api/fan-poll/` endpoint the homepage's Vote Now banner already uses — labeled "This week's poll," never "daily," since the underlying system is weekly), Finite feed (composed client-side from the same already-fetched data — next meet, latest result, ranking, poll — capped, ending in a real "You are caught up" state, no infinite scroll, no new event-log table).
- Followed-athlete cards degrade honestly: if a followed athlete has no `top_performance` or no current ranking row, that athlete's line says so rather than being hidden silently or filled with a placeholder number.

### Project 4 — contextual daily states
Implemented inside the same data adapter (`classifyDay()` in `my-podium-data.js`), driven entirely by real dates/status already returned by existing endpoints:
- **Normal day** (default): the six-card order in §Project 3 above.
- **Meet approaching** (a followed team's next real connected meet is within 7 days): the Next Meet card is visually elevated to the top of the dashboard and expands to show venue/schedule text when the `meets` row has it, plus a direct Meet Center link.
- **Race day** (a followed team has a real `team_meet_connections` row whose meet's `meet_date` is *today*, Ohio time): switches the top of the dashboard to a compact Race Day strip — Meet Center link, Split Watch link, Coach Sign In, Enter Race Day Code. **A date match alone never produces a "Live" label** — there is no verified sitewide "is this race live right now" signal (confirmed again during this audit: `race_sessions.status='live'` is a real, per-session signal, but nothing aggregates it to "is my followed team live" without a team→session join that does not exist yet). Race Day Mode therefore uses the states **Today / Scheduled / Results pending / Results available** only; "Live" is never shown from a date check.
- **After the meet** (the followed team's most recent connected meet is in the past): elevates Latest Result. No personal-record calculation is attempted — Project 0.3 confirmed there is no per-athlete historical-best table wired to this build's data path, so PRs are correctly listed under Project 6 (future), not fabricated here.

### Project 9 — homepage connection
- **New visitor**: a compact, dismissible "Make Podium Watch yours" card in the homepage's Home Spotlight band (next to Power Rankings / Follow Your School — see the homepage's own recent restructure). Dismissal is stored in `localStorage` (`podiumWatch.myPodium.promoDismissed`) and never shown again on that device. No modal.
- **Returning visitor** (preferences already exist): the same slot instead renders a compact preview — followed school name/colors, next verified meet if any, one "Open My Podium" action — reusing `my-podium-data.js`, not a second query path.
- The pre-existing "Follow Your School" panel is unchanged in behavior but now reads/writes through the shared `my-podium-store.js` instead of its own separate key, so following a school there and in My Podium's onboarding is the same action, not two.

### Project 5 — Email alerts + account sync (implemented 2026-08-28)

A repository audit (see the session log) found this project's original "nothing exists yet" assumption about accounts was wrong: real, mature auth infrastructure and a real double-opt-in email alert system already existed, unrelated to My Podium. Two safe, well-scoped slices were built on top of that real infrastructure rather than inventing new systems:

**Slice A — email alerts.** My Podium's "Following" context card gained an optional "Get email alerts for [school]" action that calls the existing `POST /api/followers/subscribe` (`team_followers`/`team_follows`, `lib/engagement_service.mjs`) exactly as-is — no new tables, no new service logic. The email a visitor enters goes straight into the request body and is never written to `localStorage`; only a bare, non-PII `alertsRequestedAt` timestamp is kept, so the form doesn't keep re-prompting. Verified end to end against real production data (a real `team_followers`/`team_follows` row was created and cleaned up); confirmed the alert system itself is live (`engagement_settings.public_following_enabled = true`, `notification_mode = "live"`), but `RESEND_API_KEY`/`RESEND_FROM_EMAIL` are still not configured in production, so every real submission surfaces an honest error until that's set up — a credentials gap outside this build's control, not a code defect.

**Slice B — My Podium account (cross-device sync).** A new, lightweight, self-serve account (`install/31_MY_PODIUM_ACCOUNTS.sql`, `lib/my_podium_auth.mjs`, `api/my-podium/{me,sync,clear}.js`, `/my-podium-login/`, `public/scripts/my-podium-{auth,sync}.js`) modeled on this project's existing OPEN self-serve pattern (`lib/team_auth.mjs`/`lib/photographer_auth.mjs` — no invite required), deliberately not the coach-invite-only athlete/guardian pattern, since this account only ever grants a signed-in user access to their own preferences. One new table (`my_podium_accounts`, RLS locked to `service_role` only, same as every other table in this project). Reconcile-on-load logic (`public/scripts/my-podium-sync.js`) pulls a new device's synced preferences down automatically, pushes local edits up (debounced) while signed in, and resolves conflicts by last-write-wins on a real timestamp comparison, with the server as the final word. "Clear all" while signed in clears the synced copy first so it can't reappear on the next reconcile.

Verified end to end with a real, disposable, admin-created test account across two simulated devices against real production Supabase: first sync (push), a brand-new device pulling synced preferences down automatically instead of showing onboarding, a cross-device edit propagating on reload, "Clear all" while signed in correctly preventing a later reconcile from resurrecting the cleared data, and sign-out leaving local (accountless) preferences fully untouched. All test data (the auth user and its `my_podium_accounts` row) was deleted after and confirmed gone.

**Explicitly not built in this pass** (unchanged from the original scoping decision): verified athlete-profile self-claims (governed by this project's existing "always human review, no exceptions" rule for a minor's identity — see `docs/RECRUITING_PHASE_THREE_ARCHITECTURE.md`), ranking alerts (no event-driven infrastructure exists — rankings are a build-time CSV artifact), any change to the invite-only athlete/guardian tiers, a COPPA/age-verification framework (a real, pre-existing gap shared by every open account tier in this project already — neither slice here collects any athlete's or minor's personal data, so it isn't newly introduced, but it also isn't solved), and full account deletion (no precedent exists for any account tier in this codebase yet — Slice B ships "clear synced preferences" + "sign out" only).

## 4. Explicitly deferred inside Projects 0–4

- **Movement arrows/rank deltas** — no previous verified snapshot exists yet in any published ranking CSV (`previousRank` is empty on every row). Shown as current rank + date only, honestly.
- **"Live" status anywhere in My Podium** — no verified sitewide live signal exists. Only real `today/scheduled/results pending/results available` states are used.
- **Personal records / season bests** — no complete historical-performance comparison path exists yet for this build's data sources; deferred to Project 6.
- **Team-to-meet relevance for meets outside `team_meet_connections`** — if a team has no connected schedule, the Next Meet / Latest Result cards say so honestly and link to the general Meet Center rather than guessing a relationship.
- **Daily-cadence anything** — the only real poll system is weekly (Fan Poll). My Podium's poll card is labeled accordingly, not renamed "daily" to match the prompt's suggested wording.

## 5. Constraints honored

No destructive git commands were used. No email/phone/address/location/birthdate/training data is collected or stored by the accountless My Podium preference store (Projects 0–4). Project 5's account system (added 2026-08-28, see above) collects only an email+password for the account holder's own sign-in — identical in kind to the pre-existing team/photographer account tiers, and it never grants access to another person's data or any athlete's private information. No live status was shown from a date match alone. No ranking movement was shown without both a current and a previous verified snapshot (none exists yet, so none is shown). Existing official source labels (`results_url`/`athleticnet_url`/`milesplit_url`) are preserved verbatim everywhere they're surfaced. The desktop experience is unmodified except for one new nav entry, the homepage's existing Home Spotlight band gaining a third card, and the new `/my-podium-login/` page.

## 6. Verification performed

- `npm run build` — production build, must pass before any push.
- `npm run check` — internal link/image/script validation across all built pages.
- `npm test` — full existing 23-script suite plus `check.mjs`.
- A disposable local Node harness (not committed) served the real built `dist/` output while mounting the real `api/*.js` handlers against real production Supabase (`.env.local`), so all functional testing exercised real data, not mocks.
- Playwright against that harness at 360×800, 390×844, 430×932, 768×1024, and 1366×768 — see `docs/MY_PODIUM_TEST_MATRIX.md` for the full checklist and pass/fail record.
- A second Playwright pass against the live production site after deploy (only performed if this document says a deploy actually happened — see the session's final report for the true answer, never assume).

## 7. Future roadmap (documented only — not implemented)

Project 5's core scope (accounts, email alerts) shipped 2026-08-28 — see §3 above. What remains genuinely undone from its original wishlist: verified coach/athlete profile claims beyond the team claim flow that already existed (see §3's "explicitly not built" list), parent/guardian controls beyond the existing `guardian_accounts` viewing tier, ranking alerts, a moderation policy and abuse-reporting path (not needed yet — neither shipped slice produces any public-facing content), and a real COPPA/age-verification framework (a pre-existing gap across every open account tier in this project, not solved by this pass).

### Project 6 — My Season and Podium Cards
Season bests; verified personal records; event progress charts; meet history; team scoring contributions; goal tracking; shareable result/ranking/team/state-qualification cards.

**Required before implementation:** a complete, verified per-athlete performance history table with reliable event-name normalization (today's `athlete_performances` rows are real but not guaranteed complete enough to assert "this is a PR" without risk of a false claim) — every performance claim must be derived from complete verified data, and share cards must never include private or sensitive information.

### Project 7 — Dream version
Road to State tracker; regional qualification scenarios; Podium Passport for verified meet participation; event/team/athlete comparison tools; Ohio season timeline; race day command center; personalized tournament brackets; Progressive Web App installation; carefully controlled push notifications; deep XC/track personalization; historical milestone recognition; daily Ohio running pulse; coach-managed team hubs; verified athlete achievement pages.

My Podium must never become a popularity contest or an unmoderated social network. The long-term advantage is trusted Ohio data, relevance, race-day usefulness, team identity, and daily habit — not follower counts or public activity feeds.

## 8. Acceptance criteria (Definition of done, Projects 0–4)

See the final session report for the actual verified status of each item — this list is the checklist, not a claim of completion on its own:

1. Production build passes. 2. My Podium has a real route. 3. A new visitor can build My Podium without an account. 4. Preferences survive a refresh. 5. Invalid saved data doesn't break the page. 6. A visitor can edit and clear preferences (clearing requires confirmation). 7. My Podium uses real existing data only. 8. Missing data produces honest empty states, never invented content. 9. The dashboard works at 360px wide, no horizontal scroll. 10. The five-item bottom dock works sitewide. 11. My Podium is in the dock. 12. The mobile side menu and the dock never conflict. 13. Coach Sign In is clearly accessible from Split Watch. 14. Enter Race Day Code is clearly accessible. 15. Desktop remains functional. 16. No fake live statuses. 17. No fake ranking movement. 18. Official source labels remain visible. 19. Accessibility requirements are met. 20. The future roadmap is documented (this file, §7). 21. Privacy-sensitive future features remain unimplemented. 22. The final git diff contains no unrelated destructive changes.
