# Podium Watch architecture

## 1. Main folders

| Path | Purpose |
|---|---|
| `api` | Vercel server functions |
| `lib` | Shared server helpers, authentication, Supabase clients, and utilities |
| `src/pages` | Static page templates |
| `src/lib` | Shared HTML and page generation helpers |
| `src/config` | Site configuration |
| `public` | Browser scripts, styles, images, and static assets |
| `scripts/build.mjs` | Main static website build |
| `scripts/check.mjs` | Automated project quality checker |
| `dist` | Generated website output |
| `docs` | Permanent project knowledge and operating documentation |
| `reference_data` | Original official reference files and data notes |
| `supabase` or migration folders | Ordered database migrations when present |

## 2. Build flow

1. Source pages and content are read by `scripts/build.mjs`.
2. Static HTML is generated into `dist`.
3. Public assets are copied or referenced by the generated pages.
4. Vercel serves `dist` and routes API requests to the `api` folder.
5. Supabase stores application data.
6. Privileged database operations use server side helpers.

## 3. Generated files

Do not edit `dist` as the source of truth.

Make changes in:

1. `src`
2. `public`
3. `api`
4. `lib`
5. Content and data files
6. Build scripts

Then run the build again.

## 4. Authentication boundaries

1. Public browser code may use the Supabase publishable key.
2. The Supabase secret key must only exist in Vercel server functions.
3. Admin access uses the project admin authentication helper.
4. Team access verifies a Supabase user token on the server.
5. Row Level Security remains enabled even when server APIs are used.

## 5. Database changes

1. Create a new ordered SQL migration.
2. Add comments explaining the purpose.
3. Prefer additive changes.
4. Avoid dropping data.
5. Include indexes and constraints where needed.
6. Test the migration in Supabase manually.
7. Record the migration in `docs/SESSION_LOG.md`.

## 6. Athlete data flow

1. Bundled editorial ranking seed data is stored in `public/data/athlete-foundation-seed-2026.json`.
2. The public directory can use the seed before the database migration is installed.
3. `install/02_ATHLETE_PROFILE_FOUNDATION_DATABASE.sql` creates permanent athlete identities.
4. `lib/athlete_foundation_service.mjs` handles preview, import, matching, and roster connections.
5. Public athlete APIs return only public and unsuspended profiles.
6. Privileged athlete changes use `api/admin/athletes.js`.
7. Every performance keeps an independent source and verification status.
8. Team roster records connect to permanent profiles through `athlete_profile_id`.

## 7. Recruiting and performance flow

1. Migration 03 normalizes performance fields and creates recruiting tables and views.
2. `lib/recruiting_service.mjs` handles events, marks, exact athlete matching, import previews, and import commits.
3. `api/admin/recruiting.js` handles private imports, ratings, and recruiting activity.
4. `api/recruiting/index.js` returns only published ratings and public athlete information.
5. `athlete_best_performances` calculates source linked or verified event bests.
6. `athlete_published_recruit_ratings` calculates current class and event group ranks.
7. Athlete profile APIs connect public ratings, recruiting activity, and best performances.
8. The Operations Center reports migration readiness, performance evidence, drafts, published ratings, and failed imports.
