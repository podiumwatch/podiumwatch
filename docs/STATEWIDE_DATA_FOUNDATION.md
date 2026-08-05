# Ohio statewide school and division foundation

## 1. Purpose

The statewide foundation gives Podium Watch one official identity record for each Ohio school and keeps season specific division assignments separate from public team pages.

This prevents duplicate schools, makes future athlete profiles safer, and gives rankings, meets, teams, recruiting tools, and tournament resources a consistent school reference.

## 2. Included official data

The first release contains:

1. 556 OHSAA boys cross country schools
2. OHSAA school ID
3. Official school name
4. City
5. Athletic district
6. Boys base enrollment
7. 2026 and 2027 division assignment
8. Previous 2025 and 2026 division assignment
9. 57 schools that changed divisions
10. 16 supplied 2026 track and field regional site records
11. Regional dates, times, locations, contacts, and representation notes

The boys cross country dataset must not be used as a girls cross country or track division source.

## 3. Public pages

### Ohio School and Division Directory

Route:

```text
/ohio-schools/
```

Visitors can search by:

1. School
2. City
3. OHSAA school ID
4. Boys cross country division
5. Athletic district
6. Division movement

The directory works before the database migration by using the bundled official dataset. After import, it also connects schools to published Podium Watch team pages.

### Claim Your Team

Route:

```text
/claim-your-team/
```

This page explains the coach and approved representative workflow and connects visitors to team search, team account access, and the claim process.

## 4. Admin page

Route:

```text
/admin/statewide-data/
```

The Statewide Data Center provides:

1. Migration readiness
2. Bundled and database record counts
3. Import preview
4. Team page matching
5. Missing team page totals
6. Division conflict preview
7. Optional team page creation
8. Optional publication of new team pages
9. Optional replacement of conflicting official boys cross country divisions
10. Import batch history
11. Conflict resolution

The preview does not save data.

## 5. Database tables

The migration creates:

1. `ohio_data_sources`
2. `ohio_schools`
3. `ohio_school_aliases`
4. `ohio_school_divisions`
5. `ohio_tournament_sites`
6. `ohio_import_batches`
7. `ohio_data_conflicts`

It also adds `ohio_school_id` to `team_pages`.

## 6. Import safety

1. The migration is additive.
2. Original team pages are not deleted.
3. School records are upserted by OHSAA school ID.
4. Division records are upserted by school, sport, gender, and season.
5. Tournament sites are upserted by sport, season, division, and region.
6. Existing teams match by linked official school, trusted OHSAA source ID, or normalized school name and city.
7. A source ID from an unrelated spreadsheet is not trusted as an OHSAA match.
8. Conflicting boys cross country divisions are recorded for review by default.
9. Replacing a conflict with the official assignment requires an explicit admin option or conflict decision.
10. The same import can be run again safely.

## 7. Source corrections

The supplied track regional source showed later semifinal and final dates than the earlier project JSON.

The bundled regional JSON now uses:

1. Division 1 semifinal May 28 and final May 30
2. Division 2 semifinal May 27 and final May 29
3. Division 3 semifinal May 28 and final May 30
4. Division 4 semifinal May 27 and final May 29
5. Division 5 semifinal May 28 and final May 30

These values are based on the supplied official document. The source remains subject to change.

## 8. Recommended operating process

1. Run the SQL migration in Supabase.
2. Open the Statewide Data Center.
3. Confirm the database foundation is installed.
4. Run Preview Import.
5. Review team matches and conflicts.
6. Choose the team creation and publication options.
7. Run the import.
8. Review open conflicts.
9. Test the Ohio School Directory.
10. Review newly created team pages before public promotion.
