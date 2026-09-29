# Podium Watch automatic project index

Generated: 2026-09-29 19:13:10
Project: C:\Users\12zac\Downloads\Podium_Watch_Website\podium_watch_site

This file is generated from the current project.

## Project summary

| Item | Count |
|---|---:|
| Included source files | 777 |
| Page source files | 87 |
| API files | 120 |
| Route references | 99 |
| Environment variable names | 22 |
| Supabase table references | 131 |

## Git state

Latest commit:

0f36c6d8b72039300b784ff477f50f8fb7c5a81f | 2026-09-29 19:10:33 -0400 | Add permanent per-row school resolution table; fix accented-name matching

Working tree:

 M .claude/settings.json
 M docs/AUTO_PROJECT_INDEX.md
 M docs/DECISIONS.md
 M docs/NEXT_SESSION.md
 M docs/SESSION_LOG.md
?? dataimports/

## Package commands

| Name | Command |
|---|---|
| audit:seo | node scripts/audit-seo.mjs |
| build | node scripts/build.mjs |
| check | node scripts/check.mjs |
| dev | node scripts/serve.mjs --watch |
| preview | node scripts/serve.mjs |
| test | npm run check && npm run audit:seo && npm run test:athletes && npm run test:recruiting && npm run test:results && npm run test:finish-timing && npm run test:runsignup && npm run test:podium-play && npm run test:podium-play-service && npm run test:awards && npm run test:award-media && npm run test:athlete-leaders && npm run test:team-instagram && npm run test:team-media && npm run test:fan-poll && npm run test:pace-calculator && npm run test:scoring-calculator && npm run test:engagement && npm run test:path-to-state && npm run test:split-watch && npm run test:photographer-billing && npm run test:race-day-access && npm run test:athlete-goals && npm run test:article-polls && npm run test:rehearsal && npm run test:command-center && npm run test:archive-day-link && npm run test:timing-crew && npm run test:outdoor-capture && npm run test:helper-race-selection && npm run test:rehearsal-helper-sharing && npm run test:race-day-code-reveal && npm run test:live-capture-audit-fixes && npm run test:race-day-health && npm run test:split-watch-load-timeout && npm run test:vote-count-safety && npm run test:mock-meet-export |
| test:archive-day-link | node scripts/test-archive-and-day-link.mjs |
| test:article-polls | node scripts/test-article-polls.mjs |
| test:athlete-goals | node scripts/test-athlete-goals.mjs |
| test:athlete-leaders | node scripts/test-athlete-leaders.mjs |
| test:athletes | node scripts/test-athlete-foundation.mjs |
| test:award-media | node scripts/test-award-media.mjs |
| test:awards | node scripts/test-awards-service.mjs |
| test:command-center | node scripts/test-command-center.mjs |
| test:engagement | node scripts/test-engagement.mjs |
| test:fan-poll | node scripts/test-fan-poll.mjs |
| test:finish-timing | node scripts/test-finish-timing-provider.mjs && node scripts/test-finish-timing-service.mjs |
| test:helper-race-selection | node scripts/test-helper-race-selection.mjs |
| test:live-capture-audit-fixes | node scripts/test-live-capture-audit-fixes.mjs |
| test:mock-meet-export | node scripts/test-mock-meet-export.mjs |
| test:outdoor-capture | node scripts/test-outdoor-capture.mjs |
| test:pace-calculator | node scripts/test-pace-calculator.mjs |
| test:path-to-state | node scripts/test-path-to-state.mjs |
| test:photographer-billing | node scripts/test-photographer-billing.mjs |
| test:podium-play | node scripts/test-podium-play.mjs |
| test:podium-play-service | node scripts/test-podium-play-service.mjs |
| test:race-day-access | node scripts/test-race-day-access.mjs |
| test:race-day-code-reveal | node scripts/test-race-day-code-reveal.mjs |
| test:race-day-health | node scripts/test-race-day-health.mjs |
| test:recruiting | node scripts/test-recruiting-foundation.mjs |
| test:rehearsal | node scripts/test-rehearsal.mjs |
| test:rehearsal-helper-sharing | node scripts/test-rehearsal-helper-sharing.mjs |
| test:results | node scripts/test-results-ingestion.mjs |
| test:runsignup | node scripts/test-runsignup-provider.mjs |
| test:scoring-calculator | node scripts/test-scoring-calculator.mjs |
| test:split-watch | node scripts/test-split-watch.mjs |
| test:split-watch-load-timeout | node scripts/test-split-watch-load-timeout.mjs |
| test:team-instagram | node scripts/test-team-instagram.mjs |
| test:team-media | node scripts/test-team-media.mjs |
| test:timing-crew | node scripts/test-timing-crew.mjs |
| test:vote-count-safety | node scripts/test-vote-count-safety.mjs |

## Public routes

1. /
1. /about/
1. /admin/
1. /admin/athletes/
1. /admin/awards/
1. /admin/engagement/
1. /admin/fan-poll/
1. /admin/meets/
1. /admin/operations/
1. /admin/path-to-state/
1. /admin/photographers/
1. /admin/recruiting/
1. /admin/results-sources/
1. /admin/statewide-data/
1. /admin/team-content/
1. /admin/team-instagram/
1. /admin/team-manager/
1. /admin/team-rosters/
1. /admin/teams/
1. /admin/team-schedules/
1. /apply/
1. /athlete/
1. /athlete-home/
1. /athlete-login/
1. /athlete-of-the-week/
1. /athletes/
1. /athlete-spotlights/
1. /claim-your-team/
1. /contact/
1. /fan-poll/
1. /follow/
1. /guardian-home/
1. /guardian-login/
1. /interviews/
1. /meetdetail/
1. /meets/
1. /my-podium/
1. /my-podium-login/
1. /ohio-schools/
1. /pace-calculator/
1. /photographer-dashboard/
1. /photographer-login/
1. /photographers/
1. /photographers/membership/
1. /photographers/profile/
1. /podium-play/
1. /privacy/
1. /race/
1. /rankings/
1. /rankings/cross-country/
1. /rankings/leaders/
1. /rankings/methodology/
1. /rankings/mock-meets/2026-09-17/
1. /rankings/oatccc/
1. /rankings/track-and-field/
1. /recruiting/
1. /recruiting/methodology/
1. /recruiting/submit-activity/
1. /recruiting/top-100/boys/
1. /recruiting/top-100/girls/
1. /recruiting/top-250/boys-cross-country/
1. /recruiting/top-250/girls-cross-country/
1. /scoring-calculator/
1. /search/
1. /splits-calculator/
1. /split-watch/
1. /split-watch/join/
1. /split-watch/live/
1. /split-watch/plan/
1. /split-watch/races/
1. /split-watch/review/
1. /sponsors/
1. /stories/
1. /submit-results/
1. /submit-timing-results/
1. /team/
1. /team-content/
1. /team-dashboard/
1. /team-editor/
1. /team-home/
1. /team-insights/
1. /team-login/
1. /team-meet-center/
1. /team-of-the-week/
1. /team-roster/
1. /teams/
1. /team-schedule/
1. /tournament-hub/
1. /writer-login/
1. /writer-portal/
1. /writer-portal/admin/
1. /writer-portal/admin/review/
1. /writer-portal/articles/
1. /writer-portal/authors/
1. /writer-portal/board/
1. /writer-portal/calendar/
1. /writer-portal/profile/
1. /writer-portal/style-guide/
1. /writer-portal/write/

## API endpoints

1. /api/admin/athletes
1. /api/admin/auth
1. /api/admin/awards
1. /api/admin/awards-upload-media
1. /api/admin/dashboard-summary
1. /api/admin/engagement
1. /api/admin/fan-poll
1. /api/admin/intern-applications
1. /api/admin/meets
1. /api/admin/operations
1. /api/admin/path-to-state
1. /api/admin/photographers
1. /api/admin/presence
1. /api/admin/recruiting
1. /api/admin/results-sources
1. /api/admin/statewide-data
1. /api/admin/team-content
1. /api/admin/team-instagram
1. /api/admin/team-rosters
1. /api/admin/teams
1. /api/admin/team-schedules
1. /api/admin/teams-import
1. /api/admin/timing-submissions
1. /api/admin/writer-portal
1. /api/aotw/archive
1. /api/aotw/current
1. /api/aotw/nominate
1. /api/aotw/vote
1. /api/article-polls/results
1. /api/article-polls/vote
1. /api/athlete/goals
1. /api/athlete/invite
1. /api/athlete/me
1. /api/athlete/races
1. /api/athletes/detail
1. /api/athletes/index
1. /api/athletes/report
1. /api/cron/close-scheduled-nominations
1. /api/cron/finish-timing-scan
1. /api/cron/notifications
1. /api/cron/open-scheduled-nominations
1. /api/cron/team-instagram-digest
1. /api/cron/weekly-digest
1. /api/engagement/public
1. /api/engagement/track
1. /api/fan-poll/ballot
1. /api/fan-poll/index
1. /api/followers/manage
1. /api/followers/subscribe
1. /api/followers/verify
1. /api/guardian/invite
1. /api/guardian/me
1. /api/guardian/races
1. /api/intern-applications/submit
1. /api/meets/index
1. /api/meets/photographers
1. /api/my-podium/clear
1. /api/my-podium/me
1. /api/my-podium/sync
1. /api/ohio-schools/index
1. /api/photographer/billing-portal
1. /api/photographer/checkout
1. /api/photographer/create
1. /api/photographer/me
1. /api/photographer/profile
1. /api/photographer/upload-media
1. /api/photographers/detail
1. /api/photographers/index
1. /api/podium-play/leaderboard
1. /api/podium-play/leaderboard-hurdle-dash
1. /api/podium-play/me
1. /api/podium-play/submit
1. /api/podium-play/world-records
1. /api/portal/board
1. /api/portal/calendar
1. /api/portal/me
1. /api/portal/public
1. /api/portal/review
1. /api/portal/style-guide
1. /api/portal/writers
1. /api/presence/ping
1. /api/race/public
1. /api/rankings/leaders
1. /api/recruiting/index
1. /api/recruiting/submit-activity
1. /api/results-submissions/index
1. /api/split-watch/crew
1. /api/split-watch/join
1. /api/split-watch/plan
1. /api/split-watch/review
1. /api/split-watch/sessions
1. /api/split-watch/sync
1. /api/stripe/webhook
1. /api/team/access
1. /api/team/claim
1. /api/team/config
1. /api/team/content
1. /api/team/create
1. /api/team/detail
1. /api/team/home
1. /api/team/insights
1. /api/team/me
1. /api/team/meet-center
1. /api/team/race-day-code
1. /api/team/roster
1. /api/team/schedule
1. /api/team/schools
1. /api/team/upload-media
1. /api/team-instagram/index
1. /api/teams/content
1. /api/teams/detail
1. /api/teams/index
1. /api/teams/report
1. /api/teams/roster
1. /api/timing-submissions/request-upload
1. /api/timing-submissions/submit
1. /api/totw/archive
1. /api/totw/current
1. /api/totw/nominate
1. /api/totw/vote

## Environment variable names

Values are intentionally excluded.

1. CRON_SECRET
1. GITHUB_TOKEN
1. KV_REST_API_TOKEN
1. KV_REST_API_URL
1. PODIUM_ADMIN_PASSWORD
1. PODIUM_ADMIN_SESSION_SECRET
1. PORT
1. RESEND_API_KEY
1. RESEND_FROM_EMAIL
1. RESEND_REPLY_TO
1. SITE_URL
1. STRIPE_PHOTOGRAPHER_ANNUAL_PRICE_ID
1. STRIPE_PHOTOGRAPHER_MONTHLY_PRICE_ID
1. STRIPE_SECRET_KEY
1. STRIPE_WEBHOOK_SECRET
1. SUPABASE_PUBLISHABLE_KEY
1. SUPABASE_SECRET_KEY
1. SUPABASE_URL
1. TEAM_INSTAGRAM_DIGEST_EMAIL
1. VERCEL_ENV
1. VERCEL_PROJECT_PRODUCTION_URL
1. VOTE_HASH_SECRET

## Supabase table references

1. %PDF-1.7
1. <html>not really a png</html>
1. <svg></svg>
1. aotw_finalists
1. aotw_nominations
1. aotw_weeks
1. article_poll_votes
1. athlete_accounts
1. athlete_best_performances
1. athlete_content_items
1. athlete_data_sources
1. athlete_event_catalog
1. athlete_import_batches
1. athlete_invites
1. athlete_performance_import_batches
1. athlete_performance_import_rows
1. athlete_performances
1. athlete_profile_aliases
1. athlete_profile_corrections
1. athlete_profile_merges
1. athlete_profiles
1. athlete_published_recruit_ratings
1. athlete_ranking_entries
1. athlete_recruit_rating_methodologies
1. athlete_recruit_rating_rank_snapshots
1. athlete_recruit_ratings
1. athlete_recruiting_activity
1. athlete_school_history
1. athlete_social_links
1. athlete_standard_goals
1. athlete_story_links
1. discovered_meet_sources
1. discovered_meets
1. engagement_settings
1. fan_poll_ballots
1. fan_poll_email_subscribers
1. fan_poll_week_results
1. fan_poll_weeks
1. finish_timing_team_links
1. guardian_accounts
1. guardian_invites
1. intern_applications
1. meets
1. my_podium_accounts
1. not an image, just text
1. ohio_data_conflicts
1. ohio_data_sources
1. ohio_import_batches
1. ohio_school_aliases
1. ohio_school_divisions
1. ohio_schools
1. ohio_tournament_qualification_thresholds
1. ohio_tournament_regional_assignments
1. ohio_tournament_stage_calendar
1. photographer_galleries
1. photographer_meet_coverage
1. photographer_members
1. photographer_partnership_stories
1. photographer_plans
1. photographer_portfolio
1. photographer_service_areas
1. photographer_sports
1. photographer_subscriptions
1. photographers
1. place,athlete_name,school_name,event_name,mark_text\n1,John Runner,Central,5K,15:29.20
1. place,athlete_name,school_name,event_name,mark_text\n1,John Runner,Central,5K,15:30.20
1. plain text file
1. podium_play_accounts
1. portal_article_revisions
1. portal_articles
1. portal_board_posts
1. portal_board_replies
1. portal_editor_notes
1. portal_profiles
1. portal_story_ideas
1. portal_style_guide
1. race_checkpoints
1. race_day_code_attempts
1. race_day_sessions
1. race_goals
1. race_pack_captures
1. race_participants
1. race_positions
1. race_sessions
1. race_split_revisions
1. race_splits
1. race_targets
1. recruiting_activity_tips
1. result_crawl_edges
1. result_crawl_pages
1. result_ingestion_audit
1. result_ingestion_jobs
1. result_source_documents
1. result_staging_row_school_resolutions
1. result_staging_rows
1. result_team_scores
1. results_discovery_runs
1. results_source_providers
1. result-source-documents
1. site_presence
1. team_admin_audit_log
1. team_advancement_status
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
1. team_race_day_codes
1. team_reports
1. team_roster_entries
1. team_roster_import_batches
1. team_seasons
1. team_social_links
1. team_sponsor_placements
1. team_sponsors
1. timing_submission_upload_slots
1. timing_submissions
1. timing-submissions
1. totw_finalists
1. totw_nominations
1. totw_weeks
1. writer-portal-images

## Page source files

1. src\pages\admin.mjs
1. src\pages\adminathletes.mjs
1. src\pages\adminawards.mjs
1. src\pages\adminengagement.mjs
1. src\pages\adminfanpoll.mjs
1. src\pages\adminmeets.mjs
1. src\pages\adminoperations.mjs
1. src\pages\adminpathtostate.mjs
1. src\pages\adminphotographers.mjs
1. src\pages\adminrecruiting.mjs
1. src\pages\adminresultssources.mjs
1. src\pages\adminstatewidedata.mjs
1. src\pages\adminteamcontent.mjs
1. src\pages\adminteaminstagram.mjs
1. src\pages\adminteammanager.mjs
1. src\pages\adminteamrosters.mjs
1. src\pages\adminteams.mjs
1. src\pages\adminteamschedules.mjs
1. src\pages\apply.mjs
1. src\pages\athletedetail.mjs
1. src\pages\athletehome.mjs
1. src\pages\athletelogin.mjs
1. src\pages\athletes.mjs
1. src\pages\claimteam.mjs
1. src\pages\fanpoll.mjs
1. src\pages\follow.mjs
1. src\pages\guardianhome.mjs
1. src\pages\guardianlogin.mjs
1. src\pages\meetdetail.mjs
1. src\pages\meets.mjs
1. src\pages\mockmeets.mjs
1. src\pages\mockregionals.mjs
1. src\pages\mypodium.mjs
1. src\pages\mypodiumlogin.mjs
1. src\pages\oatcccpoll.mjs
1. src\pages\ohioschools.mjs
1. src\pages\pacecalculator.mjs
1. src\pages\photographerdashboard.mjs
1. src\pages\photographerdetail.mjs
1. src\pages\photographerlogin.mjs
1. src\pages\photographermembership.mjs
1. src\pages\photographers.mjs
1. src\pages\podiumplay.mjs
1. src\pages\privacy.mjs
1. src\pages\racepublic.mjs
1. src\pages\rankingleaders.mjs
1. src\pages\rankingmethodology.mjs
1. src\pages\recruiting.mjs
1. src\pages\recruitingmethodology.mjs
1. src\pages\recruitingtop100.mjs
1. src\pages\recruitingtop250xc.mjs
1. src\pages\scoringcalculator.mjs
1. src\pages\search.mjs
1. src\pages\splitscalculator.mjs
1. src\pages\splitwatch.mjs
1. src\pages\splitwatchjoin.mjs
1. src\pages\splitwatchlive.mjs
1. src\pages\splitwatchplan.mjs
1. src\pages\splitwatchraces.mjs
1. src\pages\splitwatchreview.mjs
1. src\pages\submitrecruitingactivity.mjs
1. src\pages\submitresults.mjs
1. src\pages\submittimingresults.mjs
1. src\pages\teamcontent.mjs
1. src\pages\teamdashboard.mjs
1. src\pages\teameditor.mjs
1. src\pages\teamhome.mjs
1. src\pages\teaminsights.mjs
1. src\pages\teamlogin.mjs
1. src\pages\teammeetcenter.mjs
1. src\pages\teamprofile.mjs
1. src\pages\teamroster.mjs
1. src\pages\teams.mjs
1. src\pages\teamschedule.mjs
1. src\pages\tournamenthub.mjs
1. src\pages\weeklyawards.mjs
1. src\pages\writerlogin.mjs
1. src\pages\writerportal.mjs
1. src\pages\writerportaladmin.mjs
1. src\pages\writerportalarticle.mjs
1. src\pages\writerportalauthor.mjs
1. src\pages\writerportalboard.mjs
1. src\pages\writerportalcalendar.mjs
1. src\pages\writerportalprofile.mjs
1. src\pages\writerportalreview.mjs
1. src\pages\writerportalstyleguide.mjs
1. src\pages\writerportalwrite.mjs

## Main project folders

1. .claude
1. api
1. content
1. dataimports
1. docs
1. install
1. lib
1. public
1. reference_data
1. scripts
1. src
1. tests
