# Recruit Ratings and Performance History test report

## Automated validation

1. All changed JavaScript and MJS files passed `node --check`.
2. The recruiting foundation validator passed.
3. Thirty five normalized event definitions were checked.
4. Star boundaries from 70 through 100 were checked.
5. Time parsing was checked with 9:45 and 15:45.20.
6. Pole vault conversion was checked with 14 feet 6 inches.
7. High jump conversion was checked with 6 feet 4 inches.
8. Duplicate normalized event aliases were checked.
9. The migration was checked for required tables, views, RLS, revokes, and service role grants.
10. The migration was checked to confirm that no athlete ratings are seeded.
11. Public API privacy fields were checked.
12. Admin authentication was checked in source.
13. Preview first import handling was checked in source.
14. Operations Center recruiting integration was checked.
15. Recruiting build routes and search index entries were checked.

## Complete project checks

1. The static build completed successfully.
2. The site built 264 pages.
3. Nine published stories were generated.
4. Eight ranking files were generated.
5. The quality checker inspected 140 JavaScript files.
6. The quality checker inspected 8 JSON files.
7. The quality checker inspected 283 HTML files.
8. The quality checker inspected 11,603 internal links.
9. The quality checker inspected 621 local images.
10. No quality checker problems were found.

## Still requires manual review

1. Run migration 03 in the real Supabase project.
2. Open the Recruiting Center in a Vercel Preview deployment.
3. Preview a small CSV import.
4. Confirm unmatched rows are not saved.
5. Confirm exact matched rows are saved.
6. Confirm duplicate rows are blocked.
7. Publish one draft rating with event group evidence.
8. Confirm a rating without event group evidence is rejected.
9. Confirm public recruiting activity without a source link is rejected.
10. Review desktop and phone layouts.
11. Review keyboard navigation and focus states.
12. Confirm no private contact information appears publicly.
