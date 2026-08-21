# Podium Watch decision log

Record major technical, editorial, design, and business decisions here.

## 2026 08 10 Path to State: OHSAA cross country tournament advancement roadmap

### Decision

Built a horizontal roadmap on team and athlete pages showing the real OHSAA cross country tournament advancement path -- Regular Season -> District -> Regional -> State for Divisions 2/3/4, or Regular Season -> Regional -> State for Division 1, which skips the district round entirely (2026 OHSAA regulation 3.1) -- with the real qualifying threshold at each stage, sourced from the real 2026 OHSAA Cross Country Tournament Regulations PDF the user supplied. The user's own pre-written feature spec flagged three open questions it explicitly said should not be silently assumed; all three were resolved directly with the user before any code was written:

1. **Advancement status is manually set by a Podium Watch admin for this launch, not auto-computed from results ingestion.** The results-ingestion pipeline is still early and largely unverified (see the statewide-import decisions below); auto-publishing tournament outcomes from unvetted data would repeat exactly the caution this project already applies to performance imports. `team_advancement_status` is shaped so a future `athlete_advancement_status` table (identical columns, keyed by `athlete_profile_id`) can slot into the same builder later with zero rework -- proven working now via `buildPathToState`'s already-present `athleteStatusRows` parameter (always empty in this launch, but its resolution-order precedence over the admin's team-wide status is real and tested).
2. **District/regional exact site address and tournament-manager contact info is out of scope for this launch.** Real research (live fetches against all 6 OHSAA District Athletic Board pages, plus a real PDF pulled and read directly) found only 3 of 6 districts have confirmed, current-2026 site data published; the rest are stale (2025), unpublished, or locked behind Google Docs/Sheets that can't be reliably read. Rather than ship 3 real districts and 3 fabricated or silently-missing ones, the user chose to pause this sub-feature. `public.ohio_tournament_sites` already exists in this project's schema for exactly this kind of data but currently holds zero cross country rows and uses a different (integer) regional numbering scheme than the named regionals (Central/Northeast/Northwest/Southwest) cross country actually uses -- a future site-info pass needs a naming reconciliation, not a new table, and must not duplicate this migration's tables.
3. **Both team pages (primary) and athlete pages (secondary) shipped in the same pass**, not deferred -- the athlete page's version reuses the exact same shared renderer and shows a derived "divergence" note (an individual advanced further than their team) which an admin's own note on that status row can override.

A few other decisions made while building it:

4. **`ohio_tournament_regional_assignments` bridges two key spaces that don't otherwise connect**: district thresholds are keyed by athletic district, regional thresholds are keyed by named regional, and nothing else in the official source data links them. Division 2/3/4's mapping came directly from the official district-to-regional table's own `regional` column (confidently `published`). Division 1 has no district round, so this mapping is not stated anywhere in the source document -- only the 3 athletic districts sharing an identically-named regional (Central, Northeast, Southwest) were recorded as `published`; East, Southeast, and Northwest were recorded as `unknown` rather than guessed.
5. **`qualifying_teams`/`qualifying_individuals` are constrained `> 0`, never `>= 0`.** A combination that does not exist in real life (there is no Division 1 Northwest regional -- confirmed by its absence from the official regional-to-state table) must be unrepresentable as a real-looking zero at the database level, not just handled correctly by application code. `resolveThresholdForStage` in `lib/path_to_state_service.mjs` additionally never averages or maxes across disagreeing rows when an exact scope isn't known -- it only ever reports a division-wide number when every real row for that division genuinely agrees, otherwise the UI shows "not published yet," never a fabricated count. This exact real gap (Division 1, Northwest) is the concrete test case for this guarantee, both in `scripts/test-path-to-state.mjs` and re-verified live against production Supabase after the migration ran.
6. **A real bug found live-testing against production, not caught by unit tests alone**: Supabase's REST layer (PostgREST) throws its own `PGRST205` with a completely different message shape ("Could not find the table '...' in the schema cache") for a missing table, not raw Postgres `42P01`. `isMissingPathToStateError`'s first version only recognized `42P01`, which would have meant every team/athlete page load logged a spurious error before the migration ran, even though the page itself degraded correctly. Fixed and reverified live before commit.

### Reason

The user's own spec explicitly instructed against silently assuming the three open questions, and separately asked to "chase down" the real per-district site data before accepting that it was genuinely unavailable for half the state -- both were honored by doing the real research (or, for status auto-computation, applying the same caution this project already uses for unverified imports) rather than guessing or shipping a partial/inconsistent picture.

### Alternatives considered

1. Auto-compute advancement status from the results-ingestion pipeline now. Rejected -- that pipeline is still early, and this project's established pattern (see the statewide-import and Recruit Ratings decisions) is to keep unverified data hidden or manual until a pipeline is proven, not to publish tournament outcomes from it by default.
2. Ship site/date/manager info for the 3 confirmed districts and leave the other 3 blank or stale. Rejected by the user in favor of pausing the whole sub-feature rather than presenting an inconsistent picture.
3. Guess Division 1's East/Southeast/Northwest regional assignment by analogy to the Division 2/3/4 mapping (same athletic district, same regional). Rejected -- the source document does not state this, and a wrong regional would mean a wrong, confidently-displayed qualifying number for a real team.

### Files or systems affected

`install/10_PATH_TO_STATE.sql` (run in Supabase, confirmed live), `lib/path_to_state_service.mjs`, `api/teams/detail.js`, `api/athletes/detail.js`, `api/admin/path-to-state.js`, `src/pages/teamprofile.mjs`, `src/pages/athletedetail.mjs`, `src/pages/adminpathtostate.mjs`, `src/pages/admin.mjs`, `public/scripts/path-to-state.js` (new shared renderer), `public/scripts/team-profile.js`, `public/scripts/athlete-profile.js`, `public/scripts/admin-path-to-state.js`, `src/styles/main.css`, `scripts/build.mjs`, `scripts/test-path-to-state.mjs`.

### Follow up

Cross country only for now -- track and field can follow later with new `ohio_tournament_stage_calendar`/`ohio_tournament_qualification_thresholds` rows only, no schema change, once it has the same level of real division data cross country already does. District/regional site and manager info remains paused pending either OHSAA publishing the other 3 districts' 2026 data or a dedicated future research pass. Auto-computed advancement status from results ingestion is a later phase once that pipeline is more mature. Division 1's East/Southeast/Northwest regional assignment stays `unknown` until a real, confirmed source is found.

## 2026 08 06 Podium Watch Fan Poll: launched cross country only, track ready

### Decision

Built a weekly, fan-voted top 16 team poll per sport, gender, and division -- modeled after the real OATCCC Coaches Poll but built and labeled everywhere as Podium Watch's own unofficial poll, never presented as official. Shaped after AOTW/TOTW's existing pattern (a `*_weeks` table with a voting window and status field, an atomic RPC vote-cast function, a hashed voter identifier) but reverse-engineered from `api/aotw/vote.js`, `api/aotw/current.js`, and `api/aotw/archive.js` rather than copied from an install/ migration -- `aotw_weeks`/`totw_weeks` predate this repository's migration convention and were never written to an install/*.sql file. A few decisions made building it:

1. **Only cross country actually launched, both genders, divisions 1-4 -- track and field is schema-ready but not turned on.** The user's original request was "all 8 divisions launch together... for both cross country and track and field," but before writing any schema, checking the real data found: the only official statewide division dataset in this project (`public/data/ohio-school-foundation-2026-27.json`) is explicitly boys-cross-country-only by its own stated scope, and `team_pages`' self-reported division fields showed 0 of 556 teams with a girls cross country or any track division assigned. Flagged this to the user before writing any code rather than silently building 8 pages knowing 6 had no real data behind them. The user chose to source the missing division data themselves and scope this build to cross country only for now; track and field (which uses 5 divisions elsewhere on this site, not 4, confirmed in `scripts/build.mjs`) will use its own real 5-division structure once turned on. The schema (`division_number between 1 and 5`, a `sport` enum already including the track values) needs no changes when that happens -- just new `fan_poll_weeks` rows.
2. **Girls cross country division data was sourced and loaded the same session**, closing most of the gap. The user supplied 8 official OHSAA PDFs (`2026BXC-D1..D4`, `2026GXC-D1..D4`), one boys and one girls per division. Extracted via `pdfjs-dist` (already a project dependency, used the same column-reconstruction technique as `lib/result_parsers.mjs`'s PDF results parsing) and matched to real `team_pages` rows by the numeric official OHSAA school ID (`ohio_schools.ohsaa_school_id`), never by fuzzy name matching. The boys extraction was cross-checked against the already-live boys data first as a correctness proof: 556/556 matched exactly, 0 mismatches. Girls: 422 of 468 real girls cross country programs matched to an existing `team_pages` row and were written to `team_pages.cross_country_girls_division`, logged via the existing `writeTeamChange` audit trail. The remaining 46 are real schools (mostly all-girls schools like Magnificat, Hathaway Brown, Mount Notre Dame, Ursuline Academy) that were never in `ohio_schools`/`team_pages` at all, since that table was originally seeded from the boys-only dataset -- listed in full for the user rather than silently created or silently dropped; creating new school/team records for them is a separate, smaller follow-up, not part of this build.
3. **A ballot is a foreign-keyed list of real `team_pages` rows, never free text**, unlike TOTW's finalists (plain `team_name`/`school` text columns, no `team_id` reference) -- a deliberate departure from that specific part of the TOTW pattern, directly serving the "no free text school names" requirement.
4. **The results-email opt-in writes to a fully separate table, `fan_poll_email_subscribers`, never to the ballot table itself.** `fan_poll_ballots` only ever stores a hashed email (for the one-ballot-per-email-per-week database constraint); a real, sendable address is only ever written when a voter explicitly checks "Email me when this week's poll results are published," and voting works identically either way. The actual sending mechanism (a weekly digest cron, matching the pattern already used for the team Instagram digest) was not built in this pass -- only the opt-in capture -- and is flagged as a follow-up.
5. **No existing admin action to open/close a voting window was found to copy.** `api/admin/operations.js` only ever reads `aotw_weeks`/`totw_weeks` for its status dashboard; there is no write action anywhere in this codebase that opens or closes an AOTW/TOTW week, meaning that has evidently been done by hand in Supabase up to now. `api/admin/fan-poll.js` is a new, original design for this specific need, shaped consistent with this project's other admin action files (`api/admin/team-instagram.js`) rather than copied from a nonexistent precedent.
6. **Scoring points (16 for 1st down to 1 for 16th) are computed inside the database function itself** (`cast_fan_poll_ballot_v1`), never trusted from the client -- the same principle already applied everywhere else client-supplied values touch scoring or money in this project.

### Reason

The user asked for this to follow the AOTW/TOTW pattern closely rather than invent new conventions, and to design the schema for permanent, queryable history from the start. Both held throughout, with the one necessary original piece (admin open/close) built to match this project's other admin action files instead, once it was confirmed nothing existing could be reused. Real, verified data (not guessed or partial) was treated as a launch prerequisite per division rather than shipping ballot pages with no real teams behind them.

### Alternatives considered

1. Launch all 8 (or 10, accounting for track's real 5th division) pages immediately with an undivided, statewide fallback list wherever real division data doesn't exist yet. Rejected by the user -- not a real division poll for most of the site until better data exists.
2. Store the ballot's teams as free text, matching TOTW's existing `finalists` pattern. Rejected -- the user's spec explicitly required real schools only, no free text, which a foreign key enforces and free text cannot.

### Files or systems affected

`install/09_FAN_POLL.sql` (not yet run), `lib/fan_poll_service.mjs`, `api/fan-poll/index.js`, `api/fan-poll/ballot.js`, `api/admin/fan-poll.js`, `src/pages/fanpoll.mjs`, `public/scripts/fan-poll.js`, `src/pages/adminfanpoll.mjs`, `public/scripts/admin-fan-poll.js`, `src/pages/admin.mjs`, `src/config/site.mjs`, `scripts/build.mjs`, `scripts/test-fan-poll.mjs`. Also, outside this feature's own files: 422 `team_pages.cross_country_girls_division` values populated from real official data (already live, a data change, not a code change).

### Follow up

Requires `install/09_FAN_POLL.sql` to be run in Supabase before any ballot can be cast. After that: schedule and open the first real cross country voting weeks; decide what to do about the 46 girls-only-program schools with no team page; build the actual results-email sending mechanism (capture is done, sending is not); and turn on track and field once real division data exists for it.

## 2026 08 06 Team logo and banner uploads, alongside the existing URL fields

### Decision

Let a signed-in coach of a claimed team upload an actual image file for their team's logo or banner, instead of only being able to paste a URL to an image already hosted somewhere else. The existing URL text fields stay exactly as they were -- a coach who already has a hosted image can still paste its address -- an upload just fills the same field in for them.

1. **A new public Supabase Storage bucket, `team-media`**, created the same way `install/05_RESULTS_INGESTION_ENGINE.sql` already created `result-source-documents`. That bucket is private, for internal audit copies nobody outside Podium Watch should read directly; this one is the opposite case on purpose, so it is created `public = true` -- every file it holds is meant to be shown on a public team page.
2. **The new upload endpoint (`api/team/upload-media.js`) never writes to `team_pages` itself.** It only validates and stores the file, then returns a public URL. The team editor drops that URL into the same `logo_url` / `banner_image_url` text field a coach could paste into by hand, and the existing "save" action in `api/team/detail.js` is what actually persists it -- the same audited path as any other profile edit, not a new one. Nothing is public until the coach presses Save.
3. **Every uploaded file is classified by its own magic bytes (`lib/team_media_service.mjs`'s `classifyImageBytes`), never by the browser-supplied content type or file extension** -- the same principle `lib/result_parsers.mjs` already uses for results documents. Only PNG, JPEG, GIF, and WEBP are accepted; SVG is deliberately excluded (it is XML and can carry a script). A 5 MB size limit is enforced both before decoding the base64 payload (so an oversized upload never gets fully allocated in memory just to be rejected) and again after.
4. **Reused the existing team auth and membership pattern exactly** (`requireTeamUser` + a `requireMembership` check against `team_members`, matching `api/team/detail.js`), rather than inventing a new access model for this one endpoint.

### Reason

The user asked specifically to convert the existing URL-paste-only logo/banner fields into a real upload capability. Keeping the upload endpoint itself "dumb" (validate, store, return a URL) and letting the existing, already-audited save action be the only thing that ever writes to `team_pages` avoids a second, parallel way for that table to change, and means the new code that touches a database column at all is zero.

### Alternatives considered

1. Have the upload endpoint save directly to `team_pages` on successful upload. Rejected: would create a second write path into the same field the profile form already saves, and would mean an uploaded-but-not-yet-reviewed image could go live before the coach presses Save on the rest of their edits.
2. Also let unclaimed teams (555 of 556 team pages) submit a photo with no login, mirroring the team Instagram feature's public submission model. Not built here -- the user's request read as upgrading the existing claimed-team editor, not opening a new anonymous submission surface; worth asking about separately if wanted.
3. Accept SVG uploads. Rejected: SVG is XML and can embed `<script>`, an XSS risk for a public image field with no server-side render sanitation step.

### Files or systems affected

`install/08_TEAM_MEDIA_UPLOADS.sql` (not yet run), `lib/team_media_service.mjs`, `api/team/upload-media.js`, `src/pages/teameditor.mjs`, `public/scripts/team-editor.js`, `scripts/test-team-media.mjs`.

### Follow up

Requires `install/08_TEAM_MEDIA_UPLOADS.sql` to be run in Supabase before any upload will succeed. Live end-to-end verification (uploading a real file through the editor, confirming it appears on the public team page after Save) is still outstanding until the migration is run.

## 2026 08 06 Team Instagram submissions: instant, automated, and reversible

### Decision

Built a public, no-login "submit your team's Instagram" feature that is deliberately different from every other submission path in this project: a valid, verified submission takes effect immediately, with no admin approval step. This is only safe because of what still gates it: real automated validation (handle format, a basic blocklist, and confirmation the handle is a real Instagram account, checked live against Instagram itself), a per-team-per-address rate limit, and a fully logged, one-click-reversible change history. Three narrower decisions made building it:

1. **A new `instagram_handle` column on `team_pages`, separate from the existing coach-managed `instagram_url` / `team_social_links`.** Both can be shown on a team's page at once (the user's explicit choice over two safer-looking alternatives -- see the conversation this session for the other two options considered). This means a claimed team's own verified link is never at risk of being overwritten by an anonymous submission, at the cost of the page needing to display two Instagram references distinctly if both exist.
2. **Reused the existing `public.team_change_log` table (via `lib/team_audit.mjs`'s `writeTeamChange()`) as the required change history, instead of building a second, redundant table.** That table already stores exactly what this feature needs: team, actor, old value, new value, and timestamp. `actor_id` holds a hashed submitter address for rate limiting, matching the pattern already used by the public athlete-correction endpoint -- never a raw IP, never displayed publicly.
3. **Instagram's real account existence check uses a `<title>` tag signal, not the HTTP status code.** Verified live: both real and made-up Instagram handles return HTTP 200 (the profile page is a JavaScript application, not server-rendered), but the page's title still differs server-side -- a real account's title names the account; a nonexistent one is the bare site title "Instagram". A fetch failure or timeout is treated the same as "does not exist" -- this feature never accepts a handle it could not actually confirm.

### Reason

The user explicitly asked for this exact instant-live model for this one feature, contrasted directly against the hidden-until-approved pattern this project uses everywhere else. Given that, the safety burden moves entirely onto the automated checks and the ability to instantly and completely undo any mistake -- which is why the revert action writes a *new* change log entry rather than editing history, and why the admin page and the weekly digest both read from the same underlying data so they can never disagree.

### Alternatives considered

See the two rejected field-scope options recorded in the session transcript: writing straight into the existing `instagram_url` (rejected -- would let an anonymous submission silently overwrite a real coach's own verified account) and a new field shown only on unclaimed teams (not chosen -- the user preferred showing it on every team regardless of claim status).

### Files or systems affected

`install/07_TEAM_INSTAGRAM_SUBMISSIONS.sql` (not yet run), `lib/team_instagram_service.mjs`, `api/team-instagram/index.js`, `api/admin/team-instagram.js`, `api/cron/team-instagram-digest.js`, `src/pages/teamprofile.mjs`, `public/scripts/team-profile.js`, `src/pages/adminteaminstagram.mjs`, `public/scripts/admin-team-instagram.js`, `src/pages/admin.mjs`, `vercel.json`, `scripts/test-team-instagram.mjs`.

### Follow up

Requires `install/07_TEAM_INSTAGRAM_SUBMISSIONS.sql` to be run in Supabase, and a `TEAM_INSTAGRAM_DIGEST_EMAIL` environment variable in Vercel (the address that should receive the weekly digest) before the digest cron can send anything. Full live end-to-end verification of the submit/revert/digest flow against the real database is still outstanding until the migration is run.

## 2026 08 06 Public results submissions are community trust, not official trust

### Decision

A performance imported from the new public results submission path (`/submit-results/`, no admin account required) is tagged `source_type: "community"` when it is eventually approved and imported, not `"official"`. `importApprovedRows` now derives this from the job it came from (`provider_key === "public_submission"` or `options.is_public_submission`) instead of hardcoding `"official"` for every source the Results Ingestion Engine ever imports from.

### Reason

Everything the Results Ingestion Engine has imported so far (Baumspage crawls) came from an admin-run, reviewed action. A public submission is different in kind: anyone can submit it, with only a name, email, and a honeypot field standing between a real coach and a bad-faith submission. It still goes through the exact same hidden-review-queue safety as everything else, and identity matching still refuses to invent an athlete -- but the trust label on the eventual performance should reflect where it actually came from, the same distinction this project already draws elsewhere between official and community-submitted recruiting activity.

### Alternatives considered

1. Tag every import "official" regardless of source, as the code already did. Rejected once the public submission path existed, since it would put a Baumspage crawl and an anonymous public web form at the same trust level, no matter how convincing that mismatch would look.
2. Require additional verification (email confirmation, a moderation step before staging) before a public submission is even staged. Not adopted for now -- the existing hidden-review-queue step (an admin already has to manually match identities, review, and approve every row) already provides that gate; a stricter one can be added later if abuse becomes a real problem.

### Files or systems affected

`lib/result_ingestion_engine.mjs` (`importApprovedRows`, `createPublicResultsSubmission`), `api/results-submissions/index.js`, `src/pages/submitresults.mjs`, `public/scripts/submit-results.js`.

### Follow up

`/submit-results/` is not yet linked from anywhere else on the site. Decide where (if anywhere) to link it once it has been tried.

## 2026 08 05 Baumspage crawler stays match-only, does not create profiles

### Decision

The Results Ingestion Engine's identity resolution (`resolveJobIdentities`) does not create new athlete profiles from unmatched Baumspage rows, and this stays as-is for now. It only ever attaches a crawled performance to an athlete who already has an existing profile; an unmatched row remains staged, requiring either a pre-existing profile or a separate roster/official import before it can ever be imported.

### Reason

The narrow profile-creation exception approved earlier the same day (see "Narrow exception: create hidden profiles from official results" below) was scoped specifically to `source_type === "official"` rows -- verified, single-governing-body results like the OHSAA state meet pages copy-pasted into the recruiting admin tool. Baumspage is classified in this project as a lower-trust `archive` provider (`import_policy: "review_required"`), aggregating results from many different meet hosts and timing companies with less centralized quality control than a single governing body's own site. Extending automatic profile creation to it would have meant a real, separate trust-boundary decision, not just flipping the existing flag. Confirmed live the same day: a real 100-page Baumspage catalog crawl staged 3,098 rows with 0 matched athletes, since almost no regular-season meet's runners already have profiles -- so as things stand, Baumspage crawls are useful mainly for adding performances to athletes who already exist (for example, state qualifiers already imported from an OHSAA meet, competing earlier in the season at a Baumspage-tracked meet), not for growing the athlete database on their own.

### Alternatives considered

1. Extend the same official-source profile-creation exception to Baumspage rows. Rejected for now -- would let a much less centrally-verified, multi-host archive create new athlete identities with the same trust currently reserved for a single state governing body.
2. Require rosters to exist before any Baumspage data is useful at all. Not adopted as a hard rule, since matching against athletes already imported from official sources is still useful without a full roster project.

### Files or systems affected

None changed -- `lib/result_ingestion_engine.mjs`'s `resolveJobIdentities` already behaved this way; this records the decision to keep it that way rather than extend it.

### Follow up

Revisit if Baumspage (or a specific sub-source within it) is later judged trustworthy enough for its own narrow profile-creation exception, or once real usage shows the athlete database is growing enough through official sources that Baumspage's match-only role becomes limiting.

## 2026 08 05 Narrow exception: create hidden profiles from official results

### Decision

Add one narrow, explicit exception to the standing rule "never create an athlete profile from an unmatched performance row." A new profile can now be created automatically only when all of the following are true: the admin explicitly opted in for this specific import, the row's source type is Official, the row is otherwise complete and valid, and the row's school resolves to exactly one official Ohio school by exact name or an existing alias (never a fuzzy or partial match). A created profile is always saved hidden (`public_visible: false`), marked `unverified`, and looked up by a stable `source_identity_key` first, so importing the same athlete again later reuses the same profile and never overwrites anything an admin has since reviewed, verified, or published.

### Reason

The user asked to build a statewide performance database ("thousands of athletes... to rank them"), starting with OHSAA cross country and track results, and does not have team rosters loaded. Every existing profile-creation path in this project (the athlete seed, team roster sync) requires an upstream identity source; the recruiting performance importer and the separate Results Ingestion engine both only ever match against profiles that already exist. Without team rosters, importing real meet results would mostly produce rows with nowhere to attach, defeating the purpose. Official, state-governing-body-sourced results with a complete name, school, gender, and grade are treated with the same trust already extended to a team's own roster entry -- both are institutional facts about real identity, not an inference from fuzzy text.

### Alternatives considered

1. Require team rosters to be populated first, before any performance import (the original two-stage plan). Rejected for now because the user does not have rosters and wants to start with results directly; this remains the safer default path and is not removed as an option.
2. Allow profile creation from any unmatched row regardless of source type. Rejected -- this would remove the "official source only" guardrail entirely and treat community-submitted or unverified data with the same trust as a state championship result.
3. Auto-publish created profiles. Rejected outright -- every created profile stays hidden until a human reviews and publishes it, with no exception, matching every other import in this project.

### Files or systems affected

1. `lib/recruiting_service.mjs` (`parseOfficialResultsText`, `deriveGraduationYearFromGrade`, `loadOhioSchoolLookup`, `createOfficialSourceProfile`, and the `previewPerformanceImport`/`commitPerformanceImport` extensions)
2. `api/admin/recruiting.js` (`preview_official_results_text` action)
3. `src/pages/adminrecruiting.mjs`, `public/scripts/admin-recruiting.js`
4. `scripts/test-recruiting-foundation.mjs`
5. `docs/NEXT_SESSION.md` (see "Statewide results import")

### Follow up

Verified against a real, complete 213-athlete dataset (the actual 2025 OHSAA Division 4 Boys Cross Country State Championship) using only the read-only preview action before committing: 18 matched the existing seed, 153 would create new hidden profiles, 42 remained unmatched pending school name cleanup. Committed on 2026-08-05 with the user's explicit approval: 171 performances and 153 new profiles created, all confirmed hidden and unverified by direct database query afterward. This was the first real (non-seed, non-test) data written by any of this project's Claude-assisted sessions.

A second real meet (2025 OHSAA Division 1 Boys Cross Country) exposed a gap in this exception's matching logic, not its creation logic: an existing profile ("Calvin Watson") is linked to a school by its official name ("Thomas Worthington"), but the results page printed the abbreviated form ("Thom. Worthington"). The school alias lookup this decision introduced was being used to help *create* new profiles against a resolved official school, but was never used to help *match* against existing ones -- so the existing profile was invisible to the matcher, and committing the import crashed on a duplicate slug. Fixed the same day: the alias lookup now loads unconditionally and is tried as a second match key before a row is treated as having no match. See `docs/SESSION_LOG.md`, 2026-08-05 "Second real meet" entry, for the full diagnosis.

## 2026 08 05 Schools missing from the official source stay unmatched, not invented

### Decision

When an unmatched school name on a results page turns out not to exist anywhere in `public/data/ohio-school-foundation-2026-27.json` (the parsed copy of the actual official OHSAA boys cross country division document that the entire `ohio_schools` table is sourced from) -- as opposed to simply being an abbreviated form of a school that does exist -- do not add a new `ohio_schools` row for it. Leave the performance rows for that school unmatched (skipped, nothing saved) unless and until a genuine official source confirms the school and its division.

### Reason

Discovered while resolving the 2025 OHSAA Division 3 Boys Cross Country meet's 39 unmatched rows: 4 school names (Dawson-Bryant, "Ak. Springfield," "Spr. Shawnee," Pleasant) do not appear anywhere in the 556-school official document at all, most likely because they do not sponsor their own boys cross country program (a runner's home school still prints on results even when running unattached or on another school's co-op team). Two concrete facts ruled out adding them as ordinary new rows: `ohsaa_school_id` is `not null unique` in the schema, so a real-looking placeholder would have to be invented; and that field is displayed on the live public `/schools/` directory page, so a placeholder would appear as a visibly fake OHSAA ID sitting next to 556 genuine ones. Presented to the user with the concrete public-page consequence; they chose to leave the 4 schools unmatched rather than add anything invented to a public, authoritative-looking directory.

### Alternatives considered

1. Add the 4 schools with a placeholder `ohsaa_school_id` (for example a negative number) and metadata flagging them as manually added. Rejected by the user once it was clear this number is public-facing, not just internal bookkeeping.
2. Loosen the `ohsaa_school_id not null unique` constraint to allow schools without one. Not pursued -- a bigger schema change than this narrow case justified, and every other row's provenance would be undermined if the column's meaning became inconsistent.

### Files or systems affected

None changed. `ohio_school_aliases` (data only) gained 11 new confident entries from the same meet, unrelated to this decision. See `docs/SESSION_LOG.md`, 2026-08-05 "Third real meet" entry.

### Follow up

If any of these 4 schools is later confirmed (for example, OHSAA adds them to a future division document, or they are found under a different official display name already in the table), add the alias or new row then, with that real source cited.

## 2026 08 05 Recruiting Phase Three: scoring assist approved, claims deferred

### Decision

Of the five decisions in `docs/RECRUITING_PHASE_THREE_ARCHITECTURE.md`, build only the read-only scoring assist tool now. Defer self-service athlete and parent claims until there is real demand for it, and defer a rank snapshot retention rule until real usage data exists. The scoring assist tool was implemented the same session: a `load_rating_comparison` admin action and a "Compare to rated athletes in this group" panel on the rating form, showing already published ratings in the same graduation year, gender, and event group, sorted by score.

### Reason

Self-service claims is the largest item in the report and nothing indicates real demand for it yet. A rank snapshot retention rule is premature with zero published ratings to observe real growth patterns against. The scoring assist tool is small, purely additive, read-only, and directly useful for the manual review work still ahead.

### Alternatives considered

1. Build all of Phase Three now, including claims.
2. Skip the scoring assist tool too and revisit the whole report later.

### Files or systems affected

1. `api/admin/recruiting.js` (`load_rating_comparison` action)
2. `src/pages/adminrecruiting.mjs`, `public/scripts/admin-recruiting.js`
3. `scripts/test-recruiting-foundation.mjs`
4. `docs/RECRUIT_RATINGS_AND_PERFORMANCE_HISTORY.md`

### Follow up

Manually test the comparison panel once real ratings exist. Revisit self-service claims and rank snapshot retention per `docs/RECRUITING_PHASE_THREE_ARCHITECTURE.md` sections 2 and 5 whenever their trigger conditions are met.

## 2026 08 05 Overnight verification: no new database writes without the user present

### Decision

While verifying Phase Two overnight without the user available to review each step, do not create any new rows in Supabase, including throwaway or self-cleaned-up test data, even against an obviously fake profile. Limit verification to read-only API calls against existing data and careful code review of the write paths.

### Reason

The local dev server and production point to the same Supabase project. A write made during unsupervised testing is a real write to the live database with no one available to catch a mistake before it happens. This is different from the earlier Phase Zero pattern of preview-only testing, which never wrote anything at all regardless of supervision.

### Alternatives considered

1. Create a throwaway, obviously fake athlete profile, exercise every write action against it, then delete everything afterward.
2. Skip verification entirely until the user returns.

### Files or systems affected

None directly. This is a process decision, not a code change.

### Follow up

The write paths (media save and publish, rating draft and publish, rank movement on a second save) still need the user's own hands-on testing. See `docs/NEXT_SESSION.md`.

## 2026 08 04 Recruiting Phase Two implementation written, not yet installed

### Decision

Implement the approved Phase One architecture: write migration `install/06_RECRUITING_TAXONOMY_AND_MEDIA.sql` (nine group taxonomy, methodology version 2026.2, `athlete_content_items`, `athlete_recruit_rating_rank_snapshots`), extend `lib/recruiting_service.mjs` and the admin and public recruiting APIs and pages, and extend the automated tests. Do not run the migration against Supabase, commit, push, or deploy until reviewed and explicitly approved.

### Reason

The Phase One report recommended the smallest additive change that closes the identified gaps while reusing every existing table, service, admin pattern, and security boundary. Writing the code first and testing it locally, the same way Phase Zero was handled, lets the migration be reviewed before it touches the real database.

### Alternatives considered

1. Run the migration immediately after writing it.
2. Skip the admin preview action and only fix the taxonomy.
3. Build hand curated ranking sets instead of the rank snapshot table (rejected in Phase One decision 3).

### Files or systems affected

1. `install/06_RECRUITING_TAXONOMY_AND_MEDIA.sql` (new, not yet run)
2. `lib/recruiting_service.mjs`
3. `api/admin/recruiting.js`
4. `api/recruiting/index.js`
5. `api/athletes/detail.js`
6. `src/pages/adminrecruiting.mjs`, `public/scripts/admin-recruiting.js`
7. `src/pages/recruiting.mjs`
8. `src/pages/athletedetail.mjs`, `public/scripts/athlete-profile.js`
9. `scripts/test-recruiting-foundation.mjs`
10. `docs/RECRUIT_RATINGS_AND_PERFORMANCE_HISTORY.md`

### Follow up

Migration 06 was run in Supabase on 2026-08-04. The first attempt failed with a check constraint violation because the taxonomy backfill only updated rows matching a hardcoded list of the 35 expected event keys instead of every row in the table; the transaction rolled back cleanly with no lasting effect. The backfill was rewritten to apply to every row with a safety net for any leftover retired value, and the corrected migration ran successfully on the second attempt. Manually test the admin media form, the public profile preview, one rating publish and its rank movement on a second save, and the individual athlete profile's new media panel, before committing, pushing, or deploying.

## 2026 08 04 Recruiting Phase One architecture approved

### Decision

Approve the Phase One recruiting architecture report (`docs/RECRUITING_PHASE_ONE_ARCHITECTURE.md`) without building anything yet. Adopt a new 9 value event group taxonomy (Cross Country, Distance, Middle Distance, Sprints, Hurdles, Jumps, Pole Vault, Throws, Combined Events) as methodology version 2026-2, classify 800 meters as Middle Distance and 600 meters as Sprints while keeping an other fallback bucket, rely on the existing live computed ranking view instead of hand curated ranking sets, keep the recruiting performance importer and the Results Source Manager permanently separate for now, and confirm the first launch scope as one graduation class, about 25 athletes, and one gender.

### Reason

An audit of the existing statewide school, athlete profile, and Recruit Ratings systems found that most of a recruiting platform already exists and is wired end to end, including the public recruiter search, the methodology page, and the recruit rating panel on the individual athlete profile page. The real gaps were a taxonomy mismatch, missing ranking movement history, no athlete media table, no admin preview before publishing, duplicated college interest storage, and two disconnected performance import pipelines. A small additive migration reusing every existing table, service, and security pattern was recommended instead of a rebuild.

### Alternatives considered

1. Keep the current 8 value event group taxonomy and accept that cross country and track distance share one ranking bucket.
2. Build hand curated ranking sets that can override score based sort order.
3. Connect the Results Source Manager crawler to the recruiting performance importer now instead of later.
4. Launch with a broader scope covering more than one graduation class or both genders.

### Files or systems affected

1. Recruit Ratings event catalog and event group taxonomy
2. Recruit rating methodology versioning
3. Future athlete media table
4. Future rank snapshot table
5. Admin recruiting workflow
6. Public recruiting directory and individual athlete profile page

### Follow up

Phase Two implementation (the migration, service, and admin changes listed in report sections 8 and 10) has not started. Begin only when explicitly requested, following the controlled implementation order in section 10 of the report, and update this log again when methodology version 2026-2 is actually created in the database.

## 2026 08 04 Phase Zero import and release safety cleanup

### Decision

Require complete meet identity and place data for every performance import, force imported performances to remain hidden, prevent unmatched rows from creating athlete profiles, and define exact duplicates by athlete, school, event, mark, meet, date, and place.

### Reason

The earlier importer accepted incomplete rows, ignored some admin defaults, allowed blank publication values to become public, and treated a changed source label or URL as a different performance. Those behaviors conflict with the approved Podium Watch data rules.

### Alternatives considered

1. Keep incomplete rows as drafts in the performance table.
2. Allow an import checkbox to create public athlete profiles.
3. Continue using source labels and URLs as part of duplicate identity.

### Files or systems affected

1. Performance import normalization and validation
2. Recruiting admin API and page
3. Responsive header and navigation
4. Automated validation
5. Git release hygiene

### Follow up

Applied the verified cleanup package to the real repository, reviewed the staged file list, and tested the homepage at desktop and phone widths on 2026-08-04. Build, check, and all test suites pass; the homepage, mobile menu, Explore row, and both admin recruiting import scenarios (one incomplete row, one complete matching row) were manually confirmed. Committed to a local branch. Deploy only after explicit approval, and confirm migration 03 is applied to the production Supabase project first.

## 2026 08 03 Verified Baumspage discovery

### Decision

Require the Baumspage reader to verify an event page, exact season date, and season specific results page before creating a meet catalog record.

### Reason

The first reader treated navigation and archive labels as meets. Source discovery must save fewer dependable records instead of many uncertain links.

### Files or systems affected

1. Results Source Manager
2. Baumspage discovery
3. Failed batch cleanup

### Follow up

Test a 50 link 2025 cross country batch locally before approving any sources.

## 2026 08 03 Baumspage event identity and diagnostics

### Decision

Read the meet title, location, and date from separate page elements, limit verification concurrency to four requests, and return grouped rejection reasons to the admin interface.

### Reason

The live Baumspage event page does not place its location and date inside the meet heading. The earlier parser therefore rejected every real event without explaining why.

### Files or systems affected

1. Baumspage event verification
2. Results Source Manager feedback
3. Local discovery stability

### Follow up

Run a 50 link 2025 cross country batch and review actual verified meet rows before approving them.

## Decision template

### Date

YYYY MM DD

### Decision

Describe what was decided.

### Reason

Explain why this option was chosen.

### Alternatives considered

Record the main alternatives.

### Files or systems affected

List the affected areas.

### Follow up

Record anything that still needs review.

## 2026 08 03 Operations Center

### Decision

Create one read only admin Operations Center that combines the highest priority work from the existing Podium Watch systems.

### Reason

Podium Watch now has several strong management systems. A central dashboard reduces the time needed to find pending claims, reports, missing results, incomplete meet pages, content drafts, award status, notification failures, analytics, and sponsor readiness.

### Alternatives considered

1. Replace the existing Meet Manager with a new admin application.
2. Merge every management form into one page.
3. Keep all systems separate and rely only on bookmarks.

### Files or systems affected

1. Admin navigation
2. Meet Center
3. Team Manager
4. Team schedules
5. Team content
6. Weekly awards
7. Engagement
8. Analytics
9. Sponsors

### Follow up

Complete live local testing before deployment. Keep the dashboard read only until the existing workflows have been used enough to identify which safe quick actions should be added.


## 2026 08 03 Statewide school foundation

### Decision

Create a separate official Ohio school identity and division assignment layer instead of storing every official fact only on public team pages.

### Reason

School identity, division history, public team ownership, rankings, meets, athlete profiles, and recruiting tools have different responsibilities. A separate official layer gives each system one stable school reference while preserving community managed team content.

### Alternatives considered

1. Continue using only school name text on every feature.
2. Replace all existing team pages with newly imported records.
3. Store only the current boys cross country division directly on team pages.

### Files or systems affected

1. Ohio school directory
2. Team directory
3. Team pages
4. Tournament data
5. Operations Center
6. Global search
7. Admin imports
8. Future athlete profiles
9. Future recruiter search

### Follow up

Run the migration, preview the real database import, review conflicts, and confirm the public directory before deployment.

## 2026 08 03 Recruit Ratings and performance history

### Decision

Create an original Podium Watch numerical and one through five star recruiting evaluation system that can only be published after sourced event group performance evidence is recorded.

### Reason

Track and cross country performances are measurable, but recruiting value also requires context. Separating source evidence from editorial evaluation makes the system useful while protecting trust.

### Alternatives considered

1. Copy another media company rating format and terminology.
2. Generate stars automatically from one performance.
3. Let reported college offers determine the score.
4. Publish ratings without source requirements.

### Files or systems affected

1. Athlete performances
2. Athlete profiles
3. Recruiting database
4. Recruiting methodology
5. Recruiting activity
6. Admin performance imports
7. Operations Center
8. Global navigation and search

### Follow up

Run migration 03, import a small official result set, publish one reviewed rating, review mobile layouts, and document any score rubric changes as a new methodology version instead of silently changing published history.

## 2026 08 11 Race Command Center architecture

### Decision

Build Race Command Center as its own route section (`/race-command-center/`, four sub-pages) with a 9-table additive schema, rather than folding it into the existing team-roster/team-schedule flat-route pattern or inventing a second design system for Live Race Mode. Race data (splits, targets, goals) is coaching data and is structurally kept out of every verified-performance/results/rankings table -- the API layer never writes to those tables at all. No team-score calculation exists anywhere in the codebase for this feature.

### Reason

The feature is genuinely multi-screen (Plan/Race/Review), matching how `/rankings/` and `/recruiting/` already use sub-paths, not a single flat tool like `/team-roster/`. Keeping race data structurally separate from verified performances protects the site's core promise (results shown publicly are real and verified) from a coach's live-timing data, which is inherently approximate (hand-timed splits, not chip timing) and never should auto-promote into a permanent athlete record. A real cross country team score requires field-position data (which finisher beat which) that this project does not capture from hand-recorded splits alone -- computing one anyway would be presenting a number as authoritative that isn't.

### Alternatives considered

1. Nest under `/team-*` flat routes to match every other coach tool.
2. Auto-promote a race's Finish splits into `athlete_performances` once a race is marked finished.
3. Compute an approximate team score from finish order alone, labeled "unofficial."

### Key implementation decisions worth recording

1. **No sync-state column server-side.** A `race_splits` row existing in Supabase already means it's synced; sync state (pending/synced) is tracked only in the browser's IndexedDB store. Avoids an entire class of stale-sync-flag bugs, at the cost of sync state not being visible to a second device until that split has actually synced.
2. **Review is computed on demand**, never stored, from `race_splits` + `race_targets` + `race_participants`. Can never go stale, and a future Race Replay feature can reuse the same computation with zero migration.
3. **`client_split_id` (client-minted, `pw_rcc_`-prefixed, unique) is the real idempotency key** for split sync -- mirrors the `pw_`-prefixed voter-token pattern already used by AOTW/TOTW, the first place in this codebase a client mints its own dedup key rather than the server deriving one.
4. **The timer's source of truth during a live session is `performance.now()` (monotonic)**; `Date.now()` is recorded once, at the deliberate start press, purely as a post-refresh recovery anchor, and recovered elapsed time is explicitly tagged lower-precision in the UI, never presented as identical to live-session precision.
5. **Participant status transitions (scheduled -> started -> finished) are atomic, guarded database updates** (`... WHERE status = 'scheduled'`, `... WHERE status NOT IN ('dns','dnf')`), not read-then-write application logic -- a real race condition (a delayed split push reverting an explicit DNF back to "started") was found via the required manual simulation and fixed this way; see `docs/SESSION_LOG.md`, 2026-08-11.
6. **Undo clears a split back to "not recorded" rather than restoring a specific prior value.** The full correction history is preserved in `race_split_revisions` either way (an append-only audit log); Undo just doesn't offer a redo-stack UI in Phase One. A coach undoing a mistake re-taps fresh.
7. **Checkpoints are fixed at race creation; there is no in-place checkpoint editor in Phase One.** A coach fixes a checkpoint mistake by deleting the still-draft race (draft-only deletion already exists) and recreating it.
8. **DNS/DNF status changes are a direct, immediate network call, not part of the local-first offline queue** that splits use. This is the one part of Live Race Mode that currently requires connectivity at the moment it's used; recording splits themselves never does.
9. **Goals B and C are reference ambition markers only** (a time, shown in review) -- only Goal A drives Live Race Mode's live target/diff/coaching-cue math and gets full per-checkpoint targets. The schema does not preclude adding B/C targets later.

### Files or systems affected

1. `install/11_RACE_COMMAND_CENTER.sql` (new tables)
2. `lib/race_math.mjs`, `lib/race_command_center_service.mjs` (new)
3. `api/race-command-center/*.js` (new)
4. `public/scripts/race-math.js`, `race-timer.js`, `race-local-store.js`, `race-command-center-{hub,plan,live,review}.js` (new)
5. `src/pages/racecommandcenter*.mjs` (new)
6. `src/lib/html.mjs`, `scripts/check.mjs`, `scripts/build.mjs` (the new `/race-command-center/` prefix added to all three private-route lists -- confirmed there are exactly three, not two, by grepping for an existing private prefix)
7. `public/scripts/team-dashboard.js` (new dashboard button)

### Follow up

Decide whether/when to build the explicitly deferred pieces (multi-device live sync, public athlete share codes, a course template database, true field-position-based team scoring, official-result promotion, season analytics) -- none are precluded by this schema, none are built yet. Revisit the DNS/DNF-requires-connectivity limitation if it proves to matter in real coach use. Full detail in `docs/SESSION_LOG.md`, 2026-08-11.

## 2026 08 11 Team Workspace Phase One architecture

### Decision

Build the first slice of a season-long Team Workspace (Team Home + Team Meet Center) as a pure presentation/aggregation layer over existing tables -- **no new database migration** -- rather than inventing new schema for team schedule, meet operations, or race groups.

### Reason

A repository audit (3 parallel Explore passes) found that the two things this phase most needed -- a team-to-meet linking system and multi-coach permissions -- already exist and are fully built: `team_meet_connections`/`team_meet_requests` (`api/team/schedule.js`) already is the real team schedule, and `team_members.role` (`owner`/`editor`, `api/team/access.js`) already handles multiple coaches with a claim/approval flow and a last-owner-removal safeguard. `race_sessions.meet_id` already references `meets(id)` (added with Race Command Center) but was never used at the application layer. Building new schema for any of this would have duplicated real, working systems rather than connecting them. This is also the safest possible Phase One: no migration to run, no new authorization surface to get wrong -- both new pages reuse `api/team/schedule.js`'s exact `requireMembership()` shape (suspended/archived/merged/editing-locked checks), not a lighter version of it.

### Key implementation decisions worth recording

1. **Team Meet Center's "create a race for this meet" calls Race Command Center's existing `sessions.js` "create" action directly, with `meet_id` pre-filled.** There is exactly one code path that creates a `race_sessions` row, not two -- `lib/race_command_center_service.mjs` was not modified at all by this phase.
2. **Race "readiness" ("7 of 7 race plans ready") is computed on demand** from `race_participants` + `race_goals` (a participant counts as ready once they have a Goal A), not a stored column -- matches the "review is computed on demand, never stored" precedent from Race Command Center's own migration.
3. **`athlete_performances`/`athlete_profiles` were deliberately left untouched.** The audit found a rich, already-established trust-level vocabulary there (`source_type`, `verification_status`, `result_status`) and confirmed `athlete_performances` has no `meet_id` FK at all (`meet_name`/`meet_date` are free text) -- this phase does not attempt to bridge Race Command Center data into that system, matching the existing, explicit boundary already stated in `install/11_RACE_COMMAND_CENTER.sql`.
4. **Persistent, reusable "race groups" (a named group of athletes reused across races) were deliberately deferred.** `race_participants.race_group` (free text, set per race) already covers Phase One's real need; a cross-race, named group entity is real future schema, not built now.
5. **Noted but explicitly out of scope**: `athlete_best_performances` (a real SQL view computing all-time-best-per-event) is fetched by `api/athletes/detail.js` but never rendered by `public/scripts/athlete-profile.js` -- dead data on a live page, unrelated to this feature, worth fixing separately.

### Alternatives considered

1. A new `team_schedule_entries` table independent of `team_meet_connections` -- rejected, would have duplicated a real, working system.
2. A third `team_members.role` value (e.g. `assistant_coach`) -- rejected; `editor` already serves that purpose today, and the two-role allow-list lives only in `api/team/access.js` (plus two `<option>` lists in `team-dashboard.js`), so adding a third role later is a small, contained change if ever needed.
3. Persistent named race groups in Phase One -- rejected as premature; deferred per the spec's own phase boundaries.

### Files or systems affected

1. `lib/team_workspace_service.mjs` (new) -- reads `team_pages`, `team_members`, `team_seasons`, `team_roster_entries`, `team_meet_connections`, `meets`, `race_sessions`, `race_participants`, `race_goals`; writes nothing except via Race Command Center's own `createSession()`.
2. `api/team/home.js`, `api/team/meet-center.js` (new)
3. `src/pages/teamhome.mjs`, `src/pages/teammeetcenter.mjs` (new), `public/scripts/team-home.js`, `public/scripts/team-meet-center.js` (new)
4. `src/lib/html.mjs`, `scripts/check.mjs`, `scripts/build.mjs` -- `/team-home/` and `/team-meet-center/` added to all three private-route lists
5. `public/scripts/team-dashboard.js` -- new "Team home" button on `renderOwnedTeams()`

### Follow up

Decide whether/when to build Phase Two (athlete access, personal race plans/review history) and Phase Three (parent/follower access, live team following with public/private split control) -- both explicitly deferred per the spec's own phasing, neither precluded by anything built here. Revisit `athlete_best_performances` being dead code on the athlete profile page as a small, separate fix. Full detail in `docs/SESSION_LOG.md`, 2026-08-11.

## 2026 08 13 Athlete Access (Team Workspace Phase Two) architecture

### Decision

Give athletes their own signed-in view of their race plan and review through a **coach-issued invite** (a coach generates a one-time invite from the roster for a specific `team_athletes.id`; there is no open self-serve signup), scoped in this pass to **race plan + review only** (no PR/season-best history). Two new tables (`athlete_invites`, `athlete_accounts`); invite tokens reuse `lib/engagement_service.mjs`'s existing plain-hash `createToken()`/`hashToken()` pair rather than introducing a new HMAC secret; consent is a single flag, not the three-flag pattern `athlete_social_links` uses for public-facing content.

### Reason

Both scope choices came directly from the user via `AskUserQuestion`. A coach-issued invite keeps identity verification anchored to someone who already knows the athlete (the coach), rather than building open signup with no way to confirm a stranger claiming to be "Jane Smith" actually is her. Keying invites and account links off `team_athletes.id` (not `athlete_profiles.id`) was required by a real, pre-existing data-shape finding: a cross-team transfer usually creates a second, duplicate `athlete_profiles` row, so `athlete_profiles.id` is not safely 1:1 with a real person across their career -- `team_athletes.id` (the concrete roster record a coach is looking at) is. Reusing `createToken()`/`hashToken()` instead of AOTW/TOTW's HMAC pattern is because AOTW's HMAC exists specifically to compensate for client-influenced, weaker tokens; a server-generated 256-bit random token needs no additional keyed hash, and reusing an established helper avoided a new secret entirely. The lighter single-flag consent (versus `athlete_social_links`'s three flags) reflects a real difference in stakes: the three-flag pattern gates *publishing to the public internet*; this feature gates *viewing already coach-controlled, non-public data the coach explicitly invited the athlete to see* -- the coach has already vouched for identity by generating the invite in the first place.

### Alternatives considered

1. Open self-serve athlete signup (pick your team/name from a list) -- rejected; no way to verify identity without a coach in the loop.
2. Key invites/links off `athlete_profiles.id` -- rejected once the transfer-duplication finding came up; would have silently mismatched a transferred athlete's history.
3. Reuse AOTW/TOTW's HMAC-secret token pattern -- rejected as unnecessary rigor for a server-generated token with no client influence; would have added a secret for no real security gain.
4. Reuse `athlete_social_links`'s three-flag consent pattern -- rejected as mismatched stakes; that pattern exists for public publishing, this feature gates private viewing of coach-controlled data.

### Key implementation decisions worth recording

1. **`race_coach_notes` is structurally excluded from `getAthleteRaces()`** -- confirmed live it has no visibility/approval column at all (0 rows, 6 plain columns), so there is no mechanism to selectively expose it yet. The join deliberately never touches that table.
2. **Revocation is a status flip (`athlete_accounts.status = 'revoked'`), never a delete** -- matches Race Command Center's established "traceable, not destructive" pattern (its Undo/revision model).
3. **Athlete Home has no required `?id=` query param**, unlike every coach tool -- an athlete's identity (every active `athlete_accounts` link for the signed-in user) drives the view, not a team selection.
4. **Two real, pre-existing, previously-undiscovered bugs found and fixed as a byproduct of needing real roster data to test against** (production had zero rows in both tables before this work): `team_seasons.year` (a separate, real, `NOT NULL` column from `season_year`) was never populated by `createSeason()`/`saveSeason()`; `team_roster_entries.athlete_name` (a separate, real, `NOT NULL` denormalized column) was never populated by `save_athlete`. Both fixed with a minimal, additive field addition to the existing insert/update payloads in `lib/team_roster_service.mjs`. Neither bug is related to Athlete Access itself -- they were blocking real verification, not caused by this feature's design.

### Files or systems affected

1. `install/12_ATHLETE_ACCESS.sql` (new tables: `athlete_invites`, `athlete_accounts`)
2. `lib/athlete_auth.mjs`, `lib/athlete_access_service.mjs` (new)
3. `api/athlete/invite.js`, `api/athlete/me.js`, `api/athlete/races.js` (new); `api/team/roster.js` (new dispatch branch)
4. `src/pages/athletelogin.mjs`, `src/pages/athletehome.mjs` (new); `public/scripts/athlete-login.js`, `public/scripts/athlete-home.js` (new)
5. `src/pages/teamroster.mjs`, `public/scripts/team-roster.js` (new invite section in the existing athlete edit dialog)
6. `src/lib/html.mjs`, `scripts/check.mjs`, `scripts/build.mjs` (`/athlete-login/` and `/athlete-home/` added to all three private-route lists)
7. `lib/team_roster_service.mjs` (the two unrelated bug fixes above)

### Follow up

Decide whether/when to build Phase Three (parent/follower access, live team following with explicit public/private split controls) -- not precluded by anything built here. Decide whether/when `race_coach_notes` ever gets a real visibility/approval mechanism, which would be required before any athlete-facing coach-note feature could be built. Full detail in `docs/SESSION_LOG.md`, 2026-08-13.

## 2026 08 16 Admin dashboard redesign

### Decision

Replaced the admin section's flat, hand-coded 15-button nav grid (screenshot supplied by the user: a wall of black-bordered buttons under a "Meet Manager" heading) with a persistent sidebar present on every `/admin/*` page, plus a real dashboard landing page, badge counts, a quick-jump search, and browser-local pinned/recent tools. Split what used to BE `/admin/` (1184 lines: the Meet Manager tool with a nav grid stapled to the top of it) into a true dashboard (`/admin/`) and its own route (`/admin/meets/`). Visual language is a hybrid: the brand's existing black/green/Impact-font/sharp-corner chrome for the sidebar and nav, denser hairline-bordered cards (no shadows, no rounding) for data-dense areas like the needs-attention panel and stat tiles.

### Reason

The user asked for three things: easier navigation between tools, a professional look, and feature ideas they hadn't thought of. An audit before planning found the real problem wasn't cosmetic -- `/admin/` wasn't a dashboard at all, and every other admin page hand-picked 2-3 "related tool" links, different and inconsistent per file, with no way back to most of the other 13 tools short of returning to `/admin/` first. A persistent, complete sidebar directly fixes that. The needs-attention panel and badges reuse Operations Center's already-computed, already-correct prioritized task list (extracted, not rewritten) rather than inventing a second implementation that could drift out of sync with it.

### Key implementation decisions worth recording

1. **Nav config is one shared array (`src/lib/adminnav.mjs`), not per-page hardcoded links.** Mirrors the existing `src/lib/tools.mjs` pattern. Read at build time by every admin page and mirrored to the browser as `window.PODIUM_ADMIN_NAV` for client-side badge/search rendering.
2. **The shell is entirely static, server-rendered HTML.** This is a build-time static site generator with no per-request server rendering -- badges, pins, recent-tools, and quick-jump are all added client-side on top of markup that already works with JS disabled. The admin CSS/script are injected once in `layout()` (a new `pathname.startsWith("/admin/")` branch, the only edit to that shared file) rather than per-page, which is what made migrating pages one at a time safe.
3. **Badge/needs-attention data is a payload projection, not a new query set.** `lib/operations_service.mjs` (new) holds `getDashboard()`, extracted verbatim from `api/admin/operations.js` with zero behavior change; a new `summarizeDashboard()` projects `{tasks, summary}` (~8KB) for the new `api/admin/dashboard-summary.js` endpoint, versus the full response's hundreds of KB. Server-side query cost (~24 parallel Supabase queries) is unchanged in this pass -- the win is payload size and a stable contract a future cheap-count-query optimization can drop behind with zero client changes.
4. **Pinned/recent tools are `localStorage`-only, by necessity not choice.** `lib/admin_auth.mjs` has a single shared password and no per-admin identity of any kind -- there is no server-side place to store "this admin's" preferences.
5. **Quick-jump had a real collision to solve, not just build.** `public/scripts/site.js` already binds Ctrl/Cmd+K and `/` on `document` in the bubble phase for the public search dialog. The admin shortcut is registered with `{ capture: true }` plus `stopPropagation()`, which runs before site.js's handler ever fires -- confirmed live that a naive second bubble-phase listener would have opened both dialogs on the same keypress.
6. **Four hrefs found pointing at a permanent dead end, fixed honestly rather than guessed at.** Four Operations Center tasks (AOTW/TOTW scheduling/announcing) pointed at `/admin/` under the label "Open award management" -- there has never been an admin award-management tool anywhere in this codebase (`api/aotw/*`/`api/totw/*` have no `isAdminRequest` gate at all). Repointed to `/admin/operations/` with the honest label "Review award status" (Operations Center's own awards section really does show AOTW/TOTW phase); building the missing tool itself is a separate, unstarted feature.
7. **`public/scripts/admin.js` renamed to `admin-meets.js`, content untouched.** Confirmed precisely (not assumed) that it was loaded by exactly one page and is not shared session infrastructure -- it throws immediately on any page missing `[data-meet-form]` (15+ unguarded `querySelector` calls at module top level), so the safest possible move for the Meet Manager split was a verbatim rename, not a retype.

### Two real bugs found live during Playwright verification, both fixed (not test-script workarounds)

1. **A CSS positioning bug**: pin buttons were positioned `position: absolute` relative to the whole group container (`.admin-nav-group-items`) instead of their own row, so every pin button in a multi-item group rendered at the same point -- clicking one tool's pin button actually activated a different tool's. Fixed by wrapping each nav item + pin button pair in its own `.admin-nav-row` positioning context.
2. **A stale-session bug**: `admin-shell.js` fires its dashboard-summary fetch unconditionally the moment its script runs, which on a fresh, not-yet-authenticated `/admin/` load happens before the login form is even submitted -- it memoized an "anonymous" 401 result that a successful in-page login never refreshed, so badges/stats stayed empty until a manual reload. Fixed by having the login success handler explicitly bypass the memoized cache for one fresh, now-authenticated fetch.

A third finding was a limitation in the verification harness itself, not the app: the local test server only read request bodies for POST, but `api/admin/meets.js`'s DELETE handler legitimately expects a JSON body too (which real Vercel functions parse regardless of method) -- fixed in the harness, not the app.

A fourth, real bug surfaced only by the user's own manual browsing of a persistent local preview, not by any scripted Playwright check: `bodyClass: "admin-shell"` put that class on `<body>` itself, and the sidebar's own grid wrapper `<div>` was independently also named `admin-shell` -- the identical class. The bare `.admin-shell { display: grid; ... }` rule matched both, silently making `<body>` itself a 2-column grid and dragging the real header/main/footer into it (visible as an overlapping header and a footer squeezed into a ~268px column). Fixed by renaming the wrapper to `.admin-layout`. Worth remembering: every automated check this session drove exact known routes and never rendered a full page the way a person scrolling through it actually would -- that gap is exactly what caught this one.

### Alternatives considered

1. Redesign only the `/admin/` landing page, leaving each tool page's own hand-picked back-links as-is -- rejected; doesn't fix the actual complaint (getting *between* tools, not just getting *to* the dashboard).
2. A full SaaS-style rounded-corner/shadow visual overhaul matching Operations/Engagement Center's own existing inline styles -- rejected in favor of the hybrid; keeps the site's actual brand identity intact rather than replacing it.
3. Server-backed personalization (a lightweight admin-accounts table) -- rejected as out of scope; would require redesigning the single-shared-password auth model this pass doesn't touch.
4. Leaving Meet Manager on `/admin/` and only redesigning the nav portion above it -- rejected; `/admin/` needed to become a real, fast dashboard, and Team Manager already established the "give it its own route" precedent.

### Files or systems affected

1. `src/lib/adminnav.mjs`, `src/lib/adminshell.mjs`, `src/styles/admin.css` (new) -- shared nav config, shell wrapper, admin-only CSS (never touches `src/styles/main.css`, which two test suites assert literal text against)
2. `src/lib/html.mjs` -- one new conditional branch in `layout()`
3. `public/scripts/admin-shell.js`, `public/scripts/admin-dashboard.js` (new)
4. `src/pages/admin.mjs` (rewritten: 1184 lines -> ~150, now the dashboard) and `src/pages/adminmeets.mjs` (new, the extracted Meet Manager)
5. `public/scripts/admin.js` renamed to `admin-meets.js`, content unchanged
6. `lib/operations_service.mjs` (new, extracted) and `api/admin/dashboard-summary.js` (new); `api/admin/operations.js` shrunk to a thin handler
7. All 14 other `src/pages/admin*.mjs` files -- mechanical migration to `adminShell()`
8. `scripts/test-recruiting-foundation.mjs` -- one-line fix (reads the moved literal strings from `lib/operations_service.mjs` instead of `api/admin/operations.js`)

### Follow up

Fold Operations Center's and Engagement Center's own ~350/~30-line inline `<style>` blocks (their own competing rounded-corner/shadow language, left untouched this pass since their class-prefixed selectors can't collide) into `admin.css`'s shared primitives once proven. Decide whether/when to build a real admin award-management tool, now that the dead-end links pointing nowhere have at least been made honest. Consider container queries for the sidebar's ~296px width impact on mid-width (1200-1440px) tool pages, currently mitigated only by the manual sidebar-collapse control. Full detail in `docs/SESSION_LOG.md`, 2026-08-16.

## 2026 08 16 Team Workspace Phase Three: guardian & spectator access

### Decision

Built the final stage of Team Workspace -- Race Command Center -> Team Home/Meet Center -> Athlete Access -- from a one-line spec repeated three times across the docs and nothing deeper: "parent/follower access, live team following with explicit public/private split controls." Delivered two distinct new tiers on top of a shared projection module rather than one blended experience:

1. **Guardian access**: a coach-invited, signed-in account (`guardian_invites`/`guardian_accounts`, file-for-file mirroring `athlete_invites`/`athlete_accounts` from Athlete Access) that sees its own linked athlete's goals/targets/splits -- never another participant's -- plus, when the coach has separately made a race spectator-visible, a full leaderboard of every runner in it (names/times/checkpoints only).
2. **Anonymous spectator access**: a brand-new public route, `/race/?race=<id>`, showing real-time-ish (polled, ~10s while live) checkpoints, names, and times for a single race -- gated entirely on a new per-race, coach-controlled, off-by-default `race_sessions.spectator_visible` flag. No account, no follower list involved.

Both tiers are served by one new shared module, `lib/race_viewer_service.mjs`, with explicit field allow-lists per tier instead of each caller writing its own `select("*")`.

### Reason

Four scoping questions were resolved directly with the user before design started (all "Recommended"): guardian access is a distinct tier from a lighter anonymous follower tier, not one experience; "live" means polling, not websockets; visibility is coach-controlled per race, off by default; and the existing (dormant) `team_followers`/`team_follows`/`results`-category notification system should be extended, not duplicated. A planning pass (Explore + Plan agents, independently re-verified against the real code before implementation) corrected the initial synthesis on three points: a guardian is not a full race viewer (would leak other athletes' private goals/targets); the public surface had to be a new top-level route, not Team Meet Center (fully coach-gated, no public path exists); and the new column is `spectator_visible`, not `followers_visible` (avoids confusion with the distinct `team_followers` table).

### A real, previously-unknown, already-live bug found and fixed as part of this pass

`lib/race_command_center_service.mjs`'s `getSessionDetail()` did `select("*")` on `race_participants` with **no join to `team_athletes`** -- `display_name` never existed on the row, so `public/scripts/race-command-center-live.js` and `race-command-center-review.js`'s `participant.manual_name || participant.display_name || "Runner"` fallback showed the bare word "Runner" for every roster-linked participant on the coach's own Live Race Mode and Review pages, today, in production. Fixed via a new shared `resolveParticipantNames()` in `race_viewer_service.mjs` (joins `team_athlete_id` -> `team_athletes`), used by `getSessionDetail()` and reused by all three viewer tiers. Reverified live: real names now render correctly on the coach's pages as a direct byproduct of this fix.

### Two more real findings fixed in the same pass

1. `lib/athlete_access_service.mjs`'s `getAthleteRaces()` did `select("*")` on `race_sessions`/`race_goals`/`race_targets`/`race_splits`/`race_checkpoints`, over-exposing internal columns (`device_id`, `created_by_user_id`, `client_split_id`, unbounded `metadata`) to an athlete's own browser. Refactored onto the same shared `race_viewer_service.mjs` allow-list projection the guardian tier uses, with zero behavior change to what an athlete is actually allowed to see -- confirmed live (goals/targets still render correctly; internal columns confirmed absent from the raw response).
2. A guardian-tier revocation design bug caught and fixed **before** it ever shipped: an early draft scoped `revokeGuardianAccess` by `team_athlete_id` (mirroring `revokeAthleteAccess`), which would have silently revoked *every* guardian linked to that athlete at once. Since more than one guardian per athlete is the normal case here (two parents), it was rescoped to revoke by the specific `linked_via_invite_id` instead -- verified live with two real guardians on the same athlete: revoking one leaves the other's access untouched.

### Alternatives considered

1. One blended "follower" experience instead of two tiers -- rejected per the user's own confirmed decision; a guardian's relationship to a specific athlete's private plan is fundamentally different from an anonymous spectator's.
2. A full push/websocket live system -- rejected as over-engineered for this site's real scale; a short-interval poller with tab-visibility pause and error backoff (`public/scripts/race-poll.js`, new, also reusable by the guardian home page) covers the real requirement.
3. `api/race/public.js` as GET with CDN caching (a real, if less-common, precedent for this exact idea already exists in `api/recruiting/index.js`) -- rejected in favor of keeping this repo's universal POST convention; the polling interval/backoff/visibility-pause design already bounds load adequately at this site's scale, and a GET-cached route can be revisited later if real traffic ever demands it.
4. Combining `api/guardian/*` into one file -- rejected in favor of mirroring Athlete Access's real, already-established 3-file split (`invite.js`/`me.js`/`races.js`) exactly, for consistency.

### Files or systems affected

`install/13_GUARDIAN_AND_SPECTATOR_ACCESS.sql` (run in Supabase, confirmed live) -- `race_sessions.spectator_visible`, `guardian_invites`, `guardian_accounts`; `lib/race_viewer_service.mjs` (new, shared 3-tier projection); `lib/race_command_center_service.mjs` (Runner-bug fix, `spectator_visible` toggle, live/finished notification wiring); `lib/athlete_access_service.mjs` (refactored onto the shared projection); `lib/guardian_auth.mjs`, `lib/guardian_access_service.mjs` (new, mirror the athlete-tier equivalents); `api/guardian/invite.js`, `api/guardian/me.js`, `api/guardian/races.js`, `api/race/public.js` (new); `api/team/roster.js` (new `GUARDIAN_ACCESS_ACTIONS` dispatch, mirroring `ATHLETE_ACCESS_ACTIONS`); `api/teams/detail.js` (new `live_races` field); `src/pages/racepublic.mjs`, `guardianlogin.mjs`, `guardianhome.mjs` (new); `src/pages/teamroster.mjs`, `teamprofile.mjs`, `racecommandcenter.mjs` (extended); `public/scripts/race-poll.js`, `race-public.js`, `guardian-login.js`, `guardian-home.js` (new); `public/scripts/team-roster.js`, `team-profile.js`, `race-command-center-hub.js` (extended); `src/lib/html.mjs`, `scripts/check.mjs`, `scripts/build.mjs` (new private-route entries for `guardian-login/`/`guardian-home/`, and the new public `/race/` route registration).

### Follow up

Notification wiring reaches only the existing anonymous `team_followers` audience (those opted into the `results` category) -- a guardian's own access is direct sign-in, not follower-list-based, by design. `api/team/roster.js` was found to have zero `public_visible` filtering on the roster response today -- a real, pre-existing gap, unrelated to this migration's new tables, noted but not fixed in this pass. Full detail in `docs/SESSION_LOG.md`, 2026-08-16.

## 2026 08 18 Photographer Network Phase One: database foundation and public directory

### Decision

Built the first phase of a statewide Ohio sports-photography discovery directory: `/photographers/` (search by school, city, region, or sport) and `/photographers/profile/?slug=` (public profile), backed by six new tables and an admin-only management tool at `/admin/photographers/`. Sourced from a detailed user-written product spec covering the full long-term vision (self-service accounts, meet coverage, galleries, billing, analytics); Phase One deliberately scopes to just the database foundation, public directory, and admin-managed publication workflow -- no photographer-facing accounts, no billing, no meet-coverage/gallery linking yet.

A Phase Zero repository audit ran first (see `docs/SESSION_LOG.md`, 2026-08-18) and found: zero prior photographer feature of any kind (only an unrelated photo-credit byline field on team content items), zero lat/long or geocoding infrastructure anywhere in the project, and zero Stripe/billing infrastructure anywhere in the project -- all three confirmed by direct repo search, not assumed.

### Reason

The audit's two "zero" findings directly shaped Phase One's real scope: without geocoding, "nearby" search had to be plain city/county/region text matching, not distance math -- reusing `ohio_schools`' existing Central/East/Northeast/Northwest/Southeast/Southwest athletic-district taxonomy for the region dimension rather than inventing a second one. Without any billing infrastructure, Phase Four (billing) is a from-scratch build whenever that's prioritized, not a "reuse existing" -- `photographer_plans` is seeded now as a config table (four named tiers, `price_cents` left null) so pricing is never hardcoded into a template later, but carries zero billing logic today.

### Key implementation decisions worth recording

1. **`photographers` + `photographer_members` mirrors `team_pages` + `team_members`** -- identity and ownership as two separate tables, not a single `owner_user_id` column. `photographer_members` isn't populated by anything yet (no self-serve photographer account system exists until Phase Two), but the shape is right from the start.
2. **Public profile pages are query-string-driven (`/photographers/profile/?slug=`), not baked per-record at build time.** `/stories/<slug>/` and the seed-file-backed `/athletes/<slug>/` pages both use build-time generation, but only because they're backed by files/JSON bundled in the repo. Photographer data lives entirely in Supabase and changes without a code deploy (admin-managed), so it follows `/team/?slug=`'s pattern instead -- a real, confirmed distinction, not a stylistic choice.
3. **A real build-breaking bug caught before commit**: the two public-facing page templates (`photographers.mjs`, `photographerdetail.mjs`) initially imported `SPORTS`/`REGIONS` directly from `lib/photographer_service.mjs`, which imports `supabaseAdmin` at module load time -- and `scripts/build.mjs` runs with zero Supabase env vars by design (the static build never touches the database). This crashed `npm run build` immediately. Fixed by extracting the two constants into a new, dependency-free `lib/photographer_constants.mjs` that both the service file and the build-time page templates can safely import.
4. **A real API bug caught during live verification, not by inspection**: `adminUpdatePhotographer()` initially re-validated every core field (including requiring `business_name`) on every update, so a status-only "approve this listing" call failed with a confusing 400. Fixed so update only touches fields the caller actually sent -- create still requires the full set.
5. **`status` and `public_visible` are two independent gates** on `photographers` -- `status` is the publication workflow (draft/submitted/pending_review/approved/rejected/suspended), `public_visible` is a separate admin kill-switch that can hide an otherwise-approved listing without walking it back through the whole status workflow. Both public read paths (`listPublicPhotographers`, `getPublicPhotographerBySlug`) require both.
6. **Verification is deliberately two-state (`unverified`/`verified`)**, per the spec's own explicit caution against implying an unsupported background-check claim -- never auto-set to `verified` on payment (there's no payment yet regardless).

### Alternatives considered

1. Clean per-photographer static URLs (`/photographers/<slug>/`, as the original spec suggested) generated at build time, matching `/stories/<slug>/` -- rejected in favor of the query-string pattern once the audit confirmed team/athlete "seed" pages are backed by bundled files, not live Supabase data; a directory the admin edits constantly cannot be static-baked without a rebuild per edit.
2. A single `photographers.owner_user_id` column instead of a join table -- rejected in favor of mirroring the established `team_pages`/`team_members` split, since Phase Two's ownership model (which hasn't been designed yet) may need more than one owner per listing, exactly like team accounts already do.
3. Building photographer image upload/Storage now -- rejected per the spec's own explicit caution about not becoming responsible for hosting large photo libraries; `image_url` fields are plain text URLs in Phase One (admin-entered or externally hosted), with a real upload pipeline (mirroring `install/08_TEAM_MEDIA_UPLOADS.sql`'s pattern) deferred as an explicit future decision, not silently built.

### Files or systems affected

`install/14_PHOTOGRAPHER_NETWORK.sql` (run in Supabase, confirmed live) -- `photographers`, `photographer_members`, `photographer_sports`, `photographer_service_areas`, `photographer_portfolio`, `photographer_plans`; `lib/photographer_constants.mjs` (new), `lib/photographer_service.mjs` (new); `api/photographers/index.js`, `api/photographers/detail.js`, `api/admin/photographers.js` (new); `src/pages/photographers.mjs`, `photographerdetail.mjs`, `adminphotographers.mjs` (new); `public/scripts/photographers.js`, `photographer-detail.js`, `admin-photographers.js` (new); `src/lib/adminnav.mjs` (new Photographer Network nav item), `src/config/site.mjs` + `src/lib/html.mjs` (new "Find a Photographer" primary nav entry), `scripts/build.mjs` (route registration).

### Follow up

Phase Two (photographer self-service accounts, ownership, submission workflow) is the next planned stage -- see `docs/SESSION_LOG.md`, 2026-08-18 for the full phased roadmap the user specified. `api/team/roster.js`'s pre-existing missing `public_visible` filtering (noted in the previous entry) remains unrelated and unfixed. No lat/long exists; true distance-based "nearest photographer" sorting remains a distinct future decision requiring a geocoding service, not assumed or faked in this pass.

## 2026 08 18 Photographer Network Phase Two: self-service accounts and ownership

### Decision

Gave photographers their own accounts: open self-serve signup (mirroring team/coach signup, since no one invites a photographer the way a coach invites an athlete), a dashboard to create and edit their own listing, manage their own sports/service areas/portfolio, and submit for review. Admin approval (the only path to `status = 'approved'`, and the only way to set `featured`/`founding_photographer`/`verification_status`/`plan_id`) stays exactly as Phase One built it, untouched.

### Reason

This was the explicitly-approved next phase from the user's own roadmap. The core risk in this phase is obvious and singular: one photographer editing another photographer's listing. Every self-service write and read in `lib/photographer_service.mjs` is ownership-checked against the real signed-in user via a new `requirePhotographerOwnership()` (`lib/photographer_auth.mjs`) before anything happens -- never inferred from the request body's `id` alone.

### Key implementation decisions worth recording

1. **Admin-only fields are structurally unreachable through the self-service path, not just validated away.** `updateMyPhotographerListing()` only ever calls `corePhotographerFieldsForUpdate()`, which iterates a fixed field list that does not include `status`/`featured`/`founding_photographer`/`verification_status`/`plan_id` at all -- there is no `if (body.status) fail(...)` guard to accidentally miss or forget to add later; those keys are simply never read from the request body by this function, structurally. Confirmed live: a request that explicitly includes `status: "approved", featured: true` in the body succeeds (200) but the persisted row is provably unaffected.
2. **The self-service `update`/`set_sports`/`set_service_areas`/`add_portfolio_item`/`remove_portfolio_item`/`detail` actions reuse the exact same underlying functions the admin tool uses** (`adminSetSports`, `adminSetServiceAreas`, `adminAddPortfolioItem`, `adminRemovePortfolioItem`, `adminGetPhotographer`) -- the "admin" prefix on those names is now a little imprecise (they're really shared, ownership-agnostic mutators), but avoiding duplicated logic was judged more valuable than a naming cleanup that would touch more files for no functional change.
3. **A flat 12-image portfolio cap**, enforced server-side in `selfAddPortfolioItem()`, not just suggested in the UI -- there are no plan-based limits yet (Phase Four, unbuilt), so this is a placeholder ceiling, not a real tiered system. Confirmed live: the 13th image is rejected with 409.
4. **Submission is a one-way, narrowly-gated transition**: `submitMyPhotographerListing()` only allows `draft`/`rejected` -> `submitted`, never touches any other status, and rejects re-submitting an already-submitted listing (409) rather than silently no-op'ing or erroring unhelpfully.

### Alternatives considered

1. Reusing `lib/team_auth.mjs` directly instead of a new `lib/photographer_auth.mjs` -- rejected, matching this project's own explicit, repeated convention (`lib/athlete_auth.mjs`/`lib/guardian_auth.mjs`'s own header comments) of separate, purpose-specific auth modules over one shared generic one, so error copy stays audience-appropriate.
2. A single combined "save everything" endpoint instead of separate `update`/`set_sports`/`set_service_areas`/`add_portfolio_item` actions -- rejected in favor of matching `api/admin/photographers.js`'s own action-dispatch shape exactly, so the admin and self-service paths stay structurally parallel and easy to compare.

### Files or systems affected

`lib/photographer_auth.mjs` (new); `lib/photographer_service.mjs` (extended: `getMyPhotographerListings`, `getMyPhotographerListing`, `createMyPhotographerListing`, `updateMyPhotographerListing`, `submitMyPhotographerListing`, `selfSetSports`, `selfSetServiceAreas`, `selfAddPortfolioItem`, `selfRemovePortfolioItem`); `api/photographer/create.js`, `api/photographer/me.js`, `api/photographer/profile.js` (new); `src/pages/photographerlogin.mjs`, `photographerdashboard.mjs` (new); `public/scripts/photographer-auth.js`, `photographer-dashboard.js` (new); `src/pages/photographers.mjs` ("Manage your listing" CTA added); `src/lib/html.mjs`, `scripts/check.mjs`, `scripts/build.mjs` (new private-route entries for `photographer-login/`/`photographer-dashboard/`).

### Follow up

Phase Three (meet coverage and gallery links) is next per the user's roadmap. The 12-image portfolio cap and the still-unpriced `photographer_plans` rows are both explicit placeholders pending Phase Four (billing), which has zero existing infrastructure to build on. Image hosting is still plain external URLs, not a real upload pipeline.

## 2026 08 18 Photographer Network Phase Three: meet coverage and galleries

### Decision

Connected photographers to real Podium Watch meets: a photographer can mark "I'm covering meet X" (self-published immediately) and post a link to their own external gallery for a meet (held for a quick admin approval first). The existing, live `/meetdetail/` page now shows a "Photographers covering this meet" / "Galleries from this meet" section, added safely and additively.

### Reason

This was the next approved phase from the user's roadmap. The two new record types carry genuinely different risk, so they get genuinely different gates: coverage is just a flag ("I plan to be there"), essentially no risk, self-published the moment a photographer adds it. A gallery is an external URL posted under a real meet's name -- a more conservative, reversible choice (hold for one admin click) was made instead of auto-publishing, matching this project's general preference for the safer default when a detail isn't explicitly forced one way.

### Key implementation decisions worth recording

1. **Never invent or duplicate a meet.** Both `photographer_meet_coverage.meet_id` and `photographer_galleries.meet_id` reference the real `meets` table directly (same "references a table this repo's migrations never created, because it predates the install/ convention" situation as `team_pages`/`team_athletes` in earlier migrations). The dashboard's meet picker searches the real, existing public `/api/meets/` list (reused as-is, not duplicated) and only ever submits a real `meet_id` -- confirmed live that a fabricated meet id is rejected with 404, never silently accepted.
2. **The meet-page integration is deliberately fail-silent and non-blocking.** `loadMeetPhotographers()` in `public/scripts/meet-detail.js` is called via `.catch(() => {})` right after the real meet renders -- if the new fetch fails for any reason, the existing meet page (which has worked in production for weeks) is completely unaffected. Both new sections start `hidden` and only reveal themselves once real data arrives.
3. **Reused the exact ownership-check pattern from Phase Two** (`requirePhotographerOwnership`) for both new record types -- confirmed live that photographer B is rejected (403) adding coverage or removing a gallery on photographer A's listing, exactly like the Phase Two properties.
4. **The admin moderation queue is a distinct top-level panel**, not folded into the per-photographer editor -- an admin reviewing new galleries doesn't want to hunt through every photographer's individual page to find what's pending.

### Alternatives considered

1. Requiring admin approval for meet coverage too, matching galleries -- rejected as unnecessary friction for something that carries essentially no risk (a flag, not a public URL); reserved the conservative gate for the genuinely higher-risk record type.
2. A dedicated new meet-search API endpoint -- rejected in favor of reusing the existing public `/api/meets/` list client-side (the same approach Meet Center itself already uses), avoiding a duplicate system for the same data.

### Files or systems affected

`install/15_PHOTOGRAPHER_MEET_COVERAGE.sql` (run in Supabase, confirmed live) -- `photographer_meet_coverage`, `photographer_galleries`; `lib/photographer_service.mjs` (extended: `selfAddMeetCoverage`/`selfRemoveMeetCoverage`/`selfAddGallery`/`selfRemoveGallery`, `adminUpdateGalleryStatus`/`adminListPendingGalleries`, `getMeetPhotographers`); `api/photographer/profile.js` (new actions), `api/admin/photographers.js` (new actions), `api/meets/photographers.js` (new, public); `src/pages/photographerdashboard.mjs` (meet search + coverage/gallery forms), `photographerdetail.mjs` (Upcoming Coverage / Recent Galleries sections), `adminphotographers.mjs` (pending-galleries moderation panel); `public/scripts/photographer-dashboard.js`, `photographer-detail.js`, `admin-photographers.js` (extended); `src/pages/meetdetail.mjs` + `public/scripts/meet-detail.js` (new, hidden-by-default, fail-silent sections).

### Follow up

Phase Four (billing) is next per the roadmap, with zero existing payment infrastructure to build on. No email notification exists yet for gallery approval/rejection, matching Phase Two's same open item for listing approval.

## 2026 08 18 Photographer Network Phase Four: entitlement layer (Stripe deliberately not implemented)

### Decision

Built the database and entitlement architecture for photographer billing -- deliberately stopping short of an actual Stripe integration. The original spec was explicit: "Do not immediately implement a payment provider... build the database and entitlement architecture first, then show me the proposed Stripe implementation before adding billing." That two-step gate was followed exactly: real entitlement tracking exists and is wired to one real feature (portfolio limits) today, and a full Stripe integration proposal was written up separately for approval, not built.

### Reason

Actual billing needs decisions only the user can make -- final pricing, a real Stripe account, webhook secrets -- none of which exist yet (confirmed zero Stripe/billing infrastructure in the Phase Zero audit). Building a fake or partial Stripe integration without those would mean either inventing business decisions or writing dead code around missing credentials. The entitlement layer, in contrast, is fully real and functional today: an admin can manually activate a photographer's plan (e.g. an early photographer who paid outside of Stripe) and it genuinely changes what that photographer can do.

### Key implementation decisions worth recording

1. **One row per photographer (`photographer_subscriptions`, unique `photographer_id`), not a billing-event history table.** Tracks whether the plan already recorded on `photographers.plan_id` (Phase One) is actually paid and current -- deliberately not a second place to store *which* plan, avoiding duplication.
2. **`stripe_customer_id`/`stripe_subscription_id` exist as real columns today, holding null in every row.** They're shaped for a future webhook handler to write into directly, with zero schema change needed later -- but nothing here fabricates Stripe data now.
3. **"Active" requires two things, not one, and both were proven live**: `status = 'active'` AND (`current_period_end` is null OR still in the future). Confirmed directly: assigning a plan alone (subscription left `inactive`) does not raise the portfolio limit; activating it with a past `current_period_end` also does not, even though `status` still says `'active'` -- a stale status can never outlive its own expiration date.
4. **The one real feature wired to entitlement this pass is the portfolio limit** (12 baseline, unchanged for everyone; up to 25/50 for Featured/Pro once actually active) -- picked specifically because it can only ever *increase* a limit, never take away something that already worked in Phase One/Two. `featured`/`founding_photographer`/`verification_status` stay fully independent, admin-controlled flags, not auto-derived from payment -- preserving the admin's own editorial control exactly as the original spec required ("Admins retain final publication control").
5. **A real, previously-shipped gap fixed in passing**: `photographers.plan_id` existed since Phase One but was never actually exposed in the admin UI -- there was no way for an admin to assign a plan at all. Added the missing dropdown (populated from the real `photographer_plans` rows, not hardcoded) as part of making entitlement genuinely usable end to end.

### The proposed Stripe implementation (not built -- presented for approval)

Per the spec's own gate, this is a written proposal only:

- **Checkout**: a new `api/photographer/checkout.js`, authenticated, creates a real Stripe Checkout Session for the photographer's chosen plan and redirects to Stripe's own hosted page -- Podium Watch never touches a card number.
- **Webhook**: a new `api/stripe/webhook.js`, verified against `STRIPE_WEBHOOK_SECRET`, handling `checkout.session.completed`, `customer.subscription.updated`, and `customer.subscription.deleted` -- each writes directly into the existing `photographer_subscriptions` row (status values were chosen in this migration to already match Stripe's own subscription-status vocabulary, so the webhook needs no status-mapping logic).
- **Price IDs**: stored on `photographer_plans` as a new nullable `stripe_price_id` column (not yet added -- would ship with the actual integration), never hardcoded into a template.
- **Self-service management**: a Stripe Customer Portal link from the dashboard for upgrade/downgrade/cancel, rather than building a second billing UI.
- **Required from the user before this can be built**: a real Stripe account, final pricing for the four tiers, and `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`/`STRIPE_PUBLISHABLE_KEY` set as environment variables (values only, never pasted into chat or committed).

### Alternatives considered

1. Building the full Stripe integration now with placeholder/test-mode keys -- rejected; the spec explicitly asked to show the proposal first, and real pricing/account setup are the user's decisions, not something to invent.
2. Auto-setting `featured` when a photographer's plan includes it -- rejected in favor of keeping publication/featuring decisions fully admin-controlled, independent of payment, matching the spec's explicit editorial-independence requirement.

### Files or systems affected

`install/16_PHOTOGRAPHER_BILLING.sql` (run in Supabase, confirmed live) -- `photographer_subscriptions`; `lib/photographer_service.mjs` (extended: `getSubscription`, `adminSetSubscription`, `adminListPlans`, `getPortfolioLimit` wired into `selfAddPortfolioItem`); `api/admin/photographers.js` (new `set_subscription`/`list_plans` actions); `src/pages/adminphotographers.mjs` (plan dropdown, Billing panel), `photographerdashboard.mjs` (read-only plan/status banner); `public/scripts/admin-photographers.js`, `photographer-dashboard.js` (extended).

### Follow up

Awaiting the user's decision on Stripe account setup and final pricing before Phase Four's actual payment code is written. Phase Five (analytics) is next per the roadmap if billing is deferred further.

## 2026 08 19 Photographer Network Membership Pricing Finalized

### Decision

Replaced the placeholder Basic/Featured/Pro tier concept from Phase Four with the real, finalized business model: ONE Photographer Network membership, sold as two recurring Stripe subscriptions -- monthly ($7.99/mo) and annual ($39.99/yr, marked Best Value, saving $55.89 over twelve monthly payments). Both intervals grant identical core features; normal directory functionality (listing, search visibility, portfolio, meet coverage, galleries) has never required payment and still doesn't. Annual members additionally receive one Podium Watch partnership announcement story, granted once and never reset on renewal. Founding Photographer stays a separate, permanent, admin-awarded badge, independent of billing. This is still the entitlement-architecture-only stage -- Stripe itself remains unconnected, per the same gate Phase Four established.

### Reason

The user finalized real pricing and explicitly rejected the old differentiated-tier model: "Do not make photographers pay more to receive normal directory functionality," "Remove the current concept where Basic, Featured, and Pro plans unlock different portfolio limits or different core functionality." The old `PLAN_PORTFOLIO_BONUS` gating (Featured=25, Pro=50 images) was a placeholder invented before real pricing existed; it directly contradicted the final model and had to come out, not just get new numbers.

### Key implementation decisions worth recording

1. **Migration 17, not an edit to migration 16.** Migration 16 was already confirmed applied to production. Every change here is additive -- five new nullable/defaulted columns on `photographer_subscriptions`, one new child table (`photographer_partnership_stories`), and a data-only UPDATE/INSERT against `photographer_plans` (Basic/Featured/Pro/"Founding Photographer" flipped to `active = false` using the retirement mechanism that column already had since install/14; a single new "Photographer Network Membership" row inserted). Nothing dropped, nothing deleted.
2. **No stored "membership entitlement status" column, deliberately.** Whether a membership is currently entitled to perks stays a derived read (`status = 'active'` AND `current_period_end` null or future), exactly like Phase Four already proved correct -- storing that as a second column would just create a second source of truth that can drift, which is the exact bug Phase Four's own tests were written to catch. The user's spec asked the database to "distinguish" this fact at minimum; distinguishing it correctly meant computing it, not duplicating it.
3. **`partnership_story_status` lives on `photographer_subscriptions` (workflow), submitted content lives on `photographer_partnership_stories` (data) -- mirroring the existing `photographers.status` / `photographer_portfolio` split**, not inventing a new pattern.
4. **Eligibility is granted in exactly one place, `adminSetSubscription`, as a side effect, and is provably one-way.** A photographer becomes eligible only the instant a subscription is confirmed `status = 'active'` AND `billing_interval = 'annual'` AND their `partnership_story_status` is still `'not_eligible'`. Once granted, nothing in this codebase ever moves it backward -- a later downgrade to monthly, a cancellation, or repeated monthly&harr;annual switching never re-grants a second story and never revokes the first. This directly satisfies "Do not accidentally award multiple partnership stories because someone changes plans repeatedly" and doubles as the manual stand-in for what a future Stripe subscription-update webhook will do for the UPGRADING requirement.
5. **Publishing the actual announcement story still goes through the normal editorial content pipeline** (a real Markdown file under `content/stories/`, reviewed and committed like any other article) -- `photographer_partnership_stories` is an intake/review record, not a second CMS, and nothing here auto-publishes photographer-submitted text. This directly satisfies "Podium Watch should retain editorial review before publication."
6. **Portfolio limit is now flat for everyone** (`SELF_SERVICE_PORTFOLIO_LIMIT = 12`, unchanged from Phase Two) -- `getPortfolioLimit()` and `PLAN_PORTFOLIO_BONUS` were deleted outright, not adjusted. There is no remaining path in this codebase where paying more changes what a photographer can do with their listing, satisfying "do not make photographers pay more to receive normal directory functionality" as a structural fact, not a policy someone has to remember to enforce.
7. **Founding Photographer required no schema change.** `photographers.founding_photographer` (install/14) was already a plain boolean with no expiry column and no dependency on `plan_id` -- it was already exactly what the spec asked for (a separate, permanent, admin-awarded badge). The one thing that DID need fixing was the confusing "Founding Photographer" row that existed in `photographer_plans` since install/14, conflating the badge with a selectable plan tier -- retired along with Basic/Featured/Pro.
8. **Stripe price ids and dollar amounts are centralized in one new file, `lib/photographer_membership_config.mjs`** (pure data + `process.env` reads, zero imports, safe at build time -- same reasoning as `lib/photographer_constants.mjs`). Every dollar figure shown anywhere (admin billing form, dashboard membership cards, the public pricing page) reads from this one file; none are duplicated as string literals. `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` are deliberately never re-exported from here or any module a browser script could reach.
9. **A real, adjacent gap fixed in passing**: `getMyPhotographerListings()` (the dashboard's initial-load path) never actually attached subscription data, unlike the singular `getMyPhotographerListing()` -> `adminGetPhotographer()` path -- so the old plan banner was effectively decorative on first load, always falling back to its "not yet active" default. Fixed via a new `attachOwnSubscriptions()` helper, applied to `getMyPhotographerListings`, `updateMyPhotographerListing`, and `submitMyPhotographerListing` -- deliberately NOT folded into the shared `attachChildren()`, which also backs the public directory and admin list views where subscription/billing facts must never appear.

### Alternatives considered

1. Keeping `photographer_plans` as the source of truth and adding a `stripe_price_id` + `billing_interval` column directly on it -- rejected because a "plan" now maps to exactly one product either way; billing facts belong with the subscription record (which already exists, already handles the active/expired distinction, and already an established pattern), not duplicated onto the plan-catalog table.
2. Auto-creating a `photographer_partnership_stories` row at the moment eligibility is granted (before any content exists) -- rejected in favor of creating it lazily on first submission; `partnership_story_status` on the subscription already answers "eligible with nothing submitted yet" without an empty placeholder row.
3. A stored, webhook-writable "membership entitlement status" enum -- rejected; see key decision #2 above.

### Files or systems affected

`install/17_PHOTOGRAPHER_MEMBERSHIP_PRICING.sql` (new, NOT yet run in Supabase -- awaiting the user); `lib/photographer_membership_config.mjs` (new -- centralized pricing/Stripe config); `lib/photographer_service.mjs` (`PLAN_PORTFOLIO_BONUS`/`getPortfolioLimit` removed; `getSubscription`/`adminSetSubscription` extended; new `getMyPartnershipStory`/`submitMyPartnershipStoryInfo`/`adminListPartnershipStories`/`adminUpdatePartnershipStory`; new `attachOwnSubscriptions` helper); `api/admin/photographers.js`, `api/photographer/profile.js` (new actions); `src/pages/adminphotographers.mjs` (Plan dropdown removed, Billing panel extended, new Partnership Stories queue), `photographerdashboard.mjs` (plan banner replaced with a real Membership panel + Partnership Story section), `photographermembership.mjs` (new public pricing page), `photographers.mjs`/`photographerlogin.mjs` (pricing page links); `public/scripts/admin-photographers.js`, `photographer-dashboard.js` (extended); `scripts/build.mjs` (new route); `.env.example` (documented, not-yet-set Stripe variable names).

### Follow up

Migration 17 needs to be run in Supabase before any of this is live. The actual Stripe checkout/webhook integration remains unbuilt, same gate as Phase Four -- needs a real Stripe account, and `STRIPE_SECRET_KEY`/`STRIPE_PUBLISHABLE_KEY`/`STRIPE_PRICE_ID_MONTHLY`/`STRIPE_PRICE_ID_ANNUAL`/`STRIPE_WEBHOOK_SECRET` as environment variables. No email notification exists yet for membership activation or partnership-story status changes, matching every earlier phase's same open item.

## 2026 08 19 Photographer Network Real Stripe Integration

### Decision

Built the real Stripe checkout, billing portal, and webhook integration proposed (but deliberately not built) in Phase Four -- the user obtained real Stripe API keys and asked for full test mode. Added `lib/stripe_client.mjs`, `lib/photographer_billing_service.mjs`, `api/photographer/checkout.js`, `api/photographer/billing-portal.js`, and `api/stripe/webhook.js`. The dashboard's "Manage membership" section now calls real endpoints instead of the `mailto:` placeholder.

### Reason

The user provided a Stripe secret + publishable key and asked to proceed. Migration 17's entitlement architecture and the shared eligibility-grant logic (already proven correct for the admin-manual path) made this a matter of wiring a second, real trigger for the exact same write path, not inventing new entitlement logic.

### A real secret key exposure was caught and flagged

The user pasted a Stripe-Dashboard-generated Ruby sample (`server.rb`) containing what is very likely their own real test-mode secret key (Stripe auto-fills its downloadable code samples with the developer's actual key). Flagged this immediately as exposed and told the user to roll it in the Stripe Dashboard before using it -- this codebase never received, stored, or echoed the actual key value at any point; every reference is `process.env.STRIPE_SECRET_KEY`, read only at the point of use.

### Key implementation decisions worth recording

1. **One shared write path, not two.** `adminSetSubscription` was refactored to extract its upsert logic into a new exported `upsertSubscriptionFields(photographerId, fields)` in `lib/photographer_service.mjs` -- the SAME function is now called by the admin-manual path AND the new Stripe-webhook path (`applyStripeSubscriptionEvent` in the new `lib/photographer_billing_service.mjs`). The "grant partnership-story eligibility exactly once, never reset" guarantee therefore lives in exactly one place regardless of which path triggers a subscription change -- there was no way for the two paths to drift apart because there is only one path.
2. **All subscription-state writes are driven off `customer.subscription.created/updated/deleted`, never `checkout.session.completed`.** This is Stripe's own recommended pattern (checkout.session.completed doesn't reliably carry full subscription state); the user's own pasted Ruby sample listens to the same three subscription events, confirming this matches Stripe's documented guidance, not just this codebase's preference.
3. **Stripe status values are mapped, not passed through raw.** `incomplete`/`incomplete_expired`/`unpaid`/`paused` all map to our `'inactive'`, never `'active'` -- directly satisfies "a failed or incomplete payment should not activate membership."
4. **`billing_interval` is derived from the subscription's actual Stripe price id** (compared against `STRIPE_PRICE_ID_MONTHLY`/`STRIPE_PRICE_ID_ANNUAL`), never trusted from anywhere else -- so a portal-driven monthly<->annual switch is recognized correctly the moment Stripe confirms it, satisfying the UPGRADING requirement without any manual proration logic of this codebase's own invention.
5. **The "cancel stays active through the paid period" requirement needed zero new code.** Portal-initiated cancellation fires `customer.subscription.updated` with `cancel_at_period_end: true` while `status` stays `'active'` until the period genuinely ends -- the existing `isSubscriptionActive()` derivation (status='active' AND period not yet passed), already proven correct in Phase Four for the admin-manual case, handles this real Stripe case identically with no changes.
6. **The webhook requires the RAW, unparsed request body** for signature verification -- `export const config = { api: { bodyParser: false } }` disables Vercel's automatic JSON parsing for this one route, and the handler buffers the raw bytes itself before calling `stripe.webhooks.constructEvent()`. Getting this wrong (parsing then re-stringifying) silently breaks every signature check; this is the first raw-body endpoint in the project.
7. **Webhook failures return 500, not 200, so Stripe retries.** Every write here is an idempotent upsert (`onConflict: photographer_id`), so a retried delivery after a transient failure is safe -- deliberately different from "always ack 200" advice that would silently drop events on a real database hiccup. Only a bad signature returns without retry (400) -- retrying a forged/malformed request would never succeed.
8. **`payment_status` has exactly one writer.** `applyStripeSubscriptionEvent` never touches it; only `invoice.payment_succeeded`/`invoice.payment_failed` do, directly. Kept deliberately separate from the subscription-status write path so a coarser status-derived guess can never overwrite the more precise, payment-specific signal.
9. **Checkout is for a photographer's FIRST subscription only.** Switching monthly<->annual on an EXISTING subscription goes through the Stripe-hosted Customer Portal (`createMyBillingPortalSession`), not a second Checkout Session -- creating a second Checkout Session for an existing customer risks two separate subscriptions rather than one updated one. The Portal's price-switching option itself is a one-time Stripe Dashboard configuration step (Settings -> Billing -> Customer portal), outside this codebase.
10. **Success/cancel/return URLs use `site.siteUrl`** (`src/config/site.mjs`), matching this project's existing single source of truth for the canonical domain, rather than deriving an origin from request headers (no existing precedent for that in this codebase, and `site.siteUrl` is already used for canonical/sitemap purposes).

### Alternatives considered

1. Trusting `checkout.session.completed` to write initial subscription state -- rejected per Stripe's own guidance; `customer.subscription.created` fires for the same event and reliably carries the full subscription object.
2. Deriving `payment_status` from subscription.status inside `applyStripeSubscriptionEvent` (a second writer) -- rejected in favor of a single writer (invoice events only), avoiding exactly the kind of two-source drift this whole design has otherwise been careful to avoid.
3. Building a second, webhook-specific eligibility-grant check instead of extracting `upsertSubscriptionFields` -- rejected; the entire point of centralizing it was to make a second implementation impossible, not merely unlikely.

### Files or systems affected

`lib/stripe_client.mjs` (new -- server-only Stripe SDK singleton, throws clearly at import if `STRIPE_SECRET_KEY` missing, mirrors `lib/supabase-admin.mjs`'s own pattern); `lib/photographer_billing_service.mjs` (new -- checkout/portal session creation, webhook event appliers); `lib/photographer_service.mjs` (`adminSetSubscription` refactored to share `upsertSubscriptionFields`, now exported); `api/photographer/checkout.js`, `api/photographer/billing-portal.js` (new, self-service, ownership-checked); `api/stripe/webhook.js` (new, signature-verified, raw body); `src/pages/photographerdashboard.mjs`, `public/scripts/photographer-dashboard.js` (Manage Membership section now calls real endpoints); `package.json`/`package-lock.json` (new `stripe` dependency, v22).

### Follow up

Still blocked on: migration 17 has not been confirmed run in Supabase; `STRIPE_PRICE_ID_MONTHLY`/`STRIPE_PRICE_ID_ANNUAL` don't exist yet (no Product/Prices created in the Stripe Dashboard); `STRIPE_WEBHOOK_SECRET` can't be obtained until `api/stripe/webhook.js` is actually deployed and its URL registered in Stripe. No live test of the real checkout/webhook flow has been possible yet for exactly these reasons -- everything above is verified by build/syntax/import-smoke-testing only, not a live Stripe test-mode transaction.

## 2026 08 19 Photographer Network Real Stripe Prices, Complimentary Access Split, Test Suite

### Decision

Adapted the Stripe integration to the user's ACTUAL live Stripe setup (real, live Price IDs already in Vercel under `STRIPE_PHOTOGRAPHER_MONTHLY_PRICE_ID`/`STRIPE_PHOTOGRAPHER_ANNUAL_PRICE_ID`, two separate Stripe products rather than the one-product-two-prices originally sketched), added server-side duplicate-subscription prevention, split admin-manual entitlement into an explicit, separate `admin_complimentary_access` source that can never collide with real Stripe data, added out-of-order webhook protection, and added `scripts/test-photographer-billing.mjs` -- a real, substantial automated test suite for the billing logic, added to `npm test`.

### Reason

The previous pass's env var names (`STRIPE_PRICE_ID_MONTHLY`/`STRIPE_PRICE_ID_ANNUAL`) didn't match what was actually configured in Vercel; using the real names was mandatory, not optional. The user separately identified a real architectural gap in Phase Four's original manual-admin entitlement mechanism now that a real Stripe integration exists: it wrote into the SAME columns (status/billing_interval/period dates) the real webhook now needs to own exclusively, creating a genuine risk that a stale admin form save could overwrite live Stripe data.

### Key implementation decisions worth recording

1. **`install/18_PHOTOGRAPHER_STRIPE_INTEGRATION.sql`** -- additive only, migrations 16/17 untouched. Adds `stripe_price_id` (reconciliation convenience), `admin_complimentary_access`/`admin_complimentary_granted_at` (the new separate entitlement source), and `last_stripe_event_id`/`last_stripe_event_at` (out-of-order webhook protection).
2. **Complimentary access is now structurally incapable of colliding with Stripe data.** `adminSetComplimentaryAccess` (replacing `adminSetSubscription`) only ever writes `admin_complimentary_access`/`admin_complimentary_granted_at`/`admin_notes` -- never `status`/`billing_interval`/`current_period_*`/`stripe_*id`, which are Stripe-webhook-only fields now, enforced by the shared `upsertSubscriptionFields`'s "a key left out of `fields` is never touched" behavior, not by a runtime check that could be forgotten. `isMembershipActive` (new, in `lib/photographer_billing_service.mjs`) combines both sources: real Stripe entitlement OR complimentary access, either independently sufficient.
3. **Server-side duplicate-subscription prevention**, not merely a hidden button: `createMyCheckoutSession` calls `hasNonTerminalStripeSubscription` (a real subscription id present AND status not `canceled`/`inactive`) before ever calling Stripe, and refuses with a 409 directing the photographer to Manage Membership instead. A fully lapsed photographer (status `canceled`/`inactive`, or never subscribed) can always start fresh -- satisfies "a lapsed photographer should be able to resubscribe later."
4. **Out-of-order webhook protection, on top of the upsert-by-photographer_id idempotency migration 16 already provided.** `last_stripe_event_at` records the `created` timestamp of the last event actually applied; a redelivered OLDER event (Stripe does not guarantee delivery order) is detected and skipped via the new pure `isStaleStripeEvent` function rather than allowed to overwrite newer state with stale state.
5. **`checkout.session.completed` is now handled too** (defense in depth, not the primary sync path) -- `syncFromCheckoutSession` re-fetches the CURRENT live subscription directly from Stripe via API and runs it through the same `syncPhotographerSubscriptionFromStripe` function every other event uses, guarding against `customer.subscription.created` being delayed relative to the customer's redirect back to Podium Watch.
6. **The eligibility-grant rule was extracted into a pure, directly-testable function**, `shouldGrantPartnershipStoryEligibility(fields, existingPartnershipStoryStatus)` -- exactly the "clear internal function, easy to reason about and test" the business rule needed, and it's now covered by a real unit test simulating the annual -> monthly -> annual switching scenario specifically, proving the benefit is never re-granted.
7. **`scripts/test-photographer-billing.mjs`** (new, added to `npm test`) -- a real automated suite covering price/interval mapping, arbitrary-value rejection, duplicate-subscription prevention, story eligibility (including the switch-back-and-forth scenario), cancellation/expiration/failed-payment status handling, admin visibility without secret exposure, and migration safety, ALL as genuine assertions against real exported functions -- not placeholders. Webhook signature verification is tested with Stripe's own local HMAC crypto (`stripeClient.webhooks.constructEvent`/`generateTestHeaderString`), which requires no network call and is therefore safe and meaningful to test directly: valid signature accepted, wrong secret rejected, tampered payload rejected, malformed header rejected. What genuinely cannot be tested without a live database or live Stripe call (the actual upsert, actual cross-account ownership rejection, an end-to-end Checkout round trip) is explicitly guarded at the source level instead and named as such in the test's own output, matching this project's established pattern for Supabase-dependent test coverage.
8. **Customer Portal price-switching across two separate Stripe products** is a Stripe Dashboard configuration question, not something this code controls either way -- `createMyBillingPortalSession`'s code is identical regardless of how many products exist. Documented in the final report rather than assumed; nothing here deletes, recreates, or otherwise touches the user's live Stripe products.
9. **No client-side Stripe.js/publishable key is used or needed** -- Checkout uses a server-created Session with a real hosted-page redirect (`session.url`), never Stripe Elements, so `STRIPE_PUBLISHABLE_KEY` was removed from the config module as genuinely unused (confirmed via repo-wide search before removing it).

### Alternatives considered

1. Keeping a single "subscription" concept and adding an `is_complimentary` flag inline in `adminSetSubscription` itself -- rejected in favor of a wholly separate function with a narrower parameter list, so the "which fields can this path even touch" question is answered by the function signature itself, not by trusting every future edit to remember a conditional.
2. An event-id dedup table for webhook idempotency -- rejected as unnecessary; the upsert-by-photographer_id shape already makes exact redelivery a no-op, and the lighter `last_stripe_event_at` timestamp comparison handles the genuinely distinct out-of-order case without a second table.

### Files or systems affected

`install/18_PHOTOGRAPHER_STRIPE_INTEGRATION.sql` (new, NOT yet run in Supabase); `lib/photographer_membership_config.mjs` (env var names corrected to match the real live Vercel config; unused `STRIPE_PUBLISHABLE_KEY` removed); `lib/photographer_billing_service.mjs` (duplicate-subscription prevention, `syncPhotographerSubscriptionFromStripe`/`syncFromCheckoutSession` replacing `applyStripeSubscriptionEvent`, out-of-order guard, `isMembershipActive`); `lib/photographer_service.mjs` (`adminSetSubscription` replaced by `adminSetComplimentaryAccess`; `isSubscriptionActive`/`shouldGrantPartnershipStoryEligibility` exported); `api/admin/photographers.js` (`set_complimentary_access` action), `api/stripe/webhook.js` (`checkout.session.completed` handling, event metadata threading); `src/pages/adminphotographers.mjs`, `public/scripts/admin-photographers.js` (billing form replaced by a read-only Stripe readout + complimentary access form); `public/scripts/photographer-dashboard.js` (complimentary-access-aware status text); `src/pages/photographermembership.mjs` (exact renewal-language bullets added to each card); `scripts/test-photographer-billing.mjs` (new); `package.json` (`test:photographer-billing` wired into `npm test`); `.env.example` (corrected variable names).

### Follow up

Migration 18 not yet confirmed run in Supabase. Whether the Stripe Customer Portal can switch between the two separate products needs a one-time Dashboard check by the user (see the final report for exactly what to look for). No live checkout/webhook call has been made -- see the final report's REMAINING STRIPE SETUP section.

## 2026 08 20 Race Command Center Live Race Mode diagnostic and fixes

### Decision

Ran a full hands-on diagnostic of Live Race Mode (the split-capture tool) at the user's request -- read every relevant file, then actually drove the real production page with Playwright (mocked auth/API, a realistic 16-runner roster, mobile and desktop viewports) rather than reviewing code alone. Found and fixed one critical, confirmed bug (present on all four Race Command Center pages, not just Live) and, per the user's explicit direction after seeing the diagnostic, rebuilt three specific pieces of Live Race Mode's UX: removed the full site chrome, added live multi-device sync, and split the runner list so recorded runners move out of the primary view.

### Reason

"Full diagnostic... I want it to be easy to use" called for direct, hands-on verification, not a code-reading guess -- the critical bug below would never have been caught by reading the JavaScript alone, since the JS was setting `.hidden = true` exactly as intended; the actual defect was a CSS cascade interaction invisible without rendering the real page. After presenting the diagnostic, the user confirmed: multiple people (coach + volunteers) capture splits simultaneously on separate devices during a real race, rosters run 15-30+ (varsity + JV combined), and recorded runners should move out of the way rather than staying interleaved in a static list -- those three answers directly drove which of the "significant but debatable" findings got fixed now versus left as documented options.

### The critical bug, and why code review alone would have missed it

`element.hidden = true` was being set correctly everywhere in the JavaScript, but had ZERO visual effect on two elements: `.rcc-start-screen` (Live) and, discovered while checking the other three pages for the same pattern, `.rcc-shell` (the page root on Hub, Plan, and Review). Root cause: each of those classes sets its own `display` property (`grid` or `flex`) in the page's own `<style>` block, which has the same CSS specificity as the browser's built-in `[hidden] { display: none }` rule -- and because a page's own stylesheet loads after the user-agent stylesheet, the class rule wins the cascade regardless of the `hidden` attribute's actual state. Confirmed directly via `getComputedStyle()` in a real browser: `startScreen.hidden === true` in the DOM, `getComputedStyle(startScreen).display === "grid"`, bounding box fully visible. Concretely, on Live: the "Ready to Start?" screen -- including its own live **Start Race** button -- stayed visible, stacked above the running race, for the entire race, meaning a stray tap could reset the monotonic timer anchor mid-race. The exact same bug independently affected the Pack Capture selection bar (`.rcc-live-controls`), which was permanently visible even when pack mode was never activated.

**Fix**: one `[hidden] { display: none !important; }` rule added at the top of each of the four pages' own `<style>` blocks, forcing `hidden` to always win regardless of what any other selector on the page sets. Verified directly afterward: `getComputedStyle().display === "none"` and zero bounding-box height for both previously-affected elements.

### Key implementation decisions worth recording

1. **`layout()` gained an opt-in `chromeless` parameter** (default `false`, every other page unaffected) rather than a per-page workaround -- Live Race Mode's own code comment already claimed to be "a deliberately minimal-chrome page," but `layout()` had no actual mechanism to make that true; it unconditionally rendered the full site header (logo, hamburger menu, sport-category tabs, sticky), the full footer, and a *fixed* mobile bottom-tab bar (Home/Rankings/Meets/Stories). On a phone during a live race, that fixed bottom nav sits exactly where a coach's thumb is working -- a real risk of navigating away from a live race by accident, not just visual clutter. Live Race Mode now renders with zero site chrome beyond a small "&larr; Race Command Center" text link (the only way back, since the header is gone). Hub/Plan/Review were left with full chrome for now -- they're not the time-critical screen the user asked about, and chrome removal there is a separate, easy follow-up if wanted.
2. **Multi-device live sync added as a periodic pull, not a new endpoint.** `pullState()` (`api/race-command-center/sync.js`) already existed for "post-refresh/multi-tab recovery" per its own code comment, but was only ever called once, at initial page load -- so two devices timing the same live race (confirmed as the user's real workflow) never saw each other's captures without a full manual reload. A new `pullRemoteUpdates()` now calls it every 11s (offset from the existing 8s push interval) and reuses the SAME merge function (`loadMergedSplits()`) already proven correct at initial load: a local unsynced record (this device's own pending correction) always wins over whatever the fresh server pull just returned for that same `client_split_id`, so a periodic pull can never clobber an in-progress local edit. A cheap fingerprint comparison (splits + participant statuses) skips the re-render entirely when nothing actually changed, avoiding needless flicker on the 11s tick.
3. **The runner list splits into "Still need a time" and "Recorded at this checkpoint"** -- per the user's explicit direction. The primary list only ever shrinks as a race progresses (built specifically for the confirmed 15-30+ roster case, where scanning a static, fully-interleaved list to find who's left was a real, confirmed pain point); the compact Recorded list is sorted most-recent-first (the natural order for "let me glance at what I just did"), one line per runner (name + time + Undo) instead of a full card, freeing substantial vertical space. Pack Capture mode deliberately stayed a single unified list (splitting recorded/unrecorded doesn't make sense for "select everyone crossing right now").
4. **A second real bug was found and fixed while rebuilding the renderer, not something that was searched for**: `renderRunnerList()` did a full `innerHTML` rebuild on every single tap/undo/manual-save -- meaning mid-typing a manual-entry correction for one runner, then tapping a DIFFERENT runner, silently wiped the half-typed value and focus out of the first runner's box. Fixed by snapshotting non-empty manual-entry values (and which one was focused) immediately before every rebuild and restoring them immediately after -- confirmed directly with Playwright: type a partial value, tap an unrelated runner, confirm the original value is still there.
5. **The pre-start sync-status pill no longer shows the literal placeholder text "Checking..." forever** -- it never actually got set to a real status before the race begins (nothing to sync yet), so it looked permanently stuck. Now reads "Not started" as static, honest copy instead of implying an ongoing check that never resolves.

### Alternatives considered

1. A global `main.css` rule instead of a per-page one -- rejected for this pass; scoping the fix to each Race Command Center page's own `<style>` block keeps the fix visibly tied to the exact bug it addresses and avoids touching a site-wide stylesheet for an issue confirmed only in this feature so far (worth a broader repo-wide audit later if the same pattern turns up elsewhere).
2. Removing site chrome from all four Race Command Center pages now -- rejected for this pass; the user's request was specifically about the live split-capture tool, Hub/Plan/Review aren't time-critical in the same way, and it's a trivial follow-up once `chromeless` exists.
3. A full DOM-diffing rewrite of `renderRunnerList()` (only ever touch the specific card that changed) instead of snapshot/restore around a full rebuild -- rejected as more engineering than the actual bug (data loss in a text input) required; snapshot/restore closes the real gap with far less risk of introducing a new rendering bug.

### Files or systems affected

`src/lib/html.mjs` (`layout()` gained `chromeless`); `src/pages/racecommandcenterlive.mjs` (chromeless, hidden-attribute fix, back link, two-list markup + CSS, "Not started" copy); `src/pages/racecommandcenter.mjs`, `racecommandcenterplan.mjs`, `racecommandcenterreview.mjs` (hidden-attribute fix only); `public/scripts/race-command-center-live.js` (two-list rendering, manual-entry input preservation, periodic multi-device pull).

### Follow up

Not yet live-verified against real production Supabase/real coach accounts (the diagnostic and every fix were verified with a mocked API against the real built page, not a live database) -- worth a real end-to-end pass with two genuinely separate devices before relying on this for an actual meet. Hub/Plan/Review's full site chrome was left as-is; revisit if the user wants those minimized too. A broader repo-wide check for the same `hidden`-attribute-vs-class-display cascade bug outside Race Command Center has not been done.

## 2026 08 20 Live Race Mode per-checkpoint device selection

### Decision

Replaced the single "Advance to next checkpoint" button (one-way, sequential, confirmation-gated) with a row of tappable checkpoint tabs, letting each device freely and instantly select ANY checkpoint, with a sticky, always-visible "Recording: [checkpoint]" indicator that survives scrolling through a long roster.

### Reason

The user asked directly: can one volunteer stand at the Mile 1 marker and another at Mile 2, each easily understanding which one they're recording for? The honest answer at the time was no -- every device defaulted to checkpoint 0, moving to a later checkpoint required clicking "Advance" the right number of times with a confirmation dialog worded as if it affected the whole race rather than just this device, and there was no way back if a volunteer overshot. That directly contradicted the multi-device workflow the user had just confirmed was their real use case (see the prior diagnostic entry this same day).

### Key implementation decisions worth recording

1. **Checkpoint selection is confirmed to already be a purely local, per-device value** (`currentCheckpointIndex`, stored only in this device's own IndexedDB `race_state` record, never sent to or read from the server) -- this was already true before today's change; the gap was entirely in the UI only exposing sequential one-step "advance" as the way to change it, not the underlying architecture. This is exactly what makes two devices independently sitting on two different checkpoints simultaneously already safe -- no new sync mechanism was needed for the selection itself, only for the DATA (already built earlier today).
2. **No confirmation dialog on switching, unlike the old "Advance" button.** Switching checkpoints never discards or overwrites anything -- it only changes which checkpoint's runner list this device is currently looking at -- so the old confirmation text ("Runners still in progress here will stay recordable") no longer applies and would only add friction to a now-completely-safe, freely-reversible action.
3. **Each tab shows a live "N still needed" count**, computed the same way the main list partitions runners (excluding dns/dnf, checking for an existing split at that specific checkpoint) -- gives a volunteer an at-a-glance sanity check that they're on the right checkpoint without needing to scroll the runner list at all.
4. **The checkpoint indicator is sticky as ONE unit with the existing topbar**, not a second independently-positioned sticky element with a hardcoded pixel offset against the first -- avoids a layout fragility that would break the moment the topbar's own height changed for any reason (a longer race name, a wrapped sync-status pill, etc).
5. **Verified directly with two independent Playwright browser contexts** simulating exactly the user's described scenario: Device A defaults to Mile 1, Device B taps to Mile 2 with zero dialog, Device A is confirmed completely unaffected by Device B's switch, each device then taps a different runner, and each device's own Recorded list shows only ITS checkpoint's capture -- a runner captured at Mile 1 correctly still shows as needing a time on the Mile 2 device's list, and vice versa.

### Alternatives considered

1. Keeping "Advance to next checkpoint" as a quick-action alongside the new tabs (for a single coach who walks the course sequentially) -- rejected as unnecessary duplication; tapping the next tab directly is exactly as fast and removes an entire second interaction pattern to maintain.
2. A dropdown `<select>` instead of a row of tab buttons -- rejected; large, always-visible, one-tap buttons are more scannable and definitively larger touch targets on a phone than a native select's tap-then-choose-then-confirm flow, and directly matches this page's existing large-tap-target design language.

### Files or systems affected

`src/pages/racecommandcenterlive.mjs` (sticky checkpoint indicator, checkpoint tabs markup + CSS, removed the Advance button); `public/scripts/race-command-center-live.js` (`renderCheckpointTabs()`, `selectCheckpoint()`, removed the old advance handler).

### Follow up

Not yet field-tested with two real physical devices at a real meet -- same open item as the earlier diagnostic entry today.

## 2026 08 20 Photographer Network temporarily unpublished

### Decision

Took the entire Photographer Network offline from the live site at the user's explicit request ("I don't have it completely ready"), just after it had gone live via the earlier same-day push. Every public and self-service page (`/photographers/`, `/photographers/profile/`, `/photographers/membership/`, `/photographer-login/`, `/photographer-dashboard/`) is gone from the build (returns 404); the "Find a Photographer" nav link is removed; the checkout API endpoint itself is unconditionally disabled. The password-gated admin tool (`/admin/photographers/`) stays live so work can continue privately.

### Reason

The Photographer Network had just been pushed live minutes earlier in this same session, including a real, live Stripe integration with real price IDs already configured. Removing the PAGES alone would not have been sufficient: Vercel deploys everything under `api/` as independent serverless functions regardless of what `scripts/build.mjs` writes, so `api/photographer/checkout.js` would have stayed genuinely reachable and capable of starting a real Stripe Checkout Session even with no page anywhere linking to it. Given the user's stated concern was explicitly about readiness, not merely discoverability, an unconditional kill switch in the one endpoint that can actually move money was the only way to make "unpublished" true rather than "harder to stumble onto."

### Key implementation decisions worth recording

1. **Routes are commented out, not deleted**, in `scripts/build.mjs` -- every page template, service function, and API handler still exists untouched. Republishing later is exactly the one-line-per-route uncomment this comment documents, not a rebuild.
2. **The checkout kill switch (`CHECKOUT_ENABLED = false` in `api/photographer/checkout.js`) is checked before authentication even runs** -- unconditional, not "only shown to logged-out users." This matters because self-serve account creation was never gated behind the now-removed login PAGE in the first place (Supabase Auth is directly reachable by design, the same structural reality every other open-signup tier on this site already has) -- so hiding pages alone could not have guaranteed no real checkout session gets created.
3. **`billing-portal.js` was deliberately left untouched** -- with checkout disabled, no photographer can ever acquire a `stripe_customer_id` in the first place, and that endpoint already fails cleanly ("No billing account yet") without one. Adding a second kill switch there would be redundant, not an additional safety margin.
4. **A real, unrelated bug was caught by `npm run check` immediately after removing the pages**: the admin tool's own listing editor had a static "View directory" link to the now-gone `/photographers/`, which would have been a genuinely broken link for the admin. Removed alongside the (JS-driven, not caught by the static checker, but equally dead) "View public profile" link -- and updated `public/scripts/admin-photographers.js` to stop referencing the removed DOM node, since this project's `requiredElements`-gate pattern means a single missing element silently no-ops an ENTIRE admin script, not just the one broken feature.

### Alternatives considered

1. `git revert` the Photographer Network commits -- rejected; would also strip out the admin tool the user still wants to use, and complicates history for what's meant to be a temporary, easily-reversible state.
2. Relying on removing the nav link and pages alone, without touching the API -- rejected once the independent-deployment reality of `api/` was confirmed; would have left the actual financial risk in place while only removing its visibility.

### Files or systems affected

`scripts/build.mjs` (5 routes commented out), `src/config/site.mjs` (nav link removed), `api/photographer/checkout.js` (kill switch), `src/pages/adminphotographers.mjs` + `public/scripts/admin-photographers.js` (dangling directory/profile links removed).

### Follow up

Republishing later requires: uncommenting the 5 routes in `scripts/build.mjs`, restoring the nav link, flipping `CHECKOUT_ENABLED` back to `true`, and deciding whether the admin tool's "View directory"/"View public profile" links should come back too.

## 2026 08 20 Race Command Center surfaced on the team dashboard's main screen

### Decision

Added a "next race" banner to `/team-dashboard/` -- the actual first screen a coach sees after signing in -- and promoted the Race Command Center button from 7th-of-7 to 2nd position in each team card's action row. When a team has a race with `status = 'live'`, the banner is an unmissable "Live now" callout with a direct "Open live timing" button; for a merely scheduled/draft upcoming race, it reads "Next race" with an "Open plan" button. Reuses the exact same live-vs-upcoming distinction and visual language already proven on Team Home's own "Next up" card.

### Reason

The user asked directly: what does getting to Race Command Center from the main screen actually look like, and can it be made as easy as possible? Investigation found the honest current answer was "one click, but the button is the last of seven equally-weighted options in a dense card" -- reachable, not easy. Team Home already had a genuinely good pattern for this (a prominent "next race" card with a direct live-timing link) built in an earlier phase, but it only existed on the PER-TEAM Team Home page, one click deeper than the dashboard a coach actually lands on first.

### Key implementation decisions worth recording

1. **A new batched service function, `getNextRacesForTeams(teamIds)`, not a per-team call to the existing `buildTeamHomeSummary`.** The dashboard can list several teams at once; reusing the full Team Home summary (roster counts, recent races, meet connections) per team would mean real wasted queries for data this screen never displays. One query covers every owned/edited team's next race in a single round trip.
2. **A live race always outranks an earlier-dated but not-yet-started one**, via an explicit `isBetterNextRace` comparison (live beats non-live regardless of date, then earliest date wins among non-live) -- Team Home's own `nextRace` picks index 0 of a date-sorted list without this explicit tiebreak, which works in the common case (a live race is almost always today, so it naturally sorts first) but doesn't structurally guarantee a live race is surfaced over some other race with an earlier date in an edge case. Made explicit here since a coach mid-race needs this to be reliable, not merely usually-correct.
3. **The button reorder (Race Command Center: 7th -> 2nd) stands on its own, independent of whether a next-race banner exists.** A team in the off-season with nothing scheduled still gets a more discoverable path to Race Command Center -- the banner is the "urgent" layer, the reorder is the baseline improvement underneath it.
4. **Verified end-to-end with Playwright against three real scenarios** (live race, upcoming scheduled race, no race at all) using the real built page and script -- confirmed the correct banner/button/href appears in each case, confirmed the button reorder holds in all three, confirmed zero console errors, and visually confirmed via screenshot that the live-race banner renders above the fold, before any of the other action buttons.

### Alternatives considered

1. Only reordering the button, no banner -- rejected as insufficient; a same-weight outline button in position 2 is still just one option among many, not the unmissable race-day signal the user asked for.
2. Computing next-race per team via N separate calls to `buildTeamHomeSummary` -- rejected as wasteful; see key decision #1.

### Files or systems affected

`lib/team_workspace_service.mjs` (`getNextRacesForTeams`, new), `api/team/me.js` (`next_race` attached to each team), `public/scripts/team-dashboard.js` (banner rendering, button reorder).

### Follow up

None outstanding -- this is a complete, self-contained improvement to an already-existing screen.

## 2026 08 20 Race Day Access Codes -- Race Command Center without a full account

### Decision

Built a second, lighter-weight way into Race Command Center: a team owner/editor generates a short, human-typeable code (`XK4P7QRT`-style, 8 characters, misread-safe alphabet) from Team Home and shares it with race-day volunteers. A volunteer enters it at a new public page (`/race-command-center/join/`, now the "Race Command Center" entry in the main site nav) and is dropped straight into that team's live timing tools -- no Supabase account, no email, no password. This is deliberately a SECOND door alongside the existing full coach sign-in, not a replacement for it: roster, schedule, and content-editing tools still require a real team_members account exactly as before.

### Reason

The user was explicit: "I need a team to be able to click on the side menu and be able to access the race command center right away... type in a team code... brings you right to it. If it is not easy to find and use then teams won't do it." Directly asked whether to keep requiring a real account or build a lighter code-based door instead; the user chose the lighter option explicitly, accepting the added design surface in exchange for zero first-time setup friction for a volunteer who may only ever time one race.

### Key implementation decisions worth recording

1. **The access code and the resulting session are two different secrets, both hash-only-stored.** The code itself (`team_race_day_codes.code_hash`) is long-lived and shared out loud/via text; a volunteer who enters it gets back a completely separate, opaque 32-byte session token (`race_day_sessions.session_token_hash`) in an HttpOnly cookie. Regenerating the code deletes every session issued under the old one, so "the code leaked, make a new one" actually revokes existing access rather than just stopping new signups.
2. **One unified server-side entry point, `requireRaceCommandCenterAccess(request, teamId)`, replaces the old two-step `requireTeamUser` + `requireTeamMembership` pattern in all four `api/race-command-center/*.js` handlers.** It tries a real bearer token first, falls back to the race-day cookie, and returns the same `{ actor }` shape either way -- `actor.userId` is `null` for a code-based session, which every write path already tolerates (`created_by_user_id` was already nullable). Nothing outside these four handlers ever imports this module at all; a code grants Race Command Center access and structurally cannot reach roster, schedule, or content editing.
3. **`SameSite=Lax`, not `Strict` (unlike the admin session cookie).** This cookie has to survive a top-level navigation arriving from a shared text/QR code, not just same-site form posts.
4. **A deliberately long, 30-day session** -- much longer than the admin cookie's 8 hours -- because the design goal is a volunteer's own phone staying recognized across a whole season, not re-entering a code every meet. The much shorter blast radius if that trades wrong (per-team scoped, instantly revocable via regenerate) is what makes the longer duration acceptable here in a way it wouldn't be for the site-wide admin session.
5. **Verification never distinguishes "no such code" from "code exists but was deactivated."** Both take the identical failure path and message -- revealing that distinction would let someone probe for which codes used to be real.
6. **Rate limiting is on FAILED attempts only, by hashed IP** (`race_day_code_attempts`), matching the existing hashed-address convention already used elsewhere in this codebase (e.g. `lib/team_instagram_service.mjs`) -- a correct code is never logged there at all.
7. **A real, pre-existing bug was found and fixed while wiring this up**: all four existing Race Command Center client scripts (`race-command-center-hub.js`, `-plan.js`, `-live.js`, `-review.js`) hard-redirected to `/team-login/` before ever attempting an API call, purely because `window.PodiumTeamAuth.getAccessToken()` was empty -- which is exactly the normal, expected state for a code-based visitor who has a valid cookie the server would happily accept. Fixed by sending the bearer header only when a token exists and redirecting only on an actual 401 response from the server, in all four files.
8. **The header's nav filter has its own separate allowlist.** `src/lib/html.mjs`'s `header()` filters `site.navigation` through a smaller `primaryLabels` Set before rendering -- adding an entry to `site.navigation` alone does not make it appear in the header/hamburger menu unless the exact label is also added there. Caught and fixed while building this; also removed a stale leftover "Find a Photographer" entry from that same Set while in there.

### Alternatives considered

1. Requiring every volunteer to create a real Podium Watch account -- this was the initially recommended option, explicitly rejected by the user for adding first-time friction on race day, which was the exact problem being solved.
2. A single shared password (like the admin session) instead of a per-team code -- rejected; a team-scoped, individually-revocable secret is a meaningfully smaller blast radius than one password that would grant access to every team's live timing if leaked.
3. Letting the code itself double as the session (no separate cookie/session token) -- rejected; would mean the long-lived, spoken-out-loud secret is also the thing sent on every request, and regenerating the code would have no way to distinguish "kick out everyone using the old code" from "the code itself changed" as separate, independently useful actions.

### Files or systems affected

`install/19_RACE_DAY_ACCESS_CODES.sql` (new, not yet run against Supabase), `lib/race_day_auth.mjs` (new), `api/race-command-center/join.js` (new, public), `api/team/race-day-code.js` (new, owner-only), `api/race-command-center/sessions.js`/`sync.js`/`plan.js`/`review.js` (switched to the unified access function), `src/pages/racecommandcenterjoin.mjs` + `public/scripts/race-command-center-join.js` (new public join page), `public/scripts/race-command-center-hub.js`/`-plan.js`/`-live.js`/`-review.js` (redirect-before-fetch bug fixed in all four), `src/pages/teamhome.mjs` + `public/scripts/team-home.js` (new "Race day access" panel: generate/status/revoke), `scripts/build.mjs` (new route registered), `src/config/site.mjs` + `src/lib/html.mjs` (new nav entry, and the `primaryLabels` fix), `scripts/test-race-day-access.mjs` (new, wired into `npm test`).

### Follow up

Migration 19 was run by the user and confirmed live via a direct Supabase probe (all three tables queryable with the expected column shapes). Pushed to production (`e2cbb37`) and verified end-to-end against the real production deploy with real, disposable test data: a throwaway team, a real code, a real `join` call returning a real session cookie, that cookie granted access to a real RCC endpoint for its own team, and -- the check that matters most -- was correctly rejected (401) when tried against a different real team. Every throwaway row was deleted afterward and the deletion re-confirmed by re-querying. Still not field-tested with a real code shared to a real second physical device at an actual meet.

## 2026 08 20 Bulk-add runners on the Race Command Center Plan page

### Decision

Added two separate ways to add many runners at once, rather than one at a time, after the user flagged a real gap directly from a screenshot of the Plan page's empty-roster state. Asked the user to confirm scope first (this race only vs. the team's real season roster vs. both); they chose both:

1. **A "Paste multiple names" panel directly on the Plan page's "Add runners" section** -- a coach pastes a list (one runner per line, an optional group after a comma) and every line becomes a guest/manual participant for that one race, exactly as if they'd used the existing single "Guest runner name" field that many times.
2. **A link from the Plan page's empty-roster message to `/team-roster/`**, where a real CSV bulk-import tool (`preview_import`/`commit_import`) already existed but was invisible from the one screen a coach actually hits this gap on.

### Reason

The screenshot showed the exact real-world failure case: a team ("Russia," a test team, but representative of any real team before its roster is set up) with zero current-season roster, facing a one-name-at-a-time "Guest runner name" field as the only way to build a 20-30 person race-day roster. Investigating before building turned up that a full CSV import tool already existed on the Team Roster page (`data-import-section` in `src/pages/teamroster.mjs`, backed by real, working `preview_import`/`commit_import` actions in `lib/team_roster_service.mjs`) -- the actual problem wasn't a missing feature, it was that the feature nobody could find from the screen where the gap is actually felt. Rather than rebuild what already existed, the fix connects the two: a discoverability link for the real fix (season roster import), plus a genuinely new, smaller tool for the common case that CSV import doesn't cover well -- a one-off race with guests who aren't going on the season roster at all (a competitor's unattached runner being handed a bib, a walk-on for one meet).

### Key implementation decisions worth recording

1. **The bulk-paste feature writes into the exact same in-memory `manualParticipants` array the existing single "Add" field already uses**, rather than a parallel data path or its own save action. Every pasted name shows up as a normal "(manual, unsaved)" checkbox, pre-checked, in the same list the single-entry flow already produces -- and still isn't persisted until the existing "Save participants" button is clicked. This means zero new server-side code was needed for this half of the work; the entire feature is a client-side parsing convenience on top of a save path that was already correct.
2. **Group parsing splits each line on only the FIRST comma** (`Jordan Smith, Varsity` -> name `Jordan Smith`, group `Varsity`), so a name that happens to contain a comma doesn't get mis-split. Blank lines are silently skipped; an all-blank paste is rejected with a specific message rather than silently doing nothing.
3. **Did not rebuild the CSV import tool.** Verified directly (not assumed) that `preview_import`/`commit_import` are real, implemented actions before deciding a discoverability fix was sufficient -- rebuilding a second bulk-import mechanism when a correct one already existed would have been pure duplication.
4. **The Team Roster deep-link carries the team id** (`/team-roster/?id=<teamId>`) so a coach lands on their own team's roster tool directly, not a page asking them to pick a team again.

### Alternatives considered

1. Only building the CSV-import discoverability link, no Plan-page paste tool -- rejected; doesn't serve the one-off-guest case (a competitor's unattached runner, a walk-on for a single meet) that shouldn't go on the season roster at all.
2. Only building the Plan-page paste tool, no link to the season roster importer -- rejected; would leave a coach re-pasting their entire roster by hand for every single race, all season, when a real one-time import tool already exists for exactly that.
3. A CSV upload control on the Plan page itself, mirroring Team Roster's -- rejected as over-engineered for this screen's actual job (this race's participants), given a plain-text paste already covers the common case with far less UI.

### Files or systems affected

`src/pages/racecommandcenterplan.mjs` (bulk-paste panel markup, empty-roster import link), `public/scripts/race-command-center-plan.js` (parsing/wiring, `rosterImportLink.href` set from `teamId`).

### Follow up

None outstanding. Verified with Playwright against the real built page: empty-roster link correct, panel opens/closes, four pasted lines (mixed groups, a blank line, extra whitespace) all parsed correctly and appeared pre-checked, Save participants sent the correct names/groups through to the API, and an all-blank paste was rejected with a clear message instead of silently no-op'ing.

## 2026 08 20 CSV roster import was completely broken -- root-caused and fixed

### Decision

While pointing a real coach account at the newly-discoverable CSV import tool (the bulk-add-runners discoverability link built minutes earlier), the user hit a real failure: "The team roster request could not be completed" on every commit attempt. Investigated by reproducing the exact failure against real production with throwaway data (not guessing from reading code alone) and found the actual cause: `team_roster_entries.athlete_name` is a real, not-null, denormalized name column, and the CSV import path's database function (`team_commit_roster_import_v1`) never sets it on insert. Since `team_roster_entries` had zero real rows in production before an unrelated 2026-08-13 fix (see that entry, which fixed the same gap for the single "Add athlete" path only), this means bulk CSV roster import had almost certainly never worked for any real coach, ever -- the user was the first to actually exercise the path in production.

### Reason

`team_commit_roster_import_v1` was created directly against this Supabase project at some point outside this repo's tracked migrations -- confirmed by grepping the entire repository for its name and finding zero `CREATE FUNCTION` definitions anywhere. Its actual source is not visible or editable from here, and PostgREST's exposed schemas are `public`/`graphql_public` only (confirmed by directly attempting `pg_catalog`/`information_schema` introspection through the client and getting `PGRST106: Invalid schema`), so there was no way to read its definition either. Rewriting an entire stored procedure blind -- reconstructing insert/update/upsert semantics, conflict resolution, and summary counters I've never seen -- was judged too risky to attempt as the primary fix.

### Key implementation decisions worth recording

1. **Fixed via a schema-level workaround, not a blind rewrite of the opaque function.** `install/20_ROSTER_IMPORT_ATHLETE_NAME_FIX.sql` does two things: drops the `not null` constraint on `team_roster_entries.athlete_name` (so the existing RPC's insert/update stops erroring outright), and adds a small, new, separately-owned function (`team_backfill_roster_entry_names_v1`) that `commitImport()` in `lib/team_roster_service.mjs` calls immediately after the import RPC succeeds, setting `athlete_name` correctly from `team_athletes.display_name` -- the exact same value the already-correct single "Add athlete" save path uses. Net effect: the column is still always correctly populated in practice, just via a follow-up step this repo actually owns, verifies, and can evolve, rather than trusting an opaque function that had been silently broken since creation.
2. **Root-caused by reproducing against real production, not by reading code and guessing.** Called the exact real application function (`handleTeamRosterAction`) with the real Russia team id, real current season id, and an obviously-throwaway athlete name, and inspected the raw Postgres error (`code: 23502`, the literal failing-row tuple) rather than assuming from the generic "could not be completed" message the API surfaces. Also black-box tested several hypotheses for what the RPC might want (`athlete_name`, `firstName`/`lastName`, `name`, `full_name` -- all supplied explicitly on the input row) before concluding the function simply never sets the column at all, regardless of input; every one of these test calls failed with the same not-null violation and rolled back cleanly (Postgres function calls are transactional), so no throwaway data was ever left behind mid-investigation.
3. **The backfill function is intentionally scoped to exactly what's broken** (`update ... set athlete_name = ta.display_name where ... athlete_name is distinct from ta.display_name`), not a general-purpose "fix everything" tool -- narrow, auditable, and easy to reason about even though its counterpart function's behavior can't be inspected.
4. **The backfill call is best-effort and never undoes a successful import** -- if it fails for some reason, the import itself (already committed) still stands; only a `console.error` is logged, matching this codebase's established pattern for non-critical follow-up writes (e.g. `race_day_sessions.last_seen_at` in `lib/race_day_auth.mjs`).

### Alternatives considered

1. Rewriting `team_commit_roster_import_v1` from scratch via `CREATE OR REPLACE FUNCTION` -- rejected; without ever seeing its real source, a blind rewrite risks silently dropping or changing correct existing behavior (conflict/upsert matching, summary counts) in a function actively relied on, in exchange for fixing one column.
2. Making `athlete_name` a generated/computed column instead of a follow-up backfill call -- rejected; `team_roster_entries` has no foreign-key-enforced 1:1 relationship expressible as a simple generated-column expression in Postgres (would need a trigger anyway), and a trigger-based approach is materially the same complexity as the explicit backfill function while being less visible/debuggable from the application layer.
3. Leaving the column `not null` and instead making the JS layer pre-populate `athlete_name` inside the `p_rows` JSONB before calling the RPC -- tried first and confirmed NOT sufficient (the RPC ignores whatever key names are present on the input rows for this field), which is what led to the schema-relaxation approach instead.

### Files or systems affected

`install/20_ROSTER_IMPORT_ATHLETE_NAME_FIX.sql` (new, not yet run against Supabase at the time this entry was written), `lib/team_roster_service.mjs` (`commitImport()` gains the backfill RPC call).

### Follow up

Migration 20 was run by the user and verified directly against real production with throwaway data: the same real Russia team/season, a throwaway CSV row run through the actual `preview_import`/`commit_import` code path end to end -- confirmed the commit no longer throws, the athlete and roster entry are both actually created, `athlete_name` is non-null and matches the athlete's real `display_name` exactly, and every other field (grade, events, etc.) still comes through correctly. Throwaway data fully deleted and deletion re-confirmed afterward. Separately worth noting for awareness (not actioned here): `team_rollover_season_v1` is in the same boat as `team_commit_roster_import_v1` was -- referenced from this codebase but with no matching migration anywhere in `install/` -- so it's an equally plausible candidate for a similar undiscovered bug if/when a coach actually exercises the season-rollover feature.

## 2026 08 20 Race Command Center couldn't see a team's real roster -- second, separate sport-format bug

### Decision

Immediately after confirming the CSV import fix, the user ran their real 24-athlete import successfully -- then created a test race and found the Plan page's "Add runners" panel still said "No current-season roster found for this team," despite the roster now genuinely existing. Root-caused (again by reproducing directly against the real Russia team, not guessing) as a second, entirely separate bug from the CSV import one: `listTeamRoster()` in `lib/race_command_center_service.mjs` filtered `team_seasons.sport` by exact string equality against `race_sessions.sport`, but the two columns use two different, non-overlapping enums -- `race_sessions.sport` is `"cross_country"` / `"track"` (this file's own two-value enum), while `team_seasons.sport` is `"Cross Country"` / `"Indoor Track"` / `"Outdoor Track"` (`team_roster_service.mjs`'s three-value, Title-Case enum). The `.eq()` filter could never match, for any team, regardless of casing -- confirmed directly: the real, freshly-imported 24-athlete Russia roster returned zero results through this path before the fix and all 24 after it.

### Reason

Race Command Center was built with its own simpler sport concept (cross country vs. track, no indoor/outdoor distinction) that was never reconciled against the roster system's three-value seasonal sport enum when `listTeamRoster()` was written to bridge the two. This is architecturally the same class of bug as the CSV import issue found minutes earlier in the same session (a real column/contract mismatch between two originally-separate subsystems), but this one was fully within JS code this repo owns and could see, tested, and fix directly -- no opaque database function involved, no migration needed.

### Key implementation decisions worth recording

1. **Added an explicit map (`RACE_SPORT_TO_SEASON_SPORTS`), not a case-insensitive/fuzzy match.** The two enums aren't just differently-cased versions of the same values -- `race_sessions.sport`'s `"track"` has no indoor/outdoor concept at all, so a normalize-and-compare approach couldn't resolve it unambiguously anyway. An explicit table makes the actual mapping decision visible and easy to change if Race Command Center ever grows real indoor/outdoor distinction.
2. **`"track"` deliberately maps to BOTH `"Indoor Track"` and `"Outdoor Track"`** (via `.in("sport", seasonSports)` instead of `.eq()`), rather than picking one arbitrarily or leaving it broken -- since a race session genuinely can't say which one it means today, matching either current track season is strictly more useful than matching neither.
3. **Found precedent for the canonical snake_case sport keys already existing elsewhere** (`lib/fan_poll_service.mjs`'s `SPORT_LABELS`), confirming `cross_country`/`indoor_track`/`outdoor_track` is already this codebase's real convention for a sport enum -- useful context, though not directly reused here since `race_sessions.sport`'s own stored values are still just `cross_country`/`track` and changing that column's enum was out of scope for this fix.

### Alternatives considered

1. Loosening the season lookup to ignore `sport` entirely (match any current season for the team) -- rejected; a team running both cross country and track seasons concurrently could otherwise see the wrong sport's roster on a race plan.
2. Changing `race_sessions.sport` to the same three-value enum as `team_seasons.sport` -- rejected as a much larger, riskier change (touches every existing race session's stored value, the `cleanEnum` validation at race-session-creation time, and any other code assuming the two-value enum) for a fix that a small explicit map already resolves cleanly.

### Files or systems affected

`lib/race_command_center_service.mjs` (`listTeamRoster()`).

### Follow up

Verified directly against real production (the real Russia team/roster) before and after the fix -- no migration required, this is a pure application-code fix. Pushed and re-verified against the actual deployed API afterward (see the entry below, "Race day access code, shareable directly from the Race Command Center hub" -- that verification also incidentally re-confirmed this fix live).

## 2026 08 20 Race day access code, shareable directly from the Race Command Center hub

### Decision

After successfully setting up a real race (roster imported, goals set), the user pointed out there was no visible way to actually hand off timing duties to a volunteer -- the only place to generate/share a race day code was Team Home, a different page entirely from where a coach is actually thinking about "who's going to time this." Added the exact same generate/status/reveal-once/revoke panel already built for Team Home to the Race Command Center hub page (`/race-command-center/`) as well -- the page a coach actually lands on when setting up and managing races, which is a more natural moment to think about sharing access than the season-level Team Home page.

### Reason

Team Home is where a coach thinks about the season as a whole (roster, schedule); Race Command Center is where a coach thinks about a specific race and who's helping run it. "I need someone to help me time this" is squarely a Race Command Center thought, not a Team Home one -- the user's own confusion ("I don't see a place where I can give access code to someone") confirmed the panel was in the wrong (or at least, an insufficiently discoverable) place for how coaches actually use this tool.

### Key implementation decisions worth recording

1. **Duplicated the UI, not the backend.** Both Team Home's and the RCC hub's panels call the exact same `api/team/race-day-code.js` endpoint (status/regenerate/revoke) -- there's one source of truth for the code itself; only the surface a coach can act on it from is doubled. Regenerating from either page immediately invalidates sessions from the other's perspective too, since they're the same underlying data.
2. **The panel is conditionally hidden for a race-day-code visitor**, not just conditionally non-functional. This hub page is dual-audience (a real coach reaches it after signing in; a volunteer reaches the SAME page after entering a code, per the join flow built earlier this session) -- but only a real coach account can manage the code (`api/team/race-day-code.js` requires `requireTeamUser`, never accepts the race-day cookie by design). Rather than show the panel and let a volunteer's "Generate code" click fail with a confusing error, `initialize()` only reveals the section at all when `window.PodiumTeamAuth.getUser()` resolves to a real user -- verified directly via Playwright that the panel stays hidden AND the owner-only endpoint is never even called for a race-day-code visitor.
3. **The raw-code-shown-once behavior is preserved exactly**, including the `keepReveal` re-render guard from Team Home's implementation -- copied deliberately rather than reinvented, since it's already a correct, tested pattern.

### Alternatives considered

1. Only adding a link from the RCC hub to Team Home's existing panel (the same "discoverability link" pattern used for the CSV roster import fix earlier) -- rejected here specifically; unlike CSV import (a rare, once-a-season action where an extra page load is a minor cost), sharing a race day code is something a coach may want to do in the moment, phone in hand, and duplicating the actual panel removes a page load exactly when it matters most.
2. Moving the panel from Team Home to the RCC hub instead of duplicating it -- rejected; a coach might reasonably look for it in either place, and Team Home's placement wasn't wrong, just incomplete.

### Files or systems affected

`src/pages/racecommandcenter.mjs` (new panel markup + CSS), `public/scripts/race-command-center-hub.js` (status/generate/revoke wiring, conditional visibility).

### Follow up

None outstanding. Verified with Playwright against the real built page: panel visible and fully functional (generate reveals a code once, status flips on/off, revoke works) for a real coach; panel stays hidden and the owner-only endpoint is never called at all for a race-day-code visitor landing on the same page.

## 2026 08 20 Race day access, also on the Plan and Live pages -- the hub alone wasn't enough

### Decision

Pushed the RCC hub panel, then asked the user to go check it -- they came back with "Still dont see it." Asked a clarifying question rather than guessing, and the answer revealed the real gap: the user's actual workflow is Hub -> click "Open plan" -> click "Go to live timing," and never revisits the hub page once inside a specific race. The panel was technically correct and working, just placed somewhere their real navigation pattern doesn't return to. Added the same generate/status/reveal-once/revoke capability to both the Plan page (`/race-command-center/plan/`) and the Live page's pre-race "Ready to start?" screen (`/race-command-center/live/`), as a `<dialog>` opened from a button, rather than a permanently-visible inline panel.

### Reason

Three coach-tool RCC pages (hub, plan, live) each represent a different moment in getting ready for a race, and "I need someone to help me time this" can occur to a coach at any of them -- most acutely right before starting, which is the Live page's pre-race screen. Asking the user which exact page they were on (rather than assuming "must be a bug" or "must be cache") was the fast, cheap way to distinguish a real defect from a discoverability gap in under one round trip.

### Key implementation decisions worth recording

1. **`<dialog>`, not another permanent inline panel, on Plan and Live.** Both pages already have real work competing for screen space (roster/goals on Plan; large touch-target timing controls on Live) -- a modal opened by a button gives full access without permanently costing layout room on pages where that room matters more than it did on the hub's races-list page. Matches this codebase's own established pattern for a "management dialog" opened from a button (`teamroster.mjs`'s athlete dialog).
2. **The Live page's dialog is deliberately NOT dark-themed to match the rest of that page.** Live Race Mode is intentionally near-black with white text (a professional timing-tool look); the dialog is a self-contained light popup floating over it instead of trying to extend the dark palette into a form UI, matching how every other coach-tool dialog in this codebase already looks (and arguably improving outdoor daylight legibility for a UI element used briefly, not continuously).
3. **Same conditional-visibility rule as the hub, applied independently on each page**: the trigger button itself starts `hidden` in the HTML and is only revealed once `window.PodiumTeamAuth.getUser()` resolves to a real user, inside each page's own `initialize()`. A race-day-code volunteer can land on the Live page directly (the join flow's redirect target only reaches the hub, but nothing stops a volunteer from being sent a direct Plan/Live link too) and must never see a button that would just fail against the owner-only `api/team/race-day-code.js` endpoint.
4. **All three surfaces (hub, plan, live) call the identical `api/team/race-day-code.js` endpoint** -- no new backend code in this pass at all, only three independent front-end surfaces onto the same underlying state, consistent with the hub panel's own reasoning from minutes earlier.

### Alternatives considered

1. Moving the panel to just one "most correct" page instead of three -- rejected; the clarifying question confirmed real coaches don't reliably revisit any single page mid-workflow, so redundant access at each natural stopping point is the actual fix, not a single better location.
2. A persistent icon in the Live page's sticky topbar (visible during active timing, not just pre-race) -- deferred, not built; the user's description ("even after I click go to live timing") specifically describes the pre-race moment, which the start screen already covers. Worth adding if a coach later reports needing this mid-race.

### Files or systems affected

`src/pages/racecommandcenterplan.mjs` + `public/scripts/race-command-center-plan.js` (dialog + trigger button), `src/pages/racecommandcenterlive.mjs` + `public/scripts/race-command-center-live.js` (same, on the pre-race screen, light-themed dialog over the dark page).

### Follow up

Verified with Playwright against both real built pages: button visible and dialog fully functional (open, generate reveals once, close) for a real coach on both Plan and Live; button stays hidden and the owner-only endpoint is never called for a race-day-code visitor on the Plan page. Pushed and deployed, confirmed live via direct HTML check. The user then reported the button was still not visible on their own screen -- not yet root-caused; a stale cached page load is the leading suspect but unconfirmed, since the deployed markup and mocked-Playwright behavior are both already verified correct.

## 2026 08 20 Delete a race from Team Meet Center

### Decision

User asked for "an option to delete a meet added in there, with a pop up screen saying are you sure" -- a clarifying question narrowed "in there" down to Team Meet Center (`/team-meet-center/`), the page that lists race groups created for one scheduled meet. Confirmed that page had zero delete option for any race group at all -- only "Open plan"/"Open live timing"/"View review" links. Added a "Delete" button with a `window.confirm()` prompt, reusing the existing `api/race-command-center/sessions.js` "delete" action (the same one the Plan page's own "Delete draft" button already calls) rather than building new backend logic.

### Reason

Team Meet Center's own header comment already describes it as bridging the schedule system with Race Command Center -- "every race session tied to this meet" -- but the page was write-heavy (create) with no corresponding delete, an asymmetry the user's own workflow (apparently having created at least one race group they wanted to remove) surfaced directly.

### Key implementation decisions worth recording

1. **Reused the existing delete action and its existing restriction rather than inventing a new one.** `deleteSession()` already only allows deleting a `status = 'draft'` race that hasn't started -- exactly the same rule the Plan page's "Delete draft" button already enforces. The Delete button here only renders for a draft race group; a live/finished one shows no delete option at all, matching that existing, already-correct restriction rather than needing a new server-side rule.
2. **No new API endpoint or service function** -- this is a pure client-side addition (`public/scripts/team-meet-center.js`) calling the exact same `SESSIONS_ENDPOINT`/`action: "delete"` the Plan page uses, just with an explicit `session_id` in the payload (this page's own `apiFetch` doesn't auto-attach one the way the Plan page's does, since Meet Center manages several race groups, not one).
3. **Confirm-and-refresh, not optimistic removal** -- on success, the button shows "The race was deleted" and the whole meet center reloads via `initialize()`, so the displayed state always reflects a fresh server read rather than a client-side guess.

### Alternatives considered

1. A dedicated Meet Center delete endpoint -- rejected; the existing `sessions.js` "delete" action already does exactly the right thing (ownership check via `loadTeam`, draft-only restriction, real deletion) and Meet Center has no reason to duplicate it.

### Files or systems affected

`public/scripts/team-meet-center.js` (delete button per race row, confirm + delete + refresh).

None outstanding. Verified with Playwright against the real built page: a draft race shows a Delete button, a live race shows none at all, clicking Delete shows the confirm prompt with the expected wording, confirming sends the correct race id to the existing delete endpoint, and the list refreshes to show the race gone.

## 2026 08 20 Delete any race from the hub, restart a live race, and a much denser runner list

### Decision

Three requests arrived together after the user tried the hub's race list, hit a live-timing session with lots of runners, and thought through a false-start scenario: (1) delete a race directly from `/race-command-center/`'s own race list, not just from inside a specific race's Plan page, and for ANY status, not just drafts (their screenshot showed two already-FINISHED races with no delete option at all); (2) a way to restart a live race's clock after a false start or an accidental early Start Race press; (3) the Live page's "still need a time" runner list only fit 2-3 runners on screen at once, and needed to show 8+.

### Reason

Each of these came from the user actually operating the tool with real data (a real test race, a real 24-person roster) rather than abstract requests -- the same pattern as every fix this session, where the actual gap only became visible by using the feature for real.

### Key implementation decisions worth recording

1. **Delete now allowed for any status except "live"** (`deleteSession()` in `lib/race_command_center_service.mjs`), not just draft -- a finished "Test Race" the user wanted to clean up couldn't be deleted at all before this. "Live" is still refused (`"Finish or cancel this race before deleting it -- it may still be actively timed."`) since a race actively being timed right now may have a volunteer's device mid-sync against it; deleting it out from under them would corrupt an in-progress session, not just discard data. Every child row (checkpoints, participants, goals, targets, splits) already cascades on delete (confirmed directly in `install/11_RACE_COMMAND_CENTER.sql`), so this is a complete removal in one statement, not a soft flag needing follow-up cleanup.
2. **The confirm prompt is context-aware**: deleting a finished/reviewed race (real recorded results exist) warns "All recorded times and results will be permanently lost"; deleting a draft/scheduled/cancelled race (nothing real to lose) uses the plainer "This cannot be undone." Applied identically on both the hub's race cards and the Plan page's own delete button, which got the same status-based relaxation (and its label now reads "Delete race" instead of "Delete draft" once it's not actually draft-only anymore).
3. **Restart Race clears real data, deliberately** (`restartRace()`, new): every recorded split and pack capture for the session is deleted (a false start makes all of them meaningless -- they're relative to the wrong start moment), and the session reverts to `status: "scheduled"` with `race_started_at: null`, landing back on the pre-race "Ready to start?" screen. Restricted to `status === "live"` only -- a finished/reviewed race has already gone through review and needs "duplicate" or manual correction instead of a wholesale reset.
4. **A full page reload, not in-place state patching, is how the initiating device recovers after restarting.** Finish Race already just navigates away rather than trying to patch a dozen pieces of live JS state in place; Restart follows the same reasoning -- reload guarantees the Timer, checkpoint index, and local IndexedDB record for this session are all genuinely reset, matching a fresh page load, rather than trusting a hand-written partial reset to catch everything.
5. **Other devices at a different checkpoint on the same race detect the restart too**, not just the device that clicked the button -- `pullRemoteUpdates()`'s 11-second poll now also checks the fresh session status and reloads if it's no longer `"live"`. Without this, a second device timing Mile 2 would keep running its own stale local clock/splits against a race the server has already reset, silently producing wrong data instead of an obvious, correct reset.
6. **The runner-list density fix is a layout change, not an information change beyond dropping goal/target text.** Each "still need a time" card went from a stacked layout (name+status row, goal/target row, full-width 68px tap button, always-open manual-entry row, always-open DNS/DNF row -- roughly 276px tall) to one horizontal row (name | Tap button | small "more" toggle, ~74px measured) with manual entry and DNS/DNF collapsed behind that toggle, expanded per-runner on demand. Goal/target text was dropped entirely from this view since it's not needed to record a split (it's pacing-review information, still available on Plan/Review) -- matching the user's own "only show necessary information."
7. **The Tap button only shrank from 68px to 56px, not further**, specifically because the user said to keep it "still big" -- 56px is comfortably above the 44px minimum real touch-target size and visibly larger than every other control on the row, while being the one dimension that had to give some ground for 8+ cards to fit.
8. **Which cards are expanded is tracked outside the render function** (`expandedRunnerIds`, a `Set` at the top-level scope), the same reasoning `snapshotManualInputs()` already established for preserving in-progress typing across a rebuild -- without it, the 11-second background poll would silently re-collapse a card a coach had just opened to type a manual correction.

### Alternatives considered

1. Keeping delete draft-only and building a separate "archive" concept for finished races instead -- rejected as unnecessary complexity; the user asked to delete mistakes, not file them away, and cascading delete already handles this cleanly.
2. Shrinking the Tap button further (to ~44px) to hit an even denser layout -- rejected; the user explicitly asked to keep it big, and 56px already gets 8+ cards on screen without needing to compromise the primary action's size further.
3. A confirmation-free restart -- rejected; restarting is exactly as destructive as deleting a race's results (all splits gone), so it gets the same explicit, worded confirm dialog.

### Files or systems affected

`lib/race_command_center_service.mjs` (`deleteSession()` relaxed, new `restartRace()`), `api/race-command-center/sessions.js` (new `restart_race` action), `public/scripts/race-command-center-hub.js` (per-card Delete button + confirm + refresh), `public/scripts/race-command-center-plan.js` (relaxed delete visibility/label/confirm), `src/pages/racecommandcenterlive.mjs` + `public/scripts/race-command-center-live.js` (Restart Race button, cross-device reload-on-restart, and the full runner-card density redesign).

None outstanding for these three. Still owe the user a real root cause for the "Share access code" button not appearing on their screen (a separate, earlier-reported, not-yet-resolved issue) -- deferred while they worked through this batch of requests instead.

## 2026 08 20 A runner's goal now carries over to their next race automatically

### Decision

User asked directly: does a returning runner's goal carry over from their last race, and if not, they want it to (or at least have the option). Confirmed it did not -- every new race started every runner with a blank Goal A, even for the exact same athlete who'd already run a goal-paced race the week before. Fixed by copying a runner's most recent Goal A/B/C automatically the moment they're added to a new race, with zero extra clicks, while leaving the value fully editable before the race starts.

### Reason

A real coach with a real season-long roster reruns the same athletes week after week; retyping every Goal A/B/C from scratch for a full roster every single race is exactly the kind of repetitive manual entry this tool should be removing, not requiring. The user explicitly offered two acceptable shapes for the fix ("automatically keep... or have the option") -- automatic-but-editable satisfies both without adding a UI control.

### Key implementation decisions worth recording

1. **Copies only when the new participant row has NO goal yet, never overwrites one that exists.** This runs inside `saveParticipants()`'s existing insert path, scoped to genuinely brand-new `race_participants` rows -- an athlete already added to this race with a goal already set (or deliberately left blank) is never touched. There is structurally no path for this to clobber something a coach already decided for this specific race.
2. **Copies Goal A/B/C only -- never pacing strategy or checkpoint targets.** A runner's goal TIME is just a number and always transfers safely across races. Their pacing strategy (Custom Pace) is tied to a specific set of checkpoints via `race_targets`, and a new race may have a different checkpoint layout entirely (different mile splits, different total distance) -- copying targets blind risks silently producing an invalid or nonsensical Custom Pace plan the coach never asked for and might not notice until race day. Strategy defaults to Even Pace on every new race as before; a coach who wants Custom Pace again sets new targets for the new race's actual checkpoints, same as always.
3. **Only ever applies to roster-linked athletes (a real `team_athlete_id`), never manual/guest runners.** There's no reliable way to know "this guest runner named Jordan Smith is the same person as last week's Jordan Smith" from a name alone -- verified directly with a real guest-runner test case that no goal gets fabricated for them.
4. **"Most recent" is determined by the OTHER race's `race_date`, across every one of the team's races** (any status -- draft, finished, whatever), not scoped to a single season or the immediately-prior session by creation order. A coach re-ordering which race they plan first shouldn't change whose goal counts as "most recent."
5. **A one-line UI note was added** ("A runner's goal from their most recent race carries over automatically -- click in to review or change it") rather than a toggle or confirmation step -- this is a visibility improvement only, not a way to opt out, matching the "automatic but always editable" design; a coach who wants a different number for this race just changes it, exactly like any other field.

### Alternatives considered

1. An opt-in checkbox ("Copy goals from last race") before saving participants -- rejected; adds a click to the common case (goal genuinely hasn't changed) to guard against a scenario (an unwanted stale goal) that's already fully recoverable by just editing the pre-filled number, which a coach reviewing "Goals and Pacing" naturally does anyway.
2. Also copying Custom Pace targets when checkpoint labels/counts happen to match between the two races -- rejected as unnecessary complexity and a real correctness risk (checkpoint *distances* could still differ even with matching labels/counts, e.g. a 5K's "Mile 1" vs a different course's "Mile 1"); Goal A/B/C alone already delivers the actual time savings the user asked for.

### Files or systems affected

`lib/race_command_center_service.mjs` (new `copyMostRecentGoals()`, called from `saveParticipants()`), `src/pages/racecommandcenterplan.mjs` (one-line UI note).

None outstanding. Verified directly against real production (not just mocked): created two real throwaway races for the real Russia team, set a real goal on the first, added the same real roster athlete to the second with no goal-setting call at all, and confirmed Goal A and Goal B both carried over with the exact correct values, no Goal C fabricated (none existed on the source), and a manually-added guest runner in the same save got no goal at all. All throwaway data cleaned up and deletion re-confirmed.

## 2026 08 20 Root-caused the "feature I just shipped isn't showing up" pattern -- a real caching bug

### Decision

The user reported the new hub-page Delete button wasn't showing up, right after having reported the same thing for the Race Day Access "Share access code" button earlier the same session. Root-caused rather than guessed at again: `vercel.json` applies `Cache-Control: public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800` to every path under `/scripts/`, `/styles/`, and `/data/` -- and every one of those paths is a stable url with no version marker anywhere in it. Confirmed directly against the live deploy (`curl -sI`) that the exact JS file in question really was already updated and correctly deployed both times; the browser's already-cached copy from before the fix simply hadn't expired yet, and nothing about a redeploy could force that -- a Cache-Control header on a NEW response can't retroactively invalidate a response already sitting in a browser's cache under the same unchanged url. Fixed by stamping every same-origin `/scripts/*.js` and `/styles/*.css` reference in the built HTML with a `?v=<build>` query string computed once per build run, in `scripts/build.mjs`.

### Reason

This was a real, confirmed, previously-undiscovered bug, not user error and not a flaky one-off -- the same failure mode hit twice in one session, on two completely different features, each time with the deployed file itself already correct. Given how fast this session ships and pushes client-side JS fixes (many times per hour on active days), a 1-hour browser cache with zero cache-busting mechanism means a real coach could very plausibly be running stale JavaScript for a meaningful fraction of any given hour after a fix ships, with no visible sign anything was wrong on their end -- exactly what happened here, twice.

### Key implementation decisions worth recording

1. **Cache-busting via a query string stamped into the HTML, not a lower max-age.** Lowering `max-age` in `vercel.json` would only change how long *future* cache entries live -- it does nothing for a copy a browser already has cached under the unchanged url from before the config change even shipped. Only changing the URL itself forces an already-primed browser cache to be bypassed on the very next page load, which is the only thing that actually closes the gap the user hit both times.
2. **One version stamp per build run (`Date.now().toString(36)` at module-load time), applied to every page uniformly** -- not per-file content hashing. A single per-build value is simpler, and correctness here only requires "this differs from the last deploy's value," not minimal individual-file churn (this is a small site; the bandwidth cost of one shared version bump busting every asset's cache is negligible).
3. **The existing long `Cache-Control` values in `vercel.json` were deliberately left untouched.** Once every asset reference carries a build-specific `?v=`, those long lifetimes stop being a liability and become the actual benefit they were meant to be -- a cached response is now only ever reused under the exact version it was cached for, so aggressive caching and always-fresh-after-deploy are no longer in tension.
4. **Applied at the single `writePage()` choke point every real page's fully-assembled HTML already passes through**, plus the one other HTML-writing call (`404.html`) that bypasses it -- rather than touching every individual page's own hardcoded `<script src>`/`<link href>` tags across dozens of files, which would have been the exact same fix spread across much more surface area for no additional correctness.
5. **Confirmed `scripts/check.mjs`'s existing link-checker already strips query strings before resolving a file on disk** (`resolvePublicPath()`'s `url.split(/[?#]/)[0]`), so `<link href>` references with the new `?v=` suffix needed no changes there; `<script src>` references were never validated by that checker in the first place (it only ever checked `href`, not script `src`), so nothing there could regress either. Confirmed both facts by reading the checker before assuming safety, not after a build failure.

### Alternatives considered

1. Lowering `max-age` in `vercel.json` instead of cache-busting -- rejected; explained above, doesn't help anyone with an already-primed cache, which is exactly the reported symptom both times.
2. Per-file content hashing (e.g., `race-command-center-hub.abc123.js`) instead of a shared build-run query string -- rejected as more moving parts (renaming files, updating every reference to a computed hash) for no meaningful benefit at this site's scale; a shared per-build marker gets the same correctness guarantee far more simply.

### Files or systems affected

`scripts/build.mjs` (`stampCacheBustedAssetUrls()`, applied in `writePage()` and the `404.html` write).

### Follow up

None outstanding. Verified: `npm run build` produces a single consistent `?v=` value across every page in one run; `npm run check` passes with zero regressions (18,326 internal links, confirmed the checker's existing query-string handling covers the new suffix); a real page loaded via Playwright with the versioned script url present and no new console errors. This should retroactively explain both of today's earlier "the fix isn't showing up" reports -- worth keeping in mind if a similar report ever surfaces again after this point, since it would then indicate a genuinely different cause. Pushed and confirmed live directly: a versioned script url returned the current file content with `X-Vercel-Cache: MISS`.

## 2026 08 21 Race Command Center nav dropdown: race day code vs. coach sign-in

### Decision

User asked for exactly this: hovering "Race Command Center" in the main nav shows two options -- a place to enter a race day code, and an option for a coach to go straight to their team, without having to sign in again if already signed in. Built a real hover/click dropdown replacing the single link, with the second option resolving a signed-in coach's own team via `/api/team/me/` and skipping sign-in entirely when it can.

### Reason

Every prior click-reduction pass this session (the nav link itself, the join page, the race day code panels on three different RCC pages) was about getting a VOLUNTEER to live timing fast. This request is the coach-side mirror of that same goal -- a coach who already has a valid session shouldn't have to retrace team-login -> team-dashboard -> pick team -> Race Command Center every time, when the nav itself can already tell where they're going.

### Key implementation decisions worth recording

1. **The trigger keeps a real, working `href` to the join page (`/race-command-center/join/`), and is a plain `<a>`, not a `<button>`.** If `public/scripts/site.js` never runs for any reason, the nav item still works exactly as it did before this change -- a normal link to a normal page. The dropdown panel, hover reveal, and click-to-toggle are all a progressive enhancement stacked on top of that guaranteed-working baseline, never a replacement for it.
2. **Hover works via pure CSS** (`:hover`/`:focus-within` on `.nav-dropdown`), no JS required for that half at all; **click-to-toggle is the only part actually implemented in `site.js`**, since hover is meaningless on touch devices and something had to make the menu reachable there.
3. **The mobile breakpoint switches the panel from `position: absolute` (floating, needs a fade transition) to `position: static` + `display: none` by default** (only `display: grid` once `[data-open="true"]`) -- an absolutely-positioned floating panel inside the mobile nav's `overflow-y: auto` scroll container risked being silently clipped, and worse, `visibility: hidden` (the desktop technique) still reserves layout space even when "invisible," which would have left a dead gap in the mobile menu for every visitor who never touches this item. Verified directly with Playwright that the collapsed panel's bounding box is genuinely near-zero height on mobile, not just invisible.
4. **The coach-resolution logic lazily loads the same Supabase client + `team-auth-client.js` every team-specific page already loads, only on the actual click** -- not on every page load. The other ~99% of site visitors (rankings, stories, meets) never pay for this at all; the cost only exists for someone who actually clicks "Coach Sign In," which by definition means they're a coach.
5. **Exactly one team -> straight to that team's Race Command Center hub** (`/race-command-center/?id=<id>`) -- the actual point of the request. **Two or more teams, or genuinely signed out with a load/auth failure -> `/team-dashboard/`** (or `/team-login/` if truly not signed in) -- rather than guessing which of several teams a coach means, `/team-dashboard/` already lists every one with its own Race Command Center button front and center (from an earlier pass this session), so it's the correct "let them pick" landing spot, not a consolation destination.
6. **The existing "close the whole mobile nav when any link inside it is clicked" behavior was deliberately excluded for the dropdown trigger specifically** (`nav.querySelectorAll("a:not([data-nav-dropdown-trigger])")`) -- otherwise opening the submenu on mobile would immediately collapse the whole hamburger menu out from under it. The two real destination links inside the submenu are untouched by this exclusion and still close the mobile nav on click, exactly like every other nav link.

### Alternatives considered

1. A `<button>` trigger with no fallback href -- rejected; loses the guaranteed-working no-JS baseline for no real benefit, since a real `<a>` can be `preventDefault()`-ed identically once JS does load.
2. Sending a multi-team coach to a "pick your team" page built specifically for this dropdown -- rejected; `/team-dashboard/` already does exactly this job and already has a Race Command Center button per team, so building a second version of the same picker would be pure duplication.
3. Checking auth state on every page load (e.g., in a global script always present) so the nav item's destination is "known" before any click -- rejected; this session's own newly-shipped `/race-command-center/join/` flow deliberately avoids loading Supabase auth machinery for the 99% of visitors who never touch it, and the same reasoning applies here even more strongly (this is a nav item on literally every page of the site, most of which are read by fans with zero team affiliation).

### Files or systems affected

`src/lib/html.mjs` (`raceCommandCenterNavDropdown()`, new), `src/styles/main.css` (new `.nav-dropdown*` rules, desktop hover + mobile in-flow variant), `public/scripts/site.js` (click-to-toggle, the mobile-nav-close exclusion, and the lazy coach-resolution redirect logic).

### Follow up

None outstanding. Verified with Playwright: hover reveals the panel on desktop with both links carrying correct hrefs; clicking the trigger toggles the dropdown without navigating and clicking outside closes it; a signed-out visitor's "Coach Sign In" click goes to `/team-login/`; a signed-in coach with exactly one team goes straight to that team's Race Command Center hub with the correct team id; a signed-in coach with multiple teams goes to `/team-dashboard/`; on mobile, the collapsed dropdown reserves no visible space, tapping the trigger reveals both options inline without closing the surrounding hamburger menu, and a screenshot confirmed the visual result matches the rest of the mobile menu's styling.

## 2026 08 21 Full navigation rebuild -- NAVIGATION_REBUILD_SPEC.md

### Decision

Implemented the user-supplied `NAVIGATION_REBUILD_SPEC.md` in full: replaced the old two-row header (~15 flat nav links plus a separate hardcoded "Explore" bar that duplicated Fan Poll) with a single row -- 7 grouped left-side dropdowns (Home flat, then Rankings/Meets/Teams & Schools/Athletes/Voting/More as click-toggle dropdowns) and a 5-element right utility cluster (Search, Pace Calculator, Race Command Center, Watch, Instagram), eliminating the Explore row entirely. Mobile collapses to a hamburger drawer with accordion groups (one open at a time), Race Command Center and Pace Calculator pinned below the accordion, and Watch/Instagram pinned as a two-up row at the very bottom -- matching the spec's IA, interaction behavior, and acceptance checklist item for item.

### Reason

The user supplied a complete, specific spec covering IA, per-breakpoint interaction behavior, visual tokens, and an acceptance checklist -- the job here was faithful implementation plus flagging and correctly resolving the handful of places where the spec's assumptions didn't match this codebase's actual reality, rather than either blindly following an assumption that would have broken something, or silently deviating without saying so.

### Key implementation decisions worth recording

1. **Breakpoint is 1320px throughout, not the spec's placeholder 768px.** The spec explicitly said "confirm actual breakpoint against existing CSS" for exactly this reason -- `public/scripts/site.js`'s own `mobileQuery` and every existing responsive nav rule in `src/styles/main.css` already used 1320px as the real mobile/desktop split. Introducing a second, conflicting breakpoint at 768px would have created an awkward dead zone (768-1320px) matching neither behavior cleanly, so this rebuild uses the number the codebase already committed to. Confirmed directly: at exactly 1280px (a width the spec's checklist explicitly asks to test), mobile/hamburger behavior correctly applies, consistent with this choice.
2. **Rankings' dropdown items are "Cross Country" / "Track and Field," not the spec's proposed "Cross Country / Indoor Track / Outdoor Track."** Confirmed directly against `scripts/build.mjs` that no indoor/outdoor ranking split exists anywhere in this site -- only `/rankings/cross-country/` and `/rankings/track-and-field/` are real, generated pages. Linking to two pages that don't exist to match the spec's letter would have shipped broken links; using the two pages that actually exist matches its clear intent (grouping the site's real ranking categories under one dropdown).
3. **`site.mjs`'s flat `navigation` array became grouped `{ label, items }` entries** (Home stays flat with just `href`). Confirmed via a repo-wide grep that `site.navigation` was consumed in exactly one place (`header()`) before touching its shape, so restructuring it couldn't silently break anything else.
4. **One generic `navGroup()` component and one generic click-toggle-with-mutual-exclusion JS mechanism drive all 6 dropdown groups identically on both desktop (floating panel) and mobile (in-flow accordion)** -- CSS alone decides which rendering mode applies, at the single 1320px breakpoint; the JS only ever toggles a `data-open` attribute and coordinates "close every other one first," with no separate mobile-specific logic path to keep in sync.
5. **Race Command Center's dropdown is deliberately NOT part of that mutual-exclusion group.** The spec said "do not rebuild its logic, only restyle/reposition it," and its independence (opening a content-nav group doesn't close it, and vice versa) is a direct, literal reading of that instruction rather than an oversight -- confirmed it still fully works (hover, click-toggle, and the coach-sign-in smart redirect from 2026-08-21) completely unchanged, now inside its new green-accent-button wrapper in the utility cluster.
6. **Two real, pre-existing CSS bugs were found and fixed as part of this pass, both using `!important` deliberately** (not as a specificity shortcut, but as the correct fix for a confirmed conflict with legacy rules this rebuild doesn't otherwise touch): an old `@media (max-width: 1320px) { .sports-ticker { display: none; } }` rule was hiding the entire ticker bar at mobile widths, directly contradicting the spec's explicit "ticker truncates to one line, does not disappear" requirement; and an old `@media (max-width: 700px) { .sports-ticker-inner > span:not(.ticker-live) { display: none; } }` rule (with higher specificity than a fresh, unqualified class selector) would have hidden the new mobile-truncated ticker text too.
7. **The ticker bar is now one single `<a>` spanning its full width** (was: several plain `<span>`s plus one small nested link for "View calendar") -- matches the spec's explicit "the whole line links to the calendar" requirement for mobile, applied consistently at every width rather than only there, and gives desktop visitors a meaningfully larger click target as a side benefit.
8. **The mobile top bar gets its own dedicated search icon button, separate from the utility cluster's** (both wired via the same existing `[data-search-open]` attribute selector, which already supported multiple trigger buttons before this change) -- CSS shows exactly one of the two at each breakpoint, satisfying the spec's "mobile header shows only: logo, search icon, hamburger icon" without duplicating the search icon inside the drawer's own content list.
9. **A real test regression was caught and fixed**: `scripts/test-race-day-access.mjs` had a structural check asserting `site.mjs` contained a literal `label: "Race Command Center"` navigation entry and that `html.mjs` had a `primaryLabels` Set -- both assumptions this rebuild made obsolete (the dropdown is now hardcoded in `header()`, and `primaryLabels` no longer exists as a concept at all). Updated the assertions to check for what's actually true now (the dropdown component's presence and its real href) rather than deleting the coverage.

### Alternatives considered

1. Using the spec's literal 768px breakpoint -- rejected for the reasons above; the spec itself invited this deviation.
2. Wrapping Race Command Center's dropdown into the same mutual-exclusion coordination as the 6 content groups, for a more "consistent" feel -- rejected; the spec was explicit about not touching its logic, and closing it whenever an unrelated content dropdown opens (or vice versa) would be a real behavior change to logic the spec said to leave alone.
3. Duplicating the CSS rebuild's `.nav-group` mechanism as entirely separate desktop and mobile implementations -- rejected; one shared `data-open`-driven mechanism with CSS handling the visual difference is simpler and has no divergence risk between the two rendering modes.

### Files or systems affected

`src/config/site.mjs` (navigation restructured into 7 grouped entries), `src/lib/html.mjs` (`header()` fully rewritten: `navGroup()`, new icons, utility cluster, ticker restructure, Explore bar removed), `src/styles/main.css` (new `.nav-group*`/`.nav-utility*`/ticker rules, plus the two `!important` fixes for pre-existing conflicting rules), `public/scripts/site.js` (generic dropdown-group toggle + mutual exclusion), `scripts/test-race-day-access.mjs` (structural assertions updated to match the new header implementation).

### Follow up

None outstanding. Verified with a dedicated Playwright suite covering the spec's full acceptance checklist: Fan Poll appears exactly once in the header (footer keeps its own separate, always-existing link, out of this spec's scope); all 6 dropdowns open/close correctly via click, with mutual exclusivity, and close on outside click/Escape; every dropdown item resolves to a real 200 page; Search/Pace Calculator/Race Command Center/Watch/Instagram are all visible in the utility cluster, outside any dropdown; Race Command Center's own dropdown still works fully unchanged and independently; on mobile, the accordion groups enforce one-open-at-a-time, Race Command Center and Pace Calculator are visible without expanding anything, tap targets measure ≥44px, and the drawer closes correctly on X/outside-tap/Escape with focus returning to the hamburger button. Also visually confirmed via screenshot at 375px, 768px, and 1440px (desktop, since the real 1320px breakpoint means 1280px itself renders mobile behavior, confirmed directly and expected). Pushed and confirmed live directly (Fan Poll appears exactly once inside the real deployed `<header>`).

## 2026 08 21 A real "pinned order" concept for the story feed, plus a duplicate-homepage-content bug found and fixed

### Decision

User asked to publish a new coach-advice article "pushed to the top of my feed," with the three existing "Top Returning" preview articles appearing right after it in a specific order: Seniors, then Juniors, then Sophomores. Built a proper editorial-pin mechanism (`pinnedRank` in story frontmatter) rather than gaming each article's `date` field to fake the order, and along the way found and fixed a real, pre-existing bug: the homepage rendered the exact same 3 story cards twice, under two different headings.

### Reason

The site's only existing sort key for stories was `date` (descending) -- there was no way to say "this story goes first, then this one, then this one" independent of when each was actually written or covered. The user's request was explicitly about *feed position*, not about rewriting each article's real publish date, so the honest fix was a new, purpose-built mechanism rather than repurposing a field that readers see as "when this was published."

### Key implementation decisions worth recording

1. **`pinnedRank` is additive, not a replacement for date-based sorting.** `loadStories()`'s sort now checks: if either side of a comparison has a `pinnedRank`, the pinned one wins (lower rank first), and an unpinned story always loses to a pinned one; only when NEITHER side is pinned does the existing date-descending comparison apply. The overwhelming majority of stories (everything without a `pinnedRank` in its frontmatter) are completely unaffected -- this only ever activates for stories that explicitly opt in.
2. **`date` stays untouched and accurate on every article.** The three "Top Returning" articles keep their real dates (Aug 17/18/19) -- a reader looking at the byline sees when each was actually covered, not a fabricated date manufactured purely to win a sort comparison. `pinnedRank` (1/2/3/4 across the four pinned articles) is the only thing controlling their feed position.
3. **Found and fixed a real, pre-existing bug while implementing this**: the homepage rendered `storyContent` (the same 3-story HTML string) in two completely separate sections -- "Latest Stories" near the top, and a second "Latest stories" section further down under the heading "More than a finish time." Confirmed directly: a fresh homepage build had 6 links to the same single story, not 3, before this fix. This had presumably been happening on every single homepage load since that second section was built, just never reported because with pure date-sorting it may have been less obviously identical, or simply not looked at closely enough to notice. Fixed by giving the second section its own `moreStories` slice (positions 4-6, after the first section's top 3), so it now shows genuinely different, additional coverage instead of an exact repeat.
4. **The homepage's hero story is also excluded from the "Latest Stories" grid beneath it** -- a related, adjacent fix: previously, whichever story was the `featured:true` hero could ALSO appear as the first card in "Latest Stories" if it was recent enough (no dedup existed). Confirmed this would have been immediately, visibly triggered by pinning the new coach-advice article at rank 1 and marking it `featured: true` (it would otherwise have been `stories[0]` twice over). Fixed the same way as the second-section bug: filter the hero's own slug out before slicing.
5. **`featured: true` moved from the Sophomores article to the new coach-advice article**, and the Juniors article -- previously sitting as `draft: true` despite having a real, complete, finished body (212 lines, fully written) -- was published (`draft: false`) as part of satisfying "seniors, then juniors, then sophomores," since that ordering only means anything if all three are actually live.
6. **A new custom header image was built for the coach-advice article** (`8_things_coach_wants_you_to_know.png`, 1600×900), using the exact same HTML/CSS-template-plus-Playwright-screenshot technique and the same real PW badge asset established for the three "Top Returning" headers earlier this session -- matching visual brand consistency for what is now the homepage's most prominent piece of content, rather than falling back to the generic story-card placeholder image.

### Alternatives considered

1. Setting artificial, closely-spaced future `date` values on all four articles to force the desired order -- rejected; would have shown readers an inaccurate "published on" date on already-real, already-dated articles, purely as a sorting side effect.
2. Leaving the homepage's duplicate-section bug alone, since it wasn't what the user explicitly asked to fix -- rejected once found; showing a reader the identical 3 stories twice on one page load is a real, confirmed defect that this exact change was about to make more visible and more obviously wrong (the same pinned 3 stories, verbatim, twice), not less.

### Files or systems affected

`scripts/build.mjs` (`loadStories()`'s sort gains `pinnedRank`; `homePage()` excludes the hero from "Latest Stories" and gives the second story section its own distinct slice), `content/stories/20260821_8_things_coach_wants_you_to_know.md` (new), `content/stories/20260819_top_returning_seniors_boys_girls_preview.md` / `20260818_top_returning_juniors_boys_girls_preview.md` (published) / `20260817_top_returning_sophomores_boys_girls_preview.md` (`pinnedRank` 2/3/4 respectively, `featured` moved off Sophomores), `public/images/stories/8_things_coach_wants_you_to_know.png` (new header image).

### Follow up

None outstanding. Verified against the real built homepage: hero is the new coach-advice article; "Latest Stories" shows Seniors, then Juniors, then Sophomores, in exactly that order, with zero duplication; the second "Latest stories" section further down now shows 3 different, additional stories instead of repeating the first 3; the article's own page renders correctly with its new header image, correct byline date, and correct breadcrumb. `npm run build`/`run check`/full test suite all clean. Not yet pushed -- the user's "pushed to the top of my feed" language was about feed prominence/ordering, not a request to deploy, so this still needs an explicit go-ahead before `git push` per standing practice.

## 2026 08 21 Split Watch rebrand (formerly Race Command Center)

### Decision

Renamed the "Race Command Center" feature to "Split Watch" across the codebase -- display copy, page/nav titles, file names, internal function/service names, the API route directory, and CSS/data-attribute prefixes -- per the user's rebrand request.

### Reason

The user asked for the feature rebranded end to end, not just a label swap in one place. Doing it as a thorough, mechanical pass (rather than only the visible UI text) keeps source file names, internal identifiers, and on-page copy consistent with each other, rather than leaving the codebase in a state where the brand name says one thing and every file/function underneath it says another.

### Key implementation decisions

1. Page URLs (`/race-command-center/`, `/plan/`, `/live/`, `/review/`, `/join/`) were changed to `/split-watch/...` per the user's explicit choice (offered as a 3-way question: keep old URLs unchanged / change with redirects / change with no redirects), rather than silently deciding either way -- these are real, currently-shared URLs (the race-day join link a coach texts to volunteers, plus likely-bookmarked hub/live/plan/review pages), so a URL change with no redirect would break real links already in use. Permanent (308) redirects added in `vercel.json` from every old `/race-command-center/...` path to its new `/split-watch/...` equivalent -- these fire at Vercel's edge before static files are served, so an already-shared link keeps working.
2. `api/race-command-center/*` renamed to `api/split-watch/*` with no redirect -- this is pure first-party plumbing the site's own client scripts call directly; no external party ever sees, bookmarks, or shares an API path, so renaming both sides atomically in the same change carries none of the page-route risk above.
3. Three things were deliberately left untouched rather than mechanically renamed:
   - The IndexedDB database name (`public/scripts/race-local-store.js`'s `DB_NAME = "podium_race_command_center"`) -- this is real, already-persisted browser storage; renaming it would orphan any offline-queued, not-yet-synced split sitting in a volunteer's browser from an in-progress or recent race.
   - The `pw_rcc_` client-split-id prefix (validated by both the server and the unit tests against the exact `install/11_RACE_COMMAND_CENTER.sql` check constraint) -- an idempotency-key format, not user-facing brand text; changing it has no upside and a real, if small, chance of rejecting an in-flight sync from an already-loaded browser tab during a live race.
   - `install/11_RACE_COMMAND_CENTER.sql` and every other already-applied migration file -- left as an accurate historical record of what was actually run, matching how this project already treats every prior migration file.
4. Historical docs (this file's and `docs/SESSION_LOG.md`'s own prior entries, `docs/NEXT_SESSION.md`, `docs/LIVE_TRACKING_UX_AUDIT.md`, `NAVIGATION_REBUILD_SPEC.md`) were left untouched -- each describes what was true as of its own dated entry, not a currently-authoritative reference that should retroactively reflect the new name.

### Alternatives considered

1. Changing the page routes with no redirect at all -- rejected; the most literal reading of "rename everywhere," but would silently break the race-day join link the moment it deployed, with no way for an already-shared link to recover.
2. Leaving the page routes as `/race-command-center/...` and only rebranding display text/internals -- a real, safer option, offered to the user alongside the redirect approach; not chosen, since the user preferred the URLs to actually match the new name.

### Files or systems affected

Renamed: `src/pages/racecommandcenter*.mjs` -> `splitwatch*.mjs` (5 files), `public/scripts/race-command-center-*.js` -> `split-watch-*.js` (5 files), `lib/race_command_center_service.mjs` -> `split_watch_service.mjs`, `api/race-command-center/*.js` -> `api/split-watch/*.js` (5 files), `scripts/test-race-command-center.mjs` -> `test-split-watch.mjs`. Text/identifier updates only (no rename): `src/lib/html.mjs`, `src/styles/main.css`, `src/config/site.mjs`, `src/pages/teamhome.mjs`, `teammeetcenter.mjs`, `public/scripts/site.js`, `team-home.js`, `team-dashboard.js`, `team-profile.js`, `team-meet-center.js`, `team-roster.js`, `race-math.js`, `race-timer.js`, `race-local-store.js` (prefix/text only -- `DB_NAME` itself untouched), `lib/race_day_auth.mjs`, `race_viewer_service.mjs`, `team_workspace_service.mjs`, `athlete_access_service.mjs`, `athlete_goal_service.mjs`, `race_math.mjs`, `api/team/home.js`, `meet-center.js`, `race-day-code.js`, `scripts/build.mjs`, `check.mjs`, `test-race-day-access.mjs`, `test-athlete-goals.mjs`, `package.json` (test script renamed), `vercel.json` (new redirect rules).

### Follow up

None outstanding. `npm run build`/`run check`/full `npm test` all clean (18,153 internal links, zero problems; every renamed test -- `test:split-watch`, `test:race-day-access` -- passing with updated assertions). Not yet pushed or deployed -- needs explicit go-ahead per standing practice, and the redirect rules only take effect once deployed to Vercel.
