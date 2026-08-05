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

The system uses these broad recruiting groups:

1. Distance
2. Sprints
3. Hurdles
4. Jumps
5. Pole vault
6. Throws
7. Multis
8. Other

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

## 11. Main files

1. `install/03_RECRUIT_RATINGS_AND_PERFORMANCE_HISTORY.sql`
2. `lib/recruiting_service.mjs`
3. `api/recruiting/index.js`
4. `api/admin/recruiting.js`
5. `src/pages/recruiting.mjs`
6. `src/pages/recruitingmethodology.mjs`
7. `src/pages/adminrecruiting.mjs`
8. `public/scripts/recruiting-directory.js`
9. `public/scripts/admin-recruiting.js`
10. `public/data/performance-import-template.csv`
11. `scripts/test-recruiting-foundation.mjs`

## 12. Main routes

1. `/recruiting/`
2. `/recruiting/methodology/`
3. `/admin/recruiting/`
4. `/api/recruiting`
5. `/api/admin/recruiting`

## 13. Recommended first use

1. Run migration 03.
2. Open the Recruiting Center.
3. Download the CSV template.
4. Import a small official result set.
5. Review every import row.
6. Confirm the sourced performance appears on the athlete profile.
7. Create a draft Recruit Rating.
8. Review the score and written evaluation.
9. Publish one test rating.
10. Confirm the athlete appears in the public recruiting database.
