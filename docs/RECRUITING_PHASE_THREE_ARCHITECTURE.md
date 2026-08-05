# Podium Watch recruiting Phase Three architecture report

Status: draft for approval. No database, code, or content changes were made to produce this report.

Prepared overnight 2026-08-05, after Phase Two (event group taxonomy, athlete media, ranking movement, admin profile preview) was implemented, migration 06 was run successfully, and three real bugs found during verification were fixed. See `docs/SESSION_LOG.md` (2026-08-05 entries) for that work.

This report covers the items explicitly deferred out of the first launch, listed in `docs/NEXT_SESSION.md`'s "Known limitations" and Phase One's decision log: self-service athlete/parent claims, scaling beyond the first launch's one class and one gender, and a scoring assist tool for admins. Like the Phase One report, nothing here is built — every open question is listed in section 5 for explicit approval before any implementation begins.

Two items from Phase One's "Known limitations" are intentionally **not** revisited here, because Phase One already made an explicit, approved decision on each and nothing has changed that would justify reopening them:

- **Hand-curated ranking sets** — Phase One decision 3 kept the live-computed ranking view instead. Revisit only if you want editorial override power over ranking order.
- **Connecting the Results Source Manager to the recruiting importer** — Phase One decision 4 kept them separate. Revisit only if re-entering the same meet result twice becomes a real pain point.

## 1. What Phase Two actually delivered

For accuracy, since this report follows immediately after Phase Two:

1. Nine group event taxonomy (Cross Country, Distance, Middle Distance, Sprints, Hurdles, Jumps, Pole Vault, Throws, Combined Events), live in methodology `2026.2`.
2. `athlete_content_items` (media) and `athlete_recruit_rating_rank_snapshots` (ranking movement), both additive tables following the existing RLS/grant pattern.
3. An admin "preview public profile" action that shows draft content as it would appear live, without publishing it.
4. Three real bugs found and fixed during verification: a `trailingSlash: true` routing issue that silently dropped query strings on three public-facing pages (now guarded against in `scripts/check.mjs`), and two places that hardcoded the retired methodology instead of looking up whichever one is active (the more serious of the two would have silently attached every new admin rating to the retired methodology going forward).
5. Zero real ratings, performances, or media exist yet. The write paths (media save/publish, rating draft/publish, rank movement) are code-reviewed but still need your own hands-on testing, since verifying them live requires writing to the same Supabase project production uses.

## 2. Self-service athlete and parent claims

### 2.1 What already exists that this can reuse

Podium Watch already has a complete, production-proven claim system for teams, and it is **not team-specific under the hood** — it is a generic "a real logged-in Supabase Auth user requests access to something, an admin or an automatic rule approves it" system:

- `lib/team_auth.mjs`'s `requireTeamUser(request)` does exactly one generic thing: verifies a Supabase Auth session token via `supabaseAdmin.auth.getUser(token)` and returns the real user record. Nothing about it is team-specific — the name just reflects its only current caller.
- `api/team/claim.js` is a thin wrapper: require a real user, validate a few fields, call a single Postgres RPC (`claim_team_page_v3`) that does the claim logic atomically (checks for an existing active access grant, checks for a pending duplicate claim, decides auto-approve vs. pending, records the claim), and returns whether access was granted immediately or is pending.
- `api/team/access.js` and `api/team/me.js` handle the "what can this logged-in user do" and "who is this user" side once a claim is approved.
- `/claim-your-team/` and `/team-login/` are the public pages that front this flow.

This is precisely the shape a self-service athlete or parent claim needs. No new authentication system is required — Podium Watch already has Supabase Auth wired up and proven for exactly this kind of "claim something, get reviewed, get limited access" flow.

### 2.2 What is different for an athlete/parent claim

1. **The claimed object is different.** A team claim grants access to manage a whole public team page. An athlete claim should grant a narrow, specific set of permissions on one `athlete_profiles` row — not admin-level editing of the profile, and never direct editing of a Recruit Rating's score or star count (that must stay Podium Watch editorial judgment, per the existing "no athlete receives stars automatically" rule).
2. **Two claimant types exist**: the athlete themselves, or a parent/guardian on the athlete's behalf. The claim record should capture which one, the same way `team_claim_requests` already captures `requester_role`.
3. **Recruiting consent already has a gate.** `athlete_profiles.recruiting_consent_confirmed` and the `require_athlete_recruiting_consent` trigger already exist and already require a `recruiting_contact_route` before anything recruiting-related can go public. An approved claim is the natural, safe place to let the athlete or parent set this consent themselves, instead of an admin setting it on their behalf sight unseen.

### 2.3 Proposed design (smallest additive change, following the team-claim shape exactly)

**New table** `athlete_profile_claims`, mirroring `team_claim_requests`:
```
id, created_at, resolved_at
profile_id -> athlete_profiles
user_id (Supabase Auth user id)
user_email
claimant_role check (athlete, parent_guardian)
claimant_name
message
status check (pending, approved, rejected, revoked)
resolved_by
resolution_note
```

**New table** `athlete_profile_claim_access`, mirroring the access side of `team_members`, one row per approved claim:
```
id, created_at
profile_id, user_id
access_level check (limited) -- start with exactly one level; do not design more until there is a reason to
revoked_at
```

**New RPC** `claim_athlete_profile_v1`, mirroring `claim_team_page_v3`: checks for an existing active access row or pending claim for that `(profile_id, user_id)` pair, and inserts a pending claim. Unlike team claims, **do not auto-approve athlete claims** — a team claim auto-approves in some cases because a team page is a public institution; an athlete claim is about a specific minor or young adult's personal information and should always go through a human admin review, no exceptions.

**What an approved claim is allowed to do** (deliberately narrow, and explicitly listed here so the boundary is a decision, not an implementation accident):
1. Set `recruiting_consent_confirmed`, `recruiting_contact_route`, and `recruiting_headline` on their own profile.
2. Submit a recruiting activity row (interest, offer, visit, commitment, signing) that goes in as `verification_status = 'reported'` and `public_visible = false` until an admin reviews it — reusing `athlete_recruiting_activity` and the existing `save_activity` admin action exactly as-is, just adding a claimant-facing submission path in front of it.
3. Request a media item be added (submitted as `status = 'draft'`, reusing `athlete_content_items` exactly as Phase Two built it) for admin review before it can be published.
4. **Explicitly not allowed**: editing name, school, graduation year, gender (those go through the existing public correction form, `athlete_profile_corrections`, which already has admin review); editing or requesting a Recruit Rating score, star count, or evaluation text (Podium Watch editorial judgment only); marking anything `public_visible = true` directly (admin approval always required, matching every other publish gate already in the system).

**Public/claimant-facing surface**: a new `/claim-your-profile/` page (mirroring `/claim-your-team/`) and a lightweight claimant dashboard (mirroring `/team-dashboard/`, but far smaller given the narrow permission set above).

**Admin surface**: extend `api/admin/athletes.js` with `list_claims`, `approve_claim`, `reject_claim` actions, following its existing action-dispatch pattern exactly, plus a claims queue panel on `/admin/athletes/` or the Operations Center.

## 3. Scaling beyond the first launch

Phase One deliberately scoped the first launch to one graduation class, about 25 athletes, one gender (decision 5). The schema itself was never limited to that scope — `athlete_profiles.graduation_year`, `.gender`, and `athlete_performances.sport` already support every class, both genders, and all three sports today. Scaling up is a **workflow and volume question, not a schema question**.

What actually needs deciding before scaling up:

1. **Import volume.** The performance importer already caps at 500 rows per batch (`lib/recruiting_service.mjs`), which comfortably covers a full meet across every class and gender at once. No change needed there.
2. **Admin review throughput.** Every rating still requires a written 40+ character evaluation and a human decision to publish (the database trigger enforces this and cannot be bypassed). Scaling to more athletes means more of that manual editorial work, not more code — this is a staffing/workflow question for you, not an architecture question for me.
3. **Ranking computation at scale.** The `athlete_published_recruit_ratings` view recomputes `dense_rank()` over every published rating on every read. At a few hundred published ratings statewide (a reasonable full-scale number across all classes, both genders, and the nine event groups) this is trivial for Postgres — no indexing or materialization work is needed until published-rating counts reach the low thousands, which is well beyond any realistic Ohio high school scope.
4. **Rank snapshot table growth.** `athlete_recruit_rating_rank_snapshots` grows one row per profile per event group every time a rating is saved. At full scale this is still a small table (hundreds of profiles times a handful of saves each), but if it is never pruned it will grow indefinitely. Recommend a simple retention rule once real usage patterns are known (for example, keep the most recent 10 snapshots per profile/event group) rather than designing one now against no real data.

**Recommendation**: no new architecture work is needed to scale up. When you are ready to expand past the first class, the correct action is to simply start creating and publishing more athlete profiles and ratings through the existing admin workflow — the same one you will have just finished testing.

## 4. Scoring assist for admins

Flagged in `docs/NEXT_SESSION.md` limitation 4: "The first release does not calculate a score from a fixed formula." This must stay true — the project rule is explicit that no athlete receives a rating automatically, and the score must not be reduced to a formula. What can help without crossing that line is a **read-only comparison aid** shown next to the rating form, not a calculator that produces a number:

- When an admin opens the rating form for an athlete in a given event group, show the current published ratings and scores of other athletes already rated in the same graduation year, gender, and event group, sorted by mark, so the admin has fast side-by-side context ("this athlete's 5K is 12 seconds faster than the last 4-star rating in this class") without the system suggesting a score.
- This is a read-only extension of data that already exists (`athlete_published_recruit_ratings`, `athlete_best_performances`) surfaced in the admin UI — no new table, no new write path, no scoring logic. It is the smallest possible version of "assist" that cannot drift into "automatic."

## 5. Major decisions I need you to approve

1. **Build self-service claims now, or defer further?** This is the largest single item in this report — two new tables, one new RPC, a new public claim flow, a new (small) claimant dashboard, and new admin review actions. Recommend building it once you have enough published ratings that athletes/parents are actually asking for this, rather than ahead of demand.
2. **Claim approval should always be manual, never auto-approved, unlike some team claims** — confirming this before it is built, since it is a real difference in trust model between a public team institution and an individual (often minor) athlete's information.
3. **What exactly can an approved claim edit?** Section 2.3 proposes a narrow, specific list. Confirm or adjust that list before anything is built — this is the single most consequential privacy/trust decision in this report.
4. **Rank snapshot retention** — defer deciding a specific retention rule until real usage data exists (recommended), or set a rule now.
5. **Scoring assist tool** — build it, or is manual review without any comparison aid sufficient for now?

## 6. Controlled implementation order, if approved

Nothing below is built. This is the recommended order once decisions in section 5 are made, matching the discipline used for Phases Zero, One, and Two: written and tested locally first, migrations run manually in Supabase by you, manual testing before any commit is pushed, and deploy only after explicit approval.

1. Write and manually test the claims migration (`athlete_profile_claims`, `athlete_profile_claim_access`, `claim_athlete_profile_v1`), reusing `claim_team_page_v3` as the direct template.
2. Extend `api/admin/athletes.js` with the claims review actions.
3. Build `/claim-your-profile/` and the claimant submission endpoints, enforcing the narrow permission list from section 2.3 at the API layer (not just hidden in the UI).
4. Build the small claimant dashboard.
5. Manually test the full loop: submit a claim, approve it as admin, confirm the claimant can only do what section 2.3 allows and nothing else, confirm a rejected/revoked claim immediately loses access.
6. Add the scoring assist read-only panel to the admin rating form (independent of the claims work above; can be done in any order relative to it).
7. Update `docs/RECRUIT_RATINGS_AND_PERFORMANCE_HISTORY.md`, `docs/DECISIONS.md`, `docs/NEXT_SESSION.md`, and `docs/SESSION_LOG.md` to match, the same as every prior phase.
8. Commit, push, and deploy only after your explicit approval, then confirm the live site the same way every prior phase was confirmed.
