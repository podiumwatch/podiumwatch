# Podium Watch full-site health check -- 2026-08-06

Investigation only. Nothing in this report was fixed, committed, pushed, or deployed -- see `docs/NEXT_SESSION.md` for what's queued up as a result.

## Headline result

**61 unique pages checked (122 page loads: every page at both a desktop and a real phone width), plus interactive elements, forms, admin login, and the mobile menu. Zero real bugs found.**

Every anomaly the automated sweep initially flagged was individually chased down to a specific, confirmed root cause. All of them turned out to be artifacts of the test setup itself (a selector matching the wrong element, a wait strategy unsuited to an analytics beacon, a bad guess at a URL) rather than problems with the site. Each one is documented below rather than silently discarded, so the investigation is checkable, not just asserted.

## Methodology

### Getting a real local server running (this took real troubleshooting)

The request was to run this against `npx.cmd vercel dev`, not production. That did not work as-is, for two separate reasons, both investigated rather than worked around silently:

1. **`vercel dev` (linked to the real project) always deferred to a remote-configured `devCommand` override** (`npm run preview`), which only serves static files -- no `/api/*` routes at all. This setting lives on the actual Vercel project (fetched fresh on every `vercel dev` run during its "Retrieving project..." step), not in any local or git-tracked file, so it could not be fixed by editing anything in the repo.
2. **`vercel dev --local`** (explicitly unlinked from the project, which does bypass that remote setting) hit a broken `yarn` auto-detection step in this environment (`'yarn' is not recognized as an internal or external command`) and never reliably served requests.

Both attempts are visible in this session's shell history. Rather than settling for a static-only server (which would have made testing forms, admin login, and every API-backed page impossible) or silently deploying to test against production, I wrote a small local server (`_tmp_health_check_server.mjs`, deleted after this check) that serves `dist/` exactly like `scripts/serve.mjs` already does, and for `/api/*` requests dynamically imports and calls the real, unmodified handler file from `api/**/*.js` -- the exact same application code Vercel would run, just dispatched by hand instead of through the Vercel CLI. This was verified against real data before any real testing started (a real team search, a real admin login) to confirm it behaves like the real API, not a mock of it.

`.vercel/project.json` and `.vercel/` itself were briefly moved aside while diagnosing the two options above; both are gitignored, local-machine-only files, and both were fully restored to their exact original state before this check finished (confirmed with a byte-for-byte diff).

### The database is shared -- what was and wasn't safe to fully test

This project's local dev and production environments use the same Supabase project. That shaped how "submit a form with valid data" was handled:

- **Search and filter forms** (team directory, athlete directory, Ohio schools, recruiting) are read-only. Fully tested with real valid and invalid input.
- **The team Instagram submission form** is the one feature on this site designed to go instantly live with no review step. Testing it with a real "valid" submission would have instantly changed a real team's real public page. Only the rejection path (invalid handle format) was exercised against real data; the acceptance path is covered by this feature's own existing automated tests (`scripts/test-team-instagram.mjs`) instead.
- **Submit Results** stays hidden pending admin review regardless of outcome, and never touches any specific real team, athlete, or meet's live page, so a real, clearly-labeled test submission was completed end-to-end. It created one real row: `result_ingestion_jobs.id = 8ce523a2-0dc0-434d-af32-f1a6389792f4` (meet name `PODIUM WATCH HEALTH CHECK TEST -- SAFE TO DELETE`, submitter email `healthcheck-test@podiumwatch.invalid`, using the IANA-reserved `.invalid` TLD so no real address was contacted). It is not public and never will be without a separate admin action. Safe to delete, or to leave as an inert row -- your call.
- **Admin destructive actions** (the Team Instagram change history's "Revert to this" button) were checked only up to their `confirm()` prompt, which was dismissed, not accepted -- confirms the button is correctly wired without actually reverting any real data. In this case the change history was empty (the feature has had no real public submissions yet since its migration was only run earlier today), so this was additionally verified by reading `public/scripts/admin-team-instagram.js` directly.
- **Claim Your Team, Athlete/Team of the Week, Follow, and Contact** were not completed with real "valid" submissions, since each would create a real, real-looking record (a claim request, a vote, a nomination, a subscription, a contact message) with no test-only distinction. Claim Your Team's actual CTA (there's no form on that page, only links) was verified instead.

### Admin access

Logged in through the real `/admin/` sign-in form using the real password from `.env.local`, the same way a human would. Confirmed the session persisted correctly across all 12 distinct admin tool pages.

## Results by category

### Pages loaded without a console error or broken network request

All 61 pages, at both viewports (122 total loads). Every page returned the correct HTTP status: `200` for real pages, `404` for a deliberately nonexistent page and for API calls made with deliberately fake identifiers (both correct, expected behavior, not bugs).

<details>
<summary>Full list of pages checked, by type</summary>

**Homepage:** `/`

**Stories:** index, 3 individual story pages, 1 category page

**Rankings:** index, methodology, 2 sport index pages, 4 division detail pages (spread across cross country/track, boys/girls)

**Meets:** index, meet detail with no slug, meet detail with a fake slug

**Teams:** directory, 1 claimed team profile, 3 unclaimed team profiles, 1 fake-slug profile

**Ohio Schools:** directory

**Claim Your Team, Submit Results:** 1 each

**Athletes:** directory, 3 individual profiles, 1 fake-slug profile

**Recruiting:** database, methodology

**Search:** the dedicated search page

**Weekly Awards:** Athlete of the Week, Team of the Week

**Tournament Hub, Athlete Spotlights, Interviews:** 1 each

**Static:** About, Sponsors, Contact, Privacy, Follow

**Team auth (unauthenticated state):** Team login, Team editor, Team dashboard -- all correctly show a sign-in requirement rather than any real team's data

**Admin (all 12 tools, real login):** dashboard, Teams, Team Manager, Team Schedules, Team Rosters, Team Content, Engagement, Operations, Statewide Data, Athletes, Recruiting, Results Sources, Team Instagram

**404 handling:** a deliberately nonexistent URL

</details>

### Broken images

None found. Every `<img>` with a real `src` across all 61 pages, both viewports, loaded successfully (checked via `naturalWidth`, not just presence in the DOM).

### Responsive layout (desktop 1440px and a real phone width, 390px)

No horizontal overflow anywhere. `document.documentElement.scrollWidth` never exceeded `clientWidth` on any of the 122 page loads, at either width.

### Mobile menu

Tested on two separate pages (Homepage and Rankings index), each through the full cycle: open via the menu button, close via clicking the overlay, reopen, close via the Escape key. All four transitions worked correctly and consistently on both pages -- `aria-expanded` and the nav's `data-open` state changed correctly at every step.

### Global search dialog

Opens via its header button, accepts input, closes via its close button, and correctly leaves no `open` attribute behind afterward.

### Search and filter forms (real valid input)

All four tested end-to-end with real queries against the real database:

| Page | Query | Result |
|---|---|---|
| Team directory | "Russia" | List correctly narrowed from all 556 teams down to exactly the one matching team |
| Ohio schools directory | "Columbus" | List content expanded from ~1,400 to ~10,000 characters of matching rows |
| Athlete directory | "Aaron" | URL updated to `?search=Aaron&page=1&page_size=24`, a real server-driven search |
| Recruiting database | "2027" | URL updated to `?search=2027&sort=rating&page=1&page_size=50` |

Two of these (team directory, Ohio schools) filter client-side without changing the URL; the other two use a server-driven, URL-reflected search. Both are legitimate, working patterns -- not a bug, just two different implementations. This was specifically double-checked (see "False leads" below) after the first pass reported a false negative here.

### Form validation (invalid input correctly rejected)

- **Team Instagram submission:** typing `!!! not a valid handle !!!` and submitting produced the correct message: *"That doesn't look like a valid Instagram handle. Use only letters, numbers, periods, and underscores."* -- rejected before any network request, matching the documented validation order in `lib/team_instagram_service.mjs`.
- **Submit Results:** submitting the empty form triggered the browser's native required-field validation (*"Please fill out this field."*) and did not send a request.
- **Submit Results, valid data:** a complete, clearly-labeled test submission (see the Methodology section above) was accepted and queued for review -- confirming the accept path also works, not just the reject path.

### Admin

- Real sign-in through the actual login form worked correctly (session persisted across all 12 admin tool pages, no re-login required).
- The Team Instagram admin page's revert button is gated by `window.confirm(...)` before it calls the revert action (verified in `public/scripts/admin-team-instagram.js`); no revertible rows exist yet to click, since the feature has had zero real public submissions since `install/07_TEAM_INSTAGRAM_SUBMISSIONS.sql` was run earlier today.
- All 12 admin tool pages loaded cleanly with a real authenticated session and no console or network errors beyond the universal, expected pattern described below.

## The one pattern seen on every single page (expected, not a bug)

Every page load showed exactly one console error and two failed network requests:

```
404 GET /_vercel/insights/script.js
404 GET /_vercel/speed-insights/script.js
```

These come from the `@vercel/analytics` and `@vercel/speed-insights` packages (both real dependencies in `package.json`, used correctly). Vercel injects the actual script files at these paths only on real deployments, at the edge network level -- they do not exist in `dist/`, and would 404 in *any* local dev server, including a fully working `vercel dev`. This is not specific to the custom server used for this check. No further action needed; this is standard behavior for local development on Vercel projects.

## False leads chased down and ruled out

In the interest of a genuinely checkable report, every anomaly the first pass of automation reported is listed here with its real cause -- not quietly dropped once explained.

1. **Nearly every page appeared to hang at a 20-second timeout on the first sweep.** Root cause: the wait strategy (`waitUntil: "networkidle"`) never resolved because of `fetch(..., { keepalive: true })` analytics beacons (`public/scripts/engagement.js`'s `track()` function) -- a known Chromium/Playwright interaction where such requests can appear permanently pending against a minimal HTTP server, confirmed unrelated to the real endpoint by calling it directly with `curl` (0.7 seconds, correct response). Fixed by switching to `domcontentloaded` plus a fixed settle delay and re-running the full sweep cleanly.
2. **The admin login appeared to fail via the UI.** Root cause: my own test selector (`button[type="submit"]`) matched 5 different submit buttons on the admin dashboard page (search, sign-in, create-meet, import-meets, and a "Delete permanently" button inside a hidden dialog), and Playwright correctly refused to guess which one to click. Scoping the selector to `[data-admin-login] button[type="submit"]` fixed it; the real login flow works correctly.
3. **`GET /api/admin/teams-import` returned 405 while loading the admin Teams page.** This is deliberate, working code: `checkAdminAccess()` in `public/scripts/admin-team-import.js` intentionally GETs a POST-only endpoint as an authentication probe -- a `405` proves the request got past the auth check (proving a valid session) before failing on method; a `401` would mean no valid session. Confirmed the server checks auth *before* method (`api/admin/teams-import.js` line 1084 before line 1090), so this probe cannot be tricked by an unauthenticated visitor. Unconventional, but correct and safe.
4. **Team directory and Ohio schools search appeared to do nothing** (URL unchanged after submitting). First checked with a selector that (via a stray `main` fallback) matched two elements and silently fell back to error text. Rechecked properly: team directory's result list correctly shrank from all 556 teams to exactly the one matching card; Ohio schools' result content correctly grew to include the matching rows. Both work; they simply filter client-side without touching the URL, unlike the athlete/recruiting search forms.
5. **My own guessed test URL for the story category page** (`/stories/category/?category=Cross%20Country`) 404'd. The real URL pattern is `/stories/category/{slug}/` (confirmed in `scripts/build.mjs`'s `categoryPage` function); my guess was wrong, not the site. Retested against the real URL and it loads correctly.
6. **A stale background process from an earlier point in this session** left a "JWT issued at future" crash log sitting in an old task output. Checked whether this reproduces against a freshly started server: it did not. Every live Supabase call made during this entire health check (556-team searches, admin auth, the results submission, etc.) succeeded normally. Noting this only for completeness, since it surfaced during setup -- it is not a current, reproducible issue.

## Known gaps -- not fully tested, and why

1. **The team editor (`/team-editor/`), team dashboard, roster, schedule, and content pages were only confirmed to correctly require sign-in.** Testing them as an authenticated coach would need a real coach account's credentials, which weren't available, and creating one live would itself be a write to the real user database. Recommend a short follow-up session with a real (or deliberately throwaway, then deleted) coach account if deeper coverage of these pages is wanted.
2. **The `meets` table currently has zero published meets** in the live database, so `/meets/` and `/meetdetail/` were only checked in their empty/no-data state, which rendered correctly. Once real meets exist, worth a follow-up pass specifically on a populated meet detail page.
3. **The Team Instagram admin revert button's actual click-through behavior** (does reverting genuinely restore the previous handle) could not be exercised live, since no real submissions exist yet to revert. Confirmed correct by reading the code instead; recommend a real end-to-end check (submit a real test handle on a disposable team, then revert it) once the feature has real traffic, or as a deliberate, approved live test.
4. **Every admin tool's full interactive surface (every filter, every button) was not individually exhausted** -- 12 distinct tools is a lot of surface area. This check confirmed every admin page loads cleanly with a real session and no errors, and went deep on the one feature built earlier this session (Team Instagram). A future pass could go deep on the others (Operations, Recruiting, Results Sources) the same way.

## Test artifacts left behind

One real, clearly-labeled row: `result_ingestion_jobs.id = 8ce523a2-0dc0-434d-af32-f1a6389792f4`, meet name `PODIUM WATCH HEALTH CHECK TEST -- SAFE TO DELETE`. Hidden, not public, does not affect anything else. Delete it or leave it, whichever you'd prefer.

## Files involved in this check

`_tmp_health_check_server.mjs`, `_tmp_health_check.mjs`, `_tmp_health_check_deep.mjs`, and `_tmp_health_check_results.json` were used to run this check and have been deleted -- none were committed, and nothing about them was needed once this report was written. The local dev server process started for this check has also been stopped.
