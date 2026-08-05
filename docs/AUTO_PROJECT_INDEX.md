# Podium Watch automatic project index

Generated: 2026-08-04 16:43:16
Project: C:\Users\12zac\Downloads\Podium_Watch_Website\podium_watch_site

This file is generated from the current project.

## Project summary

| Item | Count |
|---|---:|
| Included source files | 259 |
| Page source files | 35 |
| API files | 50 |
| Route references | 46 |
| Environment variable names | 14 |
| Supabase table references | 67 |

## Git state

Latest commit:

39ae694e3edc3e9373e9a9a8a4d8dfcd408a5a1b | 2026-08-04 12:46:17 -0400 | Complete website dependencies for Vercel

Working tree:

 M .gitignore
 M api/admin/recruiting.js
 M dist/index.html
 M lib/recruiting_service.mjs
 M package.json
 M public/scripts/site.js
 M scripts/test-recruiting-foundation.mjs
 M src/pages/adminrecruiting.mjs
 M src/styles/main.css
?? AGENTS.md
?? docs/
?? install/
?? reference_data/
?? scripts/export-project-context.ps1
?? scripts/project-health.ps1
?? scripts/update-project-context.ps1

## Package commands

| Name | Command |
|---|---|
| build | node scripts/build.mjs |
| check | node scripts/check.mjs |
| dev | node scripts/serve.mjs --watch |
| preview | node scripts/serve.mjs |
| test | npm run check && npm run test:athletes && npm run test:recruiting && npm run test:results |
| test:athletes | node scripts/test-athlete-foundation.mjs |
| test:recruiting | node scripts/test-recruiting-foundation.mjs |
| test:results | node scripts/test-results-ingestion.mjs |

## Public routes

1. /
1. /about/
1. /admin/
1. /admin/athletes/
1. /admin/engagement/
1. /admin/operations/
1. /admin/recruiting/
1. /admin/results-sources/
1. /admin/statewide-data/
1. /admin/team-content/
1. /admin/team-manager/
1. /admin/team-rosters/
1. /admin/teams/
1. /admin/team-schedules/
1. /athlete/
1. /athlete-of-the-week/
1. /athletes/
1. /athlete-spotlights/
1. /claim-your-team/
1. /contact/
1. /follow/
1. /interviews/
1. /meetdetail/
1. /meets/
1. /ohio-schools/
1. /privacy/
1. /rankings/
1. /rankings/cross-country/
1. /rankings/methodology/
1. /rankings/track-and-field/
1. /recruiting/
1. /recruiting/methodology/
1. /search/
1. /sponsors/
1. /stories/
1. /team/
1. /team-content/
1. /team-dashboard/
1. /team-editor/
1. /team-insights/
1. /team-login/
1. /team-of-the-week/
1. /team-roster/
1. /teams/
1. /team-schedule/
1. /tournament-hub/

## API endpoints

1. /api/admin/athletes
1. /api/admin/auth
1. /api/admin/engagement
1. /api/admin/meets
1. /api/admin/operations
1. /api/admin/recruiting
1. /api/admin/results-sources
1. /api/admin/statewide-data
1. /api/admin/team-content
1. /api/admin/team-rosters
1. /api/admin/teams
1. /api/admin/team-schedules
1. /api/admin/teams-import
1. /api/aotw/archive
1. /api/aotw/current
1. /api/aotw/nominate
1. /api/aotw/vote
1. /api/athletes/detail
1. /api/athletes/index
1. /api/athletes/report
1. /api/cron/notifications
1. /api/cron/weekly-digest
1. /api/engagement/public
1. /api/engagement/track
1. /api/followers/manage
1. /api/followers/subscribe
1. /api/followers/verify
1. /api/meets/index
1. /api/ohio-schools/index
1. /api/recruiting/index
1. /api/team/access
1. /api/team/claim
1. /api/team/config
1. /api/team/content
1. /api/team/create
1. /api/team/detail
1. /api/team/insights
1. /api/team/me
1. /api/team/roster
1. /api/team/schedule
1. /api/team/schools
1. /api/teams/content
1. /api/teams/detail
1. /api/teams/index
1. /api/teams/report
1. /api/teams/roster
1. /api/totw/archive
1. /api/totw/current
1. /api/totw/nominate
1. /api/totw/vote

## Environment variable names

Values are intentionally excluded.

1. CRON_SECRET
1. PODIUM_ADMIN_PASSWORD
1. PODIUM_ADMIN_SESSION_SECRET
1. PORT
1. RESEND_API_KEY
1. RESEND_FROM_EMAIL
1. RESEND_REPLY_TO
1. SITE_URL
1. SUPABASE_PUBLISHABLE_KEY
1. SUPABASE_SECRET_KEY
1. SUPABASE_URL
1. VERCEL_ENV
1. VERCEL_PROJECT_PRODUCTION_URL
1. VOTE_HASH_SECRET

## Supabase table references

1. %PDF-1.7
1. aotw_finalists
1. aotw_nominations
1. aotw_weeks
1. athlete_best_performances
1. athlete_data_sources
1. athlete_event_catalog
1. athlete_import_batches
1. athlete_performance_import_batches
1. athlete_performance_import_rows
1. athlete_performances
1. athlete_profile_corrections
1. athlete_profiles
1. athlete_published_recruit_ratings
1. athlete_ranking_entries
1. athlete_recruit_rating_methodologies
1. athlete_recruit_ratings
1. athlete_recruiting_activity
1. athlete_school_history
1. athlete_social_links
1. athlete_story_links
1. discovered_meet_sources
1. discovered_meets
1. engagement_settings
1. meets
1. ohio_data_conflicts
1. ohio_data_sources
1. ohio_import_batches
1. ohio_school_aliases
1. ohio_school_divisions
1. ohio_schools
1. place,athlete_name,school_name,event_name,mark_text\n1,John Runner,Central,5K,15:29.20
1. place,athlete_name,school_name,event_name,mark_text\n1,John Runner,Central,5K,15:30.20
1. result_crawl_edges
1. result_crawl_pages
1. result_ingestion_audit
1. result_ingestion_jobs
1. result_source_documents
1. result_staging_rows
1. results_discovery_runs
1. results_source_providers
1. result-source-documents
1. team_admin_audit_log
1. team_analytics_events
1. team_athletes
1. team_change_log
1. team_claim_requests
1. team_content_items
1. team_followers
1. team_follows
1. team_import_batches
1. team_meet_connections
1. team_meet_requests
1. team_members
1. team_notification_deliveries
1. team_notification_events
1. team_pages
1. team_reports
1. team_roster_entries
1. team_roster_import_batches
1. team_seasons
1. team_social_links
1. team_sponsor_placements
1. team_sponsors
1. totw_finalists
1. totw_nominations
1. totw_weeks

## Page source files

1. src\pages\admin.mjs
1. src\pages\adminathletes.mjs
1. src\pages\adminengagement.mjs
1. src\pages\adminoperations.mjs
1. src\pages\adminrecruiting.mjs
1. src\pages\adminresultssources.mjs
1. src\pages\adminstatewidedata.mjs
1. src\pages\adminteamcontent.mjs
1. src\pages\adminteammanager.mjs
1. src\pages\adminteamrosters.mjs
1. src\pages\adminteams.mjs
1. src\pages\adminteamschedules.mjs
1. src\pages\athletedetail.mjs
1. src\pages\athletes.mjs
1. src\pages\claimteam.mjs
1. src\pages\follow.mjs
1. src\pages\meetdetail.mjs
1. src\pages\meets.mjs
1. src\pages\ohioschools.mjs
1. src\pages\privacy.mjs
1. src\pages\rankingmethodology.mjs
1. src\pages\recruiting.mjs
1. src\pages\recruitingmethodology.mjs
1. src\pages\search.mjs
1. src\pages\teamcontent.mjs
1. src\pages\teamdashboard.mjs
1. src\pages\teameditor.mjs
1. src\pages\teaminsights.mjs
1. src\pages\teamlogin.mjs
1. src\pages\teamprofile.mjs
1. src\pages\teamroster.mjs
1. src\pages\teams.mjs
1. src\pages\teamschedule.mjs
1. src\pages\tournamenthub.mjs
1. src\pages\weeklyawards.mjs

## Main project folders

1. api
1. content
1. docs
1. install
1. lib
1. public
1. reference_data
1. scripts
1. src
1. tests
