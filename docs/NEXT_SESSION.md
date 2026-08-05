# Podium Watch next session

## Current priority

Manually test the write paths of the Recruiting Phase Two implementation (media save/publish, rating draft/publish, rank movement) — read-only paths were already verified overnight on 2026-08-05. Then merge, push, and deploy only after explicit approval. A Phase Three architecture report is also waiting for review.

## Current working state

The Phase Zero safety cleanup remains deployed and confirmed live. The Phase One architecture report was audited and approved on 2026-08-04 (`docs/RECRUITING_PHASE_ONE_ARCHITECTURE.md`). Phase Two was implemented on top of that approval and migration 06 was run successfully in Supabase on 2026-08-04.

Overnight on 2026-08-05, while diagnosing an athlete-profile-link error, three real bugs were found and fixed (see `docs/SESSION_LOG.md` for full detail):

1. A `trailingSlash: true` routing issue silently dropped query strings on three public-facing fetch calls (athlete profile, athlete directory search, recruiting directory search). Fixed, and a general guard was added to `scripts/check.mjs` so it cannot recur silently.
2. The public recruiting API hardcoded the retired methodology label. Fixed to read the active methodology from the database.
3. The admin recruiting API's install-check hardcoded the retired methodology key, meaning every admin action would have silently attached new data to the retired 2026.1 methodology instead of the active 2026.2 one. Fixed to look up whichever methodology is active.

All three fixes are committed locally to the `recruiting-phase-two-taxonomy-media` branch (not `main`, not pushed). No new database rows were created overnight — the write paths still need your own hands-on testing.

A Phase Three architecture report was also drafted overnight (`docs/RECRUITING_PHASE_THREE_ARCHITECTURE.md`). Of its five decisions, self-service claims and rank snapshot retention were deferred; the read-only scoring assist tool was approved and built the same session (a "Compare to rated athletes in this group" panel on the admin rating form). It is read-only and was verified live against real (currently empty) data — add it to the manual testing list below once real ratings exist.

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

## Manual testing still required for Phase Two

1. Run migration 06 in Supabase (after migrations 01, 02, and 03). Done 2026-08-04.
2. Confirm the full local build and test command still pass. Done repeatedly, most recently 2026-08-05.
3. Open `/admin/recruiting/`, confirm the rating form's event group list shows the nine new groups. Done 2026-08-04.
4. Open `/athletes/`, search a real athlete, click into their profile, and confirm the page loads correctly (this was broken and is now fixed — worth a quick re-check first).
5. Add one media item to a test athlete, confirm it is saved as draft and does not appear on the public profile.
6. Publish that media item, confirm it appears on the athlete's public profile page.
7. Click "Preview public profile" on a test athlete with a draft rating, confirm the preview shows the rating content but explains the rank cannot be shown yet.
8. Publish a rating, confirm it appears on `/recruiting/` and the athlete's profile page with a class rank and event group rank, and confirm the methodology label shown reads 2026.2, not 2026.1.
9. Edit and re-save that rating, confirm the profile page shows rank movement compared to the first publish.
10. With at least one published rating in a class/gender/event group, open the rating form for a second athlete in the same group and click "Compare to rated athletes in this group," confirm it shows the first athlete's mark, score, stars, and ranks, and confirm it never suggests or pre-fills a score.
11. Commit to `main`, push, and deploy only after explicit approval.
12. Confirm the Vercel build and the live recruiting pages after deployment.

## Remaining work

1. Finish Phase Two manual testing (write paths) per the checklist above.
2. Review and approve, adjust, or reject `docs/RECRUITING_PHASE_THREE_ARCHITECTURE.md` (self-service athlete/parent claims, scaling beyond the first launch, a scoring assist tool for admins). Nothing in it is built yet.
3. Begin Phase Three implementation only after that approval, following its section 6 implementation order.

## Known limitations

1. Recruit Ratings are manually evaluated and are not automatically generated. Phase Three proposes a read-only comparison aid, not automatic scoring; see `docs/RECRUITING_PHASE_THREE_ARCHITECTURE.md` section 4.
2. Performance import matching is intentionally exact and may require school name cleanup.
3. The first release does not include athlete or parent self service claims for recruiting activity. Phase Three proposes a design reusing the existing team-claim pattern; see section 2.
4. The first release does not calculate a score from a fixed formula, and Phase Three does not change that.
5. Cross country course differences require editorial context.
6. The public maximum time filter uses the rating selected top performance.
7. Real Supabase and browser testing is still required for the Phase Two write paths specifically (see "Manual testing still required for Phase Two" above); read-only paths were verified overnight 2026-08-05.
8. The corrected Baumspage reader still requires one live local 50 link batch before any discovered sources are approved. This is part of the separate Results Ingestion roadmap (`docs/RESULTS_INGESTION_STATUS.md`), not the recruiting system.

## Do not change yet

1. Do not seed stars from ranking snapshots.
2. Do not allow payment or sponsorship to affect scores.
3. Do not use offers to determine scores.
4. Do not publish private contact information.
5. Do not publish reported recruiting activity without confirmation and a source link.
6. Do not automatically create athlete profiles from unmatched performance rows.
7. Do not silently change star bands after ratings are published. Create a new methodology version.
