# Podium Watch next session

## Most recent work (2026-08-25) -- read this first

Everything below this section (through "Current priority") predates 2026-08-25 and reads as maintained by a separate ChatGPT/Codex workflow on this same repo -- it is stale relative to real production (still calls the timing tool "Race Command Center," which was renamed to Split Watch and shipped 2026-08-21). See `docs/SESSION_LOG.md`'s 2026-08-25 entries for the real, verified current state, including:

- Split Watch: rebranded, live, and freshly re-verified end-to-end (including full offline-record/reconnect-sync) ahead of the user's first real race.
- Admin area (`/admin/*`): duplicate public-nav-on-top-of-sidebar removed, a real `[hidden]`-cascade badge bug and an oversized-heading/broken-Refresh-button bug both fixed, all live.
- Public team pages (`/team/`): a real sitewide `[hidden]`-cascade bug fixed (every team page was showing an empty red bar), Profile Completion now counts roster/schedule, a real WCAG contrast bug fixed on the hero badge, and Follow This Team turned on -- though real emails still cannot send anywhere on the site until the user adds real `RESEND_API_KEY`/`RESEND_FROM_EMAIL` (and `CRON_SECRET`) to Vercel.
- A 35-meet Ohio cross country meet bulk import (Aug 25-31 window) completed through the real `/admin/meets/` importer, plus two pre-existing meets enriched with source-backed fields only. All 35 new meets are still unpublished drafts awaiting the user's own review.

## Current priority

**Race Command Center Phase One is live in production** (committed `acf04ff`, pushed, deployed, and verified live at `https://podiumwatch.vercel.app/race-command-center/` and its `/plan/`, `/live/`, `/review/` sub-pages). Coach-facing race Plan -> Race -> Review tool with mobile-first Live Race Mode, offline-first split recording, and individual/team review. `install/11_RACE_COMMAND_CENTER.sql` is run and confirmed live. Full detail and every real bug found/fixed during the build are in `docs/SESSION_LOG.md`/`docs/DECISIONS.md`, 2026-08-11.

**Team Workspace Phase One is live in production** (committed `3f90154`, pushed, deployed, confirmed live at `/team-home/` and `/team-meet-center/`). Race Command Center is now the race-day engine inside a season-long Team Workspace. `/team-home/` is a private, single-team season landing page (next meet/race, roster/schedule/results stats); `/team-meet-center/` is the operational page for one meet (linked race sessions with real readiness counts, "create a race for this meet" bridging straight into Race Command Center's existing `create` action). **No new database migration** -- the repository audit found the team-to-meet linking system (`team_meet_connections`) and multi-coach permissions (`team_members.role` = `owner`/`editor`) already fully built; this phase was a presentation/aggregation layer over what exists, not new schema. Full detail in `docs/SESSION_LOG.md`/`docs/DECISIONS.md`, 2026-08-11.

**Athlete Access (Team Workspace Phase Two) is live in production** (committed, pushed, deployed, confirmed live at `/athlete-login/` and `/athlete-home/`). Athletes get their own signed-in view of their race plan and review via a **coach-issued invite only** (no open self-serve signup), scoped to **race plan + review only** (no PR/season-best history yet). New tables `athlete_invites`/`athlete_accounts` (`install/12_ATHLETE_ACCESS.sql`) run and confirmed live. `race_coach_notes` is structurally never exposed to athletes. Full detail in `docs/SESSION_LOG.md`/`docs/DECISIONS.md`, 2026-08-13.

**Admin dashboard redesign is live in production** (committed `304267b`, pushed, deployed, confirmed live at `/admin/`). Replaced the flat 15-button nav grid with a persistent sidebar on every `/admin/*` page, a real dashboard landing page (`/admin/` used to just BE the Meet Manager tool -- now split into its own `/admin/meets/` route), live badge counts and a needs-attention panel (both reusing Operations Center's already-computed task list, extracted into `lib/operations_service.mjs` rather than reimplemented), a Ctrl+K quick-jump search, and browser-local pinned/recent tools. Three real bugs were found and fixed via live testing, including one the user's own manual browsing caught that no automated check could have (a CSS class-name collision that turned `<body>` itself into the sidebar's grid, breaking the real header and footer). Full detail in `docs/SESSION_LOG.md`/`docs/DECISIONS.md`, 2026-08-16.

**Ohio Top 100 recruits (Class of 2027, boys and girls) is built, fully tested, and E2E-verified -- not yet committed.** An ESPN SC300-style ranked list at `/recruiting/top-100/boys/` and `/recruiting/top-100/girls/`, built almost entirely on top of the existing Recruit Ratings system -- real 70-100 scores, auto-computed stars, and a live-computed, gender/class-partitioned `state_class_rank` already did the hard part. Only one small additive API change was needed (`hometown` added to `/api/recruiting`'s response, a real column that was fetched elsewhere but never rendered anywhere public before this). No new tables, no migration, no admin UI changes -- real athletes get added later through the existing `/admin/recruiting/` tool. Full live Playwright verification against real production Supabase (a real data round trip through every field, correct gender-partitioning, correct year-switching, mobile). Full detail in `docs/SESSION_LOG.md`, 2026-08-16.

**Next steps, in order:**
1. Review the Ohio Top 100 diff and commit locally (not yet done).
2. Decide whether to push and deploy.
3. Whenever the user is ready to populate it: add real Class of 2027 (and beyond) athletes through `/admin/recruiting/` exactly as that tool already works -- nothing about that workflow changed.
4. Small, low-risk follow-up not yet done: add a reciprocal link from `/recruiting/` (the full searchable database) pointing to the new Top 100 pages -- only the reverse link exists today.
5. Team Workspace Phase Three whenever revisited: parent/follower access and live team following with explicit public/private split controls -- not precluded by anything built here, not built yet.
6. Decide whether/when `race_coach_notes` ever gets a real visibility/approval mechanism -- a prerequisite for any future athlete-facing coach-note feature, not needed by anything built so far.
7. Decide whether/when to build a real admin award-management tool -- four Operations Center tasks pointed at a nonexistent one before the admin redesign; they now honestly point at Operations Center instead, but no tool to actually schedule award weeks or mark winners exists yet.
8. Deferred from the admin redesign: fold Operations Center's and Engagement Center's own competing inline `<style>` blocks into `admin.css`'s shared primitives once proven; consider container queries for the sidebar's width impact on mid-width (1200-1440px) tool pages.
9. Two small, unrelated, low-effort items surfaced by earlier audits, still not acted on: `athlete_best_performances` (a real SQL view computing all-time-best marks) is fetched by `api/athletes/detail.js` but never rendered by `public/scripts/athlete-profile.js` -- dead data on a live page. No meet in the live `meets` table is currently `published: true`, which silently blocks the real "connect a meet to your schedule" flow (`api/team/schedule.js`) end to end -- worth checking whether that's intentional.

Path to State (below) is also still un-pushed as of this entry -- confirm with the user whether it should go out together with or separately from the other un-pushed work.

---

**Path to State** shipped: a horizontal OHSAA cross country tournament advancement roadmap (Regular Season -> District -> Regional -> State, or Regular Season -> Regional -> State for Division 1, which has no district round) on both team pages (`/team/`) and athlete pages (`/athlete/`), with the real qualifying threshold at every stage sourced from the 2026 OHSAA Cross Country Tournament Regulations. `install/10_PATH_TO_STATE.sql` has been run in Supabase and confirmed live -- real threshold rows, real calendar dates, and a real admin write/read/clear round trip were all verified directly against production before committing. New admin tool at `/admin/path-to-state/` lets an admin manually set a team's advancement status per stage (auto-computation from results ingestion was deliberately deferred -- see `docs/DECISIONS.md`, 2026-08-10). District/regional exact site address and manager contact info was deliberately left out of this pass: real research found only 3 of 6 OHSAA athletic districts have confirmed, current-2026 site data published anywhere fetchable; the other 3 are stale, unpublished, or locked in Google Docs/Sheets. Cross country only for now -- the schema is sport-aware, so track and field is new seed rows later, not a migration. Not yet pushed to production.

Separately, the user supplied a 5-phase feature roadmap (`docs/FEATURE_ROADMAP.md`, committed locally `63b75f3`, not yet pushed) and chose to work through Phase 1 (public race-math tools) first. Three of its five tools are now built:

1. **Race pace calculator** (`/pace-calculator/`, main nav) -- the 6 fixed HS track/XC events (800m/1600m/3200m, 5K/3 mile/10K), goal time in, mile/km/lap splits out. Pushed, deployed, and confirmed live, including a post-deploy title-duplication bug that was found and fixed live.
2. **Splits calculator** (`/splits-calculator/`, footer only) -- any goal time + any distance (marathon, half marathon, training run, custom), mile or 400m splits out. Companion to the pace calculator for anything outside its 6 fixed events. Pushed, deployed, and confirmed live.
3. **Meet scoring calculator** (`/scoring-calculator/`, footer only) -- add teams, tap off finishers in order as they cross the line, get live dual/invitational cross country team scores (standard NFHS rules: top-5 sum, displacers, 5-finisher minimum, deterministic tie-break). The only remaining Phase 1 tool that didn't need a formula/data decision first. Client-side only, nothing saved -- a live-meet scratchpad. Committed locally (`a18d5b7`), **not yet pushed**.

All three cross-link to each other via a shared `toolsCrosslink()` helper (`src/lib/tools.mjs`) that lists every Phase 1 tool once, rendered as a small styled callout inside each tool's own section (not in `pageHero`'s description, which is HTML-escaped and can't hold a real link) -- built when the 3rd tool made the earlier pairwise hardcoded links unmaintainable.

The pace and splits calculators share one reusable, unit-tested split-math file (`public/scripts/pace-splits.js`, `window.PodiumPaceSplits`); the scoring calculator has its own equivalent (`public/scripts/meet-scoring.js`, `window.PodiumMeetScoring`), same pattern. Two real bugs were found and fixed by Playwright testing before ever reaching production: `formatWholeTime`/`formatSplitTime` never rolled minutes into hours (a 1:45:00 half marathon goal displayed as "105:00"), and the scoring calculator's standings table showed a team's internal id ("t1") instead of its real name. Both are now covered by regression tests.

Next step: push the scoring calculator once reviewed. Of the roadmap's original 5 Phase 1 tools, 2 are now built (goal-pace splits builder, dual/invitational scoring calculator); the remaining 3 -- training pace calculator, equivalent performance calculator, and recruiting standards checker -- each need a decision from the user first (two formula choices and one real reference-data set) before responsible building can start on any of them.

---

The Podium Watch Fan Poll (cross country launch, both genders, divisions 1-4) is built, tested, pushed, deployed, and **confirmed working end to end against the real, live production site** (`https://podiumwatch.vercel.app/api/fan-poll/ballot/` itself, not a local stand-in). Nav links ("Fan Poll" in the header and the Explore bar), a real layout bug (a misplaced breadcrumb), and mobile ballot-building ergonomics (44px touch targets, ballot-in-progress shown above the team search on narrow screens) were all fixed and shipped too, per live user feedback against the real page.

**One real lesson from this session, worth remembering:** the first end-to-end test (before pushing) ran through a hand-built local server standing in for `vercel dev`, which still can't be used directly in this environment. That test reported a clean pass, but its ballot actually saved with zero team entries -- a flaw in that local test harness, not in the real code. This was only caught because the *real* production endpoint was independently tested after deploying and showed empty results where a ballot should have been. Testing directly against the real, deployed endpoint (not just a local stand-in) is what actually caught it -- worth doing for any future feature with a live/db-dependent path, not just trusting a local harness that's already known to have its own quirks (see the 2026-08-06 health check's "false leads" section for the earlier instance of this same class of issue). Three test ballots (the broken one plus two diagnostic ones created while investigating) were deleted from the live database with the user's approval; Cross Country Boys Division I is now open for voting with zero ballots, a clean start for real voters.

All 8 cross country divisions are now open for voting (confirmed live, real production API), and the Fan Poll's team data is fully complete: 46 real schools with a girls program but no boys program (so absent from the original boys-only statewide import) got real `ohio_schools` + `ohio_school_divisions` + `team_pages` records created, following the exact conventions of the real `api/admin/statewide-data.js` import tool. `team_pages`/`ohio_schools` are now 602 rows each (was 556); girls cross country division coverage is now the true, complete 468 (was a partial 422). No known data gaps remain for the cross country Fan Poll.

Nothing outstanding for cross country itself. Next real steps whenever revisited: build the results-email sending mechanism (only the opt-in capture exists so far), and turn on track and field once real division data exists for it (schema is already ready -- no migration needed, just new weeks and a small `scripts/build.mjs` change).

**Important process note (2026-08-06):** a `git push origin main` intended to push only the team media upload feature actually pushed every locally-committed-but-unpushed commit on `main` -- `git push` sends the whole branch history ahead of the remote, not just the most recently discussed diff. This included the team Instagram feature, which had an explicit "do not push without review" instruction attached that was never separately lifted. Both `install/07_TEAM_INSTAGRAM_SUBMISSIONS.sql` and `install/08_TEAM_MEDIA_UPLOADS.sql` were run in Supabase immediately after (both purely additive) to fix the resulting live breakage (the public Instagram submission form was returning HTTP 500 on every real team page). Confirmed live and working as of 2026-08-06: the `team-media` storage bucket exists with the expected config, and `team_pages.instagram_handle` is queryable. **Before any future `git push`, check `git log origin/main..main` first** -- an approval to push one feature is not necessarily approval to push everything else sitting locally ahead of the remote.

Team logo/banner uploads and the team Instagram feature are both now fully live in production (code deployed, migrations run, confirmed via direct checks). Still outstanding:

1. Live end-to-end functional verification with the user present: upload a real logo/banner through `/team-editor/` against a real claimed team and confirm it previews, saves, and renders on the public team page; submit a real Instagram handle on a real team page and confirm it appears, then confirm the admin revert works.
2. Set `TEAM_INSTAGRAM_DIGEST_EMAIL` in Vercel so the weekly digest cron has somewhere to send to -- it will otherwise fail silently.
3. Decide whether unclaimed teams (555 of 556) should get any no-login photo-submission path, similar to the Instagram feature -- not built, since the literal upload request was read as upgrading the existing claimed-team editor only.

Full detail in `docs/SESSION_LOG.md` and `docs/DECISIONS.md`, both 2026-08-06.

A new public results submission path also exists and is verified working: `/submit-results/` plus `api/results-submissions/`, letting anyone (coach, timer, meet host) submit raw results without an admin account, following the same hidden-review-queue safety as everything else. Nothing links to this page yet from anywhere else on the site -- it exists and works but is not discoverable. Decide whether/where to link it (footer, contact page, team pages). Full detail in `docs/SESSION_LOG.md`, 2026-08-06 entry, and the trust-tagging decision in `docs/DECISIONS.md`.

Three real meets are fully committed: D4 boys (213 rows), D1 boys (180 rows, batch `65e7bec0-869e-47ad-8728-4c7bf290a26a`), and D3 boys (215 rows, batch `3c6249e5-e146-4f9d-a588-d5a6fe680a60`, 211 imported, 4 correctly left unmatched). The statewide-import feature plus every bug fix found so far is pushed to production and confirmed live.

A fourth meet (2025 OHSAA Division 2 Boys Cross Country, 215 rows) has its school names resolved: 13 new aliases added and verified (see "Fourth real meet" below), 1 ("New Richmond") correctly left unmatched per the existing missing-from-official-source precedent. Next action: ask the user to re-preview and commit the D2 meet.

Pattern holding across four meets now: check `ohio_schools` for a confident alias first (increasingly, the same school recurs across divisions -- CVCA, Hoban, and the Holland Springfield were all already known by the time D2 came up), then check `public/data/ohio-school-foundation-2026-27.json` before concluding a school is genuinely missing from the official source rather than just abbreviated.

Separately, the user set standing autonomy permissions this session (see `.claude/settings.json` and the memory note on standing permissions) and asked for progress on the separate Results Ingestion Engine (Baumspage crawler). Real, fully autonomous success achieved: seeded at nothing more than the bare Baumspage catalog root, a 100-page crawl now reaches 24 real result documents and stages 3,098 correct rows with zero errors -- no manual per-event seeding needed. Three real bugs found and fixed along the way (PDF column drift, a Team Scores leak, and a crawler discovery-capacity bug that previously blocked catalog-root crawls from ever reaching real results at all) -- full detail in `docs/RESULTS_INGESTION_STATUS.md`, 2026-08-05 entries. Identity resolution and the import safety refusal were also verified live. Not yet exercised: a full successful review-approve-import round trip (needs a real crawl that happens to include a previously-known athlete). This work is committed locally (`115d551`, `af2fac1`, `7e7d2e0`) but not yet pushed to production -- push decision still open.

## Current working state

The Phase Zero safety cleanup remains deployed and confirmed live. The Phase One architecture report was audited and approved on 2026-08-04 (`docs/RECRUITING_PHASE_ONE_ARCHITECTURE.md`). Phase Two was implemented on top of that approval and migration 06 was run successfully in Supabase on 2026-08-04.

Overnight on 2026-08-05, while diagnosing an athlete-profile-link error, three real bugs were found and fixed (see `docs/SESSION_LOG.md` for full detail):

1. A `trailingSlash: true` routing issue silently dropped query strings on three public-facing fetch calls (athlete profile, athlete directory search, recruiting directory search). Fixed, and a general guard was added to `scripts/check.mjs` so it cannot recur silently.
2. The public recruiting API hardcoded the retired methodology label. Fixed to read the active methodology from the database.
3. The admin recruiting API's install-check hardcoded the retired methodology key, meaning every admin action would have silently attached new data to the retired 2026.1 methodology instead of the active 2026.2 one. Fixed to look up whichever methodology is active.

A Phase Three architecture report was also drafted overnight (`docs/RECRUITING_PHASE_THREE_ARCHITECTURE.md`). Of its five decisions, self-service claims and rank snapshot retention were deferred; the read-only scoring assist tool was approved and built the same session (a "Compare to rated athletes in this group" panel on the admin rating form).

Later on 2026-08-05, with the user present, every write path (media, ratings, rank movement, the comparison tool) was verified live against a throwaway test profile that was fully deleted afterward, then the branch was merged to `main`, pushed, and deployed.

## Database work still required

Migrations 01 through 06 are all installed in production Supabase as of 2026-08-04. No database work is currently outstanding. The next migration, if Phase Three's self-service claims are approved and built, would be numbered 07.

## Manual testing completed (2026-08-04)

1. Applied the Phase Zero cleanup package in the current project folder.
2. Confirmed the full local build and test command pass.
3. Reviewed the exact Git status and staged file list.
4. Opened the local homepage on desktop.
5. Opened the local homepage at a real phone width.
6. Confirmed the Explore row remains visible and horizontally scrollable.
7. Opened and closed the menu with the button, overlay, and Escape key.
8. Confirmed the menu begins below the complete header without an empty gap or overlap.
9. Confirmed there is no horizontal page overflow.
10. Opened `/admin/recruiting/` and reviewed the new import safety explanation.
11. Previewed one deliberately incomplete row (missing place) and confirmed it was invalid.
12. Previewed one complete exact athlete match and confirmed it was ready but hidden.

## Manual testing completed for Phase Two and Phase Three (2026-08-05)

All items below were verified live using a throwaway test profile created and then fully deleted with the user's approval (see `docs/SESSION_LOG.md`, 2026-08-05 "write-path verification and merge" entry).

1. Migration 06 run in Supabase. Done 2026-08-04.
2. Full local build and test command pass. Confirmed repeatedly.
3. Admin rating form's event group list shows the nine new groups. Done 2026-08-04.
4. Individual athlete profile page loads correctly (the trailing-slash bug is fixed).
5. Draft media item saved, confirmed hidden from the public profile.
6. Media item published, confirmed it appears on the public profile.
7. Public profile preview on a draft rating showed the content but explained the rank cannot be shown yet.
8. Rating published, confirmed it appears on `/recruiting/` and the athlete's profile page with correct ranks, and confirmed the methodology label reads 2026.2.
9. Rating re-saved, confirmed the rank snapshot mechanism records correctly.
10. Scoring comparison tool confirmed it surfaces published ratings as reference context only.
11. Merged to `main`, pushed, and deployed.

## Remaining after deployment

1. Confirm the Vercel build and the live recruiting pages after deployment (desktop and phone).

## Statewide results import (2026-08-05)

Goal: build a statewide performance database ("thousands of athletes and their times and marks... to rank them") starting with OHSAA cross country 2025 and track 2026 results.

Investigated first, since the docs' own claims about the separate Results Ingestion system (migrations 04-05) needed verification, not trust: confirmed it already writes into `athlete_performances` (a correction to something reported as missing on 2026-08-04), but it only ever attaches a result to an athlete who already has a profile -- it never creates one. With no team rosters loaded and ~200 seed athletes total, most real results would have had nowhere to attach.

Also confirmed live: MileSplit's results pages (both `milesplit.com` and `milesplit.live`) render results with client-side JavaScript. The raw HTTP response never contains a table, so they cannot be fetched directly -- copy-pasting the rendered page is the only reliable route today. Fully automated bulk pulling from MileSplit or Athletic.net is not realistic without a data partnership or browser automation, and the latter raises real terms-of-service questions this project should not build around quietly.

Built and tested against a real, complete dataset (the actual 2025 OHSAA Division 4 Boys Cross Country State Championship, 213 athletes, pasted directly from a browser):

1. `parseOfficialResultsText` (`lib/recruiting_service.mjs`) parses text copied straight out of a browser -- place, athlete name, grade (FR/SO/JR/SR embedded between name and school), school, mark -- and derives graduation year from grade and season year. Handles multi-word school names with periods and parentheses, and skips Team Scores sections automatically.
2. A narrow, explicit exception to "never create profiles from unmatched rows": when an admin opts in for an import with Source type Official, an otherwise-unmatched row whose school resolves to exactly one official Ohio school (by exact name or existing alias) becomes "creatable" instead of "unmatched." The created profile is always hidden (`public_visible: false`), marked Unverified, and looked up by a stable `source_identity_key` first so a later re-import of the same athlete reuses the same profile instead of ever overwriting or duplicating it. See `docs/DECISIONS.md` (2026-08-05) for the full reasoning and the boundary this does not cross.
3. New admin UI: a "paste results copied from an official results page" box and a "Create hidden profiles for unmatched rows from this official source" checkbox on `/admin/recruiting/`, both wired to a new `preview_official_results_text` admin action.
4. Verified against the real 213-row dataset via the actual HTTP API path (read-only preview only, before committing): **18 ready** (matched the existing seed, including Bennett Lehman, confirming the exact-match logic), **153 creatable** (real athletes with no profile yet, school resolved cleanly), **42 still unmatched** (abbreviated team names like "Con. Crestview," "Ft. Loramie," "Spring. ECA" that do not exactly match OHSAA's official directory -- expected, not a bug; candidates for `ohio_school_aliases` entries).
5. Found and fixed two real bugs during this build, both the same class caught once already this session: running `cleanAthleteText` (which collapses all whitespace, including newlines) on a whole pasted blob before splitting it into lines destroys the line structure the parser depends on. Hit it once in the parser itself, then again in the admin API action that calls it. Fixed both, and a test now guards the exact API-layer regression by name. Also found and fixed a `Number(null) === 0` edge case in the grade-to-graduation-year formula that let a missing season year silently produce graduation year 1 instead of failing -- caught by a test written for this exact feature, not discovered live.
6. **Committed on 2026-08-05, with the user's explicit approval**: the real 213-row import. 171 performance records created (18 attached to existing profiles, 153 attached to newly created ones), all hidden (`public_visible: false`, confirmed by direct query). 153 new athlete profiles created, all hidden and marked `unverified` (confirmed by direct query, including a specific check on the Luke Snyder profile). The 42 unmatched rows were correctly not saved and created nothing. Import batch id `194fc161-c20c-40e8-ad63-d41d77c46cfa`.
7. This was the first real (non-seed, non-test) data written by any of this project's Claude-assisted sessions.

### Second real meet (2025 OHSAA Division 1 Boys Cross Country, 180 rows)

1. A case-insensitive grade regex bug corrupted "Kenneth Morgan Jr" (matched the name suffix "Jr" as the grade marker). Fixed same day, real row added as a permanent fixture. Committed as `95d4a04`.
2. The 69 initially unmatched school names were resolved one at a time against the live `ohio_schools` table -- 17 confirmed real schools under an abbreviated display name, added as `ohio_school_aliases` rows (never guessed; only added on a single confident candidate). One ("Mass. Jackson" / Massillon Jackson) needed the official OHSAA division PDF to disambiguate from an unrelated "Jackson" school.
3. Committing the now-fully-matched preview crashed on a real duplicate-slug error: an existing seed profile ("Calvin Watson," linked to "Thomas Worthington" by its official name) was invisible to the matcher because the row printed the abbreviated "Thom. Worthington," and the school alias lookup was only being used to help create new profiles, never to help match existing ones. Fixed the same day (see `docs/DECISIONS.md`, 2026-08-05 follow-up note), verified live against the real data that caused the crash, committed as `8f5cfa3`.
4. The user re-clicked "Import ready results" and it committed successfully: batch `65e7bec0-869e-47ad-8728-4c7bf290a26a`, 180 rows imported (31 attached to existing profiles, 149 to newly created ones), all hidden and unverified, confirmed by direct database query -- including confirming Calvin Watson still has exactly one profile, not a duplicate.

### Third real meet (2025 OHSAA Division 3 Boys Cross Country, 215 rows)

1. 11 of 39 unmatched school names resolved the same way as D1 -- exactly one confident candidate in `ohio_schools`, verified live: Cin. CHCA, Mar. Highland, Ash. Edgewood, Alter, WCH Washington, Genoa, Bid. River Valley, Fenwick, Col. Academy, Beaver Local, Fair. Park Fairview. Clears 35 of the 39 rows since several repeat across the meet.
2. The remaining 4 (Dawson-Bryant, "Ak. Springfield," "Spr. Shawnee," Pleasant) are absent from `public/data/ohio-school-foundation-2026-27.json`, the parsed official OHSAA document the whole `ohio_schools` table is sourced from -- not a typo or missing alias, but schools that most likely do not sponsor their own boys cross country program. `ohsaa_school_id` is `not null unique` in the schema and is shown on the real public `/schools/` directory page, so a placeholder ID would put a visibly fake OHSAA number next to 556 genuine ones. The user chose to leave all 4 unmatched rather than add anything invented to that public page. See `docs/DECISIONS.md` for the fuller reasoning.
3. This is a new category worth watching for in future meets: an unmatched school name is not always an aliasing gap. Check the parsed OHSAA JSON (`public/data/ohio-school-foundation-2026-27.json`) before assuming a real school is just missing an alias.

### To continue toward "thousands of athletes"

1. Get more OHSAA cross country 2025 and track 2026 results the same way (paste copied results into the same tool), one meet at a time -- there is no bulk/automated route today.
2. Add more `ohio_school_aliases` entries as new abbreviated names are found in future meets.
3. Every imported performance and every created profile stays hidden until separately reviewed and published -- nothing from either real import is public yet, and reviewing/publishing is a distinct, still-outstanding step whenever the user wants to do it.
4. Revisit `docs/RECRUITING_PHASE_THREE_ARCHITECTURE.md` section 3 (scaling beyond the first launch) once there is real volume to plan against.
5. Decide whether to push the accumulated statewide-import feature (D4 + D1 + the matching fix) to production now that it has been exercised through two real meets, both fully committed -- not yet answered by the user.

## Known limitations

1. Recruit Ratings are manually evaluated and are not automatically generated. The scoring assist comparison tool is read-only reference context, never a formula; see `docs/RECRUITING_PHASE_THREE_ARCHITECTURE.md` section 4.
2. Performance import matching is intentionally exact and may require school name cleanup.
3. Athlete or parent self service claims for recruiting activity are deferred; see section 2 of the Phase Three report for the design to build whenever that is revisited.
4. There is no fixed formula for scores, by design, and that is not changing.
5. Cross country course differences require editorial context.
6. The public maximum time filter uses the rating selected top performance.
7. The corrected Baumspage reader still requires one live local 50 link batch before any discovered sources are approved. This is part of the separate Results Ingestion roadmap (`docs/RESULTS_INGESTION_STATUS.md`), not the recruiting system.

## Do not change yet

1. Do not seed stars from ranking snapshots.
2. Do not allow payment or sponsorship to affect scores.
3. Do not use offers to determine scores.
4. Do not publish private contact information.
5. Do not publish reported recruiting activity without confirmation and a source link.
6. Do not automatically create athlete profiles from unmatched performance rows, except the one narrow exception approved 2026-08-05: an admin-opted-in, official-source-only, exact-school-match-only creation that always stays hidden. See "Statewide results import" above and `docs/DECISIONS.md`.
7. Do not silently change star bands after ratings are published. Create a new methodology version.
