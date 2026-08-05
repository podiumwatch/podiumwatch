# Statewide data foundation test report

## Test date

2026 08 03

## Automated source validation

Passed:

1. 556 school records were present.
2. Every school had an OHSAA school ID.
3. Every school had a name, city, athletic district, enrollment, current division, and previous division.
4. No duplicate OHSAA school IDs were found.
5. No duplicate school and city pairs were found.
6. Division totals were 78 in Division I, 160 in Division II, 160 in Division III, and 158 in Division IV.
7. Exactly 57 schools changed divisions.
8. All six athletic districts were represented.
9. All 16 track regional records had a unique division and region pair.
10. Track semifinal and final dates matched the supplied official reference transcription.

## JavaScript and JSON validation

Passed:

1. Every created or changed JavaScript and MJS file passed `node --check`.
2. The school dataset passed JSON parsing.
3. The regional site dataset passed JSON parsing.
4. The existing boys cross country division dataset passed JSON parsing.
5. `package.json` and `vercel.json` passed JSON parsing.

## Build and quality review

Passed:

```text
Built 60 pages, 9 published stories, and 8 ranking files.
Checked 119 JavaScript files, 7 JSON files, 77 HTML files, 2976 internal links, and 209 local images. No problems found.
```

## API tests

Passed:

1. Public directory fallback returned all 556 bundled schools when the database tables were unavailable.
2. School search returned the expected school.
3. Division I filtering returned 78 schools.
4. Changed division filtering returned 57 schools.
5. Admin status correctly reported that the migration was required when tables were unavailable.
6. Preview reported 556 school inserts, 556 division inserts, and 16 tournament site inserts in an empty database.
7. Safe matching linked teams by school and city.
8. An unrelated source school ID was not trusted as an OHSAA match.
9. A conflicting existing division was preserved and recorded for review.
10. A test import created missing teams, linked existing teams, imported official records, and recorded the conflict.
11. A second preview showed the completed official import as repeat safe.
12. The Operations Center continued loading when the optional statewide tables were unavailable.

## SQL review

The migration was reviewed as an additive PostgreSQL migration with tables, constraints, indexes, triggers, Row Level Security, grants, and source seed records.

The migration was not run against the live Supabase project from the development environment.

## Manual review still required

1. Run the migration in Supabase.
2. Preview the import with the real team database.
3. Review every reported division conflict.
4. Review the number of new team pages before committing.
5. Open the public directory on desktop and phone widths.
6. Test shared directory filter URLs.
7. Confirm created team pages appear in Team Directory search.
8. Confirm existing team claims and ownership remain unchanged.
9. Review the corrected track regional dates against the displayed Tournament Hub.
10. Review source links before production deployment.
