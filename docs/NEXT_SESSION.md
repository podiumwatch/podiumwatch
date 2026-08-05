# Podium Watch next session

## Current priority

Manually test the Recruiting Phase Two implementation (event group taxonomy, athlete media, ranking movement, admin public profile preview), then run migration 06 in Supabase, then commit, push, and deploy only after explicit approval.

## Current working state

The Phase Zero safety cleanup remains deployed and confirmed live. The Phase One architecture report was audited and approved on 2026-08-04 (`docs/RECRUITING_PHASE_ONE_ARCHITECTURE.md`). Phase Two implementation has been written on top of that approval: `install/06_RECRUITING_TAXONOMY_AND_MEDIA.sql`, updated `lib/recruiting_service.mjs`, admin and public recruiting API and page changes, and expanded automated tests. The full build, check, and test command all pass locally.

Migration 06 was run successfully in Supabase on 2026-08-04 (after one failed attempt caused by a backfill that missed a row outside the expected event key list; the migration was made defensive and re-run successfully — the failed attempt rolled back cleanly with no lasting effect). None of this work has been committed, pushed, or deployed yet.

## Database work still required

Run migrations in order:

```text
install/01_STATEWIDE_FOUNDATION_DATABASE.sql
install/02_ATHLETE_PROFILE_FOUNDATION_DATABASE.sql
install/03_RECRUIT_RATINGS_AND_PERFORMANCE_HISTORY.sql
```

Migrations 01 and 02 should already be installed. Confirm migration 03 is applied to the production Supabase project before pushing or deploying this cleanup — the admin recruiting page depends on it.

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

## Manual testing still required for Phase Two

1. Run migration 06 in Supabase (after migrations 01, 02, and 03). Done 2026-08-04.
2. Confirm the full local build and test command still pass.
3. Open `/admin/recruiting/`, confirm the rating form's event group list shows the nine new groups.
4. Add one media item to a test athlete, confirm it is saved as draft and does not appear on the public profile.
5. Publish that media item, confirm it appears on the athlete's public profile page.
6. Click "Preview public profile" on a test athlete with a draft rating, confirm the preview shows the rating content but explains the rank cannot be shown yet.
7. Publish a rating, confirm it appears on `/recruiting/` and the athlete's profile page with a class rank and event group rank.
8. Edit and re-save that rating, confirm the profile page shows rank movement compared to the first publish.
9. Commit, push, and deploy only after explicit approval.
10. Confirm the Vercel build and the live recruiting pages after deployment.

## Remaining work

1. After Phase Two is tested and deployed, begin whatever Phase Three recruiting work is identified next (for example, the deferred results-ingestion connection or hand curated ranking sets, if priorities change).

## Known limitations

1. Recruit Ratings are manually evaluated and are not automatically generated.
2. Performance import matching is intentionally exact and may require school name cleanup.
3. The first release does not include athlete or parent self service claims for recruiting activity.
4. The first release does not calculate a score from a fixed formula.
5. Cross country course differences require editorial context.
6. The public maximum time filter uses the rating selected top performance.
7. Real Supabase and browser testing is still required.
8. The corrected Baumspage reader still requires one live local 50 link batch before any discovered sources are approved.
9. Phase One recruiting architecture must wait until the cleanup is installed and live verification passes.

## Do not change yet

1. Do not seed stars from ranking snapshots.
2. Do not allow payment or sponsorship to affect scores.
3. Do not use offers to determine scores.
4. Do not publish private contact information.
5. Do not publish reported recruiting activity without confirmation and a source link.
6. Do not automatically create athlete profiles from unmatched performance rows.
7. Do not silently change star bands after ratings are published. Create a new methodology version.
