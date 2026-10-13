# Source note: Ohio XC 2026 Athletic.net top-1000 season-best rankings

1. **Original filename**: `ohio_xc_2026_top_1000_all_divisionsweek7.xlsx` (unchanged, still present alongside this note).
2. **Source organization**: Athletic.net (public rankings pages), compiled by the user into this workbook.
3. **Season**: 2026 Ohio high school cross country, 5,000 meters, Boys and Girls Divisions I-IV.
4. **Date received**: 2026-10-13.
5. **Date last verified**: 2026-10-13 (row counts, header, and the two documented tied-rank exceptions checked directly against the workbook's own "Combined" sheet before conversion).
6. **Processing performed**: No CSV existed alongside the original `.xlsx`. The workbook's "Combined" sheet (all 8 divisions already merged, one row per athlete) was parsed directly from its underlying XML and written out as `ohio_xc_2026_top_1000_all_divisions_week7.csv`, preserving every column, value, and special character (apostrophes, quotation marks, hyphens) exactly as stored in the workbook. The original `.xlsx` was not modified.
7. **Known limitations**: This is a supplied reference / editorial source (docs/DATA_SOURCES.md category 2), not an official governing-body result. `source_rank` is Athletic.net's own competitive ranking (ties can skip positions) and is never written to `athlete_performances.place`. Six rows have an unusual `grade_displayed` value (not a real 9-12 grade) with `grade_normalized` left blank; graduation year is left null for those six rather than guessed. See `lib/athletic_net_rankings_service.mjs` for the full import design and `docs/DECISIONS.md` for the two explicit decisions this import makes (profile auto-creation extended to this source; `athlete_url` treated as a first-class, stronger-than-name identity signal).
