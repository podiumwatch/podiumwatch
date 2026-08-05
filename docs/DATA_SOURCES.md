# Podium Watch data sources

## 1. Source categories

Use these categories in documentation and editorial notes:

| Category | Meaning |
|---|---|
| Official | OHSAA, official timing, official meet results, school or governing body |
| Supplied reference | A file supplied for Podium Watch research or development |
| Podium Watch editorial | Ranking, projection, analysis, or opinion |
| Community submitted | Information entered by a coach, team representative, athlete, or visitor |
| Unverified | Information that requires confirmation |

## 2. Reference file storage

Store original source files in `reference_data`.

Do not edit original PDFs, spreadsheets, or CSV files directly.

Create cleaned or transformed copies in a clearly named subfolder such as:

```text
reference_data\processed
```

Use a source note that records:

1. Original filename
2. Source organization
3. Season
4. Date received
5. Date last verified
6. Processing performed
7. Known limitations

## 3. Important supplied references

Known project references include:

1. `2026 Regional Site Info Including Representation.pdf`
2. `2627BXC.pdf`
3. `State Rankings - Sheet1.csv`
4. `State Ranking Girls - Sheet1.csv`
5. `Girls 2025 State XC and 2026 1600 & 3200 Times`
6. `Track Boys 1600, 3200 and CC 2025`
7. `D2`
8. `D3`
9. `D4`
10. `D5`

The generated context index will list reference files that currently exist in the local project.

## 4. Ranking standards

Every ranking should explain:

1. The season and event
2. The data window
3. Whether the list is returning athletes only
4. How division changes were handled
5. Whether state, regional, or season best performances were used
6. How cross country and track evidence were balanced
7. That the ranking is Podium Watch editorial analysis
8. How to submit a correction

## 5. Corrections

Corrections should preserve:

1. The original claim
2. The corrected value
3. The source used
4. The date corrected
5. The person or system that made the correction

## 6. Athlete profile source handling

The first athlete seed comes from the eight supplied 2026 Podium Watch cross country ranking CSV files.

These are editorial sources.

The seed may establish an athlete identity and ranking connection, but it does not establish an official performance record.

To add a performance, preserve:

1. Event
2. Mark
3. Season
4. Meet
5. Date
6. Source label
7. Source link when available
8. Source type
9. Verification status
10. Review notes

A stronger team roster, official result, or administrator verified source should not be overwritten by weaker editorial seed information.

## 7. Recruit Rating source handling

Recruit Ratings must be based on performance records that are source linked or verified.

Every imported performance should preserve:

1. Athlete identity match
2. School
3. Graduation year
4. Gender
5. Sport
6. Season year
7. Normalized event
8. Original mark text
9. Sortable mark value
10. Meet name and date
11. Source label
12. Source URL when available
13. Source type
14. Verification status
15. Course or wind context when relevant

Recruiting interest, offers, visits, commitments, and signings are separate from the performance based Recruit Rating score.
