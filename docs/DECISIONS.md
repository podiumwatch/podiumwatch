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
