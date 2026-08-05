# Podium Watch recruiting Phase One architecture report

Status: approved 2026-08-04 (see section 9). No database, code, or content changes have been made yet — Phase Two implementation begins only when explicitly requested.

Prepared 2026-08-04, after the Phase Zero import and release safety cleanup was deployed and confirmed live.

This report is the complete Phase One deliverable: an audit of what exists, what can be reused, what is incomplete or duplicated, and a proposed architecture for the next phase of recruiting work. Nothing in this report has been built. Every open question is listed in section 9 for explicit approval before any Phase Two implementation begins.

## 1. What already exists

Podium Watch already has three layered systems that together form most of a recruiting platform. They were built in separate sessions but share a common identity layer.

### 1.1 Statewide school foundation (migration 01)

- `ohio_schools`, `ohio_school_aliases`, `ohio_school_divisions`, `ohio_tournament_sites`, `ohio_data_sources`, `ohio_import_batches`, `ohio_data_conflicts`.
- One official identity per Ohio school (OHSAA school ID, name, city, athletic district, division history), separate from public team pages.
- `team_pages.ohio_school_id` links a public team page to its official school record.
- Public page: `/ohio-schools/`. Admin page: `/admin/statewide-data/`.
- All tables have RLS enabled, all grants revoked from `anon`/`authenticated`, all access through `service_role` only.

### 1.2 Athlete profile foundation (migration 02)

- `athlete_profiles` is the single permanent identity per athlete: name, gender, graduation year, current school/team, status, verification status, `public_visible`/`suspended`/`archived_at`, and a recruiting consent block (`recruiting_enabled`, `recruiting_consent_confirmed`, `recruiting_contact_route`).
- Supporting tables: `athlete_profile_aliases` (alternate names), `athlete_school_history` (school by season), `athlete_performances` (sourced marks), `athlete_ranking_entries` (editorial ranking connections, already has `rank` and `previous_rank`), `athlete_story_links` (articles/awards), `athlete_profile_corrections` (public correction queue), `athlete_import_batches`, `athlete_profile_merges`.
- `team_athletes.athlete_profile_id` links a seasonal roster row to the permanent profile.
- Two SQL functions do the heavy lifting: `athlete_commit_seed_import_v1` (seed import, matches by name/gender/grad-year/school, never overwrites a verified profile with weaker data) and `athlete_merge_profiles_v1` (moves school history, performances, rankings, stories, corrections, and roster links from a duplicate profile into the surviving one, with a permanent audit row).
- The bundled seed is 200 athletes in 8 groups of 25 (one group per division/gender combination for 2026 cross country). 196 of 200 matched an official school automatically.
- Public pages: `/athletes/` (search), `/athlete/` and `/athletes/<slug>/` (profile). Admin page: `/admin/athletes/` (`api/admin/athletes.js`: `status`, `preview_seed`, `commit_seed`, `search`, `get`, `save_profile`, `save_performance`, `archive_performance`, `resolve_correction`, `merge_profiles`).

### 1.3 Recruit Ratings and performance history (migration 03)

- `athlete_event_catalog` / `athlete_event_aliases`: 35 normalized events across cross country and track, each with an `event_group` (currently `distance`, `sprints`, `hurdles`, `jumps`, `pole_vault`, `throws`, `multis`, `other`, plus `relays` allowed on performances only), a measurement type, and sort direction.
- `athlete_performances` gained `event_group`, `measurement_type`, `mark_sort_value`, `sort_direction`, `wind_legal`, `course_context`, `import_batch_id`, `result_status`.
- `athlete_recruit_rating_methodologies`: versioned rubric definitions. One active row today, `podium-watch-recruit-ratings-2026-1`.
- `athlete_recruit_ratings`: one row per `(profile_id, methodology_id, event_group)`. Score 70-100, derived star (1-5) computed by trigger, projection level, confidence level, evaluation text, top verified mark, `based_on_verified_data`, `data_cutoff_date`, `status` (draft/published/archived).
- A trigger (`require_publishable_recruit_rating`) independently enforces publication rules in the database: a published rating needs a score, at least one source-linked-or-verified performance in the matching event group, a written evaluation of 40+ characters, and a data cutoff date. This cannot be bypassed by the API layer.
- `athlete_recruiting_activity`: interest/offer/visit/commitment/signing, with verification labels (reported, confirmed by athlete, confirmed by coach, publicly announced, disputed). Public visibility requires a source URL and a confirmed/publicly-announced status.
- `athlete_performance_import_batches` / `athlete_performance_import_rows`: the audited CSV/paste importer covered in the Phase Zero cleanup. Requires meet name, meet date, and place; forces `public_visible = false`; never creates a profile from an unmatched row; identifies duplicates by athlete/school/event/mark/meet/date/place.
- Two views compute public output live, with no separate ranking-storage table: `athlete_best_performances` (best sourced mark per profile/event/sport) and `athlete_published_recruit_ratings` (adds `state_class_rank`, partitioned by graduation year + gender, and `event_group_rank`, partitioned by graduation year + gender + event group, both computed with `dense_rank()` over published ratings only).
- Public API `/api/recruiting` (`api/recruiting/index.js`) is a fully built search endpoint: joins ratings to profile/school/team/best-performances/activity, filters by search text, gender, graduation year, event group, primary event, minimum stars/score, commitment status, max time, min mark, recruiting-enabled-only; sorts by score/name/class; paginates; returns a methodology block and per-field summary counts. Public page `/recruiting/` and `/public/scripts/recruiting-directory.js` already consume it. `/recruiting/methodology/` explains the rubric publicly.
- Admin page `/admin/recruiting/` (`api/admin/recruiting.js`) already supports: status dashboard, athlete search, rating save (with all the trigger's requirements enforced client-side too), recruiting activity save/archive, and the import preview/commit flow just hardened in Phase Zero.
- **The individual athlete profile page already renders recruiting data.** `src/pages/athletedetail.mjs` has a recruit-rating panel (score circle, stars, two rank tiles) and a recruiting-timeline panel, both populated from `/api/athletes/detail`, which already joins `athlete_published_recruit_ratings` and `athlete_recruiting_activity` (`api/athletes/detail.js:364,369`). This is not a placeholder — it is wired end to end, just currently empty because no rating has been published yet.

### 1.4 Adjacent systems worth knowing about

- **Results ingestion (migrations 04-05)** is a separate, general-purpose meet-results crawler/importer: `results_source_providers`, `discovered_meets`, `result_ingestion_jobs`, `result_crawl_pages`/`result_crawl_edges`, `result_source_documents`, `result_staging_rows`, `result_ingestion_audit`, `result_provider_adapters`. It has its own parsing library (`lib/result_parsers.mjs`, `lib/result_ingestion_engine.mjs`) and admin page `/admin/results-sources/`. It does not currently write into `athlete_performances` or `athlete_performance_import_rows` — it is not connected to the recruiting/athlete performance pipeline at all today.
- **Team content** (`team_content_items`, `api/admin/team-content.js`) already models a generic per-team content item with a `content_type` (announcement/achievement/result/coverage/media), status, and featured flag. No equivalent table exists yet for an individual athlete.
- **Auth boundary** is consistent and simple across every admin system checked: `lib/admin_auth.mjs` issues an HMAC-signed, `HttpOnly` cookie session after a shared `PODIUM_ADMIN_PASSWORD` check; every admin API route calls `isAdminRequest(request)` before doing anything. `lib/supabase-admin.mjs` is the only Supabase client used anywhere in `api/` and `lib/` for this domain — it uses the secret service-role key and is imported only in server files. Every table in migrations 01-03 has RLS enabled and revokes all grants from `anon`/`authenticated`, so even if a bug ever exposed the publishable key to this data, Postgres itself would refuse the query. No browser code touches Supabase directly for schools, athletes, or recruiting data — everything goes through a Vercel API route first.

## 2. What can be reused without modification

| Need | Reuse instead of rebuilding |
|---|---|
| Athlete identity, aliases, school history, merges, duplicate detection | `athlete_profiles` + `athlete_school_history` + `athlete_profile_aliases` + `athlete_merge_profiles_v1` |
| Performance evidence, career bests | `athlete_performances` + `athlete_best_performances` view |
| Event catalog and mark parsing | `athlete_event_catalog`/`athlete_event_aliases` + `lib/recruiting_service.mjs` (`resolveEvent`, `parseMark`) |
| Rating publication safety | `require_publishable_recruit_rating()` trigger — this stays the source of truth even if the admin UI changes |
| Recruiting activity (offers/visits/commitments) | `athlete_recruiting_activity` table and its confirmed-or-announced-plus-source-link publication rule |
| Public recruiter search | `/api/recruiting` and `/recruiting/` — extend filters, do not rebuild |
| Individual profile display | `src/pages/athletedetail.mjs` recruit panels + `/api/athletes/detail` join — extend fields, do not rebuild |
| Admin auth | `lib/admin_auth.mjs` (`isAdminRequest`) unchanged |
| Server Supabase access | `lib/supabase-admin.mjs` unchanged; continue the rule that no new table gets `anon`/`authenticated` grants |
| Admin API shape | The single-endpoint, `action`-dispatched pattern in `api/admin/athletes.js` and `api/admin/recruiting.js` (`parseBody`, `fail()`, action `if/else` chain) — new admin actions should be added to `api/admin/recruiting.js` following this exact shape, not a new API file |
| Import preview-then-commit UX | The pattern already built in `adminrecruiting.mjs`/`admin-recruiting.js` (preview shows row status and blocks commit on anything not `ready`) |
| Editorial rank/previous-rank pattern | `athlete_ranking_entries.rank`/`previous_rank` already models rank movement for editorial rankings — the same column pair, on a new small table, is the natural way to add rank movement to Recruit Ratings (see section 4.3) |
| Media/content item shape | `team_content_items`' `content_type`/status/featured shape is a ready-made template for an athlete media table |

## 3. What is incomplete or duplicated

1. **Event group taxonomy does not match what you want to launch with.** Today's `event_group` values are `distance, sprints, hurdles, jumps, pole_vault, throws, multis, other` (+`relays` on performances only), and cross country and track distance events share the single `distance` bucket. You asked for `Cross Country, Distance, Middle Distance, Sprints, Hurdles, Jumps, Throws, Pole Vault, Combined Events`. This is a real schema change, not just a label change — see section 9, decision 1.
2. **Ranking has no memory.** `athlete_ranking_entries` (editorial rankings) has `previous_rank`, but the Recruit Ratings ranks (`state_class_rank`, `event_group_rank`) are computed live by a view every time it is queried — there is no snapshot, so "ranking movement" for Recruit Ratings cannot be shown today. Nothing recalculates or stores a "previous" value.
3. **No athlete media table.** `athlete_profiles.photo_url` is a single field. There is no gallery, no video, no per-item source/caption/credit, unlike the team-level `team_content_items`.
4. **No admin "preview as public" screen for a recruit profile.** The import tool previews *rows*, and the rating form previews nothing — an admin fills out the rating form and saves it as a draft, but cannot see what the public card/profile will look like before publishing. This is a real gap against your explicit ask for "previewing profiles."
5. **College interest/commitment is stored in two places.** `athlete_profiles` has `college_commitment`, `college_commitment_verified`, and a free-text `college_interests` field, while `athlete_recruiting_activity` separately records structured, sourced interest/offer/visit/commitment/signing rows (and a `commitment` activity with `public_visible=true` already writes back into `athlete_profiles.college_commitment` — see `api/admin/recruiting.js:661-670`). The free-text `college_interests` field has no writer anywhere in the admin UI I found, and no reader anywhere in the public API — it appears to be a stub from the original design that the activity table has since superseded.
6. **Two disconnected performance-import pipelines.** The Recruit Ratings importer (`athlete_performance_import_batches/rows`) and the general Results Source Manager/Ingestion Engine (`result_ingestion_jobs`, `result_staging_rows`, etc.) do not share code or data. A meet result discovered and staged by the crawler cannot flow into an athlete's recruiting profile without being re-entered through the separate CSV/paste tool. This may be intentional scope separation (team results vs. individual recruiting evidence) rather than a bug, but it is worth a deliberate decision rather than an accident (see section 9, decision 4).
7. **`athlete_published_recruit_ratings` ranks are not sport-aware today**, only because nothing forces it to be — `state_class_rank` partitions by graduation year + gender only, and `event_group_rank` adds event group. Since cross country and track distance currently share one event group, a cross country runner and a track 3200 runner compete for the same rank slot. Adopting the new taxonomy in decision 1 fixes this as a side effect, without adding a `sport` column anywhere.

## 4. Recommended database design

Recommendation: the **smallest additive migration** that closes the gaps in section 3, reusing every table in sections 1-2 unchanged. No existing table is dropped, renamed, or has data deleted.

### 4.1 Event group taxonomy migration

- Expand the `event_group` check constraint on `athlete_performances` and `athlete_recruit_ratings` to: `cross_country, distance, middle_distance, sprints, hurdles, jumps, pole_vault, throws, combined_events` (drop `multis`/`other`/`relays` from the allowed set, or keep `other` as an explicit fallback bucket — decision 2).
- Backfill `athlete_event_catalog.event_group` per `event_key`:
  - `xc_2_mile, xc_3k, xc_3200, xc_5k` → `cross_country`
  - `track_800, track_1000, track_1600, track_mile` → `middle_distance`
  - `track_3200, track_2_mile, track_5000` → `distance`
  - `track_60, track_100, track_200, track_300, track_400, track_500, track_600` → `sprints`
  - `hurdles_*` → `hurdles` (unchanged)
  - `high_jump, long_jump, triple_jump` → `jumps` (unchanged)
  - `pole_vault` → `pole_vault` (unchanged)
  - `shot_put, discus, weight_throw, hammer, javelin` → `throws` (unchanged)
  - `pentathlon, heptathlon, decathlon` → `combined_events` (renamed from `multis`)
- `track_600` and `track_800` are a judgment call between sprints/middle distance — flagged in decision 2 rather than decided here.
- Because this changes what a published rating's `event_group` means, add a new methodology row (`podium-watch-recruit-ratings-2026-2`) rather than editing `2026-1` in place, per the existing rule of never silently changing star bands or event definitions after publication. Since no rating has been published yet, this is a clean cutover with no live data to migrate.

### 4.2 Athlete media table

```
athlete_content_items
  id, created_at, updated_at, archived_at
  profile_id -> athlete_profiles (cascade)
  content_type check (photo, video, article, other)
  title, url, caption, credit
  source_label, source_url, source_type (reuse existing source_type values)
  status check (draft, published, hidden, archived)
  featured boolean default false
  sort_order integer
  created_by, updated_by
  metadata jsonb
```
Same RLS treatment as every other table here: enable RLS, revoke `anon`/`authenticated`, grant `service_role` only. This mirrors `team_content_items` closely enough that the admin UI patterns from `api/admin/team-content.js` can be adapted directly.

### 4.3 Ranking movement (smallest correct option)

Add a small snapshot table rather than columns on `athlete_recruit_ratings`, because a rank can move due to *another* athlete's change, not just this athlete's edit — a column updated only on save would miss that:

```
athlete_recruit_rating_rank_snapshots
  id, captured_at
  profile_id, methodology_id, event_group, graduation_year, gender
  state_class_rank, event_group_rank
```
Written once whenever ratings are recomputed (simplest first version: append a row from the existing `athlete_published_recruit_ratings` view every time an admin publishes/edits a rating; a scheduled recompute can be added later if you want movement to reflect other athletes' changes too, not just edits). The public API then compares the current view row to the most recent prior snapshot for that `(profile_id, event_group)` to show movement, the same way `athlete_ranking_entries.previous_rank` already works for editorial rankings.

### 4.4 No new "ranking set" table is recommended for the first launch

Your request to rank "by graduation class, gender, sport, and event group" is already satisfied by the existing `athlete_published_recruit_ratings` view's two partitions (`state_class_rank` by class+gender, `event_group_rank` by class+gender+event group), **once the taxonomy in 4.1 makes cross country its own group** — at that point sport-separation falls out for free, because a cross country mark and a track mark never share an event group. Building a separate manually-curated "ranking set" table would duplicate what the view already computes and would need its own publish/hide workflow. Recommend deferring this unless you specifically want hand-curated ranking order that overrides the score-based sort (flagged as decision 3).

### 4.5 College interest/commitment cleanup

Recommend deprecating `athlete_profiles.college_interests` (unused free-text field) in favor of reading current commitment/interest state from `athlete_recruiting_activity` rows, which already have sourcing and verification. `college_commitment`/`college_commitment_verified` on the profile can stay as a fast-read cache, since it is already kept in sync by the existing commitment-activity write-back logic — just stop treating `college_interests` as a separate input.

## 5. Recommended admin workflow

Extend `api/admin/recruiting.js` and `src/pages/adminrecruiting.mjs` rather than building a new admin surface, following the existing action-dispatch pattern:

1. **Create or connect an athlete** — already built (`/admin/athletes/` search + `save_profile`, plus the "Find athlete" panel already on `/admin/recruiting/`). No change needed.
2. **Assign rating and event group** — existing `save_rating` action, updated to accept the new 9-value event group set and the media/rank-snapshot additions above.
3. **Add evaluation, offers, commitments** — existing `save_activity` action, unchanged. Recommend removing the unused `college_interests` field from the rating/profile form per 4.5.
4. **Add media** — new actions (`save_content_item`, `archive_content_item`) added to `api/admin/recruiting.js` in the same shape as `save_rating`/`save_activity`.
5. **Preview before publishing (new)** — a new read-only action (e.g. `preview_public_profile`) that returns exactly what `/api/athletes/detail` and `/api/recruiting` would show for that profile if it were published right now, rendered in the admin page using the same panel markup `athletedetail.mjs` already has. This closes gap 3.4 without inventing new public-facing code — it reuses the existing render, just fed draft data before it goes live.
6. **Publish or hide** — existing `status` field on rating (`draft`/`published`/`archived`) and `public_visible` on profile/activity/content item. Nothing here needs a new state machine; drafts remain fully private (the database trigger already guarantees a draft can never leak through `athlete_published_recruit_ratings`, since that view filters on `status = 'published'`).

## 6. Public page and profile structure

No new public route is required for the first launch. What exists already covers the requested structure:

- **`/recruiting/`** — searchable/filterable directory (already built, already reads live from the database once ratings are published).
- **`/recruiting/methodology/`** — public rubric explanation (already built).
- **`/athlete/` and `/athletes/<slug>/`** — individual profile, already has a recruit-rating panel (score, stars, both ranks) and a recruiting-timeline panel wired to the same data. Once media exists (4.2), this page gains a media panel the same way, following the same hidden-until-populated pattern already used for the rating/timeline panels.
- **Correction submission** — already exists at the profile-foundation level (`athlete_profile_corrections`) and already includes a `performance` and `college_commitment` correction type, so recruiting-related corrections do not need a new endpoint.

The only structural addition recommended is the admin-only preview view in section 5.5. No public template changes, no new routes, no new pages are needed to reach the scope you described.

## 7. Security and privacy requirements

Carry forward the pattern already used by every table in migrations 01-03, unchanged:

1. Every new table gets RLS enabled, all grants revoked from `anon` and `authenticated`, and `grant all ... to service_role` only.
2. Every new admin action goes in a server file under `api/admin/`, gated by `isAdminRequest(request)` at the top of the handler, exactly like the existing actions.
3. No browser code receives the Supabase secret key; no browser code queries these tables directly at all (this domain does not use the publishable-key pattern anywhere today, and there is no reason to start).
4. Public reads continue to go through `/api/recruiting` and `/api/athletes/detail`, which already filter to `public_visible = true`, `suspended = false`, `archived_at is null`, and (for ratings) `status = 'published'` — new fields (media, rank snapshots) must be added to these same filtered queries, not exposed through a new unfiltered endpoint.
5. No private contact information (email, phone, guardian info) is introduced by anything in this report. Recruiting contact remains routed through the team page or a future Podium Watch-approved connection process, per the existing `recruiting_contact_route` field.
6. New tables follow the existing consent boundary: nothing recruiting-related becomes public unless `recruiting_enabled` and `recruiting_consent_confirmed` are both true on the athlete profile — this is already enforced by the `require_athlete_recruiting_consent` trigger and needs no change.

## 8. Exact files and database objects that would change in Phase Two

**New migration:** `install/06_RECRUITING_TAXONOMY_AND_MEDIA.sql` (or similar name), additive only, containing:
- Updated `event_group` check constraints on `athlete_performances` and `athlete_recruit_ratings`.
- Backfill update of `athlete_event_catalog.event_group` per event key.
- New methodology row `podium-watch-recruit-ratings-2026-2`.
- New table `athlete_content_items` with RLS/grants matching existing tables.
- New table `athlete_recruit_rating_rank_snapshots` with RLS/grants matching existing tables.

**Changed files:**
- `lib/recruiting_service.mjs` — update `EVENT_GROUPS` set and any group-label mappings; add snapshot-write helper.
- `api/admin/recruiting.js` — add `save_content_item`, `archive_content_item`, `preview_public_profile` actions; update `saveRating` for the new event group set.
- `api/recruiting/index.js` — extend `applyFilters`/`summary`/response shape to include rank movement and media where relevant.
- `api/athletes/detail.js` — join `athlete_content_items` and the latest rank snapshot alongside the existing rating/activity joins.
- `src/pages/adminrecruiting.mjs` + `public/scripts/admin-recruiting.js` — new media form, new profile-preview panel, updated event group `<select>` options.
- `src/pages/athletedetail.mjs` + its browser script — new media panel, rank-movement indicator.
- `scripts/test-recruiting-foundation.mjs` — new assertions for the taxonomy backfill, the new tables' safety rules, and the preview action.
- `docs/RECRUIT_RATINGS_AND_PERFORMANCE_HISTORY.md` and `docs/DECISIONS.md` — updated to record the new taxonomy as a new methodology version, per project convention.

**Unchanged (confirmed reusable as-is):** `athlete_profiles`, `athlete_school_history`, `athlete_profile_aliases`, `athlete_performances` (columns unchanged, only constraint values), `athlete_best_performances` view, `athlete_recruiting_activity`, `athlete_performance_import_batches/rows`, `lib/admin_auth.mjs`, `lib/supabase-admin.mjs`, `lib/athlete_foundation_service.mjs`, `api/admin/athletes.js`.

## 9. Major decisions — approved 2026-08-04

1. **Adopt the new 9-value event group taxonomy.** Approved. Cross Country, Distance, Middle Distance, Sprints, Hurdles, Jumps, Pole Vault, Throws, Combined Events. Retire the current 8-value set and record it as methodology version `2026-2`, since no rating has been published yet and the cutover is free today.
2. **600m and 800m classification.** Approved: 800m → Middle Distance, 600m → Sprints. An `other` fallback bucket stays available for events that don't cleanly classify (kept by default since this wasn't explicitly overridden).
3. **Ranking sets.** Approved: no hand-curated ranking sets. The existing live-computed view (state class rank + event group rank, sorted by score) is sufficient for the first launch; the taxonomy change alone gives sport separation for free.
4. **Results ingestion overlap.** Approved: keep the recruiting performance importer and the Results Source Manager/Ingestion Engine permanently separate for now. No coupling work in Phase Two.
5. **First-launch scope.** Approved: one graduation class, about 25 athletes, one gender — matching the existing seed's group size. Every recommendation in sections 4-6 (including deferring ranking sets) assumes this scope.

## 10. Controlled implementation order for the remaining phases

Nothing below is built. This is the order recommended once decisions 1-5 are approved.

1. Write and manually test migration 06 in Supabase (taxonomy, media table, rank snapshot table, new methodology row). Confirm existing tests still pass unchanged.
2. Update `lib/recruiting_service.mjs` event group set and add snapshot-write helper; extend `scripts/test-recruiting-foundation.mjs` for the new rules before touching any UI.
3. Extend `api/admin/recruiting.js` with the media and profile-preview actions; extend `src/pages/adminrecruiting.mjs`/`admin-recruiting.js` for the corresponding forms.
4. Extend `api/athletes/detail.js` and `api/recruiting/index.js` to surface media and rank movement; extend `athletedetail.mjs` and its script for the new panel.
5. Manually test end to end with the same one-incomplete-row/one-complete-row discipline used in the Phase Zero verification: create one athlete, add one sourced performance, create one draft rating, preview it privately, then publish it and confirm it appears correctly on `/recruiting/`, the athlete's own profile page, and nowhere else.
6. Update `docs/RECRUIT_RATINGS_AND_PERFORMANCE_HISTORY.md`, `docs/DECISIONS.md`, `docs/NEXT_SESSION.md`, and `docs/SESSION_LOG.md` to record the new methodology version and the Phase Two changes, matching the documentation discipline used for Phase Zero.
7. Only after your explicit approval: commit, push, and deploy, then confirm the live site the same way Phase Zero was confirmed.
