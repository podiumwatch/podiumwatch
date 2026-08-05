# Podium Watch athlete profile foundation

## 1. Purpose

The athlete profile foundation creates one permanent Podium Watch identity for an athlete across rankings, team rosters, stories, awards, and future sourced performances.

The system is designed for Ohio high school cross country and track.

## 2. Public pages

1. `/athletes/` provides athlete search and filters.
2. `/athlete/` is the generic athlete profile route.
3. `/athletes/<profile slug>/` provides a static profile route for every bundled ranking athlete.
4. Ranking entries link to the matching permanent athlete profile when a safe seed match exists.

## 3. Admin page

`/admin/athletes/` provides:

1. Migration readiness
2. Seed import preview
3. Safe import commit
4. Athlete search
5. Profile editing
6. Sourced performance management
7. Correction review
8. Duplicate review
9. Permanent profile merging
10. Team roster connection totals

## 4. Database migration

Run migrations in this order:

1. `install/01_STATEWIDE_FOUNDATION_DATABASE.sql`
2. `install/02_ATHLETE_PROFILE_FOUNDATION_DATABASE.sql`

The athlete migration is additive.

It does not delete or replace current team rosters, rankings, stories, meets, or results.

## 5. Main database records

1. `athlete_data_sources` stores source definitions.
2. `athlete_profiles` stores permanent athlete identities.
3. `athlete_profile_aliases` stores safe alternate names.
4. `athlete_school_history` stores school connections by season.
5. `athlete_performances` stores individually sourced marks and results.
6. `athlete_ranking_entries` stores Podium Watch editorial ranking connections.
7. `athlete_story_links` connects stories and awards.
8. `athlete_profile_corrections` stores public correction requests.
9. `athlete_import_batches` records every athlete import.
10. `athlete_profile_merges` records duplicate profile merges.
11. `team_athletes.athlete_profile_id` connects a seasonal roster record to the permanent profile.

## 6. Starting dataset

The bundled seed contains 200 athlete rows from eight supplied Podium Watch 2026 cross country ranking files.

The eight groups contain 25 athletes each.

The seed includes:

1. Athlete identity
2. Gender
3. Ranking grade
4. Derived graduation year
5. School
6. Division
7. Podium Watch ranking position
8. Ranking explanation
9. Ranking mark snapshot
10. Ranking source label

The ranking mark snapshot is not inserted into `athlete_performances`.

It remains editorial ranking context until a separate official or reviewed source is added.

## 7. School matching

196 of the 200 seed rows were safely connected to the supplied official statewide school foundation.

The unmatched school names are:

1. Clear Fork
2. Cleveland Heights
3. Hathaway Brown School

These names remain visible as ranking source snapshots, but no official school identity is invented.

## 8. Graduation year handling

Graduation years in the seed are derived from the grade listed for the 2026 season.

1. Senior maps to 2027
2. Junior maps to 2028
3. Sophomore maps to 2029
4. Freshman maps to 2030

Every profile retains a source note that the year was derived.

A team roster, official source, or administrator can later replace it with stronger information.

## 9. Publication behavior

The 200 bundled editorial profile routes come from already published Podium Watch ranking content.

They remain available as editorial source profiles before the database import.

The admin publishing option controls the imported database profile.

A database profile that is explicitly private, suspended, or archived is not replaced by the browser seed fallback.

## 9. Verification rules

An athlete identity and an athlete performance are verified separately.

Profile statuses include:

1. Unverified
2. Community submitted
3. Team roster linked
4. Editorial source linked
5. Source verified
6. Admin verified
7. Disputed

Performance statuses include:

1. Unverified
2. Source linked
3. Verified
4. Disputed

A verified athlete profile does not automatically verify every performance.

## 10. Recruiting privacy

Recruiting information is disabled by default.

It can only be published when:

1. Recruiting is enabled
2. Consent is confirmed
3. A public contact route is selected

The public profile does not expose a private athlete email address or phone number.

Approved contact routes are:

1. The public team page
2. A future Podium Watch approved recruiting connection process

Athlete social links are only returned when the existing team roster consent and approval fields are confirmed.

## 11. Team roster connections

New or edited team roster athletes can safely connect to a permanent profile.

The matcher uses:

1. Name
2. Gender
3. Graduation year
4. Current team
5. Official school identity when available

A name match alone is not enough when the school or team does not agree.

Bulk statewide connection remains an administrator controlled preview action.

## 12. Duplicate protection

The import preview identifies more than one active profile with the same normalized name, gender, and graduation year.

The import cannot commit while duplicate conflicts remain.

The merge function:

1. Requires an administrator
2. Preserves aliases
3. Moves school history
4. Moves performances
5. Moves rankings
6. Moves stories
7. Moves corrections
8. Moves roster links
9. Records a permanent merge audit
10. Keeps the old slug as an archived redirect record

## 13. Public corrections

Visitors can report:

1. Name
2. School
3. Graduation year
4. Performance
5. Division
6. College commitment
7. Duplicate profile
8. Privacy concern
9. Other issue

The endpoint includes:

1. A hidden bot field
2. Input validation
3. URL validation
4. Hashed network address storage
5. A rate limit
6. Admin review before data changes

## 14. Operations Center connection

The Operations Center shows:

1. Total athlete profiles
2. Public athlete profiles
3. Open athlete corrections
4. Unlinked roster athletes
5. Migration readiness
6. Seed import readiness

It creates tasks when the migration is missing, the seed is incomplete, corrections are waiting, or roster records are unlinked.

## 15. Safe first use

1. Confirm the statewide school migration was already run.
2. Run the athlete migration.
3. Open `/admin/athletes/`.
4. Select Preview Import.
5. Review official school links.
6. Review possible duplicates.
7. Review roster links.
8. Keep profile publishing selected only when ready.
9. Commit the import.
10. Review several public profiles.
11. Add official performances separately with source links.
