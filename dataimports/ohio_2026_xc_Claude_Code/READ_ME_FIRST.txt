OHIO 2026 CROSS COUNTRY DATABASE FOR CLAUDE CODE

Use ohio_2026_xc_team_top_7.csv or the runners array in ohio_2026_xc_validated_data.json as the import dataset. The workbook contains the same accepted runner records plus coverage, reviews, gaps and source evidence.

This package replaces the earlier CURRENT snapshot. It contains 8,158 saved runner records across all eight gender and division categories. There are 1,383 school and category records, including eight with no verified eligible runner. Each saved school list has no more than seven distinct athlete profile IDs, ordered fastest to slowest. No athlete profile ID is repeated across the accepted school lists.

Read ohio_2026_xc_validation_report.txt before importing. Thirty identity concerns remain unresolved, three schools have seventh position ties, 359 school records need official inventory division review, and five grades remain unclear. Some teams with seven alternative athletes remain provisional because uncertain identity profiles were withheld. The report lists every affected school and athlete. Do not silently merge profiles or invent a missing runner, grade, school name or time.

The source excludes races labeled Open, including high school Open and combined Varsity / Open races, according to the requested rule. For affected athletes, verified eligible alternate performances were reviewed. The season_best_time column therefore means the fastest verified eligible 2026 high school 5,000 meter performance accepted under that rule. It can be slower than the athlete's displayed all event season best.

Preserve athlete_url as the strongest athlete identity key and team_url as the school identity key. Preserve gender, division, source links, displayed grades and verification notes. Keep incomplete teams and provisional reviews visible in the mock meet project. Use the project's existing import workflow and preserve any user corrections that need reconciliation.

The supplied OHSAA PDFs are the official category inventory. Athletic.net schools missing from a category PDF were retained and flagged. An official school name linked from the opposite gender inventory does not resolve a missing division assignment.

Source records were captured over October 19, 2026. Rankings captures ran from 9:33 a.m. through 11:06 a.m. Eastern. The final validation dataset was assembled at 7:00 p.m. Eastern. The JSON metadata contains exact timestamps and category totals. This is a collection snapshot, not a live feed.

The source_evidence directory contains raw rankings, team best pages, meet race labels, athlete profiles, official inventories and identity review evidence. Raw source rows are evidence only. They include excluded performances and must not be imported as accepted team rosters. Source Log also retains all 12,002 raw rankings rows. The collegiate Vanderbilt entry in Boys Division I was excluded from accepted runners and retained only as raw evidence.

No mock meet scores were calculated during this collection.
