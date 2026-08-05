# Podium Watch decision log

Record major technical, editorial, design, and business decisions here.

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
