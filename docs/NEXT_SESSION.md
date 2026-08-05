# Podium Watch next session

## Current priority

Begin Phase One recruiting architecture work. The Phase Zero safety cleanup is deployed and confirmed live.

## Current working state

The cleaned source passes the production build, complete quality checker, Athlete Foundation validation, Recruit Ratings validation, and all 36 results ingestion tests. Full manual testing (desktop, mobile, menu, Explore row, and both admin recruiting import scenarios) was completed and confirmed on 2026-08-04.

The cleanup was merged to `main` and pushed on 2026-08-04. Vercel deployed it and the live site was confirmed working on both desktop and phone. No athlete ratings or performances were created.

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

## Remaining work

1. Begin Phase One recruiting architecture work.

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
