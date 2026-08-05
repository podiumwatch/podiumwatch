# Podium Watch Recruit Ratings and Performance History

## 1. Purpose

This system adds a source first performance history and an original Podium Watch recruiting evaluation layer.

It supports:

1. Sourced cross country, indoor track, and outdoor track performances
2. Career best calculations by athlete, sport, and event
3. Podium Watch numerical recruiting scores from 70 through 100
4. One through five star ratings
5. Graduation class rankings
6. Event group rankings
7. Recruiting interest, offers, visits, commitments, and signings
8. Public recruiter search
9. Admin performance import previews
10. Operations Center readiness and failure tasks

## 2. Important separation

Athlete identity, performance evidence, editorial ratings, and recruiting activity are separate records.

1. A verified athlete identity does not verify every performance.
2. A ranking snapshot is not an official personal best.
3. A reported offer is not a confirmed offer.
4. A Recruit Rating is Podium Watch editorial analysis.
5. A Recruit Rating is not an official college offer or scholarship guarantee.

## 3. Event groups

As of methodology version 2026.2 (2026-08-04), the system uses these nine recruiting groups, plus an other fallback:

1. Cross Country
2. Distance
3. Middle Distance
4. Sprints
5. Hurdles
6. Jumps
7. Pole vault
8. Throws
9. Combined Events
10. Other

Cross country events are always Cross Country, regardless of distance. Track 800 meters, 1000 meters, 1600 meters, and one mile are Middle Distance. Track 3200 meters, two mile, and 5000 meters are Distance. Track 600 meters and shorter are Sprints. This keeps cross country and track distance runners from ever being ranked against each other, since `athlete_published_recruit_ratings` partitions ranks by event group.

The original 2026.1 methodology used a smaller taxonomy without Cross Country or Middle Distance, and used Multis instead of Combined Events. See `docs/DECISIONS.md` (2026-08-04, Recruiting Phase One architecture approved) for why the taxonomy changed and why it was released as a new methodology version instead of an edit to the retired one.

Each performance also keeps a normalized specific event key such as `track_1600`, `track_3200`, `high_jump`, or `pole_vault`.

## 4. Star bands

| Stars | Score | Public label |
|---|---:|---|
| Five | 95 through 100 | National level recruit |
| Four | 90 through 94.99 | High level Division I prospect |
| Three | 84 through 89.99 | Strong college prospect |
| Two | 78 through 83.99 | Developing college prospect |
| One | 70 through 77.99 | Recruiting watch list |

A profile may exist without a Recruit Rating.

No athlete receives a rating automatically from the migration or installer.

## 5. Publication requirements

A published rating requires:

1. A score from 70 through 100
2. At least one source linked or verified performance in the selected event group
3. A written evaluation of at least 40 characters
4. A data cutoff date
5. An event group
6. A recorded confirmation that the rating is based on sourced evidence

The database trigger independently checks for qualifying evidence before publication.

## 6. Rating principles

The score may consider:

1. Verified performance level
2. Championship evidence
3. Consistency
4. Development trajectory
5. Versatility
6. Graduation year context
7. Competition context

The score must not consider:

1. Payment
2. Sponsorship
3. School popularity
4. Social following
5. Personal relationships with Podium Watch
6. Whether offers have been reported

Offers are displayed separately from the performance based score.

## 7. Performance import safety

The performance importer:

1. Requires a preview before saving
2. Matches athlete name, school, graduation year, and gender exactly
3. Does not create a new athlete when a row is unmatched
4. Identifies invalid, duplicate, unmatched, and ambiguous rows
5. Limits each import to 500 rows
6. Requires athlete name, school, gender, graduation year, sport, season year, event, mark, meet name, meet date, and a positive numeric place
7. Requires a source label
8. Applies approved meet, date, gender, event, sport, and season defaults only when the row field is blank
9. Saves every imported performance as hidden until an administrator approves publication
10. Preserves the original row and normalized row in an audit table
11. Creates a batch record with completed or failed status
12. Detects exact duplicates with athlete, school, event, mark, meet, date, and place, regardless of a changed source label or URL

## 8. Performance source categories

1. Official
2. Supplied reference
3. Editorial
4. Community submitted

Verification states remain separate:

1. Unverified
2. Source linked
3. Verified
4. Disputed

Only source linked or verified performances can support a public Recruit Rating.

## 9. Recruiting activity

Supported activity types are:

1. Interest
2. Offer
3. Visit
4. Commitment
5. Signing
6. Other

Supported verification labels are:

1. Reported
2. Confirmed by athlete or family
3. Confirmed by coach
4. Publicly announced
5. Disputed

Public recruiting activity requires a source link and a confirmed or publicly announced status.

## 10. Privacy

The public recruiting database does not return personal email addresses, phone numbers, home addresses, guardian information, or private academic records.

Athlete profile recruiting controls from the Athlete Foundation remain consent based and disabled by default.

## 11. Athlete media

`athlete_content_items` (migration 06) holds photos, video, and articles for an athlete profile, mirroring the existing `team_content_items` shape.

1. Content types are photo, video, article, and other.
2. Status is draft, published, hidden, or archived. Only published, unarchived items appear on the public athlete profile.
3. Each item keeps its own title, caption, credit, source label, and source URL.
4. An item can be marked featured for prominent display.
5. Media is managed from the athlete editor on `/admin/recruiting/`, using the same save-then-list pattern as ratings and recruiting activity.

## 12. Ranking movement

`athlete_recruit_rating_rank_snapshots` (migration 06) records a profile's class rank and event group rank every time its rating is saved, the same way `athlete_ranking_entries.previous_rank` already tracks movement for editorial rankings.

1. A snapshot is written after every rating save, for every event group the profile currently has a published rating in.
2. The public API and the athlete profile page compare the live computed rank against the most recently stored snapshot to show whether a rank went up, down, or stayed the same.
3. A rating that has never been saved while published has no snapshot yet, so no movement is shown until the second time it is published or updated.

## 13. Scoring assist

The admin rating form includes a read-only "Compare to rated athletes in this group" action. It shows every currently published rating in the same graduation year, gender, and event group, sorted by score, with each athlete's name, mark, score, stars, and current ranks.

This is reference context only. It never computes, suggests, or pre-fills a score — it only ever displays ratings that were already reviewed and published by an administrator. Per the existing rule, no athlete receives a rating automatically, and this tool does not change that.

## 14. Public profile preview

The admin recruiting page includes a preview action that shows exactly what an athlete's rating, recruiting activity, and media would look like to the public if everything currently in draft were published right now, without changing or publishing anything.

A draft rating's rank cannot be shown in the preview, because a draft is intentionally excluded from `athlete_published_recruit_ratings` and its eventual rank depends on what else is published by the time it goes live.

## 15. Main files

1. `install/03_RECRUIT_RATINGS_AND_PERFORMANCE_HISTORY.sql`
2. `install/06_RECRUITING_TAXONOMY_AND_MEDIA.sql`
3. `lib/recruiting_service.mjs`
4. `api/recruiting/index.js`
5. `api/admin/recruiting.js`
6. `api/athletes/detail.js`
7. `src/pages/recruiting.mjs`
8. `src/pages/recruitingmethodology.mjs`
9. `src/pages/adminrecruiting.mjs`
10. `src/pages/athletedetail.mjs`
11. `public/scripts/recruiting-directory.js`
12. `public/scripts/admin-recruiting.js`
13. `public/scripts/athlete-profile.js`
14. `public/data/performance-import-template.csv`
15. `scripts/test-recruiting-foundation.mjs`

## 16. Main routes

1. `/recruiting/`
2. `/recruiting/methodology/`
3. `/admin/recruiting/`
4. `/api/recruiting`
5. `/api/admin/recruiting`

## 17. Recommended first use

1. Run migration 03, then migration 06.
2. Open the Recruiting Center.
3. Download the CSV template.
4. Import a small official result set.
5. Review every import row.
6. Confirm the sourced performance appears on the athlete profile.
7. Create a draft Recruit Rating using the current event group taxonomy.
8. Review the score and written evaluation.
9. Use the public profile preview to review the rating, activity, and media before publishing.
10. Publish one test rating.
11. Confirm the athlete appears in the public recruiting database and the rank shown matches expectations.
