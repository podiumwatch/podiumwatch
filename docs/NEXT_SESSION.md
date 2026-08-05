# Podium Watch next session

## Current priority

Confirm the live site after deployment (desktop and phone), matching the discipline used after Phase Zero. Everything else is done: all Phase Two and Phase Three write paths were verified live on 2026-08-05 using a throwaway test profile that was fully deleted afterward, and the branch was merged, pushed, and deployed the same session.

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
6. Do not automatically create athlete profiles from unmatched performance rows.
7. Do not silently change star bands after ratings are published. Create a new methodology version.
