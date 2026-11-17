# Overnight report (2026-11-17 into 11-18)

Short version: the full site move is built and switched off on the new branch `oatccc-full-site`. The files are copied to Storage (approved, 265 MB). The four Thursday fixes were NOT done: I could not find what they are supposed to be (blocker 1). Nothing pushed, merged or deployed; no SQL run; no Vercel change; nothing from dataimports/ or _private/ committed.

## Blockers (need you)

1. **Thursday launch fixes not done.** You asked me to finish "byline, article images, the launch-only build check, OATCCC_TERMS_LIVE" on oatccc-section first. They were not committed, and there is no description of them anywhere I could reach (every branch, both worktrees, dataimports/, Downloads). They change the pages that launch Thursday, so I did not guess. Recorded on oatccc-section in docs/NEXT_SESSION.md (commit e6b4eef8). I need one line each on what they should do.
2. **Migration 103 and the Hall of Fame import are waiting on you** (written, not run). Until they run, the Hall of Fame and award pages build nothing and their links keep going to oatccc.com.
3. **No Midwest Meet page exists to copy**: oatccc.com sends /Outdoor-Track-Field/Midwest-Meet/ to its home page. The section has the Mideast page only.

Nothing else blocked. No command was refused; no test is failing except the two `.limit()` warnings in lib/athletic_net_rankings_service.mjs that were already on main.

## Done

| Step | Status |
| --- | --- |
| 1. Crawl | Done. 526 pages read (488 from the Site-Map, 38 linked from them), 0 failed, 0 behind a login. |
| 2. Files | Done. 1,015 files (265.7 MB); 1,007 copied to the new public bucket `oatccc-public` (8 sponsor logos and page banners skipped). Spot-checked: files open. |
| 3. Simple pages | Done. 19 pages, word for word, each with its own switch (all off). |
| 4. Hall of Fame and awards | Done, not run: migration 103 and the import script (dry run: 466 inductees, 5 awards, 370 recipients). Pages build from the database. |
| 5. Redirect map | Done. 516 of 526 pages and all 1,015 files mapped; no redirects on. |
| 6. Check and report | Done: screenshots, link check, wording list, phone list, can't-move list, all in docs/OATCCC_FULL_SITE_REPORT.md. |
| Backup | `D:\Podium Watch\backups\oatccc-full-site-2026-11-17.bundle`: both branches (oatccc-full-site and oatccc-section), verified with `git bundle verify`. |

Screenshots: `C:\Users\12zac\Downloads\oatccc-screenshots\full-site\`.

## Things to look at

- A personal Gmail address appears inside David Kirk's Hall of Fame bio on oatccc.com. I kept it (your rule: keep every email exactly as it appears); it shows on a public page once the Hall of Fame is on.
- Leadership shows names and roles only. oatccc.com's cards also have schools, a home mailing address and phone numbers; all left off.
- 58 award recipients are linked to a Hall of Fame inductee by exact name only (listed in the import preview) for the OATCCC to confirm.
- 15 wording problems on oatccc.com (typos, "calendar year" on Join, duplicate Academic All-Ohio links, an encoding error in one bio): listed in the report, not fixed.
- 3 links on Resources look broken (NFHS Coaching Today 404, a Tusca Zoar flyer, runohio.com).

## Left to do

- Thursday fixes (blocker 1), then bring oatccc-section's new commits into oatccc-full-site.
- Run migration 103 and the import (your call), then switch sections on one at a time (each needs OATCCC_MORE_LIVE too), and OATCCC_FILES_HOSTED.
- Decide on redirects from oatccc.com (the map is ready).
- Ask the OATCCC about the wording list, the Midwest page, the Coaching Longevity page and what to do with the "can't move yet" items.

## Commits (branch oatccc-full-site, not pushed)

| Commit | What |
| --- | --- |
| e6b4eef8 | (oatccc-section) blocker note: Thursday fixes have no spec |
| 91059d11 | crawl, simple pages, Hall of Fame (all off) |
| 8edb29ef | redirect map, alias addresses, inductee link table |
| 81df5ef9 | file upload script, link check, display fixes |
| 677b2871 | Leadership names and roles only; placeholder award tile skipped |
| (last) | reports and docs |
