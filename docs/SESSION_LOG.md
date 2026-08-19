# Podium Watch session log

Add a new section after each meaningful development session.

## 2026 08 10 Path to State: OHSAA cross country tournament advancement roadmap

### Date

2026 08 10

### Goal

Build "Path to State" from the user's own pre-written feature spec and a real 2026 OHSAA Cross Country Tournament Regulations PDF: a team/athlete-page roadmap showing the real district/regional/state advancement path and qualifying thresholds.

### Completed

1. The spec itself flagged three open questions it explicitly said should not be silently assumed. Resolved all three with the user directly before writing any code: (a) advancement status is manually admin-set, not auto-computed from the still-early results-ingestion pipeline; (b) both team pages and athlete pages ship together, not deferred; (c) district/regional site/date/manager info -- after real research (live fetches against all 6 OHSAA District Athletic Board pages, one real PDF pulled and read directly) found only 3 of 6 districts have confirmed current-2026 data published -- was paused for this pass rather than shipped inconsistent.
2. Entered plan mode given the size (new migration, multiple pages, an admin tool, real architectural decisions). An Explore subagent mapped the exact team/athlete page insertion points and confirmed no horizontal stepper UI pattern existed anywhere in this codebase to reuse. A Plan subagent produced a detailed file-by-file design, reviewed and refined before implementation began.
3. Discovered `ohio_schools.athletic_district` and `ohio_school_divisions` (602 real cross country rows) already existed and were fully populated -- no new import needed for the join key or division data, contrary to what the spec assumed. Discovered `team_pages.ohio_school_id` was a real, populated FK that `api/teams/detail.js` simply never selected.
4. `install/10_PATH_TO_STATE.sql` -- 4 new additive tables (`ohio_tournament_stage_calendar`, `ohio_tournament_qualification_thresholds`, `ohio_tournament_regional_assignments`, `team_advancement_status`), seeded with real 2026 data transcribed directly from the regs PDF (16 calendar rows, 66 threshold rows, 24 regional-assignment rows). `qualifying_teams`/`qualifying_individuals` constrained `> 0` (never `>= 0`) so the real gap (no Division 1 Northwest regional) can never be stored as a fabricated zero. Handed to the user as exact SQL, run in Supabase, confirmed live.
5. `lib/path_to_state_service.mjs` -- pure/DB-split service (matching `lib/fan_poll_service.mjs`'s pattern). The pure half (`stageSequenceFor`, `resolveThresholdForStage`, `qualifyingText`, `pickCurrentNodeKey`, `buildPathToState`, etc.) was written and fully unit-tested *before* any database wiring, per the plan's own rollout order. Found and fixed a real logic bug in `pickCurrentNodeKey` during that pure-testing pass (it stopped at the first non-`qualified_team` node instead of finding the LAST genuinely decided stage) before it ever touched real data.
6. Wired `api/teams/detail.js` and `api/athletes/detail.js`, both guarded so a Path to State failure (including the migration simply not having run yet) can never break the whole team or athlete page -- confirmed by calling the real, local handlers directly against real production Supabase data before the migration was run, and again after.
7. **A real bug caught only by that pre-migration live check, not by unit tests**: Supabase's REST layer (PostgREST) throws its own `PGRST205` ("Could not find the table '...' in the schema cache") for a missing table, not raw Postgres `42P01`. The first version of `isMissingPathToStateError` only recognized `42P01`, meaning every team/athlete page load would have logged a spurious server error for as long as the migration was pending, even though the page itself degraded correctly either way. Fixed and reverified live.
8. Shared renderer `public/scripts/path-to-state.js` (`window.PodiumPathToState`, matching the `window.PodiumPaceSplits`/`window.PodiumTeamAuth` pattern) and one shared stepper component in `src/styles/main.css` -- loaded by both the team and athlete pages rather than duplicated, since no horizontal progress-indicator pattern existed anywhere in this project to reuse.
9. New admin tool at `/admin/path-to-state/` (`api/admin/path-to-state.js`, `src/pages/adminpathtostate.mjs`, `public/scripts/admin-path-to-state.js`): team search, a per-gender stage table generated directly from each team's real `path.nodes` (so a Division 1 team's editor has no District row to even click), status set/clear, and a read-only seeded-thresholds table for verifying the migration's data landed correctly. `setTeamAdvancementStatus` validates the stage server-side against the team's real division sequence -- confirmed live that it actually rejects a District status for a real Division 1 team (Mason), not just in a test fixture.
10. Full live verification against real production Supabase, post-migration: exact real seed row counts (16/66/24), a real Division 1 team (Mason) building a correct 3-node path with no district stage, a real Division 3 team (Fairfield Union) building a correct 4-node path with the exact real threshold text ("Top 11 teams and the next 22 individuals advance to the regional." -- matching its real Southeast-district seed row precisely), and a full admin write -> read -> clear round trip verified through the real `api/teams/detail.js` handler, not just the service layer directly. Also verified client-side rendering with Playwright using realistic real-shaped data (screenshots checked at desktop and mobile widths) since the local static preview server can't route `/api/*`.

### Database migrations

`install/10_PATH_TO_STATE.sql` -- run in Supabase by the user, confirmed live via direct queries and the full live-verification pass above.

### Automated testing

New `scripts/test-path-to-state.mjs` (registered as `npm run test:path-to-state`): the pure path-builder logic (3-node vs. 4-node shape, all three threshold-resolution outcomes, status resolution order including the athlete-row-beats-admin-row forward hook, `pickCurrentNodeKey`'s real decided-stage logic), the never-render-zero guarantee at both the logic layer and the presentation layer (checked directly against the real Division 1 / Northwest gap), and source guards for the migration, service, both APIs, both pages, and the shared CSS. `npm run build`, `npm run check`, and the full `npm test` chain all pass.

### Manual testing

Full live verification against real production Supabase as described above, plus a local Playwright pass confirming the team page, athlete page, and new admin page all load their static shell cleanly with the shared renderer correctly exposed and zero real console errors, and a rendering check with realistic injected data confirmed visually correct at both desktop and mobile widths.

### Remaining work

1. Not yet pushed to production -- code review and commit approval still pending.
2. District/regional site address and tournament-manager contact info remains paused (see `docs/DECISIONS.md`, 2026-08-10) -- 3 of 6 OHSAA athletic districts have no confirmed 2026 data published anywhere fetchable yet.
3. Advancement status is 100% manually set by an admin right now -- nothing auto-populates it from results ingestion. Once that pipeline is more mature, this is a real follow-on phase, not a rebuild (the `athleteStatusRows` forward hook is already proven working).
4. Track and field is schema-ready (every table is `sport`-aware) but has no seeded calendar/threshold rows yet -- adding it later is new rows only, never a migration.
5. Division 1 teams in the East, Southeast, and Northwest athletic districts show no regional threshold number (real, honest gap -- `assignment_status = 'unknown'` in `ohio_tournament_regional_assignments`) until a real, confirmed source states which regional they feed into.

## 2026 08 06 All 8 divisions opened, then the 46 missing girls schools created

### Date

2026 08 06

### Goal

Confirm every real cross country team is actually available in the Fan Poll, open voting for the remaining 7 divisions, and fill the one known real gap: 46 real Ohio schools with a girls program and no team page at all.

### Completed

1. Opened voting for the remaining 7 division/gender combinations (Boys II-IV, Girls I-IV) through the real production admin API, same setup as Boys I (opens now, closes in 7 days). Verified live: all 8 divisions `voting_open`, correct eligible-team counts on each (matching official data), zero ballots to start.
2. Ran a full data integrity audit before doing anything else: confirmed all 556 boys and 422 (at the time) girls teams with a division assigned are actually eligible for voting -- zero silently excluded by unpublished/suspended/archived/merged status, no duplicate teams, no malformed division values. The only gap found was the already-known 46 schools with no team page at all.
3. **Created real, permanent records for those 46 schools**, per explicit request. Studied the existing pattern first rather than improvising: `api/admin/statewide-data.js` (`buildOfficialSchoolRows` + `syncTeamPages`) is the real tool that created the original 556 boys records, and revealed a more complete data model than the shortcut used earlier this session -- a dedicated `ohio_school_divisions` table (school + sport + gender + season + division), not just the flat `team_pages.cross_country_*_division` columns. That existing admin tool is hardcoded to boys-only throughout (source key, field names) and wasn't safe to repurpose live for a one-time 46-row job, so a standalone script mirrored its exact field conventions instead, reusing its real shared helpers (`displaySchoolName`, `normalizeLookup`, `slugifySchool` from `lib/ohio_foundation_service.mjs`) rather than reinventing them.
4. Re-extracted the 46 schools' full data (name, city, athletic district, enrollment, division) fresh from the official PDFs rather than trusting the earlier summary shown in chat -- split name/city/district using the same column-gap technique as the original 8-PDF extraction, cross-checked to exactly 46 rows, matching the previously identified set.
5. Created, in order: 1 new `ohio_data_sources` row (`ohsaa-girls-xc-divisions-2026-27`, attributing this data to its real source, same as the boys dataset does), 46 `ohio_schools` rows, 46 `ohio_school_aliases` rows, 46 `ohio_school_divisions` rows (`gender: girls`), and 46 `team_pages` rows (published, `cross_country_girls_division` set, linked via `ohio_school_id`) -- each new team page logged individually to `team_change_log`, matching the audit pattern the real import tool itself uses.
6. Verified live: `team_pages` and `ohio_schools` both went from 556 to 602. Boys cross country division count unchanged at 556 (confirming nothing was disturbed). Girls cross country division count is now 468 -- the true, complete total from the official source, not the partial 422 from earlier. Spot-checked specific schools (Magnificat, Seton, Cleveland Heights) appear in the real Fan Poll API response and their public team pages load correctly.

### Database migrations

None new. All of this used existing tables (`ohio_schools`, `ohio_school_aliases`, `ohio_school_divisions`, `ohio_data_sources`, `team_pages`, `team_change_log`) already created by earlier migrations.

### Automated testing

Not applicable -- no application code changed in this entry, only data, created through a reviewed one-off script mirroring an existing, tested admin tool's conventions.

### Manual testing

Verified against the real, live production API and site: all 8 divisions' voting status and eligible-team counts, the new total record counts, three individual new schools' presence in their division's ballot picker, and one new team's public page loading correctly.

### Remaining work

1. The Fan Poll is now fully, completely populated for cross country -- no known data gaps remain.
2. The 46 new team pages are unclaimed, unverified, and have no coach, logo, or description yet, same as most of the original 556 were at first -- normal, expected state for a freshly created official-source team page.
3. Everything else from earlier entries' Remaining work still applies (the results-email sending mechanism, track and field).

## 2026 08 06 Fan Poll: pushed, live feedback fixes, and a real bug caught post-deploy

### Date

2026 08 06

### Goal

Push the Fan Poll to production, apply live user feedback, and verify the deployed site actually works end to end -- not just locally.

### Completed

1. Committed and pushed the Fan Poll feature (`5fac83f`, `9af0195`) after the user reviewed the diff. Vercel auto-deployed from the push; confirmed live.
2. User feedback from looking at the real deployed page, addressed in commit `87a23f9`:
   - Added "Fan Poll" to the main header nav and the Explore bar (previously only reachable via footer/direct link).
   - Removed all "unofficial / separate from the OATCCC Coaches Poll" comparison copy across every page and meta description -- the user didn't want that framing.
   - Fixed a real layout bug: the breadcrumb sat in a raw, unstyled `<div>` with a negative top margin straddling the dark hero background and the white content section below, instead of inside a normal section wrapper like every other page uses. Moved it to match the established pattern (`athletedetail.mjs`).
   - Improved the ballot builder for phones: the in-progress ballot now renders above the team search on narrow screens (in a highlighted panel) so voters see it fill up without scrolling past it after every add; up/down/remove controls grew from a 30px to a proper 44px touch target; the submit button goes full-width.
3. Verified locally against the real database before this commit, then pushed and re-verified against the real, deployed page.
4. **After pushing, independently tested the real production ballot endpoint directly** (not just the page loading) and found `results: []` where a ballot should have shown -- traced to the very first end-to-end test (run before the push, against a hand-built local server standing in for `vercel dev`, which still doesn't work directly in this environment): that test's ballot saved with a `fan_poll_ballots` row but zero `fan_poll_ballot_entries`, and the local test script's "PASS" output was wrong. Confirmed the real, deployed code is correct two ways: calling `cast_fan_poll_ballot_v1` directly, and submitting a real ballot through `https://podiumwatch.vercel.app/api/fan-poll/ballot/` itself -- both produced all 16 entries correctly. The bug was in the earlier local test harness, not in the shipped code.
5. This left 3 ballots in the live "real first week" (Cross Country Boys Division I): the original broken one, plus two diagnostic ballots created while investigating (both under clearly-labeled `.invalid` test emails). Asked the user how to handle it; with approval, deleted all 3 (`fan_poll_ballot_entries` cascade-deleted automatically). Confirmed clean afterward: `results: []`, `eligible_teams: 78`, `status: voting_open` on the real production API.

### Database migrations

None new. Three test ballots deleted from the already-live `fan_poll_ballots`/`fan_poll_ballot_entries` tables (a data change, not a migration).

### Automated testing

`npm test` re-run clean before the `87a23f9` commit (all suites, including `test:fan-poll`).

### Manual testing

Full real-production verification: the live page (nav, copy, breadcrumb, mobile layout), the live ballot endpoint (direct RPC call and real HTTP POST, both confirmed 16/16 entries persist), and the live results endpoint (confirmed empty and clean after cleanup). This is the first feature this session verified against the actual deployed site post-push, not just a local stand-in -- and it's what caught the one real bug (in test tooling, not shipped code) that local-only verification missed.

### Remaining work

1. Schedule and open the remaining 7 division/gender combinations through `/admin/fan-poll/`.
2. Everything else from the previous two entries' Remaining work still applies (the 46 unmatched schools, the results-email sending mechanism, track and field).

## 2026 08 06 Fan Poll migration run and live end-to-end verification

### Date

2026 08 06

### Goal

Run `install/09_FAN_POLL.sql` in Supabase and verify the Fan Poll actually works end to end against the real database, not just against unit tests.

### Completed

1. User ran `install/09_FAN_POLL.sql` in the Supabase SQL Editor. Verified immediately after: all 4 tables (`fan_poll_weeks`, `fan_poll_ballots`, `fan_poll_ballot_entries`, `fan_poll_email_subscribers`), the `fan_poll_week_results` view, and the `cast_fan_poll_ballot_v1` function are all live and queryable. Called the RPC with a nonexistent week id specifically to confirm the function's actual logic runs (not just that it exists): correctly returned a clean `{"accepted":false,"reason":"week_not_found"}` instead of erroring.
2. Ran a full, real, live end-to-end test through the actual HTTP API layer (the same temporary local server built for the 2026-08-05 health check, recreated and deleted again after use, since `vercel dev` still can't be used directly in this environment): admin login through the real `/api/admin/auth/` form logic, created a real Cross Country Boys Division I week through `/api/admin/fan-poll/`, opened voting, fetched the public poll payload (78 real eligible teams returned), submitted a real 16-team ballot through `/api/fan-poll/ballot/`, attempted a second ballot from the same email (correctly rejected, HTTP 409, "already submitted a ballot for this week's poll" -- proving the one-ballot-per-email database constraint works atomically under real conditions, not just in a unit test), and re-fetched results: rank #1 had exactly 16 points and matched the team ranked first on the submitted ballot, rank #16 had exactly 1 point and matched the team ranked last, movement correctly showed `null` for every team (no previous week exists yet for this division).
3. Asked the user whether to keep the resulting real, currently-open voting week and its one test ballot (voted under the clearly-labeled `e2e-test-vote@podiumwatch.invalid`) or reset it before a real launch. The user chose to keep it as the real first week -- Cross Country Boys Division I is open for voting in the live database right now, not reachable by real visitors until the code itself is pushed.

### Database migrations

`install/09_FAN_POLL.sql` run in production Supabase on 2026-08-06. Confirmed live.

### Automated testing

Not applicable -- no code changed in this entry; `npm test` already covered the code itself before the migration was run (see the entry above).

### Manual testing

The full live end-to-end flow described above (admin login, create week, open voting, fetch eligible teams, submit ballot, duplicate-vote rejection, results correctness) was run against the real database and passed completely. Not yet tested: the actual public `/fan-poll/cross-country/boys/division-1/` page in a real browser (the end-to-end test exercised the API layer directly, not the page's own client-side rendering) -- worth a quick look once this is pushed and deployed.

### Remaining work

1. Push the code so the already-open Cross Country Boys Division I week becomes reachable by real visitors -- awaiting the user's go-ahead, per usual.
2. Schedule and open the remaining 7 division/gender combinations through `/admin/fan-poll/`.
3. Everything else already listed in the previous entry's Remaining work still applies (the 46 unmatched schools, the results-email sending mechanism, track and field).

## 2026 08 06 Podium Watch Fan Poll (cross country launch) plus real girls division data

### Date

2026 08 06

### Goal

Build a weekly, fan-voted top 16 team poll per sport/gender/division, modeled closely on the existing AOTW/TOTW pattern, per the user's detailed spec.

### Completed

1. Read the four files/sections the user pointed to before writing anything. Found the AOTW/TOTW schema pattern isn't actually in `install/02_ATHLETE_PROFILE_FOUNDATION_DATABASE.sql` (that migration is entirely about athlete profiles) -- `aotw_weeks`/`totw_weeks` predate this repo's `install/` convention and were created directly in Supabase, so there's no earlier migration file to read. Reverse-engineered the real schema and RPC interface instead from `api/aotw/vote.js`, `api/totw/vote.js`, `api/aotw/current.js`, and `api/aotw/archive.js`. Also found `api/admin/operations.js`'s AOTW/TOTW sections are read-only status reporting -- there is no existing admin action anywhere in the codebase that opens or closes an AOTW/TOTW week, so the admin open/close UI this feature needed had no precedent to copy.
2. Found a real, launch-blocking data gap before writing any schema: the only official statewide division dataset in this project is explicitly boys-cross-country-only (its own file states "This dataset does not represent girls cross country or track and field school divisions"), and a live query showed 0 of 556 teams had a girls cross country or any track division assigned in `team_pages` either. Flagged this to the user with real numbers rather than silently building 8 pages knowing 6 had nothing behind them, and asked how to scope the launch. The user chose to source the missing data themselves and scope this build to cross country only for now.
3. The user then attached 8 real OHSAA divisional alignment PDFs (boys and girls, divisions 1-4). Extracted them with `pdfjs-dist` (already a project dependency) using the same column-reconstruction technique `lib/result_parsers.mjs` already uses for results PDFs, matched to real `team_pages` rows by the numeric official OHSAA school ID (never fuzzy name matching). Verified the extraction was accurate by cross-checking the boys data against what was already live: 556/556 matched exactly, 0 mismatches. With the user's explicit approval, populated `team_pages.cross_country_girls_division` for 422 of 468 real girls programs (logged via the existing `writeTeamChange` audit trail); the remaining 46 (mostly all-girls schools with no boys program, so never in the boys-only source dataset) were listed out for the user rather than silently created or dropped.
4. Wrote `install/09_FAN_POLL.sql`: four new tables (`fan_poll_weeks`, `fan_poll_ballots`, `fan_poll_ballot_entries`, `fan_poll_email_subscribers`), a view (`fan_poll_week_results`, pre-aggregated points per team per week, always live-derived so history can never drift out of sync), and an atomic RPC (`cast_fan_poll_ballot_v1`) that validates the voting window, ballot size, and team distinctness, then inserts a ballot and its 16 entries together, relying on a real unique constraint (`week_id`, `voter_email_hash`) to atomically reject a repeat vote -- the same principle as AOTW/TOTW's own cooldown enforcement, adapted to a hard one-per-week limit instead of a time-based cooldown. `division_number` already allows up to 5 and `sport` already includes the track values, so track and field (5 divisions elsewhere on this site, not 4) needs no schema change to turn on later, only new data. Not yet run.
5. Wrote `lib/fan_poll_service.mjs`: division/sport/gender labeling, the sport+gender-to-`team_pages`-column mapping that sources ballot options, HMAC email hashing (same approach and `VOTE_HASH_SECRET` as AOTW/TOTW, keyed on a normalized email instead of a browser token), ballot shape validation, real-team eligibility checking before the RPC is ever called, results aggregation with previous-week movement (pulled out as a pure `computeMovement` function specifically so it's unit-testable without a database), and the admin week-scheduling/open/close functions (a new, original design following this project's other admin action files, since no AOTW/TOTW precedent existed to copy).
6. Built the public side: `api/fan-poll/index.js` (results + eligible teams in one request), `api/fan-poll/ballot.js` (honeypot, hashed IP, ballot submission), `src/pages/fanpoll.mjs` (an index page plus one page per cross country division/gender, all clearly labeled as an unofficial fan poll separate from the real OATCCC Coaches Poll), and `public/scripts/fan-poll.js` (a searchable team list with add buttons, an ordered ballot list with up/down/remove controls -- no drag-and-drop, per the spec, since most traffic is mobile).
7. Built the admin side: `api/admin/fan-poll.js` (list/create/open/close), `src/pages/adminfanpoll.mjs`, `public/scripts/admin-fan-poll.js`, and a link from `/admin/`.
8. Wrote `scripts/test-fan-poll.mjs`: pure-function tests for labeling, division-to-column mapping, division bounds per sport, email normalization/hashing determinism, and the full movement matrix (first-ever week, newly ranked, up, down, unchanged), plus source guards for validation order, hashed-not-raw email in the vote table, opt-in email separation, honeypot, and admin auth. Registered as `npm run test:fan-poll`, included in `npm test`.

### Files changed

`install/09_FAN_POLL.sql` (new), `lib/fan_poll_service.mjs` (new), `api/fan-poll/index.js` (new), `api/fan-poll/ballot.js` (new), `api/admin/fan-poll.js` (new), `src/pages/fanpoll.mjs` (new), `public/scripts/fan-poll.js` (new), `src/pages/adminfanpoll.mjs` (new), `public/scripts/admin-fan-poll.js` (new), `scripts/test-fan-poll.mjs` (new), `src/pages/admin.mjs`, `src/config/site.mjs`, `scripts/build.mjs`, `package.json`, `docs/DECISIONS.md`.

### Database migrations

`install/09_FAN_POLL.sql` is written and ready but **not yet run**. No ballot can be cast in Supabase until it is. Separately, 422 `team_pages.cross_country_girls_division` values were written live this session (a data change through the existing service, not a schema migration) -- already done, already live.

### Automated testing

1. `npm run build`: 274 pages, 9 published stories, 8 ranking files.
2. `npm run check`: 171 JavaScript files, 10 JSON files, 296 HTML files, 14,802 internal links, 650 local images -- no problems found.
3. `npm test`: all suites passed, including the new `test:fan-poll` suite.

### Manual testing

Not yet done -- requires `install/09_FAN_POLL.sql` to be run in Supabase first, then scheduling and opening a real voting week through the admin page and casting a real ballot through a public division page.

### Remaining work

1. Run `install/09_FAN_POLL.sql` in Supabase.
2. Schedule and open the first real cross country voting weeks through `/admin/fan-poll/`, then live-verify a full ballot submission and the results/movement display.
3. Decide what to do about the 46 girls-only-program schools with no team page yet.
4. Build the actual results-email sending mechanism (the opt-in capture is done; nothing sends yet).
5. Turn on track and field once real division data exists for it -- no schema changes needed, just new `fan_poll_weeks` rows and updating `scripts/build.mjs`'s page-generation loop.
6. Not pushed or deployed -- awaiting review and explicit approval, per the user's instruction for this feature.

## 2026 08 06 Push scope mistake: migrations run to fix the resulting live breakage

### Date

2026 08 06

### Goal

Record a real process mistake and its fix, so it is not repeated.

### What happened

Asked to push the team media upload feature, `git push origin main` was run without first checking `git log origin/main..main`. `git push` sends every local commit ahead of the remote, not just the one most recently discussed -- this pushed 14 commits at once, including the team Instagram feature, which had carried an explicit "do not push without review" instruction from earlier in the session that was never separately lifted.

Since this project auto-deploys to Vercel on push to `main`, the code went live immediately. Checked the real production site directly: `POST https://podiumwatch.vercel.app/api/team-instagram/` was returning HTTP 500 on every call, because `install/07_TEAM_INSTAGRAM_SUBMISSIONS.sql` (the `instagram_handle` column it depends on) had never been run in Supabase. Any real visitor submitting the Instagram form on any real team page would have hit this. The new upload endpoint was less exposed (401s for unauthenticated requests, so not publicly broken the same way) but would have failed with a storage error for any coach who tried it, since `install/08_TEAM_MEDIA_UPLOADS.sql` also had not been run yet.

Reported this to the user immediately and in full, with the concrete live evidence, and offered two ways forward: run both pending migrations now (both purely additive, no data-loss risk) to make the already-live code work, or roll back the deployment. The user chose to run the migrations.

### Completed

1. Ran `install/07_TEAM_INSTAGRAM_SUBMISSIONS.sql` and `install/08_TEAM_MEDIA_UPLOADS.sql` in Supabase (the user ran both directly -- this project has no tooling for Claude to execute raw SQL against Supabase itself, only the Supabase SQL Editor, same as every earlier migration).
2. Verified live immediately after: `POST /api/team-instagram/` with a nonexistent team id now correctly returns 404 instead of 500. A read-only verification script (`_tmp_verify_migrations.mjs`, deleted after use) confirmed the `team-media` storage bucket exists with the expected config (public, 5 MB limit, the four allowed image MIME types) and that `team_pages.instagram_handle` is queryable.

### Database migrations

`install/07_TEAM_INSTAGRAM_SUBMISSIONS.sql` and `install/08_TEAM_MEDIA_UPLOADS.sql`, both run in production Supabase on 2026-08-06.

### Remaining work

1. **Before any future `git push`, check `git log origin/main..main` first.** An approval to push one specific feature is not automatically approval to push everything else already committed locally.
2. Live end-to-end functional verification with the user present is still outstanding for both features (a real upload through the editor; a real Instagram submission and admin revert) -- confirmed above is only that the underlying breakage is fixed, not a full functional walkthrough.
3. Set `TEAM_INSTAGRAM_DIGEST_EMAIL` in Vercel.

## 2026 08 06 Team logo and banner file uploads

### Date

2026 08 06

### Goal

Convert the team editor's existing URL-paste-only logo and banner fields into a real file upload capability, per the user's request ("Can we make it so they can upload an image as a profile picture?").

### Completed

1. Investigated the existing flow first: confirmed `/team-editor/`'s logo/banner fields were plain text URL inputs, confirmed the public team page already rendered `logo_url` as an `<img>` correctly (so once a valid URL exists, display needed no changes), and confirmed the exact existing auth pattern to reuse (`requireTeamUser` + a `requireMembership` check against `team_members`, matching `api/team/detail.js`).
2. Found the direct precedent to follow: `install/05_RESULTS_INGESTION_ENGINE.sql` already creates a Supabase Storage bucket (`result-source-documents`, private) via plain SQL, and `lib/result_ingestion_engine.mjs` shows the exact base64-upload, pre-decode size check, and magic-byte classification pattern already used for results documents.
3. Wrote `install/08_TEAM_MEDIA_UPLOADS.sql`: creates a new **public** Storage bucket, `team-media` (public, unlike the private results-documents bucket, since every file here is meant to be shown on a public team page), 5 MB file size limit, restricted MIME types at the bucket level as defense in depth. Additive only -- no table created or altered. Not yet run.
4. Wrote `lib/team_media_service.mjs`: `classifyImageBytes` reads real magic bytes (PNG, JPEG, GIF, WEBP signatures) rather than trusting the browser's declared content type or file name -- SVG is deliberately excluded since it is XML and can carry a script. `decodeImageUpload` checks size from the base64 length before ever decoding (avoids allocating memory for an oversized payload just to reject it), then again after decoding. `storeTeamMediaUpload` uploads to the new bucket with a content-addressed storage key (team id + field + a short hash of the bytes) and returns the public URL.
5. Wrote `api/team/upload-media.js`: requires a signed-in, active team member (or an admin), validates and stores the file, and returns only a public URL -- it deliberately never writes to `team_pages` itself. The existing "save" action in `api/team/detail.js` is what actually persists the URL, the same audited path as any other profile edit, so nothing is public until the coach presses Save.
6. Updated `src/pages/teameditor.mjs`: added a real file input (styled as a button via a hidden input nested in a labeled `.button`) next to each existing URL field, plus a status line and a hint explaining upload fills the URL field but Save still publishes it.
7. Updated `public/scripts/team-editor.js`: refactored `apiFetch` to accept an optional path (was hardcoded to `/api/team/detail/`) so the same token-fetching and 401-handling logic could be reused for the new upload endpoint instead of duplicated. Added `fileToBase64`, `uploadTeamMedia`, and `handleMediaFileChange`, wired to each file input's `change` event. On success, the returned URL is written into the matching text field and a real `input` event is dispatched so the existing preview-update logic (`updateImagePreviews`) fires unchanged.
8. Wrote `scripts/test-team-media.mjs`: real magic-byte fixtures for all four accepted formats plus rejection cases (plain text, SVG, empty, truncated signature, mislabeled file), upload decoding checks (field validation, empty content, non-image content, oversized content caught pre-decode, encoding), and source guards for the parts needing a live Supabase connection (auth requirement, and that the endpoint never touches `team_pages` directly). Registered as `npm run test:team-media`, included in `npm test`.

### Files changed

`install/08_TEAM_MEDIA_UPLOADS.sql` (new), `lib/team_media_service.mjs` (new), `api/team/upload-media.js` (new), `scripts/test-team-media.mjs` (new), `src/pages/teameditor.mjs`, `public/scripts/team-editor.js`, `package.json`, `docs/DECISIONS.md`, `docs/NEXT_SESSION.md`.

### Database migrations

`install/08_TEAM_MEDIA_UPLOADS.sql` is written and ready but **not yet run**. No upload will succeed in Supabase until it is.

### Automated testing

1. `npm run build`: 265 pages, 9 published stories, 8 ranking files.
2. `npm run check`: 162 JavaScript files, 10 JSON files, 286 HTML files, 14,027 internal links, 630 local images -- no problems found.
3. `npm test`: all suites passed, including the new 12-assertion `test:team-media` suite.

### Manual testing

Not yet done. **Update:** pushed to production and `install/08_TEAM_MEDIA_UPLOADS.sql` was run in Supabase the same night (see the "Push scope mistake" entry above for how the push happened earlier than planned). The bucket is confirmed live; a real upload through the editor has not yet been walked through with the user present.

### Remaining work

1. Live-verify: upload a real logo/banner through the editor, confirm the preview updates, confirm Save persists it, confirm it renders on the public team page.
2. Decide whether unclaimed teams (555 of 556) should get any photo-submission path too -- not built here; the literal request read as upgrading the existing claimed-team editor, not opening a new anonymous submission surface.

## 2026 08 06 Team Directory was empty: 556 real teams existed, none published

### Date

2026 08 06

### Goal

Diagnose the user's report that searching the Team Directory (`/teams/`, reached from "Claim Your Team" -> "Find your team") returned nothing, no matter what they searched.

### Completed

1. Reproduced live against the real API (`/api/teams/`): an empty search returned zero results, ruling out anything specific to the exact search text the user tried.
2. Checked the real numbers via the Operations Center (`api/admin/operations.js`'s teams subsystem): 556 team pages exist (one for every official Ohio school, created by the statewide school import on 2026-08-03), 0 published, 1 claimed. The search code itself was correct -- it filters to `published = true` by design, and nothing had ever been published.
3. Confirmed there was no existing bulk-publish action; found the correct single-team mechanism (`api/admin/teams.js`'s `set_status` action, the same one the real admin UI uses, which validates and logs to both `team_change_log` and the general admin audit log).
4. With the user's explicit approval, called `set_status` (field `published`, value `true`) once per unpublished, non-suspended, non-archived, non-merged team page (`status: "draft"`, 556 of them) through the real admin API. All 556 succeeded, 0 failures.
5. Verified live: an empty search and a real school name search (e.g. "Worthington") both now return real results.

### Files changed

None. This was a data-only fix (556 `team_pages.published` updates through the existing, reviewed admin action), not a code change.

### Database migrations

None.

### Automated testing

Not applicable -- no code changed.

### Manual testing

Verified live through the real running server: before the fix, every search (including empty) returned zero teams; after, both an empty search and a specific school name search return real results.

### Remaining work

1. The 555 unclaimed team pages are still very incomplete (no coach, no logo, no description -- the Operations Center's existing "556 active team profiles below 65 percent completion" task already tracks this). Publishing them makes them findable; filling them in is a separate, ongoing effort for coaches claiming their own pages.

## 2026 08 06 Team Instagram submissions (instant, validated, reversible)

### Date

2026 08 06

### Goal

Build a public, no-login team Instagram submission feature per the user's detailed spec: automated validation, immediate effect (no admin approval step, unlike every other feature in this project), full change logging, one-click admin revert, and a weekly email digest.

### Completed

1. Read `docs/ATHLETE_PROFILE_FOUNDATION.md`, `docs/STATEWIDE_DATA_FOUNDATION.md`, `AGENTS.md`, and (per AGENTS.md's own instruction) `docs/ARCHITECTURE.md` and `docs/DATA_SOURCES.md` before starting.
2. Found real existing infrastructure before writing anything: `team_pages.instagram_url` and `team_social_links` (coach-managed, authenticated), and `public.team_change_log` with a ready-made `writeTeamChange()` helper in `lib/team_audit.mjs` -- exactly the change-history shape the user asked for. Flagged the resulting design fork (would an anonymous instant-write feature risk overwriting a real coach's verified link?) rather than guessing, and got an explicit decision: a new, separate `instagram_handle` field, shown on every team page regardless of claim status.
3. Empirically verified, before designing validation around it, that Instagram account existence can be checked without a browser: both real and nonexistent handles return HTTP 200 (the profile page is a JavaScript application), but the page's `<title>` tag still differs server side. Tested against several known-real accounts (Nike, NASA, Instagram itself) and several made-up handles.
4. Built `lib/team_instagram_service.mjs`: handle normalization (accepts `@handle`, a bare handle, or a pasted profile URL), format validation (Instagram's real username rules), a basic blocklist, the title-tag existence check (with an injectable fetch for testing), submission (validate -> blocklist -> rate limit -> existence check -> write -> log, in that order so a rate-limited request never triggers an outbound network call), one-click revert (writes a new log entry, never edits history), a cross-team change list, and the weekly digest email content builder.
5. Built the public path: `/submit-results/`-style page at the bottom of `/team/`, a public API (`api/team-instagram/`, no admin auth, honeypot, hashed-address rate limiting matching the existing athlete-correction endpoint's pattern), and client-side rendering/submission wiring in `team-profile.js`.
6. Built the admin path: `api/admin/team-instagram.js` (list, revert), a new admin page `/admin/team-instagram/` with a one-click revert per change, and linked it from `/admin/` (learned from an earlier oversight this project already hit once with the Results Source Manager page).
7. Built the weekly digest: `api/cron/team-instagram-digest.js`, reusing the existing `sendResendEmail`/`getSiteUrl`/`escapeHtml` exports from `lib/engagement_service.mjs` rather than reimplementing the Resend integration, and a new Monday 13:30 UTC cron entry in `vercel.json` (offset from the existing 13:00 UTC follower digest).
8. Wrote `install/07_TEAM_INSTAGRAM_SUBMISSIONS.sql`: adds `instagram_handle` and `instagram_handle_updated_at` to `team_pages`, and one supporting partial index on `team_change_log` for the rate-limit and history queries. Never issues `create table` for either table, since both already exist outside this repo's migration history.
9. Added `scripts/test-team-instagram.mjs` (registered as `npm run test:team-instagram`, included in `npm test`): full coverage of the pure validation functions, the existence check via dependency-injected fetch (no live network call in the suite), the digest email builder, and source guards for the parts that need a live database connection this fixture-only suite does not have.

### Files changed

`install/07_TEAM_INSTAGRAM_SUBMISSIONS.sql` (new, not run), `lib/team_instagram_service.mjs` (new), `api/team-instagram/index.js` (new), `api/admin/team-instagram.js` (new), `api/cron/team-instagram-digest.js` (new), `src/pages/adminteaminstagram.mjs` (new), `public/scripts/admin-team-instagram.js` (new), `scripts/test-team-instagram.mjs` (new), `src/pages/teamprofile.mjs`, `public/scripts/team-profile.js`, `src/pages/admin.mjs`, `scripts/build.mjs`, `vercel.json`, `package.json`.

### Database migrations

`install/07_TEAM_INSTAGRAM_SUBMISSIONS.sql` written but **not run** -- the user asked to run it themselves after reviewing it.

### Automated testing

`npm run build`, `npm run check`, and `npm test` (including the new `test:team-instagram` suite, 20+ new checks) all pass.

### Manual testing

The new pages (`/admin/team-instagram/`) were confirmed reachable and rendering correctly on the local dev server. The full live submit/revert/digest flow against a real database could not be tested yet -- the `instagram_handle` column does not exist until install/07 is run.

### Remaining work

1. User to review and run `install/07_TEAM_INSTAGRAM_SUBMISSIONS.sql` in Supabase.
2. Set `TEAM_INSTAGRAM_DIGEST_EMAIL` in Vercel before the weekly digest cron can send anything (in addition to the `RESEND_API_KEY` / `RESEND_FROM_EMAIL` / `CRON_SECRET` this project already needs configured for any cron email to send).
3. Once the migration is run, live-verify the full submit -> validate -> write -> log -> revert -> digest loop against a real (disposable) team, the same discipline used for every other live-database feature this project has shipped.
4. Nothing here is pushed or deployed -- the user asked to review the diff first.

## 2026 08 06 Public results submission path (no admin account required)

### Date

2026 08 06

### Goal

The user wanted a way to stop being the only path for results into Podium Watch. After researching how bigger recruiting platforms (Athletic.net specifically) actually source data -- not by scraping anyone, but by giving coaches and meet hosts a place to upload the same file their timing software already exports -- build Podium Watch's own version of that: a public page where anyone can submit raw results without an admin account.

### Completed

1. Built `/submit-results/`: a public page (meet name, date, sport, season, optional location/gender, a paste box or file upload, required submitter name/email, optional organization/note, a honeypot field) and a new public API route, `api/results-submissions/`, that requires no admin login.
2. Every safety rule already established this project holds here too: always a dry run, always lands in the same hidden admin review queue an admin already uses, never creates or publishes anything automatically. Added one new rule specific to this path: `importApprovedRows` now tags a public submission's eventual performance as `source_type: "community"` rather than the `"official"` trust every other import in this project carries, reading this from the job instead of hardcoding it.
3. Anti-abuse follows the exact pattern already used by the public athlete-correction endpoint: a honeypot field, required contact information, and a per-address daily rate limit keyed off an HMAC-hashed address (never a raw IP) rather than inventing a new approach.
4. Found and fixed two real bugs while building and live-testing this end to end:
   - `createContentIngestionJob` never forwarded a caller-supplied meet name or date into row metadata (only sport/season), so typing "Meet name: ..." into the new form was silently dropped. Fixed; the existing admin content-upload action gained the same fields as a side benefit.
   - A real, well-formed OHSAA/MileSplit-style paste ("PLACE ATHLETE TEAM MARK POINTS", single-space separated, grade embedded between name and school -- the exact format used all session for the manual OHSAA imports) silently produced zero staged rows through the general Results Ingestion Engine. Its header detection matched this as a real header line, but splitting it produced only one cell (no 2+ space run to split on), which then made every data line beneath it also collapse to one garbage cell instead of falling through to a pattern that could parse it. Fixed with a grade-anchored fallback pattern adapted directly from the admin recruiting importer's own proven copy of this pattern (case-sensitive, so "Kenneth Morgan Jr" is never mistaken for grade marker "JR" again), and by only accepting a header match as real multi-column headers when it actually splits into more than one cell.
5. Verified live, end to end, through the real running server: a complete submission with real results text staged correctly, meet name/date on every row, submitter contact info attached, and a hashed (not raw) address recorded for rate limiting. Also verified the honeypot short-circuits with no real work, and that every required-field validation rejects correctly.
6. Added 8 regression tests (46 total in this suite now) covering the parser fix, the metadata-forwarding fix, every validation rule, the honeypot, the hashed-not-raw-IP rate limiting, the community-trust tagging, and the presence of the new page/script's safety markers.

### Files changed

`api/results-submissions/index.js` (new), `src/pages/submitresults.mjs` (new), `public/scripts/submit-results.js` (new), `lib/result_ingestion_engine.mjs`, `lib/result_parsers.mjs`, `api/admin/results-sources.js`, `public/scripts/admin-results-sources.js`, `scripts/build.mjs`, `tests/results-ingestion.test.mjs`.

### Database migrations

None. Reuses the existing `result_ingestion_jobs`/`result_staging_rows` tables and their existing `job_type` enum values (`paste`, `upload`) exactly as they already were.

### Automated testing

`npm test` (46 results-ingestion tests, all passing) plus the full project suite.

### Manual testing

Verified live through the real running local server: honeypot short-circuit, every required-field rejection, and a complete real submission staging correctly with the parser fix in place. Confirmed the resulting job surfaces correctly in the admin Results Source Manager with submitter name/email/organization/note clearly labeled.

### Remaining work

1. Decide whether/when to link `/submit-results/` from elsewhere on the site (footer, contact page, team pages) so real submitters can actually find it -- it exists and works, but nothing yet points to it.
2. Decide whether to push this (and the rest of tonight's accumulated commits) to production.
3. Consider adding a public-facing "why we ask for your email" or privacy note near the submitter fields if this gets real traffic and questions arise.

## 2026 08 05 First real Baumspage results ingestion crawl, two bugs fixed

### Date

2026 08 05

### Goal

With new standing autonomy permissions in place (see `.claude/settings.json` and the memory note on standing permissions), get as far as possible toward running a first real Baumspage crawl job for the separate Results Ingestion Engine, stopping only for git push, Vercel deploys, direct Supabase SQL, publishing/approving anything for public visibility, destructive git commands, or deleting files from before this session.

### Completed

1. Read `docs/RESULTS_INGESTION_STATUS.md`, `docs/RESULTS_INGESTION_PLAN.md`, and `docs/RESULTS_PROVIDER_MATRIX.md`. Confirmed via the real admin API (not direct SQL) that the engine was already installed, so no migration re-run was needed.
2. Ran a 10-page Baumspage provider job at the catalog root, then a 30-page one, both of which discovered only event-index pages and zero result documents -- diagnosed this as an expected characteristic of Baumspage's two-hop catalog structure (many sibling event pages consume a small page budget before any single event's linked result files get queued), not a bug.
3. Seeded a job directly at one real event page (the 2025 Willard Early Bird Cross Country Invitational) and got the first real, non-fixture, end-to-end success: 4 real result PDFs fetched, classified, extracted, verified, and staged.
4. Found and fixed two real bugs in the shared parsing library exposed by real data: (a) PDF column drift, where `pdfText()`'s naive one-space-per-item joining corrupted athlete names and school names whenever a PDF happened to split a field across multiple text runs; (b) a Team Scores table leaking three fake "individual result" rows per document. Full technical detail in `docs/RESULTS_INGESTION_STATUS.md`.
5. Fixed both, added a real fixture (the actual PDF that exposed them) and two permanent regression tests exercising the real pipeline, and verified end to end through the real admin API a second time: a fresh crawl of the same real meet now stages exactly 39 correct rows per document.
6. Created `.claude/settings.json` at the user's explicit direction, recording standing permission rules (free rein for file edits and local git/npm/node/build commands; always ask before push, deploy, direct Supabase SQL, publishing, destructive git, or deleting pre-session files). Broadened its Bash allow rule from specific command prefixes to all Bash after the narrower version still prompted for plain `grep`/`rm`.

### Files changed

`lib/result_parsers.mjs`, `tests/results-ingestion.test.mjs`, `tests/fixtures/baumspage-boys-hs-results.pdf` (new), `.claude/settings.json` (new), `docs/RESULTS_INGESTION_STATUS.md`.

### Database migrations

None. No SQL was run directly against Supabase for any of this session's results-ingestion work -- every check and job action went through the real admin API (`/api/admin/results-sources/`), the same one the deployed product exposes. Several test ingestion jobs were created this way and left in the database (dry-run, not public, matching several similar leftover test jobs already there from 2026-08-04).

### Automated testing

`npm test` (all 38 checks, including the two new PDF regression tests) passes.

### Manual testing

Verified live, twice, through the real admin ingestion job API against the real Baumspage host: once to discover both bugs, once after fixing them to confirm clean staged rows.

### Remaining work

1. A full successful review-approve-import round trip (matched athlete + actual import) has not been exercised, since no real crawl this session happened to include a previously-known athlete. Will be naturally proven the first time a real production crawl includes one.
2. Decide whether to push tonight's accumulated commits to production.

### Update: catalog-root crawls, a third bug, and full autonomous validation

Continued past the first success. Diagnosed why a provider-wide catalog crawl (seeded at the bare `https://www.baumspage.com/cc/` root, not one specific event) never reached any result documents at 10 or 30 pages: `maxPages` was capping how many pages could ever be *discovered*, not just fetched, so one page's fan-out across dozens of sibling events exhausted the whole discovery budget before any individual event's linked result files were ever queued. Fixed by decoupling discovery capacity (now roughly 10x `maxPages`) from the visit budget (`maxPages` still gates fetches). Verified live: a 100-page catalog-root crawl -- no manual per-event seeding at all -- reached **24 real documents and staged 3,098 rows with zero errors**, spot-checked clean across three different real meets.

Also exercised identity resolution and the import safety refusal live for the first time: school-level matching succeeded correctly, athlete-level matching correctly reported every row unmatched (none of these small local schools' runners have existing profiles yet) rather than guessing, and manually approving unmatched rows then attempting to import correctly failed with a 409 safety refusal instead of importing anything unverified.

A background `vercel dev` process crashed mid-session from an unrelated Node.js/undici internal bug during the heaviest crawl; restarted cleanly, not a project code issue.

Committed the crawler fix (`7e7d2e0`) and this documentation update. Everything from tonight remains local-only, per the user's new standing permissions -- nothing pushed, no Vercel deploy, no direct SQL, nothing published.

## 2026 08 05 Fourth real meet (D2 boys): 13 more aliases, applying the precedent

### Date

2026 08 05

### Goal

Resolve the 44 unmatched school names from a fourth real meet (2025 OHSAA Division 2 Boys Cross Country State Championship, 215 rows).

### Completed

1. Resolved 13 of 44 unmatched school names against the live `ohio_schools` table, same standard as before (exactly one confident candidate, verified live): Dub. Scioto (Dublin Scioto), CF Northwest (Northwest, Canal Fulton), CVCA (Cuyahoga Valley Christian Academy -- already known from the D3 "Col. Academy" search), Tol. St. Francis (St. Francis de Sales, Toledo), Watterson (Bishop Watterson), Hoban (Archbishop Hoban -- already known from the D3 Akron-city search), Carroll (Bloom-Carroll High School, whose city is literally "Carroll"), Hartley (Bishop Hartley), Hol. Springfield (Springfield, Holland -- already known from the D3 investigation), Brecksville (Brecksville-Broadview Hts), Roosevelt (Theodore Roosevelt, Kent), Syl. Northview (Sylvania Northview), Lima Shawnee (Shawnee, Lima -- the same real school already confirmed as a genuine gap-adjacent case in D3, just referenced in city-first word order here). Clears 43 of the 44 rows since several repeat across the meet.
2. The 44th ("New Richmond") checked against `public/data/ohio-school-foundation-2026-27.json` and is not in the official document at all -- applied the 2026-08-05 "schools missing from the official source stay unmatched, not invented" decision directly, without re-asking, since the precedent was already set and documented for D3.

### Files changed

None. 13 rows added to `ohio_school_aliases` directly in Supabase (data only).

### Database migrations

None.

### Automated testing

No code changed; existing suite unaffected.

### Manual testing

All 13 new aliases verified live against the real local API (synthetic 14-row preview covering every new alias plus New Richmond); all 13 resolved to `creatable`, New Richmond correctly stayed `unmatched`.

### Remaining work

1. Ask the user to re-preview the D2 meet and commit it.

## 2026 08 05 Third real meet (D3 boys): aliases, and a real directory gap

### Date

2026 08 05

### Goal

Resolve the 39 unmatched school names the user hit previewing a third real meet (2025 OHSAA Division 3 Boys Cross Country State Championship, 215 rows).

### Completed

1. Resolved 11 of 39 unmatched school names against the live `ohio_schools` table, the same way as the D1 meet: only added an alias when exactly one confident candidate existed. Added: Cin. CHCA (Cincinnati Hills Christian Academy), Mar. Highland (Highland, Marengo), Ash. Edgewood (Edgewood, Ashtabula), Alter (Archbishop Alter), WCH Washington (Washington, Washington Court House), Genoa (Genoa Area), Bid. River Valley (River Valley, Bidwell), Fenwick (Bishop Fenwick), Col. Academy (Columbus Academy), Beaver Local (Beaver, East Liverpool), Fair. Park Fairview (Fairview, Fairview Park). Verified live: all 11 correctly resolve through the real API. Since several of these repeat across the meet (Cin. CHCA, Mar. Highland, Ash. Edgewood, and Col. Academy each appear 7 times), this clears 35 of the 39 rows.
2. The remaining 4 (Dawson-Bryant, "Ak. Springfield," "Spr. Shawnee," Pleasant) turned out to be a different kind of problem, not a typo: none of them appear anywhere in `public/data/ohio-school-foundation-2026-27.json`, the parsed copy of the actual official OHSAA document (556 schools) that the entire `ohio_schools` table was built from. Checked directly against that source rather than guessed. This most likely means these schools do not sponsor their own OHSAA boys cross country program (so the document never assigns them a division), and a results page still prints the athlete's home school even when they are running unattached or as part of another school's co-op team.
3. Found and confirmed a second real constraint before proposing to add them anyway: `ohsaa_school_id` on `ohio_schools` is `not null unique` in the schema, and -- more importantly -- it is displayed on the real public `/schools/` directory page, not just used internally. Giving these 4 schools a placeholder ID would put a visibly fake OHSAA ID number on a real public page next to 556 genuine ones.
4. Presented this finding to the user with the concrete public-page consequence shown; they chose to leave all 4 unmatched rather than add anything invented or odd-looking to the public schools directory. No schema change, no placeholder rows, and no code changes were needed -- `previewPerformanceImport` already treats an unresolved school as `unmatched` by design.

### Files changed

None. 11 rows added to `ohio_school_aliases` directly in Supabase (data only, no migration, no code change).

### Database migrations

None.

### Automated testing

No code changed; existing `npm test` suite still passes (unaffected).

### Manual testing

All 11 new aliases verified live against the real local API (a synthetic 15-row preview covering every new alias, all correctly resolved to `creatable`; the 4 unresolved names correctly stayed `unmatched`).

### Remaining work

1. If any of these 4 schools turns out to genuinely sponsor boys cross country (for example under a different display name or as part of a merged district), revisit with real evidence before adding anything to `ohio_schools`.

### Update: committed successfully

The user re-previewed and committed the D3 meet themselves. Verified directly against the database afterward (batch `3c6249e5-e146-4f9d-a588-d5a6fe680a60`): 211 of 215 rows imported (24 attached to existing profiles, 187 to newly created ones), the same 4 rows correctly stayed unmatched and were not saved, and every performance and created profile confirmed hidden (created profiles also confirmed `unverified`). Note: querying the batch mid-commit briefly showed `status: "started"` with profiles already created but zero performances yet -- this was just the commit still in progress (it took about 66 seconds for 215 rows, longer than D1's 41 seconds for 180, likely due to the higher creatable-row count), not a bug; re-checking after it finished confirmed a clean, complete commit.

## 2026 08 05 Import preview error visibility fix

### Date

2026 08 05

### Goal

Diagnose why the user, previewing a new meet's pasted results on the live production site, reported seeing no summary counts or per-row status ("I do not see the check list of which ones failed or were good").

### Completed

1. Reproduced the likely cause live against the local API: `preview_official_results_text` requires Season Year and returns a 400 error if it is blank (for example `"Season year must be between 2000 and 2200."`), confirmed with a direct request.
2. Found the real UX gap causing the confusion: the "Preview pasted official results" button is a plain button, not a form submit, so it never gets free browser required-field validation for Meet Name, Meet Date, or Season Year the way the older submit-based "Preview meet results" button does. When the API rejects a missing field, the only place that error appeared was the page's single status message near the very top of `/admin/recruiting/` -- far above the meet import section, especially once a full meet's pasted results push everything below the textarea further down the page. The result looked like the preview silently did nothing.
3. Fixed both preview paths (the CSV/manual form submit and the pasted-official-text button) to also render the error directly above the preview table, right next to the button that was just clicked, in addition to the existing top banner. Added a small `.recruit-admin-import-error` style using the existing `--danger` color variable.
4. Verified locally: rebuilt, confirmed the built and locally served `admin-recruiting.js` contain the fix.

### Files changed

`public/scripts/admin-recruiting.js`, `src/styles/main.css`.

### Database migrations

None.

### Automated testing

`npm test` (all 36+ checks) passes.

### Manual testing

Verified locally that the fix is present in the built output and served by the local dev server, then committed and pushed to production immediately (the user was actively blocked by this on the live site while gathering the next meet).

### Remaining work

1. Confirm with the user which field was actually blank (most likely Season Year) so the specific meet they were trying can be retried.

## 2026 08 05 Second real meet: school aliases, two more bugs, matching fix

### Date

2026 08 05

### Goal

Help the user import a second real meet themselves through the browser UI (the 2025 OHSAA Division 1 Boys Cross Country State Championship, 180 rows), following the first real import (D4, 213 rows) committed earlier the same day.

### Completed

1. Diagnosed a real second-meet parsing bug from the user's pasted data: "Kenneth Morgan Jr" has "Jr" as a mixed-case name suffix, but the row parser's grade regex was case-insensitive, so it matched "Jr" as the grade marker "JR" and corrupted both the athlete's name and the school name that followed. Fixed by making the regex case sensitive (every provider seen so far renders the real grade marker in all caps); added the real row as a permanent fixture. Committed as `95d4a04`.
2. Diagnosed a Vercel-production-vs-localhost mixup: the user tried the new feature on the deployed site, where it does not exist yet (only committed locally, never pushed). Confirmed via direct request to `localhost:3000` and a `grep` of the local build output that the local server and build were both correct; the user confirmed they had the wrong tab open.
3. Reviewed the full real D1 preview (180 rows: 97 ready, 14 duplicate, 69 unmatched, 0 creatable, 0 ambiguous, 0 invalid) and resolved the 69 unmatched abbreviated school names against the live `ohio_schools` table one at a time -- never guessed; only added an `ohio_school_aliases` row when exactly one confident candidate existed. Found and confirmed 17 real schools this way (for example "Thom. Worthington" to "Thomas Worthington," "Dub. Jerome" to "Dublin Jerome"). One name ("Mass. Jackson") initially looked unmatched because the search only checked `normalized_name`; re-checked against the official OHSAA division PDF and a corrected `school_name ilike` search, confirmed it is Massillon Jackson (disambiguated from an unrelated "Jackson" school in Jackson, Ohio), and added the alias.
4. User re-previewed with the new aliases in place and got down to 0 unmatched, then clicked "Import ready results" to commit.
5. That commit crashed with a real production error: a `23505` duplicate-key violation on `athlete_profiles_slug_key` for "Calvin Watson." Diagnosed by reading the dev server's log, then querying the database directly: Calvin Watson already had a hidden profile from the original 2026-08-03 editorial seed, linked to the school's official name ("Thomas Worthington"), but the import only ever compared the raw abbreviated text from the results page ("Thom. Worthington") against that official name -- these never match, so the existing profile was invisible to the matcher and a duplicate creation was attempted, colliding on the auto-generated slug. Root cause: the school alias lookup was helping profile *creation* (matching a row's school name to an official school so a new profile could be created against it) but was never being used to help profile *matching* (finding an existing profile in the first place).
6. Fixed `previewPerformanceImport` to load the school alias lookup unconditionally and try a second match key built from the resolved official school name before concluding a row has no match; hardened `createOfficialSourceProfile` to retry once with a disambiguated slug on a slug-specific collision instead of crashing the whole commit. Verified live against the real data that caused the crash: Calvin Watson's row now correctly resolves to `ready` against his real existing profile. Committed as `8f5cfa3`, with a source-guard regression test (this path depends on live Supabase data a fixture-only test file cannot stand up on its own).
7. User re-clicked "Import ready results" for the D1 meet and it committed successfully. Confirmed directly against the database afterward: batch `65e7bec0-869e-47ad-8728-4c7bf290a26a`, all 180 rows imported (31 attached to existing profiles, 149 attached to newly created ones), every performance and every created profile hidden (and every created profile marked `unverified`), and specifically confirmed Calvin Watson still has exactly one profile in the database (his original 2026-08-03 seed profile) -- no duplicate was created.

### Files changed

`lib/recruiting_service.mjs`, `scripts/test-recruiting-foundation.mjs`. 17 rows added to `ohio_school_aliases` directly in Supabase (data only, no migration).

### Database migrations

None. The 17 school alias rows are ordinary data additions to the existing `ohio_school_aliases` table, not a schema change.

### Automated testing

`npm run build`, `npm run check`, and `npm test` all pass after each fix, including the new Kenneth Morgan Jr fixture case and the new alias-matching source guard.

### Manual testing

The Kenneth Morgan Jr fix and the alias-matching fix were both verified live against the real data that exposed them, via the actual HTTP API path. The user then re-clicked "Import ready results" for the D1 meet themselves in the browser and it committed successfully, confirmed by direct database query afterward (see item 7 above).

### Remaining work

1. Continue gathering more official results the same way, adding school aliases as new abbreviations are found.
2. Decide whether to push the accumulated statewide-import feature (D4 + D1 + this matching fix) to production now that it has been exercised through two real meets, both fully committed.

## 2026 08 05 Statewide results import: OHSAA official results, real data

### Date

2026 08 05

### Goal

Begin building a statewide performance database ("thousands of athletes and their times and marks... to rank them"), starting with OHSAA cross country 2025 and track 2026 results, per the user's request.

### Completed

1. Investigated rather than trusted the existing Results Ingestion system's own documentation: confirmed it does write into `athlete_performances` (correcting a wrong claim from the 2026-08-04 Phase One report), but confirmed it only ever attaches results to athletes who already have a profile, never creating one. With zero team rosters loaded, this made the existing system unable to help without a large separate rosters project first.
2. Confirmed live, with a real request, that MileSplit (`milesplit.com` and `milesplit.live`) renders results with client-side JavaScript and cannot be fetched directly by any query-string trick; copy-pasting the rendered page is the only reliable route today, and fully automated bulk scraping is not realistic without a data partnership or browser automation (the latter raising real terms-of-service concerns).
3. Built and tested `parseOfficialResultsText` against a real, complete dataset: the actual 2025 OHSAA Division 4 Boys Cross Country State Championship, 213 athletes, pasted directly from a browser by the user. Handles grade embedded between name and school (FR/SO/JR/SR), multi-word school names with periods and parentheses ("Con. Crestview," "Sandusky Central Catholic," "Central Christian (Kidron)"), and automatically skips Team Scores sections.
4. Added a narrow, explicit exception to "never create profiles from unmatched rows" (full reasoning in `docs/DECISIONS.md`): admin-opted-in, official-source-only, exact-school-match-only profile creation, always hidden, looked up by a stable identity key first so re-imports never duplicate or overwrite review work.
5. Added the admin UI for it: a paste box for raw official results text and a "Create hidden profiles for unmatched rows from this official source" checkbox on `/admin/recruiting/`.
6. Verified the complete real 213-row dataset through the actual HTTP API path (read-only preview only): 18 ready (matched the existing seed, including Bennett Lehman), 153 creatable (real athletes, school resolved), 42 unmatched (abbreviated school names needing alias cleanup, e.g. "Ft. Loramie," "Spring. ECA," "Rac. Southern").
7. Found and fixed two real bugs while building this, both self-caught before anything went live: (a) the same "cleanAthleteText collapses newlines" mistake from earlier in the session, hit twice more (the parser itself, then the new admin API action that calls it) -- both fixed, with a named regression test guarding the API-layer case specifically; (b) `Number(null) === 0` in the grade-to-graduation-year formula let a missing season year silently produce graduation year 1 instead of failing -- caught by a test written for this feature, not discovered live.
8. With the user's explicit approval, committed the real 213-row import via the real HTTP API path (the same one the browser UI uses): 171 performance records created (18 attached to existing profiles, 153 attached to newly created ones) and 153 new athlete profiles created. Verified directly against the database afterward: every performance in the batch is hidden, every created profile is hidden and marked `unverified`, and a specific check on the Luke Snyder profile (grade SR in the 2025 season) confirmed graduation year 2026. The 42 unmatched rows correctly created nothing. Import batch id `194fc161-c20c-40e8-ad63-d41d77c46cfa`.

### Files changed

`lib/recruiting_service.mjs`, `api/admin/recruiting.js`, `src/pages/adminrecruiting.mjs`, `public/scripts/admin-recruiting.js`, `scripts/test-recruiting-foundation.mjs`, `docs/DECISIONS.md`, `docs/NEXT_SESSION.md`.

### Database migrations

None. No new tables were needed; this reuses `athlete_profiles` and the existing performance import tables exactly as they are.

### Automated testing

`npm run build`, `npm run check`, and `npm test` all pass, including new tests for the real-data parsing fixture, the grade-to-graduation-year formula (including the null-handling bug fix), and both new admin API/page markers.

### Manual testing

The import itself was executed and verified via the real HTTP API path (the same endpoint the browser UI calls) against the real 213-row dataset, with direct database verification afterward. The user has not yet clicked through the browser UI for this feature themselves; they are trying the next batch of results that way.

### Remaining work

1. User to try the next batch of official results through the browser UI.
2. Continue gathering more official results the same way, and add school aliases for the 42 unmatched names as real corrections are confirmed.
3. Review and publish the imported performances and created profiles whenever ready -- everything from this import stays hidden until that separate step happens.

## 2026 08 05 Recruiting Phase Two write-path verification and merge

### Date

2026 08 05

### Goal

With the user present, verify the Phase Two and Phase Three write paths that overnight verification deliberately did not touch (media save/publish, rating draft/publish, rank movement, the scoring comparison tool), then merge, push, and deploy once confirmed.

### Completed

1. Created one throwaway, obviously fake test athlete profile ("ZZTEST VerificationAthlete", never a real person) with the user's explicit approval, to exercise every write path without touching real athlete data.
2. Verified, in order, against the real (but disposable) profile: performance import (confirmed the new `cross_country` taxonomy resolves correctly), a draft rating (confirmed it stays unranked with the correct explanatory note), publishing that rating (confirmed it attaches to the active `2026.2` methodology, not the retired one -- this is live confirmation of the most serious bug fixed overnight), the public recruiting directory and the individual athlete profile page both showing the published rating correctly, a draft media item (confirmed hidden), publishing it (confirmed it appears), a second rating save to confirm the rank snapshot mechanism records correctly, and the scoring comparison tool (confirmed it surfaces the published rating as reference context).
3. Every check passed. No bugs found during this pass.
4. Deleted the entire throwaway profile and everything attached to it (performance, import batch and its audit rows, rating, media, rank snapshots -- most cascaded automatically via the existing foreign key `on delete cascade` rules). Verified with a direct count query that zero rows remain, and confirmed the test athlete no longer appears in either public search endpoint.
5. Merged `recruiting-phase-two-taxonomy-media` into `main`, pushed, and deployed (see git log for the merge commit).

### Files changed

None beyond what Phase Two, the bug fixes, and Phase Three already changed. This session was verification and cleanup only.

### Database migrations

None. Migration 06 (run 2026-08-04) is unaffected. All test data created during verification was fully deleted; the schema and all pre-existing data are unchanged.

### Automated testing

`npm run build`, `npm run check`, and `npm test` all pass.

### Manual testing

All Phase Two and Phase Three write paths verified live, as described above. This closes out the manual testing checklist in `docs/NEXT_SESSION.md`.

### Remaining work

1. Confirm the live site after deployment (desktop and phone), matching the discipline used after Phase Zero's deployment.
2. Self-service claims and rank snapshot retention remain deferred per `docs/RECRUITING_PHASE_THREE_ARCHITECTURE.md`; revisit when their trigger conditions are met.

## 2026 08 05 Recruiting Phase Two verification (overnight)

### Date

2026 08 05

### Goal

Diagnose the athlete profile link error found during Phase Two manual testing, verify Phase Two end to end at the API level while the user was away, and fix whatever was found. No new database writes, commits to `main`, pushes, or deploys.

### Completed

1. Diagnosed the athlete profile link error by reproducing it directly against the local API instead of guessing: confirmed with curl that `vercel.json`'s `trailingSlash: true` makes Vercel 308-redirect any `/api/...` request missing its trailing slash, and that redirect's `Location` header drops the query string entirely.
2. Found this affected three client-side fetch calls, not just the one reported: `public/scripts/athlete-profile.js` (individual athlete profile, completely broken), `public/scripts/athlete-directory.js` (public athlete search filters, silently ignored), and `public/scripts/recruiting-directory.js` (public recruiting search filters, silently ignored). Fixed all three by adding the trailing slash, matching the convention already used correctly everywhere else in the codebase.
3. Added a general guard to `scripts/check.mjs` that scans every browser script for this exact pattern (an `/api/...` fetch target with a `?` not immediately preceded by `/`) so this class of bug cannot silently reappear. Verified the guard actually catches the bug by temporarily reintroducing it, then restored the fix.
4. While verifying the fix, found the public recruiting API (`api/recruiting/index.js`) hardcoded the retired `2026.1` methodology key and label in its response instead of reading whichever methodology is active. Fixed it to query the active methodology from the database.
5. While testing the admin status dashboard read-only, found a second, more serious instance of the same class of bug: `api/admin/recruiting.js`'s `requireInstalled()` gate looked up the methodology by the same hardcoded `2026.1` key. Because the migration retires old methodology rows instead of deleting them, this was not caught by any error — it silently kept resolving to the retired methodology, which meant every admin action (including creating a new rating) would have attached to the wrong, retired methodology version. Fixed it to look up `status = 'active'` instead, confirmed the fix live against the read-only status endpoint.
6. Added regression tests for all of the above to `scripts/test-recruiting-foundation.mjs` and `scripts/test-athlete-foundation.mjs`.
7. Made a deliberate decision not to create any new database rows overnight, even throwaway or self-cleaned-up test data, since the local dev server and production point to the same Supabase project and the user was not available to review a write before it happened. Verification of the actual write paths (media save, rating publish, rank movement) was limited to careful code review plus live testing of every read-only path (search, get, status, directory listing, profile detail). The write paths still need the user's own hands-on testing.

### Files changed

`api/admin/recruiting.js`, `api/recruiting/index.js`, `public/scripts/athlete-directory.js`, `public/scripts/athlete-profile.js`, `public/scripts/recruiting-directory.js`, `scripts/check.mjs`, `scripts/test-athlete-foundation.mjs`, `scripts/test-recruiting-foundation.mjs`.

### Database migrations

None run. Migration 06 (run successfully by the user on 2026-08-04) was not modified.

### Automated testing

`npm run build`, `npm run check`, and `npm test` all pass, including new regression tests for both bug classes found tonight.

### Manual testing

Read-only API paths were verified directly (admin search, admin get, admin status, public athlete directory with a real filter, public athlete detail, public recruiting listing). Write paths (media save/publish, rating draft/publish, rank movement on a second save) were reviewed in code but not executed, and still need the user's own click-through testing.

### Remaining work

1. User to manually test the write paths per the checklist in `docs/NEXT_SESSION.md`.
2. Commit this checkpoint (already committed locally to `recruiting-phase-two-taxonomy-media`) and merge/push/deploy only after explicit approval.
3. Review the Phase Three architecture report drafted the same night.

## 2026 08 04 Recruiting Phase Two implementation

### Date

2026 08 04

### Goal

Implement the recruiting architecture approved earlier the same session in `docs/RECRUITING_PHASE_ONE_ARCHITECTURE.md`: the nine group event taxonomy, athlete media, ranking movement, and an admin public profile preview, without running any database change or deploying anything yet.

### Completed

1. Wrote `install/06_RECRUITING_TAXONOMY_AND_MEDIA.sql`: widens then re-narrows the event group check constraints on three tables, backfills the event catalog and any existing performance or rating rows into the new taxonomy, retires methodology `2026.1` and adds active methodology `2026.2`, and creates `athlete_content_items` and `athlete_recruit_rating_rank_snapshots` with the same RLS and grant pattern as every other table in the project.
2. Updated `lib/recruiting_service.mjs`: the `EVENT_GROUPS` set and every event definition's group now match the approved taxonomy (800 meters to Middle Distance, 600 meters to Sprints, cross country events to Cross Country, decathlon and similar to Combined Events). Added `recordRecruitRatingRankSnapshots` and `loadLatestRankSnapshots` for ranking movement, and `CONTENT_ITEM_TYPES`/`CONTENT_ITEM_STATUSES` for media.
3. Extended `api/admin/recruiting.js` with `save_content_item`, `archive_content_item`, and `preview_public_profile` actions, and recorded a rank snapshot after every rating save.
4. Extended `api/recruiting/index.js` and `api/athletes/detail.js` to surface rank movement, and `api/athletes/detail.js` to surface published media.
5. Extended `src/pages/adminrecruiting.mjs` and `public/scripts/admin-recruiting.js` with a media form and a "preview public profile" panel, and updated the rating form's event group options.
6. Extended `src/pages/recruiting.mjs` with the new event group filters, and `src/pages/athletedetail.mjs` and `public/scripts/athlete-profile.js` with a media panel and rank movement indicator.
7. Extended `scripts/test-recruiting-foundation.mjs` with assertions for the new taxonomy, the new migration, and the new admin actions and markup.
8. Found and fixed one bug during self-review: `PERFORMANCE_SOURCE_TYPES` was used in the new media save action without being imported, which would have failed at runtime the first time an admin saved a media item. Added the import, added a test assertion that would catch a regression, and reused the already-imported `CONTENT_ITEM_STATUSES` set instead of a duplicate hardcoded list.
9. Updated `docs/RECRUIT_RATINGS_AND_PERFORMANCE_HISTORY.md` with the new taxonomy, media, ranking movement, and profile preview sections, and updated the main files and recommended first use lists.

### Files changed

`install/06_RECRUITING_TAXONOMY_AND_MEDIA.sql` (new), `lib/recruiting_service.mjs`, `api/admin/recruiting.js`, `api/recruiting/index.js`, `api/athletes/detail.js`, `src/pages/adminrecruiting.mjs`, `public/scripts/admin-recruiting.js`, `src/pages/recruiting.mjs`, `src/pages/athletedetail.mjs`, `public/scripts/athlete-profile.js`, `scripts/test-recruiting-foundation.mjs`, `docs/RECRUIT_RATINGS_AND_PERFORMANCE_HISTORY.md`, `docs/DECISIONS.md`, `docs/NEXT_SESSION.md`.

### Database migrations

`install/06_RECRUITING_TAXONOMY_AND_MEDIA.sql` was written and is additive only, but has not been run against Supabase yet.

### Automated testing

`npm run build`, `npm run check`, and `npm test` (check plus Athlete Foundation, Recruit Ratings, and 36 results ingestion tests) all pass locally.

### Manual testing

Not yet performed. See "Manual testing still required for Phase Two" in `docs/NEXT_SESSION.md`.

### Remaining work

1. Run migration 06 in Supabase.
2. Complete the manual testing checklist in `docs/NEXT_SESSION.md`.
3. Commit, push, and deploy only after explicit approval.

## 2026 08 04 Phase Zero cleanup verification

### Date

2026 08 04

### Goal

Apply and verify the Phase Zero import and release safety cleanup in the real repository before beginning recruiting architecture work.

### Completed

1. Ran the production build, complete quality checker, and full test command; all passed, including all 36 results ingestion tests, Athlete Foundation validation, and Recruit Ratings validation.
2. Started the site locally with Vercel dev and manually reviewed the homepage on desktop.
3. Reviewed the homepage at a real phone width, including the Explore row's horizontal scroll behavior and the absence of horizontal page overflow.
4. Opened and closed the mobile menu using the button, the overlay, and the Escape key.
5. Opened `/admin/recruiting/`, reviewed the new import safety explanation, previewed one deliberately incomplete row (missing place) and confirmed it was invalid, then previewed one complete exact athlete match and confirmed it was ready but hidden.
6. Removed three leftover one-time installer scripts (`install/INSTALL_RESULTS_INGESTION_V5.ps1`, `V6.ps1`, `V8.ps1`) that had already done their job of applying the cleanup package.
7. Updated `docs/NEXT_SESSION.md` and `docs/DECISIONS.md` to record that manual testing is complete.
8. Committed the reviewed changes to a local branch, confirmed production Supabase is the same project used locally (so migration 03 was already installed), merged to `main`, and pushed.
9. Vercel deployed the push automatically; the live site was confirmed working on desktop and phone.

### Files changed

Performance import safety (`lib/recruiting_service.mjs`, `api/admin/recruiting.js`, `src/pages/adminrecruiting.mjs`), responsive header and mobile menu (`public/scripts/site.js`, `src/styles/main.css`), test tooling (`package.json`, `scripts/test-recruiting-foundation.mjs`), `.gitignore`, and a new `docs/` and `install/` foundation (architecture, decisions, session log, data sources, SQL migrations, reference data).

### Database migrations

Migrations 01 and 02 should already be installed. Migration 03 (`install/03_RECRUIT_RATINGS_AND_PERFORMANCE_HISTORY.sql`) still needs to be confirmed as installed on the production Supabase project before deployment.

### Automated testing

`npm run build`, `npm run check`, and `npm test` (check + Athlete Foundation + Recruit Ratings + 36 results ingestion tests) all passed with no errors.

### Manual testing

Desktop homepage, phone-width homepage, Explore row, mobile menu (button, overlay, Escape), and `/admin/recruiting/` import preview (one incomplete row, one complete matching row) were all reviewed and confirmed working.

### Remaining work

1. Begin Phase One recruiting architecture work.

## Session template

### Date

YYYY MM DD

### Goal

Describe the session goal.

### Completed

Number the completed changes.

### Files changed

List the files.

### Database migrations

List migrations and whether they were run.

### Automated testing

Record build, check, and syntax results.

### Manual testing

Record the pages and actions reviewed.

### Remaining work

List the next tasks.

## 2026 08 03 Operations Center build

### Goal

Create a secure central dashboard for the daily operation of Podium Watch.

### Completed

1. Added a private Operations Center page.
2. Added a secure admin Operations Center API.
3. Added prioritized tasks.
4. Added upcoming meet and missing result reviews.
5. Added incomplete meet page reviews.
6. Added team claim, report, and schedule request reviews.
7. Added team profile completion totals.
8. Added team content draft reviews.
9. Added story and ranking freshness information.
10. Added Athlete of the Week and Team of the Week status.
11. Added notification, analytics, environment, and sponsor readiness.
12. Added graceful handling for optional database features.
13. Added direct Operations Center links to the main admin and Engagement Center.

### Files changed

1. `api/admin/operations.js`
2. `public/scripts/admin-operations.js`
3. `src/pages/adminoperations.mjs`
4. `src/pages/admin.mjs`
5. `src/pages/adminengagement.mjs`
6. `scripts/build.mjs`
7. `docs/OPERATIONS_CENTER.md`
8. `docs/OPERATIONS_CENTER_TEST_REPORT.md`
9. `docs/DECISIONS.md`
10. `docs/NEXT_SESSION.md`
11. `docs/SESSION_LOG.md`

### Database migrations

No database migration is required.

### Automated testing

1. All changed JavaScript and MJS files passed syntax checks.
2. The complete website build passed.
3. The complete quality checker passed.
4. A mocked Supabase integration test passed.

### Manual testing

Live local browser and Supabase testing is still required.

### Remaining work

1. Install the upgrade locally.
2. Review live values from every subsystem.
3. Review mobile layout.
4. Decide whether safe quick actions should be added after the read only dashboard has been used.


## 2026 08 03 Statewide school and division foundation

### Goal

Create a safe official Ohio school identity, division, tournament site, and team connection system.

### Completed

1. Added an additive Supabase migration for official school data.
2. Added 556 bundled official boys cross country school records.
3. Added a public Ohio School and Division Directory.
4. Added school, city, ID, division, district, and movement filters.
5. Added database fallback so the public directory works before migration.
6. Added a secure Statewide Data Center.
7. Added preview before import.
8. Added safe repeatable school, division, and tournament site imports.
9. Added team linking and optional missing team creation.
10. Added division conflict recording and resolution.
11. Added source history and last verified fields.
12. Added official school search entries to global search.
13. Added a boys cross country division filter to Team Directory.
14. Added a Claim Your Team campaign page.
15. Connected statewide readiness to the Operations Center.
16. Corrected track regional semifinal and final dates using the supplied official document.
17. Added original official PDFs to project reference storage.

### Files changed

See `docs/STATEWIDE_DATA_FOUNDATION.md` and the upgrade handoff for the complete file list.

### Database migrations

1. `install/01_STATEWIDE_FOUNDATION_DATABASE.sql`

The migration has not been run against the live Supabase project.

### Automated testing

1. All created and changed JavaScript files passed syntax checks.
2. All new and changed JSON files passed parsing.
3. The complete static build passed.
4. The complete quality checker passed.
5. Public directory fallback and filter tests passed.
6. Admin migration readiness passed.
7. Import preview and commit simulation passed.
8. Conflict protection and safe source matching passed.
9. Repeat import preview passed.
10. Operations Center optional subsystem handling passed.

### Manual testing

Live local browser and Supabase testing is still required.

### Remaining work

1. Run the migration.
2. Preview the real import.
3. Review conflicts and missing team counts.
4. Test public pages locally.
5. Deploy only after manual approval.

## 2026 08 03 Athlete profile and recruiting foundation

### Goal

Create permanent athlete identities that safely connect statewide schools, team rosters, rankings, stories, sourced performances, corrections, and future recruiting tools.

### Completed

1. Added an additive athlete database migration.
2. Added 200 athlete seed profiles from eight Podium Watch ranking files.
3. Safely linked 196 seed rows to official schools.
4. Added public athlete directory and filters.
5. Added 200 static athlete profile routes.
6. Added database fallback before migration.
7. Added secure Athlete Data admin tools.
8. Added import preview and safe commit.
9. Added duplicate detection and admin merge.
10. Added sourced performance management.
11. Added public correction workflow.
12. Added privacy safe recruiting controls.
13. Connected team roster athletes to permanent profiles.
14. Connected ranking names to athlete profiles.
15. Added athlete entries to global search.
16. Added athlete readiness to the Operations Center.
17. Added automated athlete foundation validation.

### Database migrations

Run after migration 01:

```text
install/02_ATHLETE_PROFILE_FOUNDATION_DATABASE.sql
```

The migration has not been run against the live Supabase project.

### Automated testing

1. JavaScript syntax checks passed.
2. Athlete seed validation passed.
3. Seed uniqueness checks passed.
4. Editorial and verified performance separation passed.
5. The complete static build passed.
6. The complete quality checker passed.
7. The public athlete API fallback test passed with bundled seed data.
8. The public profile privacy fallback behavior was reviewed.

### Manual testing

Live Supabase import preview and browser testing are still required.

### Remaining work

1. Run the migration.
2. Preview the seed import.
3. Review unmatched schools and duplicates.
4. Commit the import.
5. Add sourced official performances separately.
6. Review public profile layout on phones.
7. Begin the verified results import system after approval.

## 2026 08 03 Recruit Ratings and performance history

### Goal

Build an original source first Podium Watch recruiting database with performance history, numerical ratings, stars, recruiter search, and verified recruiting activity.

### Completed

1. Added an additive recruiting and performance migration.
2. Added a normalized event catalog and aliases.
3. Added source linked performance best calculations.
4. Added recruit rating methodology version 2026.1.
5. Added numerical score and one through five star bands.
6. Added class and event group rank calculations.
7. Added source evidence publication guards.
8. Added interest, offer, visit, commitment, and signing tracking.
9. Added preview first CSV performance imports.
10. Added import batch and row audit records.
11. Added public recruiter search and filters.
12. Added a public rating methodology page.
13. Added a private Recruiting Center.
14. Added athlete profile rating and recruiting timeline panels.
15. Added Recruiting to navigation, homepage discovery, admin navigation, and global search.
16. Added Operations Center recruiting totals and tasks.
17. Added a CSV template.
18. Added automated recruiting foundation validation.

### Database migration

Run after migrations 01 and 02:

```text
install/03_RECRUIT_RATINGS_AND_PERFORMANCE_HISTORY.sql
```

The migration has not been run against the live Supabase project.

### Automated testing

1. All changed JavaScript and MJS syntax checks passed.
2. Recruit Ratings and Performance History validation passed.
3. Event normalization and mark parsing tests passed.
4. Privacy and admin authentication source checks passed.
5. The complete static build passed with 264 pages.
6. The complete quality checker passed with no problems.

### Manual testing

Live Supabase, Vercel Preview, phone, and keyboard testing are still required.

### Remaining work

1. Run migration 03.
2. Import a small official performance set.
3. Publish one reviewed rating.
4. Review public recruiter filters.
5. Confirm recruiting activity verification behavior.
6. Refine scoring guidance only after real data review.
# 2026 08 03 Results Source Manager correction

Corrected the Baumspage reader so it rejects navigation links, requires the selected season date, opens each event page, follows the matching season results link, and confirms that the destination contains actual result links. A repeat discovery clears only unapproved records for the same provider, sport, and season before saving verified replacements.
# 2026 08 03 Baumspage discovery parser correction

1. Confirmed the live Baumspage page separates the meet heading, school or venue, and full date.
2. Corrected event identity extraction to read those separate page elements.
3. Reduced verification concurrency from eight requests to four for better local Windows stability.
4. Added grouped rejection reasons to discovery responses, run history, and the admin completion message.
5. Rebuilt the site and passed the full project checker.

## 2026 08 04 Phase Zero safety cleanup

### Goal

Resolve the confirmed recruiting import safety gaps, release tracking gaps, and responsive header conflict before Phase One recruiting architecture work.

### Completed in the diagnostic source package

1. Required meet name, meet date, and positive numeric place for every performance import.
2. Applied blank row defaults for meet, date, gender, event, sport, season, and source fields.
3. Forced every imported performance to remain hidden until separate administrator approval.
4. Removed the control that offered to create public athlete profiles from unmatched rows.
5. Changed duplicate identity to athlete, school, event, mark, meet, date, and place.
6. Added compatibility checks against existing performance fields instead of relying only on previously generated source keys.
7. Aligned the responsive navigation breakpoint with the browser menu logic.
8. Preserved the Explore row and removed the mobile menu spacing conflict.
9. Added Git ignore rules for generated output, backups, diagnostic packages, and the invalid performance file.
10. Expanded the main test command to include athlete, recruiting, and results validation.
11. Added regression checks for the approved import and responsive navigation behavior.

### Database changes

None. No migration was run and no production data changed.

### Automated testing

1. Production build passed with 264 pages, 9 published stories, and 8 ranking files.
2. The quality checker passed 149 JavaScript files, 8 JSON files, 284 HTML files, 13,932 internal links, and 626 images.
3. Athlete Foundation validation passed with 200 profiles and 196 safe official school links.
4. Recruiting validation passed with 35 event definitions and the new import safety checks.
5. All 36 results ingestion tests passed.

### Manual testing

The cloud browser could not open the private local preview address. Desktop and real phone interaction testing must be completed after the package is applied to the real repository.

### Remaining work

1. Apply the guarded cleanup package to the real project.
2. Review the exact Git status and staged file list.
3. Open the local homepage at desktop and phone widths.
4. Confirm the Explore row, menu panel, overlay, and mobile dock.
5. Commit and push only after explicit approval.
6. Confirm Vercel and the live website after deployment.

## 2026 08 11 Race Command Center Phase One build

### Goal

Build the first complete, production-quality version of Race Command Center: a coach-facing race Plan -> Race -> Review tool (full-team goal planning, mobile-first live split timing, individual/team review), following a very long, prescriptive user specification. Plan-mode was used given the scope (new migration, new pages, new API surface, real architectural decisions); a repository audit and a written plan were completed and approved before any implementation began.

### Repository audit (before writing any code)

Confirmed real, current facts rather than trusting older docs (`docs/AUTO_PROJECT_INDEX.md` was found stale and explicitly not relied on): the team auth/authorization pattern (`lib/team_auth.mjs` + a per-request `team_members` active-membership check, no server-side "current team" concept anywhere), the real team roster schema (`lib/team_roster_service.mjs`: `team_seasons` -> `team_roster_entries` -> `team_athletes`), the real `meets` table, the coach-tool routing convention (flat routes reached only from dashboard cards, never site nav), the `install/` migration convention, the test convention (`scripts/test-*.mjs`, zero external test libraries), and confirmed zero existing precedent anywhere in this codebase for IndexedDB, Wake Lock, or `performance.now()` -- this piece was genuinely greenfield.

### Database changes

`install/11_RACE_COMMAND_CENTER.sql` -- 9 new, additive tables (`race_sessions`, `race_checkpoints`, `race_participants`, `race_goals`, `race_targets`, `race_pack_captures`, `race_splits`, `race_split_revisions`, `race_coach_notes`). Never touches `team_pages`, `team_athletes`, `meets`, or any results/rankings table. Run by the user in Supabase, then verified live: all 9 tables reachable, the `updated_at` trigger fires, the participant exclusive-or constraint (rostered athlete XOR manual name) rejects invalid rows, and the `client_split_id` format + uniqueness constraints work exactly as designed -- this uniqueness constraint is the real idempotency guarantee behind local-first sync.

### What was built

1. **Calculation engine** -- `public/scripts/race-math.js` (browser) and `lib/race_math.mjs` (server port of the two functions the API needs to re-validate), proven byte-identical for the same input. Even Pace and Custom Pace target generation, goal status (ahead/on_pace/at_risk/missed), and a deliberate structural split between "current pace projects X" and "required pace to hit goal is Y" so the UI can never merge them into one misleading number. No team-score function exists anywhere in it, by design (one team's own times can't determine a real cross country team score without field-position data this project doesn't capture).
2. **Timer engine** -- `public/scripts/race-timer.js`: `performance.now()` (monotonic) is the source of truth during a live session; `Date.now()` is recorded once, at the deliberate race-start press, purely as a post-refresh recovery anchor. Recovered elapsed time is explicitly tagged lower-precision, never presented as identical to live-session precision.
3. **Local-first persistence** -- `public/scripts/race-local-store.js`, a hand-rolled IndexedDB wrapper (no new dependency). Verified with a standalone Playwright harness against real Chromium IndexedDB (round trips, idempotent upsert on a duplicate `client_split_id`, append-only revision history, cross-session isolation).
4. **Service layer** -- `lib/race_command_center_service.mjs`: sessions, roster/participant management (a pure diff function so a bulk roster save always reflects the complete resubmitted list, never a confusing hidden change), goals/strategy/targets, Pack Capture, split sync, review (computed on demand, never stored).
5. **API** -- `api/race-command-center/{sessions,plan,sync,review}.js`, copying `api/team/roster.js`'s exact auth pattern.
6. **Pages** -- `/race-command-center/` (hub), `/plan/`, `/live/` (minimal-chrome Live Race Mode), `/review/`. Registered in `scripts/build.mjs`; the new route prefix added to **all three** places that needed it (`src/lib/html.mjs` and `scripts/check.mjs`'s `privatePrefixes`, and `scripts/build.mjs`'s separate `privateSitemapPrefixes` -- a third list not previously documented as needing the same update). A new "Race Command Center" button added to the team dashboard's per-team card row.

### Real bugs found and fixed via live/E2E verification (not caught by unit tests alone)

1. Participant re-save validation rejected a legitimate update-by-id because it demanded identity info on every submitted row, including ones that already existed.
2. Sync idempotency was broken: Postgres `numeric` columns come back from Supabase as strings, not JS numbers, so the naive changed-value check saw every identical retry as "changed" and would have written a spurious duplicate revision on every retry.
3. A cross-session/ownership gap in `pushSplits`: a participant or checkpoint id was only checked for existing somewhere, not for belonging to the session being pushed to.
4. A real race condition in the participant-status side-effect chain: it read `participant.status` once from an in-memory snapshot and used that stale read to decide whether to write "started"/"finished," which let a delayed or retried split push silently revert an explicit DNS/DNF back to "started." Fixed by making both status writes atomic, guarded conditional updates (`... WHERE status = 'scheduled'` / `... WHERE status NOT IN ('dns','dnf')`) instead of read-then-write application logic -- found by the required manual simulation, not by an earlier, narrower live-verification pass that happened not to exercise the exact interleaving.
5. Re-tapping a runner after Undo minted a fresh `client_split_id` for the same (participant, checkpoint) pair, colliding with the schema's one-row-per-pair uniqueness constraint. Fixed by looking up and reusing any existing (possibly undone) row's id before minting a new one.
6. A genuine sync-integrity bug: if a correction (Undo, a manual re-entry) landed locally while an earlier push for the *same* split was still in flight, the completion handler blindly marked "whatever is currently in IndexedDB" as synced -- silently swallowing the correction forever, even though the server still held the stale pre-correction value. Fixed by re-checking, after each push resolves, that the local record still matches exactly what was sent before marking it synced; if not, it's left unsynced so the next sync cycle pushes the real value. Also hardened `triggerSync()` itself so a capture arriving while a sync is already in flight is drained immediately when that sync finishes, rather than waiting up to 8 seconds for the next interval tick.
7. A sign-inversion bug in the review page: `formatDiff()` inverted `computeDiffFromTarget()`'s own documented sign convention (positive = ahead of target), so "ahead of target" runners displayed a `-` sign and vice versa.

### Automated testing

`scripts/test-race-command-center.mjs` (new, registered as `npm run test:race-command-center` in the main `test` chain): calculation engine, timer engine (fake injected time sources), local-store record shapes, the server/client calculation-engine parity check, and the service layer's pure helpers (`buildCheckpointsWithFinish`, `diffParticipants`, `splitPayloadChanged` -- including the exact Postgres-numeric-as-string shape that caused bug 2 above, as a permanent regression guard). Full `npm run build && npm run check && npm test` (13 suites) passes clean throughout.

### Manual/live testing completed

1. A full live-service-layer round trip (create session, auto-finish-checkpoint generation, participant diff, Even/Custom Pace targets with a real server-side rejection of a non-increasing custom target, bulk goal apply, start/finish, Pack Capture, idempotent sync retry, a genuine correction bumping the revision, recovery pull, review, duplicate, delete) against real production Supabase, all test data cleaned up after.
2. Real end-to-end Playwright verification of every page, using a real dedicated test coach account (created and deleted via `supabaseAdmin.auth.admin`, never a real user's account) signed in through the actual `/team-login/` flow, driving the actual built pages against the actual API handlers (via a small local harness that serves `dist/` and routes the real Vercel-style handler modules, since the static preview server can't route `/api/*` and no local Vercel dev environment is available here) -- at both desktop and real phone (390x844) viewports, checking for zero horizontal overflow and zero console/page errors throughout.
3. The required manual race simulation (spec section 46): 7 clearly-marked `TEST ... (DELETE ME)` participants run through all required scenario steps -- start, spread-out arrivals, two runners tapped back-to-back, a real 3-runner Pack Capture (one shared frozen timestamp), a wrong-tap-then-Undo (with the correction genuinely reaching the server before being undone, to prove the revision-history guarantee end to end), a missed-runner-then-manual-split, an explicit DNF, deliberate checkpoint advancement, second-checkpoint captures, finish captures, review, a mid-race refresh/recovery test, and a temporary-offline test (`context.setOffline(true)`, a capture recorded with no network dependency, then reconnect and confirm the sync status genuinely returns to Synced). All against real production Supabase; all test data deleted afterward, confirmed by re-querying.

### Known, deliberate Phase One scope limits (not gaps found late -- decided and documented as the work happened)

1. Checkpoints are locked once a race is created; there is no in-place checkpoint editor. A coach who made a mistake deletes the still-draft race and recreates it (`deleteSession` already only allows deleting a draft).
2. DNS/DNF status changes are a direct, immediate network call (`set_participant_status`), not part of the local-first offline queue that splits use -- marking a runner DNS/DNF currently requires connectivity at that moment. Splits themselves are fully local-first regardless of connectivity.
3. Undo clears a split back to "not recorded" (an auditable, traceable clear -- never a silent delete); it does not restore whatever value existed before the tap that's being undone. A coach undoing a genuine mistake re-taps for a fresh, correct value rather than reaching for a specific prior revision.
4. Goals B and C are recorded as reference ambition markers (a time, shown in review) but do not get their own full per-checkpoint pace targets in this pass -- only Goal A drives Live Race Mode's target/diff/coaching-cue math. The schema does not preclude adding B/C targets later.

### Not yet done

~~Docs update in progress (this entry); `git commit` not yet made -- diff review and explicit approval still needed before committing, and separately before any push or production deploy, per this project's standing practice.~~ **Update:** committed (`acf04ff`), pushed, and deployed with the user's explicit approval; confirmed live at `https://podiumwatch.vercel.app/race-command-center/` and its `/plan/`, `/live/`, `/review/` sub-pages. This line was left stale in the original entry and corrected while writing the 2026-08-13 Athlete Access entry below.

## 2026 08 11 Team Workspace Phase One build

### Goal

Begin the next major direction: Race Command Center becomes the race-day engine inside a larger, season-long Team Workspace a coach uses throughout the week -- not a separate tool. Given the scope (new architecture, database decisions, integration with several existing systems), used plan mode: a repository audit (3 parallel Explore passes covering meets/schedule, athlete identity/performance, and navigation/design/permissions) ran before any plan was written or code touched.

### Repository audit -- the key finding

The two things this phase most needed already exist, fully built: **the team-to-meet linking system** (`team_meet_connections`/`team_meet_requests`, `api/team/schedule.js` -- this already is the real team schedule and most of "Meet Center") and **multi-coach permissions** (`team_members.role` supports `owner`/`editor` today, with a full claim/approval/role-change flow in `api/team/access.js`, including a last-owner-removal safeguard). `race_sessions.meet_id` already references `meets(id)` (added with Race Command Center) but was never used at the application layer -- exactly the gap this phase closes. This meant **Phase One needed no new database migration** -- confirmed as the single biggest architectural finding of the audit and the main thing that shaped the plan.

Also confirmed and deliberately left alone: `athlete_profiles`/`athlete_performances` have their own rich, already-established trust-level vocabulary (`source_type`, `verification_status`, `result_status`) and no `meet_id` FK at all (`meet_name`/`meet_date` are free text) -- this phase does not bridge Race Command Center data into that system, matching the boundary Race Command Center's own migration already stated. Also found, noted, and left alone as unrelated: `athlete_best_performances` (a real SQL view computing all-time bests) is fetched by `api/athletes/detail.js` but never rendered by `public/scripts/athlete-profile.js` -- dead data on a live page.

### What was built

1. **`lib/team_workspace_service.mjs`** (new) -- `buildTeamHomeSummary()` (roster count from current-season `team_seasons`/`team_roster_entries`, upcoming meets from `team_meet_connections` joined to `meets`, upcoming/recent `race_sessions` with computed readiness) and `getMeetCenterContext()` (one meet's info, this team's schedule connection if any, every race session tied to it). `requireTeamMembership()` copies `api/team/schedule.js`'s exact authorization shape (suspended/archived/merged/editing-locked checks), not a lighter version.
2. **`api/team/home.js`, `api/team/meet-center.js`** (new) -- thin handlers over the service above.
3. **`/team-home/`** -- a new, authenticated, single-team season landing page (distinct from `/team-dashboard/`, which is a multi-team management list). Sections: next meet/race, roster/schedule/results stats, upcoming schedule, recent results.
4. **`/team-meet-center/`** -- the operational page for one meet: meet info, every linked race session with a real readiness count ("N of M race plans ready," computed from `race_participants` + `race_goals`, no new column), and a "create a race for this meet" action that calls Race Command Center's **existing, unmodified** `api/race-command-center/sessions.js` "create" action with `meet_id` pre-filled -- there is exactly one code path that creates a `race_sessions` row.
5. Dashboard integration: a new "Team home" button on `renderOwnedTeams()` (`public/scripts/team-dashboard.js`). Both new routes registered in `scripts/build.mjs` and added to all three private-route lists (`src/lib/html.mjs`, `scripts/check.mjs`, `scripts/build.mjs`'s separate sitemap-exclusion list).

### Database changes

None. Zero new tables, zero migration. Everything reads/writes only tables that already exist.

### Automated testing

`npm run build && npm run check && npm test` (the existing 13-suite chain, unchanged) passes clean -- 306 HTML files checked, no problems found.

### Manual/live testing completed

1. A live service-layer round trip against real production Supabase: `buildTeamHomeSummary()` baseline (empty state, never a fabricated "next up"), a real `team_meet_connections` row connected to a real existing meet, a real race session created via Race Command Center's own `createSession()` with `meet_id` set and confirmed, a real participant with a real goal producing correct readiness math (1 of 1 ready), `getMeetCenterContext()` returning the real meet/connection/session together, and an authorization check confirming a real but unrelated user is rejected with 403. All checks passed on the first run.
2. Real end-to-end Playwright verification using a dedicated test coach account (created and deleted via `supabaseAdmin.auth.admin`) signed in through the real `/team-login/` flow, driving the real built pages against the real API handlers (the same local-harness-server technique proven for Race Command Center) -- at desktop and real phone (390x844) widths: Team Home's honest empty state before anything is scheduled, Team Meet Center correctly showing "not connected to your schedule" before a connection exists, the real "create a race for this meet" round-tripping into a real `race_sessions` row with `meet_id` verified directly in Supabase, then (after connecting the meet) Team Meet Center's notice correctly disappearing and Team Home's stats/next-up/upcoming-list all reflecting the real data -- zero console/page errors, zero horizontal overflow at either width. One real-data limitation surfaced during this pass: **no meet in the live database is currently `published: true`**, so `api/team/schedule.js`'s own "connect" action (pre-existing, unmodified by this feature) correctly refused to connect one via its own publish gate; the "connected" rendering path was instead verified by inserting the connection row directly (matching the earlier service-layer test), since that pre-existing action's gate isn't part of what this phase built and didn't need re-proving end-to-end through a browser click. All test data (test race sessions, test schedule connections, the test coach account) deleted afterward, confirmed by re-querying.

### Known, deliberate Phase One scope limits

1. No persistent, reusable "race group" entity across races -- `race_participants.race_group` (free text, per race) is enough for Phase One.
2. Team Meet Center does not gate on the meet being published -- a coach can open it for any real meet id, including an unpublished one, since restricting that wasn't found to protect anything not already protected by team membership.
3. Athlete/parent/fan-facing views, live team following, and any public/private split for splits are not built -- explicitly Phase Two/Three per the spec's own boundaries.

### Not yet done

~~Docs update in progress (this entry); `git commit` not yet made -- diff review and explicit approval still needed before committing, and separately before any push or production deploy.~~ **Update:** committed (`3f90154`), pushed, and deployed with the user's explicit approval; confirmed live at `/team-home/` and `/team-meet-center/`. This line was left stale in the original entry and corrected while writing the 2026-08-13 Athlete Access entry below.

## 2026 08 13 Athlete Access (Team Workspace Phase Two) build

### Goal

Continue the Team Workspace direction into its next stage, per the user's own choices via `AskUserQuestion`: give athletes a signed-in view of their own race plan and review. Access method: **coach-issued invite** (a coach generates a one-time invite from the roster for a specific athlete; no open self-serve signup). Initial scope: **race plan + review only** (goals, checkpoint targets, and finished-race review) -- no PR/season-best history in this pass.

### Repository audit -- key findings

1. **No invite-before-account pattern exists anywhere in this codebase.** `team_claim_requests` is the opposite shape (identity already exists, a user requests to attach). The closest rigor precedent found was AOTW/TOTW's voter-token design (HMAC-hashed token, never stored raw) -- ultimately not reused as-is; see the token design decision below.
2. **`team_athletes.athlete_profile_id` is not safely 1:1.** A cross-team transfer usually creates a second, duplicate `athlete_profiles` row (pre-existing, known behavior, not fixed by this phase). Invites and account links therefore key off a specific **`team_athletes.id`**, never `athlete_profiles.id` -- an athlete who redeems invites from two different teams over their career simply gets two independent links.
3. **`race_coach_notes` has no visibility/approval mechanism at all** (0 rows, 6 plain columns, no status/approved column of any kind) -- the athlete view must never surface it in this phase, and does not.
4. Confirmed live: every real `race_participants` row in production used `manual_name`, not `team_athlete_id` (zero `team_athletes` rows existed anywhere yet) -- this feature had nothing real to test against without first creating real roster data, which is what surfaced the two pre-existing bugs below.

### What was built

1. **`install/12_ATHLETE_ACCESS.sql`** (new, run in production Supabase) -- two tables: `athlete_invites` (token_hash unique, status pending/redeemed/revoked/expired, single-flag consent) and `athlete_accounts` (one row per (user_id, team_athlete_id) pair, status active/revoked -- revocation is a status flip, never a delete, matching Race Command Center's existing "traceable, not destructive" pattern).
2. **`lib/athlete_auth.mjs`** (new) -- `requireAthleteUser()`/`athleteApiError()`, structurally identical to `lib/team_auth.mjs` (same underlying Supabase Auth mechanism, athlete-appropriate error copy). `requireAthleteAccess(userId, teamAthleteId)` mirrors `requireTeamMembership`, checking `athlete_accounts` for an active row.
3. **`lib/athlete_access_service.mjs`** (new) -- `generateInvite()`, `validateInviteToken()`, `redeemInvite()`, `listInvitesForAthlete()`, `revokeInvite()`, `revokeAthleteAccess()`, `getAthleteMe()`, `getAthleteRaces()`. The races join (`athlete_accounts` -> `team_athletes.id` -> `race_participants.team_athlete_id` -> `race_sessions`/`race_goals`/`race_targets`/`race_splits`/`race_checkpoints`) deliberately never queries `race_coach_notes`.
4. **`api/team/roster.js`** -- one new dispatch branch (`invite_athlete`/`list_athlete_invites`/`revoke_athlete_invite`/`revoke_athlete_access`), kept in its own service file rather than added to the already-1700+-line `lib/team_roster_service.mjs`. **`api/athlete/invite.js`, `api/athlete/me.js`, `api/athlete/races.js`** (new).
5. **`/athlete-login/`, `/athlete-home/`** (new pages + client scripts) -- login mirrors `teamlogin.mjs`/`team-auth.js` exactly (real client-side `signUp()`/`signInWithPassword()`, matching the confirmed existing convention -- this codebase has never used `supabaseAdmin.auth.admin.createUser()`/`generateLink()` for real account creation). Signup is offered only with a valid `?invite=` token present; otherwise sign-in only. Athlete Home deliberately has **no required `?id=` query param** (unlike every coach tool) -- it shows every race across every `team_athletes` row the signed-in account has an active link to, driven by identity, not a team selection.
6. Roster integration: a new "Invite to Podium Watch" section in the existing per-athlete edit dialog (`src/pages/teamroster.mjs`), fetched on demand when the dialog opens, matching how `athlete_social_links` already works within that same dialog.
7. Both new routes registered in `scripts/build.mjs` and added to all three private-route lists (`src/lib/html.mjs`, `scripts/check.mjs`, `scripts/build.mjs`'s sitemap-exclusion list).

### Token and consent design decisions

1. **Token: reused `lib/engagement_service.mjs`'s existing `createToken()`/`hashToken()` pair** (`crypto.randomBytes(32).toString("base64url")`, plain SHA-256, no secret) -- already used in production for follower-unsubscribe tokens -- rather than the AOTW/TOTW HMAC-with-secret pattern. AOTW's HMAC exists specifically because AOTW tokens are client-influenced and weaker; a server-generated 256-bit random token needs no additional keyed HMAC, and reusing an established helper avoided introducing a new secret (`ATHLETE_INVITE_HASH_SECRET` was briefly added to `.env.local`, then removed once this simplification was made).
2. **Consent: one flag, not `athlete_social_links`'s existing three-flag pattern.** That pattern (`athlete_consent_confirmed`/`guardian_consent_confirmed`/`approved_by_team`) gates *publishing to the public internet*. This feature gates *viewing already coach-controlled, non-public data the coach explicitly invited the athlete to see* -- meaningfully lower stakes, and the coach already vouched for the athlete's identity by generating the invite. Recorded as a single `consent_confirmed_at`/`consent_confirmed_by` pair on the invite row.

### Two real, pre-existing, previously-undiscovered bugs found and fixed

Found only because this feature needed real roster data to test against, and production had none:

1. **`team_seasons.year`** is a separate, real, `NOT NULL` column distinct from `season_year`, never populated by `createSeason()`/`saveSeason()` (`lib/team_roster_service.mjs`) -- confirmed live that `team_seasons` had zero rows in production, meaning no real coach had ever successfully created a season through this code path. Fixed by adding `year: seasonYear` to both insert/update payloads.
2. **`team_roster_entries.athlete_name`** is a separate, real, `NOT NULL` denormalized column (the table has no `first_name`/`last_name` of its own), never populated by the `save_athlete` action's `entryPayload` -- confirmed live that `team_roster_entries` also had zero rows ever. Fixed by adding `athlete_name: athlete.display_name`.

See `docs/DECISIONS.md`, 2026-08-13, for the fuller reasoning on both.

### Database changes

`install/12_ATHLETE_ACCESS.sql` -- two new tables (`athlete_invites`, `athlete_accounts`), standard RLS (enabled, revoked from `anon`/`authenticated`, granted to `service_role` only). Run successfully in production Supabase after resolving a wrong-Supabase-project mixup (the user had initially run it against a different project than `.env.local` points to -- diagnosed by asking the user to check the Table Editor directly, then re-run in the correct project) and a PostgREST schema-cache staleness delay (`NOTIFY pgrst, 'reload schema';` plus additional wait, the same class of issue seen during Path to State).

### Automated testing

`npm run build && npm run check && npm test` (the existing chain, unchanged) passes clean -- 277 pages built, 223 JS/10 JSON/308 HTML files checked, 17,221 internal links and 674 local images checked, no problems found; all 12 test suites pass.

### Manual/live testing completed

1. A live service-layer round trip against real production Supabase (17 checks): real `team_athletes` row creation, `generateInvite` -> `validateInviteToken` (including a garbage-token 404 rejection), `redeemInvite` (including a same-token-twice 409 rejection), `requireAthleteAccess` (including an unrelated-athlete 403 rejection), `getAthleteMe`, a real roster-linked race with goals/targets/splits **and a private coach note**, `getAthleteRaces` returning the correct race with the coach note confirmed absent from the serialized response, `revokeAthleteAccess` (immediate 403 afterward, `getAthleteMe` showing zero linked athletes), and invite revocation (a pending invite revokes cleanly, an already-redeemed one is rejected). All 17 passed; all test data deleted afterward.
2. Full real end-to-end Playwright verification, using a dedicated test coach account and a real roster season/athlete created server-side, driving the real built pages against the real API handlers (the same local-harness technique proven for Race Command Center and Team Workspace Phase One): coach opens the real roster dialog, sees the honest "no invites yet" empty state, sends a real invite through the UI (status updates to "Invite sent" live); athlete opens the real invite link at mobile width (390x844), sees the real team/athlete name in the invite banner, confirms the Create Account tab is only shown with a valid token; submitting signup without checking consent is confirmed blocked (the checkbox's native `required` attribute stops the browser's own form submission before the JS handler runs, so the real observable protection verified is that the page never navigates away); a real account is signed in with the invite token present, auto-redeeming the invite via the exact same `redeemInviteIfPresent()` code path signup uses, redirecting to Athlete Home, which shows the real linked athlete name and an honest "no upcoming races" empty state with zero horizontal overflow at 390px; the real `athlete_accounts` link is confirmed directly in Supabase; a real finished race is built (goal, target, splits) with a private coach note attached, and Athlete Home (desktop width) is confirmed to show the real race and real finish time while the coach note is confirmed absent from both the specific results section and the entire rendered page body. All test data (season, roster entry, team_athletes row, invites, athlete_accounts link, race session, coach note, the athlete auth user) deleted afterward, confirmed by re-querying; the test coach account and its team remain intentionally active for any follow-up testing.
3. One real external constraint hit and worked around, not a bug: Supabase Auth's own email-sending rate limit ("email rate limit exceeded") was triggered by this session's repeated real `client.auth.signUp()` attempts while iterating on the test script. The signup form's client-side behavior (invite banner, email-format validation, consent gating) was already proven via a real submission that reached Supabase's server before being rejected by the rate limit, not by the app. To finish verifying the rest of the flow, the athlete's account was created via the admin API instead (no email sent) and redemption was exercised through the sign-in panel instead of signup -- `athlete-login.js` runs the identical `redeemInviteIfPresent()` call after either a successful sign-up or sign-in, so this still exercises the real redemption code path end to end. Also found along the way: Supabase Auth's client-side `signUp()` (unlike the admin API used for every other test account this session) rejects the RFC 2606 `.invalid` TLD; switched the real-signup test email to `.example.com`, which is also RFC 2606-reserved and passes.

### Known, deliberate Phase Two scope limits

1. No PR/season-best history -- only the athlete's own upcoming plan and finished-race review, per the user's explicit scope choice.
2. No parent/follower access, no public/private split for splits -- explicitly Phase Three per the original Team Workspace spec's own boundaries, not built here.
3. `race_coach_notes` remains entirely invisible to athletes -- there is no visibility/approval mechanism for it yet; building one is a future decision, not assumed by this phase's schema.
4. An athlete transferring teams gets a second, independent `athlete_accounts` link rather than any merge -- matches the pre-existing `team_athletes`/`athlete_profiles` non-1:1 limitation, not something this phase changes.

### Not yet done

~~`git commit` not yet made -- diff review and explicit approval still needed before committing, and separately before any push or production deploy, per this project's standing practice.~~ **Update:** committed, pushed, and deployed with the user's explicit approval; confirmed live at `/athlete-login/` and `/athlete-home/`. This line was left stale in the original entry and corrected while writing the 2026-08-16 admin redesign entry below.

## 2026 08 16 Admin dashboard redesign

### Goal

The user shared a screenshot of the current `/admin/` page (a flat wall of 15 black-bordered buttons under a "Meet Manager" heading) and asked for three things: make it easier to navigate between tools, make it look professional, and suggest new features not yet considered. Given the scope (visual redesign + information architecture + new features across all 15 admin routes), used plan mode: two parallel Explore passes (admin page structure/build registration, and design system/Operations Center task data) ran before any direction question was asked, followed by four `AskUserQuestion` rounds (visual style, navigation pattern, whether to split Meet Manager out, which new features to build), then one Opus Plan pass to design the concrete file-by-file implementation with its own independent verification of several load-bearing claims (a test dependency on soon-to-move literal strings, `layout()`'s exact structure, the real reason `admin.js` could not simply be split in place).

### Audit finding that reshaped the plan

`/admin/` was not a dashboard -- it was the Meet Manager tool (1184 lines: create/edit form, CSV bulk import, delete dialog, meet list) with the 15-button nav grid stapled to the top of it. Every other admin page hand-picked 2-3 "related tool" links back, different and copy-pasted per file (confirmed via direct reads of several pages) -- from most tools, reaching most other tools took two navigations (back to `/admin/`, then to the target), not one. This, not the visual style, was the actual "hard to navigate" problem, and it's what the plan was built around fixing first.

### What was built

1. **`src/lib/adminnav.mjs`** (new) -- the single shared list of all 16 admin tools (id, label, href, mark, description, keywords), grouped into 6 categories (Overview, Meets & Tournament, Teams, Athletes, Statewide Data, Audience). Mirrors the existing `src/lib/tools.mjs` "one shared list rendered in several places" pattern. Exposed to the browser as a server-rendered `window.PODIUM_ADMIN_NAV` inline script for client-side badge/search rendering.
2. **`src/lib/adminshell.mjs`** (new) -- `adminShell({...})`, the function every admin page now calls instead of `layout()` directly. Renders the persistent sidebar (grouped nav links with badge slots and pin buttons, a pinned section, a recent section, a quick-jump trigger), the page's own content, and the quick-jump `<dialog>`. Entirely static server-rendered HTML -- works with JS disabled, since this is a build-time static site with no per-request server rendering to lean on.
3. **`src/lib/html.mjs`** -- exactly one new branch in `layout()` (the only edit to this file shared by ~50 pages): when `pathname.startsWith("/admin/")`, inject `<link rel="stylesheet" href="/styles/admin.css">` and `<script src="/scripts/admin-shell.js" defer>` into `<head>`. Render-blocking placement means the sidebar is fully styled on first paint, and having it live in `layout()` rather than per-page meant migrating the 14 tool pages one at a time was safe throughout.
4. **`src/styles/admin.css`** (new) -- the "hybrid" visual language: brand tokens (`--black/--ink/--green/--paper/--radius:0`, Impact font) for sidebar chrome and nav items, denser hairline-bordered cards (no shadows, no rounded corners) for the needs-attention panel and stat tiles. Everything scoped under `body.admin-shell` so it can never leak onto a public page and `src/styles/main.css` is never touched (two test suites assert literal text against its exact contents).
5. **`public/scripts/admin-shell.js`** (new) -- badge counts (one `dashboard-summary` fetch per page load, `sessionStorage`-cached 5 minutes), the quick-jump search (pure client-side filter over `window.PODIUM_ADMIN_NAV`, no new API), pinned/recent tools (`localStorage`, since there is no per-admin identity to store them server-side), and the Ctrl/Cmd+K keyboard shortcut. Exposes `window.PodiumAdminShell` as opt-in helpers -- nothing about the 14 existing tool-page scripts was required to change this pass.
6. **The Meet Manager split**: `src/pages/adminmeets.mjs` (new) carries the create/edit form, CSV bulk import, delete dialog, and meet list verbatim from the old `admin.mjs`; `public/scripts/admin.js` renamed to `admin-meets.js` with zero content changes (confirmed it's loaded by exactly one page and throws on any page missing `[data-meet-form]`, so a verbatim rename was the safe move, not a retype). `src/pages/admin.mjs` shrank from 1184 lines to ~150 and is now the real dashboard: sign-in gate, a stat strip, and a needs-attention panel (top 8 urgent/important tasks), driven by new `public/scripts/admin-dashboard.js`.
7. **Badge/needs-attention data**: `lib/operations_service.mjs` (new) -- `getDashboard()` extracted verbatim out of `api/admin/operations.js` (zero behavior change, Operations Center's own page unaffected) plus a new `summarizeDashboard()` projection. `api/admin/dashboard-summary.js` (new) serves that lightweight `{tasks, summary}` slice (~8KB) to every admin page's sidebar, versus the full response's hundreds of KB. Six task hrefs fixed in the same pass: two Meet Manager tasks retargeted from `/admin/` to `/admin/meets/`, and four AOTW/TOTW award tasks -- found pointing at `/admin/` under "Open award management," a tool that has never existed anywhere in this codebase -- honestly retargeted to `/admin/operations/` ("Review award status") instead of left broken or guessed at.
8. **All 14 remaining tool pages migrated** to `adminShell()`: each page's own inline `<style>` block passed through verbatim as a `styles` param, the outer `<section class="section section-paper"><div class="container">` wrapper removed (the shell now owns that), and each page's hand-picked "back to admin" links removed (the sidebar replaces them) while genuinely distinct controls in the same row (a day-range `<select>`, a template-download button, external public-site links) were preserved. Six pages had a load-bearing class + data-attribute combo on their `.container` div that had to be carried onto the shell's content wrapper rather than dropped.

### Database changes

None. Zero new tables, zero migration -- this entire feature is presentation/aggregation over the existing admin auth and Operations Center task-building logic.

### Automated testing

`npm run build && npm run check && npm test` (the existing chain, unchanged) passes clean throughout every step of the build -- 277 pages, 309 HTML files, 230 JS/`.mjs` files, 17,504 internal links checked, all 12 test suites pass. One required fix landed in the same commit as the service extraction: `scripts/test-recruiting-foundation.mjs` asserted 5 literal strings against `api/admin/operations.js`'s exact text, which moved to `lib/operations_service.mjs` -- the test's `read()` target was updated to match; nothing about what it asserts changed.

### Manual/live testing completed

A full Playwright pass against real production Supabase, using the same local-harness technique proven all session (serves real `dist/`, routes real `api/admin/*.js` handlers, extended this time to cover all 17 admin API files so the sidebar could be exercised across many tool pages without false errors from unregistered routes), signed in with the real shared admin password:

1. Sidebar renders correctly with the right `aria-current="page"` item across `/admin/`, `/admin/meets/`, `/admin/operations/`, `/admin/team-rosters/`, `/admin/recruiting/`, and `/admin/fan-poll/`.
2. **Badge truth test**: fetched `/api/admin/dashboard-summary/` directly, computed expected per-href badge counts/tones from the real task data, and confirmed every rendered badge matched exactly -- the check that proves badges are real, not decorative.
3. Needs-attention panel confirmed showing real task cards with real action links.
4. Quick-jump confirmed to open only the admin dialog on Ctrl+K (never the public site-search dialog, a real collision found and fixed during planning, re-confirmed live), correct search ranking, and Enter-to-navigate.
5. Pinned and recent tools confirmed to survive a full page reload, with the real `localStorage` shape checked directly.
6. Mobile (390x844): zero horizontal overflow, the full tool list collapsed by default (fixed live -- see bugs below).
7. **The real risk of the Meet Manager split**: a full regression through the actual UI -- create a real test meet via the migrated form, confirm it appears in the real meet list, delete it via the real delete-confirmation dialog (scoped precisely to the test meet's own card, not a blind first-match against the real production meet list). All test data cleaned up after, confirmed by re-querying.
8. Confirmed `/admin/` and `/admin/meets/` stay `noindex, nofollow` and are excluded from both `sitemap.xml` and `search-index.json`.

Two real app bugs were found and fixed live, not worked around in the test:

1. **Pin buttons landing on the wrong tool.** `.admin-pin` was `position: absolute` relative to the whole group container instead of its own row, so every pin button in a multi-item group rendered at the same point -- clicking "Team Manager"'s pin button actually activated "Bulk Team Import"'s. Fixed by wrapping each nav item + pin button in its own `.admin-nav-row` positioning context (both the server-rendered and client-rendered markup).
2. **Badges/stats stuck on "anonymous" after a real in-page login.** `admin-shell.js` fires its dashboard-summary fetch unconditionally the moment its script runs -- on `/admin/`'s first, not-yet-authenticated load, that happens before the login form is even submitted, memoizing a 401 result that a successful login never refreshed without a manual reload. Fixed by having the login success handler bypass the memoized cache for one fresh, authenticated fetch.

A third, smaller UX gap found and fixed the same way: the mobile tool list defaulted to open, not collapsed, because the static HTML ships open (for JS-disabled visitors) and the JS only ever forced it open at desktop widths, never closed at mobile widths. Made `syncGroupsOpen` bidirectional -- matchMedia's own "change" event only fires on an actual breakpoint crossing, so this doesn't fight a visitor's manual toggle mid-session.

One limitation was found in the verification harness itself, not the app: it only read request bodies for POST, but `api/admin/meets.js`'s DELETE handler legitimately expects a JSON body too (which real Vercel functions parse regardless of method) -- producing a false "Meet ID is required." error during the delete-regression check. Fixed in the harness.

**A fourth, more serious real bug was found afterward by the user's own manual browsing** of a local preview (the same real-Supabase-backed local harness, run persistently rather than as a one-shot script) -- something Playwright's scripted checks never exercised because they always drove specific known-good URLs, never just clicked around. The public site header visibly overlapped the page-hero heading, and the site footer rendered squeezed into a narrow, nearly-unreadable column. Root cause: `bodyClass: "admin-shell"` (used to scope every rule in `admin.css` under `body.admin-shell`) put the class `admin-shell` on `<body>` itself, and the sidebar's own grid wrapper `<div>` was *also* named `admin-shell` -- the identical class. The bare `.admin-shell { display: grid; grid-template-columns: 268px minmax(0, 1fr); }` rule matched both at once, silently turning `<body>` itself into that same 2-column grid and dragging the real page header/main/footer into grid cells they were never meant to be in (the footer landing in the ~268px sidebar-width column explains exactly what was seen). Fixed by renaming the grid wrapper div's class to `.admin-layout`, distinct from the body's `admin-shell` class, and updating every CSS/markup reference accordingly -- confirmed fixed with screenshots before and after, then re-verified with the full E2E suite and a fresh `npm run build/check/test` pass, all still green. This was the one class of bug none of this session's automated Playwright coverage could have caught by construction (it only ever drove exact known routes, never rendered a full scrolled page the way a person actually looking at it would) -- worth remembering for future admin-page manual review.

### Known, deliberate scope limits

1. Operations Center's and Engagement Center's own competing inline `<style>` blocks (rounded corners, shadows) were left untouched -- their selectors are class-prefixed and can't collide with the new sharp-cornered chrome, only sit visually adjacent to it. Folding them into `admin.css`'s shared primitives is a deferred, separate cleanup.
2. No admin award-management tool was built -- the four dead-end AOTW/TOTW task links were made honest (pointing at Operations Center instead of nowhere), not resolved with a new tool.
3. The sidebar's ~296px width can crowd data-dense tool pages at mid-width viewports (1200-1440px) where existing per-page breakpoints don't account for the sidebar's presence; mitigated only by the manual collapse-to-icon-rail control this pass, not a full container-query fix.
4. Personalization (pins/recent) is browser-local only -- there is no per-admin identity in `lib/admin_auth.mjs` to store it against server-side.

### Not yet done

~~Docs update in progress (this entry); `git commit` not yet made -- diff review and explicit approval still needed before committing, and separately before any push or production deploy, per this project's standing practice.~~ **Update:** committed (`304267b`, after amending in the class-collision fix below), pushed, and deployed with the user's explicit approval; confirmed live at `/admin/`. This line was left stale in the original entry and corrected while writing the 2026-08-16 Ohio Top 100 entry below.

## 2026 08 16 Ohio Top 100 recruits (boys and girls, Class of 2027)

### Goal

The user wants an ESPN SC300-style ranked list -- rank, player, position, hometown, stars, grade, school, committed school and date -- specifically for Ohio track and cross country recruiting, starting with the Class of 2027. They asked for the page to be set up now, empty of real data; real athletes get added later through the tools that already exist.

### What was found before building anything

An audit found this needed almost no new backend work. The existing Recruit Ratings system (`install/03_RECRUIT_RATINGS_AND_PERFORMANCE_HISTORY.sql`, `install/06_RECRUITING_TAXONOMY_AND_MEDIA.sql`) already has real 70-100 scores, auto-computed star ratings (a DB trigger, not admin-settable), a 9-event-group taxonomy, and a live-computed `state_class_rank` (a real `dense_rank()`, partitioned by `graduation_year, gender`, ordered by score) already serving `/recruiting/`, the existing searchable database. That view already **is** ESPN's "RK" column -- nothing new needed to be computed. A "hand-curated ranking set" (an admin manually typing in rank order) was explicitly proposed and declined twice already (`docs/RECRUITING_PHASE_ONE_ARCHITECTURE.md` §9 decision 3, reaffirmed in Phase Three) in favor of this exact score-based live rank -- this build kept that decision intact rather than reopening it.

Three choices were confirmed with the user via `AskUserQuestion`: a **new dedicated page** (not a mode bolted onto the existing `/recruiting/` database), **text-only** committed-school display (no college-logo asset system exists and won't be built for this), and player names **link to their real Podium Watch profile** (matching the existing `/recruiting/` table's own convention -- no separate "video" link).

### What was built

1. **`api/recruiting/index.js`** -- one additive change: `hometown` added to the existing `athlete_profiles` select (a real column that was fetched by other endpoints but never rendered anywhere public before this). Also wired into the existing search-text matching on `/recruiting/` itself, since it was sitting right there unused. No new endpoint, no new tables, no migration -- the same `/api/recruiting` endpoint serves the new pages directly, called with `graduation_year`/`gender`/`sort=rating`/`page_size=100` pre-set. The commitment date needed no backend change at all -- `athlete_recruiting_activity` rows (already returned per athlete) already carry `activity_type`/`college_name`/`activity_date`; the new page's script just finds the `commitment`-type entry client-side.
2. **`src/pages/recruitingtop100.mjs`** (new) -- `recruitingTop100Page(site, { gender })`, rendered twice by `scripts/build.mjs` into two real static routes: **`/recruiting/top-100/boys/`** and **`/recruiting/top-100/girls/`**. Cross-linked via `.gender-tabs`, the same real, existing sitewide component already used by `/rankings/<sport>/<gender>/...` -- chosen over a single page with a JS toggle specifically to match that existing precedent. Class year stays a lightweight client-side `<select>` (2027-2031, defaulting to 2027), matching how `/recruiting/` already treats graduation_year as a plain filter rather than a URL segment.
3. Visual layout reuses `.ranking-list`/`.ranking-row`/`.ranking-number` from `main.css` -- an existing shared sitewide primitive (not scoped to one page) already used by `/rankings/`, and the closest existing match to ESPN's numbered-card layout. New page-scoped classes were added only for what that primitive doesn't already have: the event-group "position" tag, the stars row and score circle (copied patterns from `/recruiting/`'s own `.recruiting-stars`/`.recruiting-score`), and the committed-school-plus-date block.
4. **`public/scripts/recruiting-top100.js`** (new) -- fetches `/api/recruiting` on load and on year-select change, renders every row from real data, and shows an honest empty state (`emptyState()` from `src/lib/html.mjs`) when a class/gender combination has no published ratings yet, which is true for all of them right now in production.

### Two real, pre-existing database requirements found while building the live-verification test data (not bugs, but undocumented until now)

Creating a real throwaway test athlete surfaced two DB-level trigger requirements neither the audit nor the plan had surfaced: `athlete_profiles` requires a real `normalized_name` (not auto-computed, must be set by the caller via `normalizeAthleteName()` from `lib/athlete_foundation_service.mjs`, same as every other athlete-creation code path already does), and a real trigger (`ATHLETE_RECRUITING_CONTACT_ROUTE_REQUIRED`) blocks `recruiting_enabled=true` unless `recruiting_contact_route` is set to something other than its `'none'` default. Both are pre-existing, correct safeguards -- not something this feature needed to change -- just previously undiscovered because no prior feature this session created an athlete profile with recruiting enabled from scratch.

### Automated testing

`npm run build && npm run check && npm test` -- 279 pages (2 more than before), 311 HTML files, all 12 suites pass clean. Touches no test-asserted literal strings.

### Manual/live testing completed

A full Playwright pass against real production Supabase, using the same local-harness technique proven all session (this time trivially simple -- the page needs no auth at all, so the harness only routes the one public `/api/recruiting` endpoint plus static files): both `/recruiting/top-100/boys/` and `/recruiting/top-100/girls/` reachable and correctly cross-linked via the gender tabs; a full real data round trip (a real `athlete_profiles` row with a real hometown, a real verified `athlete_performances` row, a real published `athlete_recruit_ratings` row at score 88.5, and a real `commitment`-type `athlete_recruiting_activity` row with a real date) confirmed present in the raw `/api/recruiting` response and then confirmed rendering correctly end to end on the real page -- hometown, school, event group as the position tag, rounded score, and committed school plus date all present in the real rendered text; the Girls Class of 2027 page correctly showed the honest empty state for the same real data (proving the gender partition works, since the test athlete was boys-only); the class-year selector correctly re-fetched without a page reload when switched to 2028 (correctly empty); no horizontal overflow at 390px mobile. All real test data deleted afterward, confirmed by re-querying (including cleaning up a genuine orphan left by an early crash in the test script's own cleanup code, described below). A separate screenshot pass with three real throwaway athletes at different scores (96.2/91.0/85.5) visually confirmed the star-fill count matches the real DB-computed `star_rating` at each score band (5/4/3 stars respectively) and that an uncommitted athlete correctly shows "Uncommitted" in place of a committed school.

Two bugs were found and fixed in the verification **script itself**, not the app, while iterating: a `.catch()` chained directly on a Supabase query builder (not a real Promise until awaited) crashed mid-cleanup and orphaned one real test profile in production, cleaned up immediately by a direct follow-up script once found; and a null-unsafe `row.school.school_name || row.team.school_name` assertion threw before the `||` could ever evaluate when a test athlete used `current_team_id` instead of `current_school_id` (both are real, valid, mutually-exclusive paths this schema supports).

### Known, deliberate scope limits

1. No reciprocal link was added from the existing `/recruiting/` database page pointing to the new Top 100 pages (only the reverse exists) -- small, low-risk, easy follow-up, left out since it wasn't part of the approved plan's file list.
2. No admin UI changes -- the user will add real Class of 2027 athletes through the existing `/admin/recruiting/` tool exactly as it already works; nothing about curation changed.
3. Committed-school display is text-only, no logos, per the confirmed decision.

### Not yet done

`git commit` not yet made -- diff review and explicit approval still needed before committing, and separately before any push or production deploy, per this project's standing practice.

## 2026 08 16 Team Workspace Phase Three: guardian & spectator access

### Goal

The user asked "what should we work on next for the website?" and chose "Team Workspace Phase Three" from the presented options -- the final stage of a lineage (Race Command Center -> Team Home/Meet Center -> Athlete Access) described only by a one-line note repeated three times across the docs: "parent/follower access, live team following with explicit public/private split controls." No deeper original spec survived (confirmed by an exhaustive doc search).

### Scoping, confirmed with the user before design started

Two Explore-agent audits of existing infrastructure, then four `AskUserQuestion` decisions (all "Recommended"): (1) guardian access is a distinct, coach-invited, signed-in tier, separate from a lighter anonymous "follower"/spectator tier -- not one blended experience; (2) "live" means real-time-ish polling during an in-progress race, not websockets; (3) visibility is controlled per-race by the coach, off by default; (4) extend the existing (dormant) `team_followers`/`team_follows`/`results`-category notification system rather than build parallel infrastructure.

A Plan agent then validated and materially corrected the initial synthesis -- every claim was independently re-verified against the real code before finalizing the plan, not taken on faith: guardian access had to stay scoped to the guardian's own linked athlete (a full race view would leak other kids' private goals/targets to any parent); the public live-viewing surface had to be a brand-new top-level route, not Team Meet Center (confirmed fully coach-gated, in all three private-route lists, no public path exists); the new column had to be named `spectator_visible`, not `followers_visible`, to avoid confusion with the distinct `team_followers` table.

### A real, previously-unknown, already-live bug found and fixed as part of this pass

Verified directly (not just claimed): `lib/race_command_center_service.mjs`'s `getSessionDetail()` did `select("*")` on `race_participants` with **no join to `team_athletes`**. `display_name` never existed on the row, so `public/scripts/race-command-center-live.js:378` and `race-command-center-review.js:80`'s `participant.manual_name || participant.display_name || "Runner"` fallback displayed the bare word "Runner" for every roster-linked participant -- on the coach's own Live Race Mode and Review pages, in production, today, before this session touched anything. Fixed by a new shared `resolveParticipantNames()` in `lib/race_viewer_service.mjs` (joins `team_athlete_id` -> `team_athletes`), used both directly by `getSessionDetail()` and by all three new viewer tiers. Reverified live with a real throwaway race and two rostered + one manual participant: all three show correct real names, none fall back to "Runner."

### What was built

1. **`install/13_GUARDIAN_AND_SPECTATOR_ACCESS.sql`** (run in Supabase by the user, confirmed live via a direct column/table probe before re-running verification) -- additive only: `race_sessions.spectator_visible boolean not null default false`, plus `guardian_invites`/`guardian_accounts`, a near-exact structural mirror of `athlete_invites`/`athlete_accounts` from Athlete Access (coach-issued-invite-only, `token_hash` via the existing `createToken()`/`hashToken()` pair, single-flag consent, status-flip revocation). The one real difference: more than one guardian per athlete is the normal case (two parents), so uniqueness is `(user_id, team_athlete_id)`, never `team_athlete_id` alone.
2. **`lib/race_viewer_service.mjs`** (new) -- the single shared module behind all three tiers, replacing ad hoc `select("*")` calls with explicit field allow-lists: `loadAthleteViewRaces()` (own goals/targets/splits, shared by both the athlete and guardian "own data" reads) and `loadSpectatorRace()` (checkpoints/names/times only, requires `spectator_visible`, used by both the anonymous public endpoint and the guardian's optional leaderboard).
3. **Guardian tier**: `lib/guardian_auth.mjs`/`lib/guardian_access_service.mjs` (new, mirror `athlete_auth.mjs`/`athlete_access_service.mjs`), `api/guardian/invite.js`/`me.js`/`races.js` (new, mirroring Athlete Access's real, confirmed 3-file split), `src/pages/guardianlogin.mjs`/`guardianhome.mjs` + matching client scripts (new, structurally near-identical to the athlete-tier pages), and a new "Guardians" invite section on the roster page (`teamroster.mjs`/`team-roster.js`), a direct duplicate of the existing athlete-invite section.
4. **Anonymous spectator tier**: a new public, indexable route `/race/?race=<id>` (`src/pages/racepublic.mjs`), a new reusable poller (`public/scripts/race-poll.js` -- ~10s while live, pauses on tab-hidden via the Page Visibility API, exponential backoff on error, stops after one final fetch once the race is over), and `api/race/public.js` (fully anonymous, POST, `Cache-Control: no-store` -- deliberately kept consistent with this repo's universal POST convention rather than introducing a first-ever GET+CDN-cached route, even though a real precedent for that pattern already exists elsewhere in `api/recruiting/index.js`; the polling/backoff/visibility-pause design already bounds load adequately at this site's real scale).
5. **Coach controls**: a `spectator_visible` toggle plus a copyable `/race/?race=<id>` link added directly to each race card on the Race Command Center hub page (`racecommandcenter.mjs`/`race-command-center-hub.js`) -- there was no existing session-settings-edit UI to extend, so this was new.
6. **Discovery**: a "Live Now" strip on the team profile page (`teamprofile.mjs`/`team-profile.js`), populated by a new `live_races` field on the existing `api/teams/detail.js` response (guarded the same way the existing Path to State call already is, so a missing migration can never break the whole team page).
7. **Notifications**: two new call sites in `race_command_center_service.mjs` (on transition to `live` and to `finished`), reusing the existing-but-previously-unused `results` category (`CATEGORY_COLUMNS.results = "alert_results"`) via the existing `queueTeamNotification()`, guarded by `spectator_visible` and deduplicated via `race:<sessionId>:live`/`race:<sessionId>:finished` dedupe keys.

### Two more real findings fixed in the same pass

1. `lib/athlete_access_service.mjs`'s `getAthleteRaces()` did `select("*")` on `race_sessions`/`race_goals`/`race_targets`/`race_splits`/`race_checkpoints`, over-exposing internal columns (`device_id`, `created_by_user_id`, `client_split_id`, unbounded `metadata`) to an athlete's own browser today. Refactored onto `race_viewer_service.mjs`'s shared allow-list projection -- confirmed live that what an athlete is actually allowed to see (their own goals/targets) is unchanged, while the internal columns are now confirmed absent from the raw response.
2. **A design bug caught and fixed before it ever shipped, by directly re-checking my own draft against the schema rather than assuming it was correct**: an early version scoped `revokeGuardianAccess` by `team_athlete_id` (mirroring `revokeAthleteAccess` exactly). Since more than one guardian per athlete is the *normal* case here, that would have meant a coach revoking one parent's access silently revoked every guardian linked to that athlete at once. Rescoped to revoke by the specific `linked_via_invite_id` instead. Verified live with two real guardians linked to the same athlete: revoking one leaves the other's `guardian_accounts.status` untouched (`active`).

### Automated testing

`npm run build && npm run check && npm test` -- 280 pages, 314 HTML files, all 12 suites pass clean (46/46 in the largest suite alone). No dedicated unit-test script exists for Athlete Access or Guardian Access in this codebase (both were verified live instead, matching this session's established practice for auth-flow features); the refactor of `athlete_access_service.mjs` was therefore caught only by the live pass below, not by `npm test`.

### Manual/live testing completed

A comprehensive live Playwright + service-layer + real-HTTP pass against real production Supabase, using the same local-harness technique proven all session, built around one real throwaway race with two rostered participants (Athlete A, Athlete B) and one manual-name participant, real goals/targets/splits, and `spectator_visible` turned on:

- **Runner-bug fix**: `getSessionDetail()` resolves real names for all three participants, confirmed directly against the service response.
- **Notification dedupe**: starting the race queued exactly one `results`-category `team_notification_events` row with the expected dedupe key.
- **Athlete tier unaffected**: real goals/targets still returned after the `race_viewer_service.mjs` refactor; internal columns (`created_by_user_id`, `duplicated_from_session_id`, `metadata`) confirmed absent from the session object's keys.
- **Guardian scoping (the critical privacy check)**: a guardian linked only to Athlete A sees Athlete A's real goals/targets, with Athlete B's participant/athlete id absent from the guardian's own-athlete section of the response (the response's separate `leaderboard` field correctly *does* include Athlete B, since that field is the intentional spectator-safe view of the whole race -- the first test-script draft conflated the two and had to be corrected to distinguish them).
- **Spectator projection (the second critical privacy check)**: a deep string scan of the full JSON response, both at the service layer (`loadSpectatorRace`) and over real HTTP (`api/race/public.js`), confirmed zero occurrences of `goal_seconds`, `target_elapsed_seconds`, `device_id`, `created_by_user_id`, `client_split_id`, `metadata`, or `note_text` anywhere in the payload.
- **Visibility gate**: turning `spectator_visible` off correctly rejects the spectator tier with a 404 at the service layer, and the real public `/race/` page shows an honest "can't watch this race" message instead of the leaderboard.
- **Guardian invite round trip over real HTTP**: `invite_guardian`/`list_guardian_invites`/`revoke_guardian_access` all confirmed via `api/team/roster.js` with a real coach-authenticated session; the per-invite revocation fix (above) was specifically confirmed at this layer with two real guardians on the same athlete.
- **Discovery strip**: `api/teams/detail.js`'s `live_races` field confirmed to include the real live, spectator_visible race.
- **The real public page, rendered**: Playwright loaded `/race/?race=<id>` and confirmed all three real participant names appear in the rendered page text, with no page errors.

Two bugs were found and fixed in the verification **script itself**, not the app: an over-broad assertion scanned the guardian's *entire* response (including the intentionally-full `leaderboard` field) for the other athlete's id, which is a false positive since the leaderboard is supposed to include everyone -- narrowed to scan only the own-athlete section, matching the real privacy boundary being tested. Separately, calling `.auth.signInWithPassword()` directly on the shared `supabaseAdmin` service-role client mutated its session for the rest of the script, silently downgrading later `supabaseAdmin.from(...)` calls to the last-signed-in user's permissions -- surfaced as a `permission denied for table guardian_accounts` error that, on inspection, actually *confirmed* the RLS posture (`revoke all from anon, authenticated; grant all to service_role`) is being enforced correctly. Fixed by using a separate, non-admin client instance for sign-in calls.

All real test data (race session, participants, checkpoints, goals, targets, splits, guardian/athlete invites and accounts, team_members row, five real Supabase Auth users, notification events) deleted afterward and re-queried to confirm gone.

### Known, deliberate scope limits

1. `api/team/roster.js` has zero `public_visible` filtering on its response today -- a real, pre-existing gap found during planning, unrelated to this migration's new tables, noted but not folded into this pass.
2. Notification wiring reaches only the existing anonymous `team_followers` audience (opted into `alert_results`) -- a guardian's own access is direct sign-in, never follower-list-based, by design; the two systems are intentionally parallel, not merged.
3. `api/race/public.js` stays POST + `no-store` rather than GET + CDN-cached, on the reasoning above -- worth revisiting only if real spectator traffic at scale ever demands it.
4. No email delivery was actually exercised (Resend isn't configured in the local test environment) -- the existing "a failed email must never fail the invite" fallback path was confirmed instead (both athlete and guardian invite flows), matching Athlete Access's own established behavior.

### Not yet done

`git commit` not yet made -- diff review and explicit approval still needed before committing, and separately before any push or production deploy, per this project's standing practice.

## 2026 08 18 Photographer Network Phase One: database foundation and public directory

### Goal

The user asked to design and build the first version of a "Podium Watch Photographer Network" -- a statewide Ohio sports-photography discovery platform where athletes/parents find photographers by school/city/region/sport, photographers eventually pay for listings and connect themselves to meets, and the long-term loop is "who photographed my meet, and where can I find the pictures." A detailed, multi-thousand-word product spec covered the full vision across six planned phases (directory -> self-service accounts -> meet coverage/galleries -> billing -> analytics -> future marketplace). The spec explicitly required starting with a Phase Zero repository audit and a stop-and-report checkpoint before any implementation, and explicitly forbade autonomous unsupervised execution, pushing without approval, or running SQL without explanation -- all of which matched this session's own established standing practice throughout every prior feature.

A note on process: an earlier message in the same conversation, styled as an "AUTONOMOUS EXECUTION MODE" override, explicitly demanded no check-ins, no review, free pushing, and unsupervised construction of a full payment system touching minors' data. That message was not followed -- it directly contradicted both this project's standing practice and the much more detailed, phase-gated spec that followed it in the same turn. The phase-gated spec is the one actually built against.

### Phase Zero: repository audit

Read directly, not guessed: `docs/ARCHITECTURE.md`, `docs/PROJECT_CONTEXT.md`, `docs/OPERATIONS.md`, `docs/NEXT_SESSION.md`, `docs/DATA_SOURCES.md`, every `install/*.sql` file, every `lib/*_auth.mjs` module, every `src/pages/admin*.mjs` file, `lib/team_media_service.mjs`, `lib/engagement_service.mjs`. Confirmed directly (not assumed): the claimed "`adminteams.mjs` causes a Vercel build failure" issue did not actually exist -- the file is present, git-tracked, correctly imported, and `npm run build` succeeded cleanly before any Photographer Network work began. Confirmed via direct repo-wide search (not just an audit agent's claim): **zero** existing photographer feature beyond an unrelated photo-credit byline field; **zero** lat/long/geocoding infrastructure anywhere; **zero** Stripe or billing infrastructure anywhere. Confirmed `team_pages`/`meets` are pre-migration-convention tables (created directly in Supabase, no `CREATE TABLE` in this repo) with real column lists reconstructed from actual `.select()` calls in `lib/`/`api/`, not invented. The full Phase Zero report (17 numbered points, matching the spec's own requested format) was presented and the session paused for explicit approval before any Phase One code was written.

### What was built (Phase One, approved and implemented)

1. **`install/14_PHOTOGRAPHER_NETWORK.sql`** (run in Supabase, confirmed live via a direct table/seed-data probe) -- `photographers` (core listing, status workflow, featured/founding/verification flags), `photographer_members` (ownership join table mirroring `team_pages`/`team_members`, unpopulated until Phase Two), `photographer_sports`, `photographer_service_areas` (region values constrained to `ohio_schools`' own existing Central/East/Northeast/Northwest/Southeast/Southwest taxonomy), `photographer_portfolio`, `photographer_plans` (seeded with the four named tiers, `price_cents` left null -- no pricing finalized, zero billing logic). Same RLS posture as every other table in this project: `service_role` only.
2. **`lib/photographer_service.mjs`** -- public search (`listPublicPhotographers`, including real school-name-to-location resolution via `team_pages`/`ohio_schools`, honest "school not found" when nothing resolves, sport/city/region filters, statewide-travel matching) and admin CRUD (status transitions, sports, service areas, portfolio add/remove).
3. **`api/photographers/index.js`** and **`api/photographers/detail.js`** -- fully public, no auth. **`api/admin/photographers.js`** -- gated by the existing `isAdminRequest()` helper, same pattern as every other admin endpoint.
4. **`src/pages/photographers.mjs`** (public directory: school/city/region/sport search, card grid, honest empty states), **`photographerdetail.mjs`** (public profile, `?slug=`-driven like `/team/?slug=`), **`adminphotographers.mjs`** (adminShell-based management tool, structurally mirroring `adminathletes.mjs`).
5. "Find a Photographer" added to the primary site navigation (`src/config/site.mjs` + `src/lib/html.mjs`) and to `src/lib/adminnav.mjs`'s Audience group.

### Two real bugs found and fixed before/during verification

1. **A build-breaking bug caught immediately on the first build attempt**: the two public page templates imported `SPORTS`/`REGIONS` directly from `lib/photographer_service.mjs`, which imports `supabaseAdmin` at module load time -- and `scripts/build.mjs` runs with zero Supabase env vars by design. `npm run build` crashed instantly. Fixed by extracting those two constants into a new, dependency-free `lib/photographer_constants.mjs`.
2. **A real API bug caught only by live verification, not by inspection**: `adminUpdatePhotographer()` re-validated every core field (including requiring `business_name`) on every update, so a status-only "approve this listing" call failed with a confusing 400 -- the first live-verification attempt hit this immediately. Fixed so update only touches fields actually present in the request; create still requires the full set.

### Automated testing

`npm run build && npm run check && npm test` -- 283 pages (up from 281), 318 HTML files, all 12 suites pass clean, zero broken links/images across 18,355 internal links.

### Manual/live testing completed

A full live pass against real production Supabase, using the same local-harness + real-HTTP + Playwright technique proven all session, plus a real signed admin session cookie minted directly from `lib/admin_auth.mjs` (not faked) to test the admin-gated endpoint and the actual `/admin/photographers/` page in a real browser:

- Confirmed the admin endpoint rejects an unauthenticated request with 401.
- Created a real throwaway photographer via the admin API; confirmed it defaults to `draft` and is invisible in both the public directory (zero filters) and public detail (404) while in that state.
- Set real sports and a real city-based service area; approved and made public; confirmed a real school-name search (against a real `team_pages` row) resolves the school and finds the photographer via the city match.
- Confirmed an unresolvable school name returns an honest "not found," never a guess.
- Confirmed sport filtering correctly includes/excludes based on real `photographer_sports` rows.
- Confirmed the public detail endpoint returns the full real profile including sports and portfolio.
- Created a second photographer with `statewide_travel: true` and a service area with zero overlap with the test school; confirmed it still appears in that school's search results.
- Suspended the first photographer; confirmed its public profile immediately 404s.
- Loaded the real `/photographers/` page, searched by the real school name, confirmed the real business name and Featured badge render in the DOM.
- Loaded the real `/photographers/profile/?slug=` page, confirmed the real business name, about text, and portfolio image render.
- Confirmed no horizontal overflow on the directory page at 390px mobile width.
- Loaded the real `/admin/photographers/` page in a real browser with a real signed admin session cookie, confirmed the real throwaway listing appears in the list with its correct status label, and confirmed clicking it loads the real data into the editor form.
- Confirmed zero page/console errors across every page tested.
- All real test data (two photographers, their sports/service-area/portfolio child rows) deleted afterward and re-queried to confirm gone, including confirming FK-cascade deletion of child rows.

### Known, deliberate scope limits (Phase One only)

1. No photographer-facing accounts, login, or self-service profile editing exist yet -- every write today is admin-only. That's explicitly Phase Two.
2. No lat/long -- search matches on city/county/region text, never computed distance. A future "nearest photographer" feature needs a real geocoding decision, not invented coordinates.
3. No image upload/Storage system -- portfolio and profile images are plain external URLs today, per the spec's own caution about not becoming responsible for hosting a large photo library.
4. No meet-coverage or gallery linking (Phase Three), no billing (Phase Four, and there is zero existing payment infrastructure of any kind to build on), no analytics (Phase Five).

### Not yet done

`git commit` made (Phase One only, migration run and confirmed live) -- push and production deploy not yet done, awaiting explicit approval per this project's standing practice.

## 2026 08 18 Photographer Network Phase Two: self-service accounts and ownership

### Goal

The user said "Phase two!" -- continuing the approved roadmap: give photographers their own accounts (open self-serve signup, no invite needed), a dashboard to create/edit their own listing and manage sports/service areas/portfolio, and a submission workflow feeding into the Phase One admin approval tool, which stays untouched.

### What was built

1. **`lib/photographer_auth.mjs`** (new) -- mirrors `lib/team_auth.mjs`/`lib/athlete_auth.mjs`/`lib/guardian_auth.mjs` exactly (bearer token + `supabaseAdmin.auth.getUser()`), plus `requirePhotographerOwnership(userId, photographerId)`, an explicit per-request check against `photographer_members` -- never inferred from the token alone.
2. **`lib/photographer_service.mjs`** extended with the self-service path: `createMyPhotographerListing` (creates the `photographers` row + the `photographer_members` ownership row together, mirroring `api/team/create.js`'s exact pattern), `updateMyPhotographerListing` (core fields only -- see the real security property confirmed below), `submitMyPhotographerListing` (the one-way `draft`/`rejected` -> `submitted` transition), `selfSetSports`/`selfSetServiceAreas`/`selfAddPortfolioItem`/`selfRemovePortfolioItem` (ownership-checked wrappers around the same functions the admin tool uses).
3. **`api/photographer/create.js`**, **`me.js`**, **`profile.js`** (new) -- `profile.js` is one action-dispatch endpoint (`update`/`submit`/`set_sports`/`set_service_areas`/`add_portfolio_item`/`remove_portfolio_item`/`detail`), mirroring `api/admin/photographers.js`'s own shape.
4. **`src/pages/photographerlogin.mjs`** (mirrors `teamlogin.mjs`'s sign-in/sign-up/reset panels exactly) and **`photographerdashboard.mjs`** (create-or-edit form, sports checklist, service area form, portfolio manager, a real status banner, and a "Submit for review" button gated to only `draft`/`rejected`). **`public/scripts/photographer-auth.js`** and **`photographer-dashboard.js`** (new).
5. `/photographer-login/` and `/photographer-dashboard/` added to all three private-route lists (matching `team-login/`/`team-dashboard/`'s treatment -- noindex, not literally "private data," just a signed-in account flow). A "Manage your listing" CTA added to the public `/photographers/` directory page, linking to `/photographer-login/`.

### Automated testing

`npm run build && npm run check && npm test` -- 283 pages, 320 HTML files (up from 318), all 12 suites pass clean, 18,462 internal links checked with zero problems.

### Manual/live testing completed

A full live pass against real production Supabase -- two entirely separate real throwaway Supabase Auth accounts (photographer A and B), a real local harness, and a real Playwright browser session driving the actual `/photographer-login/` sign-in form (not a faked session):

- Confirmed every photographer endpoint rejects a request with no auth token (401).
- Photographer A signed up and created a real listing; confirmed a real `photographer_members` row (role=owner, status=active) was created alongside it.
- **The critical security property**: sent a self-service update request that explicitly included `status: "approved", featured: true, verification_status: "verified"` in the body -- confirmed the response (200, since the request itself is well-formed) still shows the listing unchanged (`status: "draft"`, `featured: false`, `verification_status: "unverified"`), because those fields are structurally never read by the self-service update path, not merely blocked by a check that could later be forgotten.
- **The other critical security property**: photographer B, fully authenticated with their own valid token, was rejected with 403 on every single action against photographer A's listing -- `update`, `submit`, `set_sports`, `set_service_areas`, `add_portfolio_item`, and even the read-only `detail` action. Directly re-queried A's `business_name` in the database afterward to confirm B's rejected update attempt left zero trace, not just that the HTTP response reported failure.
- Confirmed the self-service portfolio cap: added 12 real images successfully, confirmed the 13th is rejected with 409.
- Confirmed the submission workflow: `draft` -> `submitted` succeeds; submitting an already-`submitted` listing is rejected with 409; core fields remain uneditable for status itself even after submission.
- Confirmed the full real pipeline end to end: self-serve signup -> create listing -> submit -> a real admin-cookie-authenticated approval call -> the listing appearing in the real public `/api/photographers/` search.
- Confirmed each photographer's `/api/photographer/me/` returns only their own listing, never the other's, even when both exist simultaneously.
- Drove the real `/photographer-login/` page in a real browser with a third real throwaway account: signed in, confirmed redirect to `/photographer-dashboard/`, created a real listing entirely through the UI, confirmed the status banner correctly reads "Draft." Zero console/page errors.
- All real test data (three photographers, their ownership rows, three Supabase Auth users) deleted afterward and re-confirmed gone.

### Known, deliberate scope limits (Phase Two only)

1. The self-service dashboard shows one listing per photographer in practice (the UI always edits `listings[0]`) even though the data model (`photographer_members`) already supports more than one owner per listing or more than one listing per owner -- multi-listing management UI is a future refinement if it's ever needed, not built now.
2. No email notification when a listing is approved/rejected -- the photographer has to check their dashboard. Wiring into the existing `queueTeamNotification()`-style system is a reasonable future addition, not built this pass.
3. Portfolio cap (12) and unpriced `photographer_plans` rows remain explicit Phase One/Two placeholders, unchanged.

### Not yet done

Not yet committed -- diff review and explicit approval still needed before committing, and separately before any push or production deploy, per this project's standing practice.
