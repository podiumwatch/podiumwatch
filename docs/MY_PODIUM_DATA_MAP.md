# My Podium Data Map

Every source below was inspected directly against real production Supabase data during this build (2026-08-28), not assumed from schema names. Where a capability is not reliable, that is stated plainly rather than worked around with invented data.

## 1. Existing data sources and how My Podium reaches them

| Source | Reached via | Notes |
|---|---|---|
| Teams (schools) | `POST /api/teams/` (search), `POST /api/teams/detail/` (by slug) | Public, no auth. Backed by `team_pages`. |
| Meets | `GET /api/meets/` | Public, no auth. Shared with the Meet Center and the `ohio-today.js` module — My Podium reuses this exact module rather than a second fetch path. |
| Team↔meet schedule | `team_meet_connections`, surfaced inside `api/teams/detail.js`'s response (`schedule` array) | Real join table; each row carries `sport_scope`/`program_scope`, letting a schedule differentiate boys/girls/cross-country/track for one school. |
| Athletes | `POST /api/athletes/` (directory/search), `POST /api/athletes/detail/` (single profile) | Public, no auth. Was returning HTTP 500 in production before this build (see §4). |
| Rankings | `content/rankings/*.csv`, compiled at build time into `dist/rankings/**` and story-adjacent JSON | Legitimately build-time-static — rankings only change on rebuild/redeploy, unlike meets. |
| Stories | `content/stories/*.md`, compiled at build time | Frontmatter: `title`, `category`, `tags` (free-text, not structured), `date`, `author`, `featuredImage`. |
| Fan Poll | `POST /api/fan-poll/` | Weekly cadence (`voting_opens`/`voting_closes`/`status`), not daily. Already used by the homepage's Vote Now banner — My Podium's poll card calls the same endpoint. |
| Ohio "today" | `public/scripts/ohio-today.js` (`window.PodiumOhioToday`) | Shared client module computing Ohio's real `America/New_York` calendar day from live `/api/meets/` data. My Podium imports this rather than recomputing dates itself. |

## 2. Supabase tables touched (all read-only from My Podium's perspective)

- `team_pages` — school/team identity, branding, and **real per-sport-per-gender division columns**: `cross_country_boys_division`, `cross_country_girls_division`, `track_boys_division`, `track_girls_division`. This is the reason My Podium never asks a visitor to type their division.
- `team_meet_connections` — `team_id`, `meet_id`, `sport_scope`, `program_scope`, `schedule_note`, `results_url_override`, `published`. The one reliable team→meet relationship in the system.
- `meets` — full meet record, including the real result-link fields (`results_url`, `athleticnet_url`, `milesplit_url`, `preview_article_url`, `recap_article_url`).
- `athlete_profiles` — 846 real, `public_visible=true`, non-suspended rows in production as of this build. Real `id` (UUID) and `slug`.
- `athlete_ranking_entries` / `athlete_performances` — joined onto athlete profiles for ranking/top-performance display.
- `fan_poll_weeks` / poll results — via `lib/fan_poll_service.mjs`, unchanged.
- No new table, column, or migration was created for this build.

## 3. Identifiers — what's real vs. what must never be treated as an identifier

- **School/Team**: `team_pages.id` (UUID) and `.slug` are both real and stable. My Podium's local preference store keeps both — `id` for API calls, `slug` for building links — never just the display name.
- **Athlete**: `athlete_profiles.id` (UUID, database mode) or `.slug` when the directory falls back to its bundled editorial seed (only happens if the `athlete_profiles` table is ever empty — confirmed NOT the current production state, 846 real rows exist). My Podium's preference store keeps whichever the search result actually returned; it never assumes one or the other.
- **Meet**: `meets.id` / `.slug`.
- **Division**: derived, not asked — read directly from the followed team's own `cross_country_*_division` / `track_*_division` column once sport+gender are known.
- **Sport / Gender**: closed choices the visitor picks explicitly (`cross_country`/`track_and_field`, `boys`/`girls`) — not inferred, since `team_pages.program_scope` is frequently `"combined"` and does not reliably imply a single gender.

## 4. Unreliable or missing relationships (confirmed by direct inspection, not assumed)

- **Ranking history/movement**: `previousRank` exists as a real CSV column but is **empty on every published ranking row right now** (this is the site's first, preseason-only ranking cycle). My Podium shows current rank + date only. The column will start carrying real data once a second ranking cycle publishes — no code change will be needed then, since the field is already read, just currently blank.
- **Story ↔ team/athlete/division tagging**: story `tags` are free-text prose fragments extracted from article bodies, not structured references to a team, athlete, or division id. My Podium's Stories card therefore personalizes only at the **category** level (Cross Country vs. Track and Field vs. general Podium Watch news) — a real, structured field — rather than claiming a story is "about" a specific followed team when that relationship isn't actually verifiable.
- **Sitewide "is anything live right now"**: `race_sessions.status = 'live'` is real but scoped per timing session, with no aggregation to "is my followed team's race live." My Podium never shows "Live" from a date match; it uses `today` / `scheduled` / `results pending` / `results available` only.
- **Personal records / season bests**: `athlete_performances` rows are real but this build's audit found no guarantee of a complete historical set per athlete (a PR claim requires knowing about *every* past performance, not just the ones ingested so far) — asserting a PR here risks a false claim, so it is not attempted. Documented under Project 6 instead.
- **`api/team/roster.js` has no `public_visible` filtering today** — a pre-existing gap noted in an earlier session's plan, unrelated to My Podium and out of scope for this build.

## 5. A real bug found and fixed during this audit

`POST /api/athletes/` was failing with HTTP 500 in production (confirmed live, then reproduced locally against real Supabase data) because two `.in("profile_id", profileIds)` queries in `api/athletes/index.js` sent the full 846-id list as one PostgREST `.in()` query-string parameter — well past the point (empirically ~300–400 ids) where the request URL exceeds the server's length limit, returning a bare "Bad Request" that the handler then reported as a generic load failure. Fixed by batching both queries into chunks of 150 ids and merging + re-sorting the results client-side, preserving the exact original "first entry wins" per-profile behavior. This was blocking the public `/athletes/` page for every visitor, independent of My Podium — fixing it was necessary to honestly assess whether "My Athletes" was a viable My Podium capability at all.

## 6. Which My Podium cards are supported now, with real data

| Card | Status | Source |
|---|---|---|
| My Team / personal context | ✅ Real | `team_pages` via `api/teams/detail.js` |
| My Sport / Gender | ✅ Real (visitor-selected, closed choices) | Local preference store |
| My Division | ✅ Real (derived, not asked) | `team_pages.cross_country_*_division` / `track_*_division` |
| My Athletes | ✅ Real (optional) | `athlete_profiles` via the fixed `api/athletes/index.js` |
| Next meet | ✅ Real when the team has a connected schedule | `team_meet_connections` + `meets` |
| Latest result | ✅ Real, honest "pending" label when no result link exists yet | `meets.results_url`/`athleticnet_url`/`milesplit_url` |
| Rankings (current) | ✅ Real | `content/rankings/*.csv` |
| Rankings (movement) | ⛔ Not shown — no previous snapshot exists yet | same CSVs, `previousRank` column |
| Stories | ⚠️ Partial — category-level relevance only | `content/stories/*.md` |
| This week's poll | ✅ Real (weekly, not daily) | `api/fan-poll/` |
| Race Day states | ✅ Real (Today/Scheduled/Results pending/available); ⛔ "Live" never shown from a date | `team_meet_connections` + `meets.meet_date` in `America/New_York` |
| My Events | ⛔ Deferred | No consistent event-name identifier across rankings/results yet |
| Personal records / Season | ⛔ Deferred to Project 6 | Incomplete historical performance set |
| Podium Cards (shareable) | ⛔ Deferred to Project 6 | Depends on the same incomplete history |
| Cross-device sync (My Podium account) | ✅ Real (2026-08-28) | `my_podium_accounts`, open self-serve Supabase Auth (mirrors `team_auth.mjs`/`photographer_auth.mjs`) |
| Email alerts | ✅ Real, wired in (2026-08-28) | Existing `team_followers`/`team_follows`/`lib/engagement_service.mjs` — sending blocked until `RESEND_API_KEY`/`RESEND_FROM_EMAIL` are configured in production |
| Verified athlete profile claims / ranking alerts / parent-guardian controls | ⛔ Still deferred | See `MY_PODIUM_MASTER_BUILD_PLAN.md` §7 |
