# Podium Watch decision log

Record major technical, editorial, design, and business decisions here.

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
