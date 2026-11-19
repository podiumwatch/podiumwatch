# OATCCC full site move: report (2026-11-17 overnight)

Branch `oatccc-full-site` (worktree `../podium_watch_oatccc_full`), started from `oatccc-section` at e6b4eef8. Nothing pushed, merged or deployed. No SQL run. No Vercel change. Everything new is switched off.

The raw crawl, the file list, the upload manifest, the redirect map, the Hall of Fame data and the phone numbers left off are in `_private/oatccc-crawl/` in that worktree. Git ignores that folder; nothing in it is committed.

## What was built

| Step | Result |
| --- | --- |
| 1. Crawl | `scripts/oatccc-crawl.mjs`: every page in the oatccc.com Site-Map (488) plus pages they link to: **526 pages read, 0 failed**. 0 pages behind a login. |
| 2. Files | **1,015 files and images, 265.7 MB** (475 PDFs 237 MB, 539 images 11 MB, 1 MP4 17.5 MB), all loading. Under 1 GB, so copied: **1,007 files to the public Supabase Storage bucket `oatccc-public`**, same path as on oatccc.com (`Media/Longevity-Form.pdf`). 8 not copied: sponsor logos (sponsors are text only) and oatccc.com page-banner backgrounds. Manifest: `_private/oatccc-crawl/upload-manifest.json`. Google Sheets, Docs and Drive stay as links. |
| 3. Simple pages | 19 pages in `src/oatccc/more/content/` (word for word, `scripts/oatccc-port-pages.mjs`), each behind `OATCCC_LIVE` + `OATCCC_MORE_LIVE` + its section switch. Tabs, hub cards and links go to oatccc.com while a section is off. |
| 4. Hall of Fame | `install/103_OATCCC_HALL_OF_FAME.sql` (NOT run). `scripts/import-oatccc-hall-of-fame.mjs` (NOT run; dry run: **466 inductees, 61 Ed Barker recipients, 5 awards, 370 recipients**). Pages read the database at build time; no bios in git. `/oatccc/hall-of-fame/` (search by name or school, year filter, Ed Barker filter), one page per inductee, `/oatccc/awards/` and one page per award (newest first, with a search box). |
| 5. Redirect map | `scripts/oatccc-redirect-map.mjs` writes `_private/oatccc-crawl/redirect-map.csv`: 526 pages (516 with a new address) and 1,015 files. No redirect is switched on. |
| 6. Checks | Screenshots, link check, wording list, can't-move list: below. |

### Section switches (all off)

Every page needs `OATCCC_LIVE=1`, `OATCCC_MORE_LIVE=1` and its own switch:

| Switch | Pages |
| --- | --- |
| `OATCCC_ABOUT_LIVE` | /oatccc/about/, /oatccc/about/leadership/, /oatccc/about/history-of-leadership/, /oatccc/about/tributes/, /oatccc/sponsors/, /oatccc/the-runner/ |
| `OATCCC_JOIN_LIVE` | /oatccc/join/ (payment stays on oatccc.com) |
| `OATCCC_SCHOLARSHIPS_LIVE` | /oatccc/scholarships/marv-crosten/, /oatccc/scholarships/dale-gabor/, /oatccc/coaches/grants/ |
| `OATCCC_FORMS_LIVE` | /oatccc/forms/, /oatccc/resources/ |
| `OATCCC_CLINICS_LIVE` | /oatccc/clinics/track-and-field/, /oatccc/clinics/cross-country/, /oatccc/clinics/vendors/ |
| `OATCCC_MEETS_LIVE` | /oatccc/cross-country/mideast-meet/ (no Midwest page: see below) |
| `OATCCC_ACADEMIC_LIVE` | /oatccc/academic-all-ohio/ (archive as a year table) |
| `OATCCC_POLLS_LIVE` | /oatccc/polls/ (Google Sheets as links, older PDFs as a year table) |
| `OATCCC_MS_LIVE` | /oatccc/indoor/middle-school/ |
| `OATCCC_HOF_LIVE` | Hall of Fame and Awards (only when the database has data; otherwise the build treats it as off so no link breaks) |
| `OATCCC_FILES_HOSTED` | File and photo links go to the `oatccc-public` bucket instead of oatccc.com |

## Screenshots

`C:\Users\12zac\Downloads\oatccc-screenshots\full-site\` (desktop 1440 and phone 390, full page and top): About, Leadership, an award (Fred Dafler), Hall of Fame list, an inductee (A. W. Hendricks 1973), Forms, Track & Field clinic, Academic All-Ohio, Coaches' Polls. Built locally with the Hall of Fame import preview (no database). No page scrolls sideways at 390 px.

Fixed while checking them: Hall of Fame cards showed only "2026" (the site footer script overwrites every `data-year` attribute; now `data-hof-year`, with a test); inductee photo too large on phones; long oatccc.com "headings" were set in huge display type (now paragraphs, same words); table links broke mid-word; a link inside a sentence lost its word ("Or you can SEARCH and contact").

## Broken links (6 of 571 links on the new pages)

| Status | Link | On |
| --- | --- | --- |
| 404 | https://www.nfhs.org/coachingtoday | Resources |
| no answer | http://tuscazoar.org/wp-content/uploads/2023/08/XC-Coach-Flyer-2023.pdf | Resources |
| no answer | http://www.runohio.com/ | Resources |
| 404 to scripts, probably fine in a browser | https://oh.milesplit.com/ | Resources, Sponsors |
| 403 to scripts, probably fine in a browser | http://www.ustfccca.org/ | Resources |
| 403 to scripts, probably fine in a browser | https://1stplacespiritwear.com/ | Sponsors |

Every oatccc.com page and file linked from the new pages loads.

## OATCCC wording problems (listed, not fixed)

1. **Join**: "Join the OATCCC for the calendar year…" and the membership form text "Membership is for the CALENDAR YEAR, January through December." Anjanette said the bylaws now use the 2026-2027 academic year.
2. **Forms**: "Dale **Garbor** Seated Athlete Scholarship Application" (Gabor elsewhere).
3. **Forms**: "You can search available forms and downloads below." The search box does not move.
4. **Fred Dafler Award**: "They may only receive the honor **for for** each category one time." and "Boy's Track, Boy's C.C., Girl's Track, Girl's C.C.."
5. **SEI Awards**: "Boardman **HIgh** School".
6. **Coaches of the Year**: "**NHFS** Ohio … Coach of Year" (twice; NFHS) and "**Glennville** High School" (twice; Glenville). The page shows only 2021 and 2022.
7. **Middle School State Award**: page title "**OATCC** Middle School State Awards"; coach "Scott **Ambrugey**" (the photo text on oatccc.com says "Amburgey"). Only 2021 is shown.
8. **Elementary School Grant / home page**: "The purpose of **OATCC** is…"; the grant total is "$19,614" on the home page but "$5950" on the grant page.
9. **Sponsors**: "OATCCC appreciates the support of **the its** sponsors."
10. **Lend Your Support**: "please fill out the form below." The form does not move.
11. **Mideast Meet**: "ended **on on** Sunday, November 8, 2026."
12. **Academic All-Ohio**: cross country "2022 Girls" and "2022 Boys" open the same Google Drive file; cross country 2006 and 2005 have no file on oatccc.com.
13. **Coaches' Polls**: the year tabs skip 2017 (2018, then 2016).
14. **Hall of Fame**: Steve Price (2015) bio shows a stray "Â" ("…to name them all.Â Joe Green…"), an encoding error on oatccc.com. A blank "NONE SELECTED" (2017) tile appears on the Hall of Fame list and the Ed Barker page (left out here). No class is listed for 2021.
15. **Midwest Meet**: https://www.oatccc.com/Outdoor-Track-Field/Midwest-Meet/ sends people to the oatccc.com home page, so there is no Midwest page to copy. Two Midwest files exist under /Media/Midwest-Meet-Of-Champions/ (copied to the bucket).

## Phone numbers left off (29)

Numbers themselves are only in `_private/oatccc-crawl/phones-left-off.json` (not in git).

- **Leadership (oatccc.com Contact-Us), 27**: one for each of President & Cross Country Clinic Co-Chair; Vice President; Past President; Secretary; Treasurer, District 2; College Liaison; District 3; District 4; District 5; District 6; District 7; District 8; District 9; District 12; District 13 & Cross Country Clinic Co-Chairman; District 14; District 15; District 16; Track Clinic Chairman; Middle School Indoor State Chair; Indoor State Meet Chair; Historian / Longevity; Hall of Fame Chairman and Mid-East XC Meet Chair; Awards Chairman; TF Clinic Registrar; Constitution; Academic All-Ohio Chair.
- **Track & Field clinic, 2**: the two hotel phone numbers (clinic hotel and the overflow hotel, Aloft at Easton).

Leadership shows names and roles only (handoff). Also left off there: each person's school, one mailing address, the contact-form email behind each card (not shown on oatccc.com) and the pop-up bios.

Every email address shown on the moved oatccc.com pages is kept exactly as it appears (Zachary, 2026-11-17). There are two: the Middle School Indoor State Chair's school address on the Middle School page, and one personal Gmail address inside a Hall of Fame bio (David Kirk's; it comes from the database, not git). The Coaching Longevity page's address (also personal) is on a page that does not move. **Worth a look:** the Gmail address in a bio is a personal email on a public page.

## Can't move yet (stays on oatccc.com)

- Contact form (Contact-Us) and the contact-form email behind each officer
- Mailing list sign-up (/Mailing-List/)
- Donation page (/Donate/) and the sponsor inquiry form (Lend Your Support)
- Clinic registration and payment (/Clinics/Track-And-Field/Register/, /Clinics/Cross-Country/Register/)
- Membership payment (Join buttons link to oatccc.com)
- oatccc.com online forms (`/Forms/Submit-Form/`): the six "online form" buttons on the Marv Crosten page and the "Online Form" links on Forms (those links still point to oatccc.com)
- Coaching Longevity page (/Awards/Coaching-Longevity-Form/): not in the handoff's list
- oatccc.com News, Privacy Policy and Website Accessibility Statement: oatccc.com's own pages

## Migration and scripts

- `install/103_OATCCC_HALL_OF_FAME.sql`: NOT run. Inductees, awards, award recipients; public read, writes only with the server key.
- `scripts/import-oatccc-hall-of-fame.mjs`: NOT run (dry run only). After 103: `node --env-file=../podium_watch_site/.env.local scripts/import-oatccc-hall-of-fame.mjs --apply`. 58 award recipients are linked to an inductee by exact name only; they are listed in the preview for the OATCCC to check.
- `scripts/oatccc-crawl.mjs`, `scripts/oatccc-port-pages.mjs` (+ `oatccc-port-special.mjs`), `scripts/oatccc-redirect-map.mjs`, `scripts/oatccc-check-links.mjs`: run; output only in `_private/`.
- `scripts/oatccc-upload-files.mjs`: run once (approved): created the public bucket `oatccc-public` and copied 1,007 files. Safe to run again (skips what is there).
