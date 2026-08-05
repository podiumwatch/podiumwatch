# Podium Watch project context

## 1. Purpose

Podium Watch is an Ohio high school cross country and track media and information platform.

The primary audience is:

1. Athletes
2. Coaches
3. Parents
4. Fans
5. College recruiters
6. Meet directors
7. Photographers
8. Sponsors

The website should feel professional, trustworthy, fast, useful, personal, and focused on the Ohio running community.

## 2. Brand priorities

1. Accuracy matters more than appearing large.
2. Community voice matters more than corporate language.
3. Mobile usability is essential.
4. Visitors should quickly find rankings, stories, athletes, teams, meets, schedules, results, and weekly voting.
5. Verified facts must be clearly separated from projections and editorial rankings.
6. The site should create useful reasons to return throughout the week.
7. Monetization should fit naturally and should not make the website frustrating.

## 3. Technical stack

1. Windows
2. VS Code
3. PowerShell
4. Node.js version 20 or newer
5. Custom Node static build
6. Vercel
7. Supabase
8. GitHub

Use these commands instead of the normal npm and npx commands:

```powershell
npm.cmd
npx.cmd
```

Local project path:

```text
C:\Users\12zac\Downloads\Podium_Watch_Website\podium_watch_site
```

## 4. Core systems

The project includes or is designed to include:

1. Homepage and primary navigation
2. Rankings
3. Ranking methodology
4. Stories and article categories
5. Global search
6. Meet Center
7. Athlete of the Week
8. Team of the Week
9. Team directory and public profiles
10. Team accounts and claims
11. Team schedules
12. Team rosters and seasons
13. Team announcements, results, achievements, media, recruiting, and coverage
14. Followers and notification preferences
15. Analytics
16. Sponsor tracking
17. Ohio school identity and division foundation
18. Ohio tournament resources
19. Operations Center and admin tools
20. Quality checks
21. Future athlete profiles and recruiting search

Use `docs/AUTO_PROJECT_INDEX.md` as the current generated inventory of actual files, routes, API endpoints, environment variable names, and database table references.

## 5. Data integrity

Use official or supplied source files when available.

Do not invent:

1. Athlete names
2. Grades
3. Performances
4. School divisions
5. Regional assignments
6. Meet results
7. Representation numbers
8. Statistics

Label information as one of these types when relevant:

1. Verified fact
2. Official source
3. Podium Watch editorial ranking
4. Projection
5. Community submitted information
6. Unverified information awaiting correction

## 6. Development rules

1. Inspect the current file before replacing it.
2. Preserve working routes and APIs.
3. Create a backup before a large installation.
4. Keep generated output such as `dist` out of source edits.
5. Keep secrets out of code and documentation.
6. Use server APIs for privileged Supabase access.
7. Create ordered SQL migrations for database changes.
8. Run the build and quality checker after changes.
9. Review mobile layout and keyboard navigation manually.
10. Record major decisions and unfinished work.

## 7. Source of truth order

When information conflicts, use this order:

1. Current project files
2. Current Supabase schema and migrations
3. Official OHSAA documents and official meet results
4. Supplied reference files
5. Podium Watch approved rankings and editorial content
6. Community submitted information
7. Old chat summaries and older backups

## 8. Starting a new development session

1. Open the project folder in VS Code.
2. Run the context update script.
3. Read `docs/AUTO_PROJECT_INDEX.md`.
4. Read `docs/NEXT_SESSION.md`.
5. Run `git status --short`.
6. Start Vercel locally.
7. Test the feature before changing it.
8. Make one planned group of changes.
9. Run the project health script.
10. Update the session documentation.

## 9. Ending a development session

1. Record completed work in `docs/SESSION_LOG.md`.
2. Record important choices in `docs/DECISIONS.md`.
3. Update `docs/NEXT_SESSION.md`.
4. Run the context update script.
5. Run the project health script.
6. Create a context export for the next chat.
7. Commit only after local review.

## 10. Athlete profile foundation

The project now includes a permanent athlete identity layer.

Athlete profiles connect rankings, school history, team rosters, sourced performances, stories, corrections, and privacy safe recruiting settings.

Read `docs/ATHLETE_PROFILE_FOUNDATION.md` before changing athlete matching, verification, performance sources, recruiting consent, or merge behavior.

## 11. Recruit Ratings and performance history

The project includes an original Podium Watch Recruit Ratings system built on sourced athlete performance evidence.

Read `docs/RECRUIT_RATINGS_AND_PERFORMANCE_HISTORY.md` before changing score bands, event normalization, performance imports, public recruiter search, recruiting activity verification, or rating publication rules.

No athlete receives stars automatically. Every public rating requires sourced performance evidence in the selected event group and a written Podium Watch evaluation.
