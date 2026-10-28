import { adminTeamsPage } from "../src/pages/adminteams.mjs";
import { adminTeamManagerPage } from "../src/pages/adminteammanager.mjs";
import { adminTeamSchedulesPage } from "../src/pages/adminteamschedules.mjs";
import { adminTeamRostersPage } from "../src/pages/adminteamrosters.mjs";
import { adminTeamContentPage } from "../src/pages/adminteamcontent.mjs";
import { adminEngagementPage } from "../src/pages/adminengagement.mjs";
import { adminPhotographersPage } from "../src/pages/adminphotographers.mjs";
import { photographersPage } from "../src/pages/photographers.mjs";
import { photographerDetailPage } from "../src/pages/photographerdetail.mjs";
import { adminOperationsPage } from "../src/pages/adminoperations.mjs";
import { adminStatewideDataPage } from "../src/pages/adminstatewidedata.mjs";
import { followPage } from "../src/pages/follow.mjs";
import { myPodiumPage } from "../src/pages/mypodium.mjs";
import { myPodiumLoginPage } from "../src/pages/mypodiumlogin.mjs";
import { teamInsightsPage } from "../src/pages/teaminsights.mjs";
import { privacyPage } from "../src/pages/privacy.mjs";
import { standardsPage } from "../src/pages/standards.mjs";
import { termsPage } from "../src/pages/terms.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import { site, NOINDEX_NOFOLLOW_PREFIXES, NOINDEX_FOLLOW_PREFIXES, SITEMAP_EXACT_EXCLUDE } from "../src/config/site.mjs";
import sponsors from "../src/data/sponsors.json" with { type: "json" };
import ohioSchoolFoundation from "../public/data/ohio-school-foundation-2026-27.json" with { type: "json" };
import athleteFoundationSeed from "../public/data/athlete-foundation-seed-2026.json" with { type: "json" };
import preseasonInteractiveData from "../public/data/podium-watch-2026-preseason-interactive-data.json" with { type: "json" };
import oatcccPollData from "../src/data/oatccc-coaches-poll.json" with { type: "json" };
import { displaySchoolName } from "../lib/ohio_foundation_service.mjs";
import {
  copyDirectory,
  escapeHtml,
  formatDate,
  listFiles,
  parseCsv,
  parseFrontMatter,
  readingTime,
  slugify,
  validateStory
} from "../src/lib/content.mjs";
import { renderMarkdown } from "../src/lib/markdown.mjs";
import {
  absoluteUrl,
  articleJsonLd,
  breadcrumb,
  breadcrumbsJsonLd,
  categorySlug,
  emptyState,
  icon,
  layout,
  organizationJsonLd,
  pageHero,
  rankingCard,
  STORY_TYPES,
  storyBylineHtml,
  storyCard,
  storyFallbackImage,
  storyType,
  websiteJsonLd
} from "../src/lib/html.mjs";
import { meetsIndexPage } from "../src/pages/meets.mjs";
import { meetDetailPage } from "../src/pages/meetdetail.mjs";
import { adminPage } from "../src/pages/admin.mjs";
import { adminMeetsPage } from "../src/pages/adminmeets.mjs";
import { teamLoginPage } from "../src/pages/teamlogin.mjs";
import { teamDashboardPage } from "../src/pages/teamdashboard.mjs";
import { photographerLoginPage } from "../src/pages/photographerlogin.mjs";
import { photographerDashboardPage } from "../src/pages/photographerdashboard.mjs";
import { photographerMembershipPage } from "../src/pages/photographermembership.mjs";
import { teamSchedulePage } from "../src/pages/teamschedule.mjs";
import { teamRosterPage } from "../src/pages/teamroster.mjs";
import { teamContentPage } from "../src/pages/teamcontent.mjs";
import { teamEditorPage } from "../src/pages/teameditor.mjs";
import { teamHomePage } from "../src/pages/teamhome.mjs";
import { teamMeetCenterPage } from "../src/pages/teammeetcenter.mjs";
import { athleteLoginPage } from "../src/pages/athletelogin.mjs";
import { athleteHomePage } from "../src/pages/athletehome.mjs";
import { guardianLoginPage } from "../src/pages/guardianlogin.mjs";
import { guardianHomePage } from "../src/pages/guardianhome.mjs";
import { racePublicPage } from "../src/pages/racepublic.mjs";
import { splitWatchHubPage } from "../src/pages/splitwatch.mjs";
import { splitWatchPlanPage } from "../src/pages/splitwatchplan.mjs";
import { splitWatchLivePage } from "../src/pages/splitwatchlive.mjs";
import { splitWatchReviewPage } from "../src/pages/splitwatchreview.mjs";
import { splitWatchJoinPage } from "../src/pages/splitwatchjoin.mjs";
import { splitWatchRacesPage } from "../src/pages/splitwatchraces.mjs";
import { teamProfilePage } from "../src/pages/teamprofile.mjs";
import { teamsPage } from "../src/pages/teams.mjs";
import { searchPage } from "../src/pages/search.mjs";
import { athleteOfTheWeekPage, teamOfTheWeekPage } from "../src/pages/weeklyawards.mjs";
import { podiumPlayPage } from "../src/pages/podiumplay.mjs";
import { tournamentHubPage } from "../src/pages/tournamenthub.mjs";
import { ohioSchoolsPage } from "../src/pages/ohioschools.mjs";
import { claimTeamPage } from "../src/pages/claimteam.mjs";
import { submitResultsPage } from "../src/pages/submitresults.mjs";
import { submitTimingResultsPage } from "../src/pages/submittimingresults.mjs";
import { submitPhotosPage } from "../src/pages/submitphotos.mjs";
import { photosPage } from "../src/pages/photos.mjs";
import { adminPhotoSubmissionsPage } from "../src/pages/adminphotosubmissions.mjs";
import { rankingMethodologyPage } from "../src/pages/rankingmethodology.mjs";
import { oatcccCoachesPollPage } from "../src/pages/oatcccpoll.mjs";
import { mockMeetsPage } from "../src/pages/mockmeets.mjs";
import { mockRegionalsAllPages } from "../src/pages/mockregionals.mjs";
// mockPostseasonAllPages (/mock-postseason/...) is a LOCAL-ONLY REVIEW
// BUILD of the districts-fed Mock Postseason chain, entirely separate
// from the live /mock-meets/... routes above and not linked from any
// nav. Do not remove this comment boundary when wiring the real feature
// in later -- that migration replaces mockRegionalsAllPages's data
// source, it does not add these routes alongside it.
import { mockPostseasonAllPages } from "../src/pages/mockpostseason.mjs";
// mockDistrictsAllPages (src/pages/mockdistricts.mjs) is built and
// committed but deliberately not called below yet -- the user wants Mock
// Districts kept off the live site until more district data is sent and
// real school/division coverage improves. Re-add the call in the page
// loop below (and the "Districts" nav item in src/config/site.mjs) when
// told to make it live.
// import { mockDistrictsAllPages } from "../src/pages/mockdistricts.mjs";
import { trackDivisionsPage } from "../src/pages/trackdivisions.mjs";
import { rankingLeadersPage } from "../src/pages/rankingleaders.mjs";
import { athletesPage } from "../src/pages/athletes.mjs";
import { athleteDetailPage } from "../src/pages/athletedetail.mjs";
import { adminAthletesPage } from "../src/pages/adminathletes.mjs";
import { adminRecruitingPage } from "../src/pages/adminrecruiting.mjs";
import { adminResultsSourcesPage } from "../src/pages/adminresultssources.mjs";
import { adminTeamInstagramPage } from "../src/pages/adminteaminstagram.mjs";
import { adminFanPollPage } from "../src/pages/adminfanpoll.mjs";
import { adminAwardsPage } from "../src/pages/adminawards.mjs";
import { adminPathToStatePage } from "../src/pages/adminpathtostate.mjs";
import { fanPollDivisionPage, fanPollIndexPage } from "../src/pages/fanpoll.mjs";
import { paceCalculatorPage } from "../src/pages/pacecalculator.mjs";
import { splitsCalculatorPage } from "../src/pages/splitscalculator.mjs";
import { scoringCalculatorPage } from "../src/pages/scoringcalculator.mjs";
import { recruitingPage } from "../src/pages/recruiting.mjs";
import { recruitingTop100Page } from "../src/pages/recruitingtop100.mjs";
import { recruitingTop250XcPage } from "../src/pages/recruitingtop250xc.mjs";
import { recruitingMethodologyPage } from "../src/pages/recruitingmethodology.mjs";
import { submitRecruitingActivityPage } from "../src/pages/submitrecruitingactivity.mjs";
import { applyPage } from "../src/pages/apply.mjs";
import { applyStateMeetCorrespondentPage } from "../src/pages/applystatemeetcorrespondent.mjs";
import { writerLoginPage } from "../src/pages/writerlogin.mjs";
import { writerPortalPage } from "../src/pages/writerportal.mjs";
import { writerPortalProfilePage } from "../src/pages/writerportalprofile.mjs";
import { writerPortalAdminPage } from "../src/pages/writerportaladmin.mjs";
import { writerPortalWritePage } from "../src/pages/writerportalwrite.mjs";
import { writerPortalReviewPage } from "../src/pages/writerportalreview.mjs";
import { writerPortalArticlePage } from "../src/pages/writerportalarticle.mjs";
import { writerPortalAuthorPage } from "../src/pages/writerportalauthor.mjs";
import { writerPortalCalendarPage } from "../src/pages/writerportalcalendar.mjs";
import { writerPortalBoardPage } from "../src/pages/writerportalboard.mjs";
import { writerPortalStyleGuidePage } from "../src/pages/writerportalstyleguide.mjs";
import { FREE_TRIAL_DAYS } from "../lib/photographer_membership_config.mjs";

const root = process.cwd();
const dist = path.join(root, "dist");
const generatedPaths = new Set();
// AdSense/indexing remediation (2026-09-15): real, per-page last-modified
// dates for the sitemap, populated only where a genuine tracked date
// already exists (stories, rankings) -- a path with no entry here simply
// omits <lastmod> in the sitemap rather than getting one shared, fake
// date stamped on every URL regardless of when it actually changed.
const pathLastmod = new Map();
const athleteSeedRows = Array.isArray(athleteFoundationSeed.athletes)
  ? athleteFoundationSeed.athletes
  : [];
const athleteSeedByRankingRow = new Map(
  athleteSeedRows.map((athlete) => [
    [
      athlete.ranking?.ranking_slug,
      slugify(athlete.display_name),
      slugify(athlete.school_name)
    ].join("|"),
    athlete
  ])
);

function athleteSeedForRankingRow(ranking, row) {
  return athleteSeedByRankingRow.get([
    ranking.slug,
    slugify(row.athlete),
    slugify(row.school)
  ].join("|")) || null;
}

// The 8 preseason cross country team-power-ranking articles
// (content/stories/20260824_preseason_*.md, driven by
// public/data/podium-watch-2026-preseason-interactive-data.json). This is a
// genuinely separate content type from the CSV-driven individual-athlete
// rankings loadRankings() produces (a team's simulated score is not an
// athlete's time/mark, and content/rankings/*.csv has no column for it) --
// these helpers are what connect the two systems anyway, by classification
// (gender + division number), for the "2026 preseason team power rankings"
// callout on the /rankings/cross-country/ division pages, purely by
// lookup. No longer used for the homepage widget -- see oatcccPowerRows()
// below for that (2026-09-03).
const preseasonClassifications = Object.values(preseasonInteractiveData.classifications || {});

function preseasonClassificationFor(genderLower, divisionNumber) {
  return preseasonClassifications.find(
    (item) => item.gender.toLowerCase() === genderLower && item.division === divisionNumber
  ) || null;
}

function preseasonArticleHref(classification) {
  return `/stories/${classification.articleSlug}/`;
}

// Top N teams from the official OATCCC coaches poll (2026-09-03: the
// homepage widget switched from Podium Watch's own simulated preseason
// power rankings to the real, weekly-updated OATCCC data, once that
// poll existed and was live) for one gender/division, in the
// [team, label, href] shape the homepage widget already renders. Always
// reads the LAST entry in oatcccPollData.weeks -- the most recent poll
// -- so this widget updates automatically every time a new week is
// pushed onto that array, with no code change here.
function oatcccPowerRows(genderLower, divisionNumber, count = 4) {
  const latestWeek = oatcccPollData.weeks[oatcccPollData.weeks.length - 1];
  const rows = (latestWeek.divisions[genderLower] && latestWeek.divisions[genderLower][divisionNumber]) || [];
  return rows.slice(0, count).map((row) => [row.school, `${row.points} points`, "/rankings/oatccc/"]);
}

// vercel.json caches everything under /scripts/ and /styles/ for up to an
// hour in the browser and a day at the CDN edge (stale-while-revalidate up
// to a week on top of that) -- a reasonable policy for a normally
// slow-changing static site, but it has a real, confirmed cost: every one
// of those paths is a STABLE url with no version marker, so a coach who
// already has a page open (or revisits within that window) silently keeps
// running old JavaScript for up to an hour after a real fix ships, with no
// way to tell short of a hard refresh. Confirmed directly -- a real user
// reported a just-shipped feature "still not there" twice in one session,
// and in both cases the deployed file itself was correct; their browser's
// cached copy from before the fix simply hadn't expired yet.
//
// The fix: stamp every same-origin /scripts/*.js and /styles/*.css
// reference with a ?v=<build> query string, computed once per build run.
// A new build always produces a new value, so the URL itself changes on
// every real deploy -- the browser is forced to fetch fresh regardless of
// how long the OLD url is still sitting in cache, and the existing
// long Cache-Control values become actually safe (a cached response is
// only ever reused under the exact version it was cached for) rather than
// just fast-but-occasionally-wrong.
const BUILD_VERSION = Date.now().toString(36);

function stampCacheBustedAssetUrls(html) {
  return html
    .replace(/(src="\/scripts\/[^"?]+\.js)(")/g, `$1?v=${BUILD_VERSION}$2`)
    .replace(/(href="\/styles\/[^"?]+\.css)(")/g, `$1?v=${BUILD_VERSION}$2`);
}

async function writeFile(relativePath, content) {
  const clean = relativePath.replace(/^\/+/, "");
  const target = path.join(dist, clean);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, "utf8");
  generatedPaths.add(`/${clean.replace(/index\.html$/, "").replace(/\\/g, "/")}`.replace(/\/+/g, "/"));
}

async function writePage(route, html) {
  const cleanRoute = route === "/" ? "" : route.replace(/^\/+|\/+$/g, "");
  await writeFile(path.join(cleanRoute, "index.html"), stampCacheBustedAssetUrls(html));
}

function pathFromSport(sport) {
  return sport.toLowerCase().includes("track") ? "track-and-field" : "cross-country";
}

async function loadStories() {
  const files = await listFiles(path.join(root, "content", "stories"), ".md");
  const stories = [];
  for (const filePath of files) {
    const source = await fs.readFile(filePath, "utf8");
    const { data, body } = parseFrontMatter(source, path.relative(root, filePath));
    validateStory(data, path.relative(root, filePath));
    const fileSlug = path.basename(filePath, path.extname(filePath));
    const slug = slugify(data.slug || fileSlug);
    const story = {
      ...data,
      slug,
      body,
      html: renderMarkdown(body),
      tags: Array.isArray(data.tags) ? data.tags : [],
      featured: data.featured === true,
      // Optional editorial override: a story with pinnedRank set jumps to
      // the front of the feed (lowest rank first) ahead of every
      // unpinned story, regardless of date -- used to lock in a specific
      // homepage/feed order (e.g. "seniors, then juniors, then
      // sophomores") without touching each story's real `date`, which
      // stays the true, reader-facing "published" byline. Unpinned
      // stories (the overwhelming majority) are completely unaffected --
      // they keep sorting by date exactly as before. See
      // docs/DECISIONS.md, 2026-08-21.
      pinnedRank: Number.isFinite(Number(data.pinnedRank)) ? Number(data.pinnedRank) : null,
      draft: data.draft === true,
      readingMinutes: readingTime(body),
      sourceFile: path.relative(root, filePath),
      // Story page redesign (2026-10-28), B4: structured front matter
      // for the at-a-glance strip and region "where" lines, both stored
      // as pipe-delimited list entries since the project's own minimal
      // front matter parser (src/lib/content.mjs) only supports flat
      // scalars and lists of scalars, not nested objects.
      seriesOrder: Number.isFinite(Number(data.seriesOrder)) ? Number(data.seriesOrder) : null,
      atAGlance: (Array.isArray(data.atAGlance) ? data.atAGlance : []).map((row) => {
        const [label, value, name, sub, tone] = String(row).split("|").map((part) => part.trim());
        return { label, value, name, sub, tone: tone || "neutral" };
      }),
      regions: (Array.isArray(data.regions) ? data.regions : []).map((row) => {
        const [name, sites, regional] = String(row).split("|").map((part) => part.trim());
        return { name, sites, regional };
      }),
      nextRegionals: (Array.isArray(data.nextRegionals) ? data.nextRegionals : []).map((row) => {
        const [name, sites] = String(row).split("|").map((part) => part.trim());
        return { name, sites };
      })
    };
    if (!story.draft) stories.push(story);
  }
  // Story page redesign (2026-10-28), A2: pinnedRank (2026-08-21,
  // docs/DECISIONS.md) used to let a story jump the whole feed ahead of
  // every unpinned story regardless of date -- confirmed live, it was
  // keeping a Sept. 30 and an Aug. 21 story ahead of the Oct. 28
  // district package on the homepage. A2 asks for every story list to
  // be strictly newest-first, so pinnedRank is no longer read here.
  // The field itself is untouched on every story's front matter and
  // still computed above -- re-enabling it later is a one-line change,
  // not a rebuild.
  return stories.sort((a, b) => {
    const dateDiff = new Date(`${b.date}T12:00:00`) - new Date(`${a.date}T12:00:00`);
    if (dateDiff !== 0) return dateDiff;
    // Story page redesign (2026-10-28), A2: same-date tie-break, so a
    // multi-part package (e.g. district weekend's overview + three
    // division recaps, all dated the same day) reads in its intended
    // order instead of alphabetical-by-filename. Stories without a
    // seriesOrder are unaffected.
    if (a.seriesOrder !== null && b.seriesOrder !== null) return a.seriesOrder - b.seriesOrder;
    return 0;
  });
}

async function loadRankings() {
  const files = await listFiles(path.join(root, "content", "rankings"), ".csv");
  const required = ["rank", "athlete", "school", "division", "gender", "season", "event", "timeOrMark", "updatedDate", "slug", "title", "sport"];
  const rankings = [];
  for (const filePath of files) {
    const rows = parseCsv(await fs.readFile(filePath, "utf8"), path.relative(root, filePath));
    if (!rows.length) continue;
    for (const field of required) {
      if (!(field in rows[0])) throw new Error(`Ranking validation failed for ${path.relative(root, filePath)}. Missing required CSV column: ${field}.`);
    }
    rows.forEach((row) => {
      const missing = required.filter((field) => !String(row[field] || "").trim());
      if (missing.length) throw new Error(`Ranking validation failed for ${path.relative(root, filePath)} at CSV row ${row.__row}. Missing: ${missing.join(", ")}.`);
      if (!Number.isFinite(Number(row.rank))) throw new Error(`Ranking validation failed for ${path.relative(root, filePath)} at CSV row ${row.__row}. Rank must be a number.`);
    });
    rows.sort((a, b) => Number(a.rank) - Number(b.rank));
    const first = rows[0];
    const sportPath = pathFromSport(first.sport);
    const genderPath = slugify(first.gender);
    const divisionNumber = String(first.division).match(/\d+/)?.[0] || slugify(first.division);
    const href = `/rankings/${sportPath}/${genderPath}/division-${divisionNumber}/${slugify(first.slug)}/`;
    rankings.push({
      filePath,
      rows,
      sport: first.sport,
      gender: first.gender,
      division: first.division,
      season: first.season,
      event: first.event,
      updatedDate: first.updatedDate,
      slug: slugify(first.slug),
      title: first.title,
      subtitle: first.subtitle,
      rankingType: first.rankingType || "Editorial ranking",
      sourceLabel: first.sourceLabel || "Published results and Podium Watch analysis",
      sourceUrl: first.sourceUrl || "",
      methodologyNote: first.methodologyNote || "",
      storySlug: slugify(first.storySlug || ""),
      href,
      sportPath,
      genderPath,
      divisionNumber
    });
  }
  return rankings.sort((a, b) => new Date(`${b.updatedDate}T12:00:00`) - new Date(`${a.updatedDate}T12:00:00`));
}

function homePage(stories, rankings) {
  // Real request, 2026-09-16: the homepage lead must always be the most
  // recent story, full stop -- no exceptions. This used to prefer a
  // hand-flagged featured:true story first (removed), and `stories[0]`
  // alone still wasn't enough -- loadStories() sorts pinnedRank stories
  // to the front ahead of date for the rest of the site (the /stories/
  // feed, category pages -- unchanged, still real and still useful
  // there), which meant a pinned story could still silently beat a
  // genuinely newer one for this one slot. A pure date-only sort on a
  // local copy (not touching the `stories` array itself, so every other
  // page keeps its pinnedRank ordering exactly as before) is the only
  // way to guarantee "always the newest" with truly no exceptions.
  const featuredStory = [...stories].sort((a, b) => new Date(`${b.date}T12:00:00`) - new Date(`${a.date}T12:00:00`))[0];
  // Exclude the hero story from "Latest Stories" below it -- without this,
  // whenever the featured story is also among the most recent (the normal
  // case), it silently appeared twice on the homepage: once as the big
  // lead, again as the first card in the grid underneath.
  // Story page redesign (2026-10-28), A2: strictly newest-first. An
  // earlier pass (media-credibility audit, P2-6) reordered this row to
  // prefer real-image stories over the generic fallback image, which
  // put an August/September story ahead of an October one -- a real
  // violation of "newest first everywhere" the handoff explicitly
  // called out. `stories` is already sorted newest-first (with the
  // seriesOrder tie-break, loadStories() in this same file), so a plain
  // slice is the correct fix; no image-based reordering.
  const latestStories = stories.filter((story) => story.slug !== featuredStory?.slug).slice(0, 8);
  // Homepage rebuild (2026-08-28): this used to render as "Latest
  // Stories" directly under the lead story, AND a second, separate
  // "Latest stories" section further down the page ("More than a finish
  // time") rendered this exact same set of cards again -- a real,
  // pre-existing bug (confirmed directly: 6 links to the same 3 stories,
  // not 3, on a single homepage load). There is now exactly one Latest
  // Stories section, moved lower on the page (after Ohio
  // Today/Results/Rankings/Power Rankings, matching the mobile-first
  // priority order), and it is the only one.
  // Swappable rail instead of a 3-card grid (2026-09-30): native CSS
  // scroll-snap gives real touch swipe on mobile for free -- no JS
  // needed for the gesture itself, and it can't get the "carousel
  // nobody notices" reputation an auto-advancing slider earns, since
  // nothing ever moves unless the reader moves it. The prev/next
  // buttons are a desktop-only convenience (public/scripts/story-
  // rail.js) for the same reason; touch devices already have the
  // swipe itself. Shows up to 8 stories instead of 3.
  const storyContent = latestStories.length ? latestStories.map((story) => storyCard(story)).join("") : emptyState({
    title: "Stories are coming soon",
    description: "Add a Markdown file to content/stories and redeploy the site.",
    actionLabel: "Open stories",
    actionHref: "/stories/"
  });

  const leadTitle = featuredStory?.title || "The teams and runners set to define Ohio cross country";
  const leadDescription = featuredStory?.description || "Rankings, results, and the stories shaping the road to state.";
  const leadHref = featuredStory ? `/stories/${featuredStory.slug}/` : "/rankings/";
  const leadImage = featuredStory?.featuredImage || storyFallbackImage(featuredStory?.category);
  const leadImagePosition = featuredStory?.featuredImagePosition || "";
  // Real, official OATCCC coaches poll data (top 4 teams per
  // classification, from that poll's own most recent week) -- replaced
  // Podium Watch's own simulated preseason power rankings here
  // (2026-09-03, once the real OATCCC poll existed and was live weekly)
  // per an explicit request: this homepage widget, and its "See full
  // rankings" link, should point at the real OATCCC poll, not Podium
  // Watch's own preseason projection. See oatcccPowerRows() above.
  const powerRankingData = {
    boys: {
      1: oatcccPowerRows("boys", 1),
      2: oatcccPowerRows("boys", 2),
      3: oatcccPowerRows("boys", 3),
      4: oatcccPowerRows("boys", 4)
    },
    girls: {
      1: oatcccPowerRows("girls", 1),
      2: oatcccPowerRows("girls", 2),
      3: oatcccPowerRows("girls", 3),
      4: oatcccPowerRows("girls", 4)
    }
  };
  const initialPowerRows = powerRankingData.boys[1].map(([team, label, href], index) => `<a class="power-row" href="${escapeHtml(href)}"><b>${index + 1}</b><span><strong>${escapeHtml(team)}</strong><small>${escapeHtml(label)}</small></span></a>`).join("");
  // The real current poll's own label (e.g. "Week 1 Poll") -- never
  // hardcoded, so this stays accurate automatically as new weeks are
  // added to oatccc-coaches-poll.json with no further code change here.
  const currentPollLabel = oatcccPollData.weeks[oatcccPollData.weeks.length - 1].pollLabel;
  // Media-credibility audit (2026-10-28), P0-3: the homepage panel used
  // to show the bare word "Updated" with no actual date. Use the poll's
  // own real pollDate field (already in oatccc-coaches-poll.json for
  // every week) instead of inventing one.
  const currentPollDate = formatDate(oatcccPollData.weeks[oatcccPollData.weeks.length - 1].pollDate);
  // Short summary only on the homepage lead card (Phase 5) -- the full
  // description still appears on the story's own page unchanged, this
  // just keeps the homepage card from running long before a visitor
  // ever reaches results/rankings below it.
  const leadSummary = leadDescription.length > 150 ? `${leadDescription.slice(0, 147).trimEnd()}...` : leadDescription;
  // Media-credibility audit (2026-10-28), P0-3: full homepage reorder so
  // the first thing a reviewer (or any reader) sees is the newsroom, not
  // a rankings widget or a vote CTA. New order top to bottom: hero (the
  // latest story, with real category/byline/date -- no more hardcoded
  // "2026 XC Preview" label on whatever happens to be featured), Latest
  // Stories, Latest Results (+ Upcoming Meets alongside it -- same real
  // /api/meets/ data, just repositioned), OATCCC Poll, Rankings, Voting,
  // Follow (My Podium), About. Nothing here was deleted -- every panel,
  // script, and data source is the same one that existed before, just
  // moved and (for the OATCCC date and rankings badge) relabeled.
  const heroCategory = featuredStory?.category || "Cross Country";
  const heroByline = storyBylineHtml(featuredStory?.author);
  const heroDate = featuredStory ? formatDate(featuredStory.date) : "";
  const content = `<section class="home-hero-news"><div class="container">
    <article class="home-lead"><a class="home-lead-image" href="${leadHref}"><img src="${leadImage}" alt="" width="1000" height="560" loading="eager"${leadImagePosition ? ` style="object-position:${escapeHtml(leadImagePosition)}"` : ""}><span>${escapeHtml(heroCategory)}</span></a><div><p class="eyebrow">${escapeHtml(heroCategory)}</p><h1><a href="${leadHref}">${escapeHtml(leadTitle)}</a></h1><p>${escapeHtml(leadSummary)}</p><p class="story-byline">By ${heroByline}${heroDate ? ` &middot; ${heroDate}` : ""}</p><a class="text-link" href="${leadHref}">Read the full story ${icon("arrow")}</a></div></article>
  </div></section>

  <section class="section section-paper" aria-labelledby="latest-stories-title">
    <div class="container">
      <div class="section-heading"><div><p class="eyebrow">Latest stories</p><h2 id="latest-stories-title">More than a finish time.</h2></div><a class="text-link" href="/stories/">From the newsroom ${icon("arrow")}</a></div>
      ${latestStories.length
        ? `<div class="story-rail-wrap">
            <button class="story-rail-arrow story-rail-prev" type="button" aria-label="Previous stories" data-story-rail-prev>${icon("arrow")}</button>
            <div class="story-rail" data-story-rail>${storyContent}</div>
            <button class="story-rail-arrow story-rail-next" type="button" aria-label="Next stories" data-story-rail-next>${icon("arrow")}</button>
          </div>`
        : storyContent}
    </div>
  </section>

  <section class="section" aria-labelledby="latest-results-title">
    <div class="container">
      <div class="section-heading"><div><p class="eyebrow">Latest results</p><h2 id="latest-results-title">What just happened in Ohio.</h2></div><a class="text-link" href="/meets/?view=results">All results ${icon("arrow")}</a></div>
      <div class="home-results-grid">
        <section class="home-panel" data-latest-results-panel>
          <div class="home-panel-title"><h2>Recently completed</h2></div>
          <div data-latest-results-list><a class="home-meet" href="/meets/?view=results"><b>&hellip;</b><span><strong>Checking results&hellip;</strong><small>&nbsp;</small></span></a></div>
        </section>
        <section class="home-panel" data-upcoming-meets-panel>
          <div class="home-panel-title"><h2>Upcoming meets</h2></div>
          <div data-upcoming-meets-list><a class="home-meet" href="/meets/?view=upcoming"><b>&hellip;</b><span><strong>Checking the calendar&hellip;</strong><small>&nbsp;</small></span></a></div>
          <a class="home-panel-link" href="/meets/?view=upcoming">Full meet calendar ${icon("arrow")}</a>
        </section>
      </div>
    </div>
  </section>

  <section class="section" aria-labelledby="recent-photos-title" data-recent-photos-section hidden>
    <div class="container">
      <div class="section-heading"><div><p class="eyebrow">Submitted by fans</p><h2 id="recent-photos-title">Recent meet photos.</h2></div><a class="text-link" href="/photos/">See all photos ${icon("arrow")}</a></div>
      <div class="photos-grid" data-recent-photos-grid data-photos-limit="8"></div>
    </div>
  </section>

  <section class="section" aria-labelledby="oatccc-poll-title">
    <div class="container">
      <div class="section-heading"><div><p class="eyebrow">OATCCC Coaches Poll</p><h2 id="oatccc-poll-title">Who the coaches have rising.</h2></div><a class="text-link" href="/rankings/oatccc/">See full rankings ${icon("arrow")}</a></div>
      <section class="home-panel power-panel"><div class="home-panel-title"><h2>OATCCC Coaches Poll</h2><span data-power-updated>${escapeHtml(currentPollLabel)} &middot; Updated ${escapeHtml(currentPollDate)}</span></div><div class="power-tabs" role="group" aria-label="Choose rankings gender"><button class="active" type="button" data-power-gender="boys">Boys</button><button type="button" data-power-gender="girls">Girls</button></div><label class="power-select-label"><span class="visually-hidden">Choose division</span><select data-power-division><option value="1">Division I</option><option value="2">Division II</option><option value="3">Division III</option><option value="4">Division IV</option></select></label><div class="power-list" data-power-list>${initialPowerRows}</div><script type="application/json" data-power-data>${JSON.stringify(powerRankingData).replaceAll("<", "\\u003c")}</script><script>(()=>{const panel=document.currentScript.closest('.power-panel');if(!panel)return;const data=JSON.parse(panel.querySelector('[data-power-data]').textContent);const list=panel.querySelector('[data-power-list]');const select=panel.querySelector('[data-power-division]');let gender='boys';const draw=()=>{list.innerHTML=data[gender][select.value].map((row,i)=>'<a class="power-row" href="'+row[2]+'"><b>'+(i+1)+'</b><span><strong>'+row[0]+'</strong><small>'+row[1]+'</small></span></a>').join('')};panel.querySelectorAll('[data-power-gender]').forEach(button=>button.addEventListener('click',()=>{gender=button.dataset.powerGender;panel.querySelectorAll('[data-power-gender]').forEach(item=>item.classList.toggle('active',item===button));draw()}));select.addEventListener('change',draw)})();</script></section>
    </div>
  </section>

  <!-- Story page redesign (2026-10-28), A6: the preseason "Who is
       rising in Ohio?" Top 25 cards (dated 2026-07-29, before the
       season started) are gone from the homepage -- the OATCCC poll
       widget above already covers rankings here, and those preseason
       pages are unchanged and still live under /rankings/. Linking the
       real October district results instead, since /mock-postseason/
       now has them (12 real district sites, built from official
       results, separate from the site's own editorial Mock Meets
       projections). -->
  <section class="section" aria-labelledby="district-results-title">
    <div class="container">
      <div class="section-heading">
        <div><p class="eyebrow">Postseason</p><h2 id="district-results-title">Districts are in the books.</h2></div>
        <a class="text-link" href="/mock-postseason/real/">See every district ${icon("arrow")}</a>
      </div>
      <div class="sport-cards">
        <article class="sport-card"><p class="eyebrow">Real results</p><h3>All 12 district sites, region by region.</h3><p>Qualifying teams and individuals from Saturday's real OHSAA district races, built from official results, not a projection.</p><a class="button button-primary" href="/mock-postseason/real/">View real districts</a></article>
        <article class="sport-card"><p class="eyebrow">Editorial projection</p><h3>Podium Watch's own Mock Meets.</h3><p>Season-best projections for regionals and state, clearly labeled as Podium Watch's editorial model, not official results.</p><a class="button button-outline" href="/mock-postseason/">View Mock Meets</a></article>
      </div>
    </div>
  </section>

  <!-- Story page redesign (2026-10-28), A4: the "Write for Podium
       Watch" hiring block moved off the homepage to a new "Join the
       team" section at the bottom of /staff/ (same Apply link and
       copy). The page itself and /apply/ are unchanged and still work;
       this only removes the homepage promotion. -->

  <!-- Media-credibility audit (2026-10-28): the Photographer Network
       promo (0 photographers published) and the State Meet Media
       Correspondent promo (role filled -- see /apply/state-meet-
       correspondent/) were both removed from the homepage per the
       audit. Neither page/feature was deleted; both routes still work,
       just not promoted here anymore. -->

  <section class="section section-paper" aria-labelledby="voting-title">
    <div class="container">
      <div class="section-heading"><div><p class="eyebrow">Voting</p><h2 id="voting-title">Have your say.</h2></div></div>
      <section class="vote-now-top">
        <span class="vote-now-top-badge">Athlete of the Week</span>
        <div class="vote-now-body">
          <p class="vote-now-category">Ohio High School Cross Country</p>
          <p class="vote-now-question">Vote for this week's Athlete of the Week.</p>
          <a class="button button-primary" href="/athlete-of-the-week/">Vote Now</a>
        </div>
      </section>
      <div class="sport-cards" style="margin-top:18px">
        <article class="sport-card"><p class="eyebrow">Team of the Week</p><h3>Vote for the best team.</h3><a class="button button-primary" href="/team-of-the-week/">Vote Now</a></article>
        <article class="sport-card"><p class="eyebrow">Fan Poll</p><h3>Build your own ranking ballot.</h3><a class="button button-primary" href="/fan-poll/">Vote Now</a></article>
      </div>
    </div>
  </section>

  <section class="section" aria-labelledby="follow-title">
    <div class="container">
      <div class="section-heading"><div><p class="eyebrow">Follow</p><h2 id="follow-title">Make Podium Watch yours.</h2></div><a class="text-link" href="/my-podium/">Open My Podium ${icon("arrow")}</a></div>
      <section class="home-panel follow-school-panel" data-follow-school-panel hidden>
        <div class="home-panel-title"><h2>My Podium</h2><a href="/my-podium/" style="font-size:.68rem;font-weight:900;color:var(--green-dark);">Open &rarr;</a></div>
        <div class="follow-school-panel-body">
          <div data-follow-school-search-view>
            <div class="follow-school-promo" data-mp-promo-intro>
              <p style="margin:0 0 4px;font-weight:800;">Make Podium Watch yours.</p>
              <p style="margin:0;">Follow your school, athletes, division, and events to see what matters to you first.</p>
              <button type="button" class="follow-school-dismiss" data-mp-promo-dismiss aria-label="Dismiss this introduction">Not now</button>
            </div>
            <input type="search" class="follow-school-search" placeholder="Search for your school" data-follow-school-input>
            <div class="follow-school-results" data-follow-school-results></div>
          </div>
          <div data-follow-school-selected-view hidden></div>
        </div>
      </section>
    </div>
  </section>

  <section class="social-band"><div class="container social-grid"><div><p class="eyebrow">Follow the coverage</p><h2>@podiumwatch</h2><p>Daily Ohio cross country and track coverage, rankings, interviews, and athlete stories.</p></div><div class="social-actions"><a class="button button-dark" href="${site.instagramUrl}" target="_blank" rel="noopener noreferrer">${icon("instagram")} Follow on Instagram</a><a class="button button-outline" href="${site.youtubeUrl}" target="_blank" rel="noopener noreferrer">${icon("youtube")} Subscribe on YouTube</a></div></div></section>

  <section class="section section-paper" aria-labelledby="about-preview-title">
    <div class="container content-grid">
      <div><p class="eyebrow">About Podium Watch</p><h2 id="about-preview-title">Built for Ohio runners.</h2><p>Rankings, results, and stories from across the state, with verified facts kept clearly separate from editorial projections and every correction welcome.</p><a class="button button-dark" href="/about/">Learn more</a></div>
      <div><a class="text-link" href="/staff/">Meet our staff ${icon("arrow")}</a><a class="text-link" href="/rankings/methodology/" style="margin-top:10px">Read the ranking methodology ${icon("arrow")}</a><a class="text-link" href="/sponsors/" style="margin-top:10px">Sponsor Podium Watch ${icon("arrow")}</a></div>
    </div>
  </section>

  <script src="/scripts/my-podium-store.js" defer></script>
  <script src="/scripts/my-podium-data.js" defer></script>
  <script src="/scripts/homepage.js" defer></script>
  <script src="/scripts/recent-photos.js" defer></script>
  <script src="/scripts/story-rail.js" defer></script>`;

  return layout({
    site,
    title: site.name,
    description: site.description,
    pathname: "/",
    image: featuredStory?.featuredImage || site.defaultSocialImage,
    content,
    jsonLd: [websiteJsonLd(site), organizationJsonLd(site)]
  });
}

// Story page redesign (2026-10-28), A3: filter chips for every story
// type. "All" plus one chip per STORY_TYPES value (labeled to match the
// handoff's plural wording for the three that have one); the underlying
// filter value stays the same lowercase singular storyType() value each
// card already carries in data-type, so one bit of filtering logic in
// site.js covers both the select-based category filter and these chips.
const STORY_TYPE_CHIP_LABELS = { Results: "Results", Preview: "Previews", Feature: "Features", Rankings: "Rankings", Analysis: "Analysis", News: "News" };
function storiesIndexPage(stories) {
  const featured = stories.find((story) => story.featured) || stories[0];
  const categories = [...new Set(stories.map((story) => story.category))].sort();
  const cards = stories.map((story) => storyCard(story, { featured: story.slug === featured?.slug })).join("");
  const typeChips = `<div class="type-chips" data-type-filter role="group" aria-label="Filter by story type">
    <button type="button" class="type-chip active" data-type-chip="all">All</button>
    ${STORY_TYPES.map((type) => `<button type="button" class="type-chip" data-type-chip="${escapeHtml(type.toLowerCase())}">${escapeHtml(STORY_TYPE_CHIP_LABELS[type])}</button>`).join("")}
  </div>`;
  const content = `${pageHero({ eyebrow: "Podium Watch stories", title: "Stories from Ohio running.", description: "Rankings, athlete features, interviews, meet coverage, and the stories behind the performances." })}
  <section class="section section-paper"><div class="container">
    <div class="story-toolbar">
      <label class="search-field"><span class="visually-hidden">Search stories</span>${icon("search")}<input type="search" placeholder="Search stories, athletes, schools, or tags" data-story-search></label>
      <label><span class="visually-hidden">Filter by category</span><select class="category-filter" data-category-filter><option value="all">All categories</option>${categories.map((category) => `<option value="${escapeHtml(category.toLowerCase())}">${escapeHtml(category)}</option>`).join("")}</select></label>
    </div>
    ${typeChips}
    <div class="results-summary" aria-live="polite"><span data-results-count>${stories.length} ${stories.length === 1 ? "story" : "stories"}</span></div>
    <div class="stories-grid">${cards || emptyState({ title: "No published stories", description: "Add a valid Markdown file to content/stories, set draft to false, and rebuild the website." })}</div>
    <div class="empty-state no-results" data-no-results><div class="empty-state-mark">PW</div><h2>No stories match your search</h2><p>Try another name, category, school, or keyword.</p></div>
  </div></section>`;
  return layout({ site, title: "Stories", description: "Podium Watch stories, rankings, athlete interviews, and Ohio high school running coverage.", pathname: "/stories/", content });
}

function categoryPage(category, stories) {
  const categoryStories = stories.filter((story) => story.category === category);
  const pathname = `/stories/category/${categorySlug(category)}/`;
  const content = `${pageHero({ eyebrow: "Story category", title: category, description: `The latest ${category.toLowerCase()} stories from Podium Watch.` })}
  <section class="section section-paper"><div class="container">${breadcrumb([{ label: "Home", href: "/" }, { label: "Stories", href: "/stories/" }, { label: category }])}<div class="stories-grid">${categoryStories.map((story, index) => storyCard(story, { featured: index === 0 })).join("")}</div></div></section>`;
  return { pathname, html: layout({ site, title: `${category} Stories`, description: `The latest ${category.toLowerCase()} stories from Podium Watch.`, pathname, content }) };
}

// Story page redesign (2026-10-28), story-page-and-homepage-handoff.md
// Part B. One template for every story -- ported from the prototype at
// dataimports/podium-watch-story-page.html (not committed; its CSS was
// lifted into src/styles/main.css's sp- prefixed rules). A story opts
// into the richer pieces (series bar, at-a-glance strip, region
// sections + sticky TOC, What's Next box) purely by having the matching
// front matter; a story with none of that still renders the full
// redesigned hero/body/related shell, just without those extras.
function storyToneClass(tone) {
  return tone === "boys" ? "sp-boys" : tone === "girls" ? "sp-girls" : "";
}

// Transforms the body HTML renderMarkdown() already produced:
// - first paragraph gets the "lede" treatment (CSS bolds its first line)
// - a paragraph that opens with a bold run-in phrase ("Watterson's
//   wave.") becomes a styled run-in subhead instead of plain <strong>
// - a trailing "*Results are from...*" disclaimer paragraph (this
//   site's standing sourcing-note convention) is pulled out of the body
//   entirely and returned separately, for the "How we reported this" box
// - any remaining standalone italic paragraph (the "co-champion" note
//   convention in the district recaps) becomes a ruled "note" line
// - `## REGION — Site (regional: X)` headings become structured region
//   sections with a real "District / Regional" line, using the story's
//   own `regions` front matter (never inferred from the heading text,
//   since a region can cover more than one real district site and the
//   heading alone doesn't say which) -- stories without `regions` are
//   untouched.
function transformStoryBody(story) {
  let html = story.html;
  let sourcingNote = null;
  const trailingNote = html.match(/<p><em>([^<]+)<\/em><\/p>\s*$/);
  if (trailingNote) {
    sourcingNote = trailingNote[1];
    html = html.slice(0, trailingNote.index).trimEnd();
  }
  html = html.replace(/<p><strong>([^<]+\.)<\/strong>/g, '<p><span class="sp-runin">$1</span>');
  html = html.replace(/<p><em>([^<]+)<\/em><\/p>/g, '<p class="sp-note">$1</p>');
  html = html.replace("<p>", '<p class="sp-lede">');
  if (story.regions.length) {
    let regionIndex = 0;
    // <section> siblings interspersed with the surrounding <p> tags --
    // no wrapper div needed, exactly how the prototype itself nests
    // region headers directly inside <article> alongside the prose.
    html = html.replace(/<h2 id="[^"]*">[^<]+<\/h2>/g, () => {
      const region = story.regions[regionIndex];
      regionIndex += 1;
      if (!region) return "";
      const anchor = slugify(region.name);
      return `<section class="sp-sec" id="${anchor}"><h2>${escapeHtml(region.name)}</h2><div class="sp-where"><span>District <b>${escapeHtml(region.sites)}</b></span><span>Regional <b>${escapeHtml(region.regional)}</b></span></div></section>`;
    });
  }
  return { html, sourcingNote };
}

function storyPage(story, stories) {
  const storyIndex = stories.findIndex((item) => item.slug === story.slug);
  const newer = storyIndex > 0 ? stories[storyIndex - 1] : null;
  const older = storyIndex < stories.length - 1 ? stories[storyIndex + 1] : null;
  const pathname = `/stories/${story.slug}/`;
  const crumbs = [{ label: "Home", href: "/" }, { label: "Stories", href: "/stories/" }, { label: story.title }];
  const sponsor = story.sponsor ? sponsors.find((item) => item.id === story.sponsor) : null;
  const sponsorBlock = sponsor ? `<aside class="sp-box" aria-label="Story sponsor"><h3>Story sponsor</h3><p><strong>${escapeHtml(sponsor.name)}</strong></p>${sponsor.description ? `<p>${escapeHtml(sponsor.description)}</p>` : ""}${sponsor.url ? `<p><a class="sp-link" href="${sponsor.url}" target="_blank" rel="noopener noreferrer">Visit sponsor</a></p>` : ""}</aside>` : "";
  const shareText = encodeURIComponent(story.title);
  const shareUrl = encodeURIComponent(absoluteUrl(site, pathname));
  const type = storyType(story);
  const heroImage = story.heroImage || story.featuredImage || "";
  const fallback = storyFallbackImage(story.category);

  // Series bar (B3.1): only when this story and at least one sibling
  // share a `series` value, ordered by seriesOrder.
  const seriesMembers = story.series ? stories.filter((item) => item.series === story.series).sort((a, b) => (a.seriesOrder ?? 0) - (b.seriesOrder ?? 0)) : [];
  const seriesBar = seriesMembers.length > 1 ? `<div class="sp-series" aria-label="${escapeHtml(story.series)} series"><div class="container sp-series-inner">
    <span class="sp-series-label">${escapeHtml(story.seriesLabel || story.series.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))} &middot; ${seriesMembers.length} stories</span>
    <ol>${seriesMembers.map((item) => `<li><a href="/stories/${item.slug}/"${item.slug === story.slug ? " aria-current=\"page\"" : ""}>${escapeHtml(item.seriesLabel || item.title.split(":")[0])}</a></li>`).join("")}</ol>
  </div></div>` : "";

  // Hero (B3.2): real hero image with a 16:9 crop, or a branded black
  // title card instead of an empty box when a story has no hero image.
  const heroArt = heroImage
    ? `<figure class="sp-hero-art"><img src="${heroImage}" data-fallback="${fallback}" data-check-hero-width="true" alt="${escapeHtml(story.heroAlt || story.featuredImageAlt || "")}" width="1600" height="900" loading="eager"${story.featuredImagePosition ? ` style="object-position:${escapeHtml(story.featuredImagePosition)}"` : ""}>${(story.heroCaption || story.heroCredit) ? `<figcaption>${story.heroCaption ? `<span>${escapeHtml(story.heroCaption)}</span>` : "<span></span>"}${story.heroCredit ? `<span class="sp-credit">${escapeHtml(story.heroCredit)}</span>` : ""}</figcaption>` : ""}</figure>`
    : `<figure class="sp-hero-art"><div class="sp-hero-art-fallback"><img src="${site.logoLight || site.logo}" alt=""><span>${escapeHtml(story.title)}</span></div></figure>`;

  const genuinelyUpdated = (story.updated || (story.updatedDate && story.updatedDate !== story.date)) ? (story.updated || story.updatedDate) : null;

  // At-a-glance strip (B3.3): omitted entirely when a story has none.
  const board = story.atAGlance.length ? `<section class="sp-board" aria-label="At a glance"><div class="container"><ul>
    ${story.atAGlance.map((item) => `<li class="${storyToneClass(item.tone)}"><span class="sp-lab"><i></i>${escapeHtml(item.label)}</span><span class="sp-num">${escapeHtml(item.value)}</span><span class="sp-who">${escapeHtml(item.name)}</span><span class="sp-sub">${escapeHtml(item.sub)}</span></li>`).join("")}
  </ul></div></section>` : "";

  const { html: bodyHtml, sourcingNote } = transformStoryBody(story);

  // Sticky "on this page" rail (B3.12): only when the story has region
  // sections to link to.
  const toc = story.regions.length ? `<aside class="sp-rail" aria-label="On this page"><div class="sp-rail-stick"><div><h4>On this page</h4><ol class="sp-toc" data-sp-toc>
    <li><a href="#sp-story-top">Top</a></li>
    ${story.regions.map((region) => `<li><a href="#${slugify(region.name)}">${escapeHtml(region.name)}</a></li>`).join("")}
  </ol></div></div></aside>` : "";

  // What's next box (B3.8): only when a story supplies it.
  const nextBox = story.nextRegionals.length ? `<aside class="sp-box sp-next" aria-label="What's next"><h3>What's next</h3><p class="sp-big">Regionals &middot; Saturday, Oct. 31</p><dl>
    ${story.nextRegionals.map((row) => `<dt>${escapeHtml(row.name)}</dt><dd>${escapeHtml(row.sites)}</dd>`).join("")}
  </dl>${story.nextStateLine ? `<p class="sp-state">${escapeHtml(story.nextStateLine)}</p>` : ""}</aside>` : "";

  // How we reported this (B3.10): only when a sourcing note was found.
  const sourcingBox = sourcingNote ? `<aside class="sp-box" aria-label="How we reported this"><h3>How we reported this</h3><p>${sourcingNote}</p><p class="sp-mail">Spotted an error? <code>${site.contactEmail}</code><button type="button" data-copy-mail>Copy</button></p></aside>` : `<aside class="sp-box" aria-label="How we reported this"><h3>How we reported this</h3><p class="sp-mail">Spotted an error? <code>${site.contactEmail}</code><button type="button" data-copy-mail>Copy</button></p></aside>`;

  // Author box (B3.11): the real author when it's a named person,
  // otherwise the newsroom copy from the handoff spec.
  const isNamedAuthor = story.author && story.author !== site.name;
  const authorBox = `<aside class="sp-box sp-author" aria-label="About the author"><div class="sp-mono"><img src="${site.logoLight || site.logo}" alt=""></div><div><h3>${isNamedAuthor ? escapeHtml(story.author) : "Podium Watch Staff"}</h3><p>${isNamedAuthor ? `Reporting for Podium Watch, edited by Zachary Bell, founder and editor.` : "Reporting by the Podium Watch newsroom, edited by Zachary Bell, founder and editor."} News tips: ${site.contactEmail}.</p></div></aside>`;

  // Related (B3.13): other stories in the same series when there is
  // one, otherwise the 3 newest stories of the same type. The hiring
  // page is never shown in any story list (A4).
  const relatedPool = stories.filter((item) => item.slug !== story.slug && item.slug !== "write-for-podium-watch");
  const related = story.series
    ? relatedPool.filter((item) => item.series === story.series).sort((a, b) => (a.seriesOrder ?? 0) - (b.seriesOrder ?? 0)).slice(0, 3)
    : relatedPool.filter((item) => storyType(item) === type).slice(0, 3);
  const relatedTitle = story.series ? `More from ${story.seriesLabel || story.series.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}` : "More from Podium Watch";
  const relatedBlock = related.length ? `<section class="sp-related"><div class="container"><h2>${escapeHtml(relatedTitle)}</h2><div class="sp-cards">
    ${related.map((item) => `<a class="sp-card" href="/stories/${item.slug}/"><img src="${item.heroImage || item.featuredImage || storyFallbackImage(item.category)}" alt="" width="640" height="360"><span class="sp-k">${escapeHtml(storyType(item))}</span><h3>${escapeHtml(item.title)}</h3><span class="sp-m">${formatDate(item.date)}</span></a>`).join("")}
  </div></div></section>` : "";

  const navigation = newer || older ? `<nav class="story-nav" aria-label="Story navigation">${newer ? `<a href="/stories/${newer.slug}/"><span>Newer story</span><strong>${escapeHtml(newer.title)}</strong></a>` : "<span></span>"}${older ? `<a href="/stories/${older.slug}/"><span>Older story</span><strong>${escapeHtml(older.title)}</strong></a>` : ""}</nav>` : "";

  // The 5 interactive components (Race Board, How the Race Was Won, Fifth
  // Runner Factor, Displacement Report, Reader Predictions), the sticky
  // section nav, the Team Compare drawer, and the Share This Team card are
  // all opt-in, driven entirely by story.preseasonClassification -- every
  // other story on the site is completely unaffected. See
  // public/scripts/preseason-article.js for the client-side hydration and
  // src/lib/markdown.mjs for the [[PODIUM_WATCH_COMPONENT: ...]] markers
  // this hydrates.
  const preseasonClassification = story.preseasonClassification
    ? preseasonInteractiveData.classifications[story.preseasonClassification]
    : null;
  const preseasonDataScript = preseasonClassification
    ? `<script type="application/json" id="pw-preseason-data">${JSON.stringify(preseasonClassification).replaceAll("<", "\\u003c")}</script><script src="/scripts/preseason-article.js" defer></script>`
    : "";

  const content = `<div class="sp-page"${preseasonClassification ? ` style="--pw-accent:${escapeHtml(preseasonClassification.accent)}" data-pw-article="${escapeHtml(story.slug)}"` : ""} data-story-slug="${escapeHtml(story.slug)}">
  ${seriesBar}
  <main id="sp-story-top">
  <section class="sp-hero"><div class="container sp-hero-inner">
    <div class="sp-hero-head">
      <p class="sp-crumbs">${crumbs.map((item, index) => index === crumbs.length - 1 ? escapeHtml(item.label) : `<a href="${item.href}">${escapeHtml(item.label)}</a>`).join(" / ")}</p>
      <div class="sp-kicker"><span class="sp-type">${escapeHtml(type)}</span><span class="sp-tags">${escapeHtml(story.category)}${story.divisions ? ` &middot; Division ${story.divisions}` : ""}${story.genders ? ` &middot; ${story.genders}` : ""}</span></div>
      <h1>${escapeHtml(story.title)}</h1>
    </div>
    <div class="sp-hero-meta">
      <p class="sp-dek">${escapeHtml(story.description)}</p>
      <div class="sp-byline">
        <span>By ${storyBylineHtml(story.author)}</span><span class="sp-dot"></span>
        <time datetime="${story.date}">${formatDate(story.date)}</time>${genuinelyUpdated ? `<span class="sp-dot"></span><span>Updated ${formatDate(genuinelyUpdated)}</span>` : ""}<span class="sp-dot"></span>
        <span>${story.readingMinutes} min read</span>
      </div>
      <div class="sp-share" aria-label="Share this story">
        <button type="button" class="share-button" data-copy-link><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.6 13.4a1 1 0 0 1 0-1.4l3.5-3.5a3 3 0 1 1 4.2 4.2l-2 2a1 1 0 1 1-1.4-1.4l2-2a1 1 0 1 0-1.4-1.4l-3.5 3.5a1 1 0 0 1-1.4 0ZM13.4 10.6a1 1 0 0 1 0 1.4l-3.5 3.5a3 3 0 1 1-4.2-4.2l2-2a1 1 0 0 1 1.4 1.4l-2 2a1 1 0 1 0 1.4 1.4l3.5-3.5a1 1 0 0 1 1.4 0Z"/></svg><span class="sp-lbl">Copy link</span></button>
        <a class="share-button" href="https://x.com/intent/post?url=${shareUrl}&text=${shareText}" target="_blank" rel="noopener noreferrer" aria-label="Post on X"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.8 3h3.1l-6.8 7.7 8 10.3h-6.2l-4.9-6.3L5.4 21H2.3l7.2-8.3L1.8 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z"/></svg><span class="sp-lbl">Post</span></a>
        <a class="share-button" href="https://www.facebook.com/sharer/sharer.php?u=${shareUrl}" target="_blank" rel="noopener noreferrer" aria-label="Share on Facebook"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H7.9v3h2.6V21h3Z"/></svg><span class="sp-lbl">Share</span></a>
      </div>
    </div>
    ${heroArt}
  </div></section>

  ${board}

  <div class="container sp-layout">
  <article class="sp-article">${bodyHtml}
    ${sponsorBlock}
    ${nextBox}
    ${sourcingBox}
    ${authorBox}
  </article>
  ${toc}
  </div>

  ${navigation ? `<div class="container">${navigation}</div>` : ""}
  ${relatedBlock}
  </main>
  ${preseasonDataScript}
  <script src="/scripts/story-view.js" defer></script>
  <script src="/scripts/story-page.js" defer></script>
  </div>`;

  return layout({
    site,
    title: story.title,
    description: story.description,
    pathname,
    image: heroImage || site.defaultSocialImage,
    imageWidth: heroImage ? 1600 : undefined,
    imageHeight: heroImage ? 900 : undefined,
    canonicalUrl: story.canonicalUrl,
    type: "article",
    publishedTime: story.date,
    modifiedTime: genuinelyUpdated || story.date,
    content,
    jsonLd: [articleJsonLd(site, story), breadcrumbsJsonLd(site, crumbs.filter((item) => item.href))],
    extraHead: '<link rel="preload" href="/fonts/big-shoulders-display-var.woff2" as="font" type="font/woff2" crossorigin>'
  });
}

function rankingsIndexPage() {
  const content = `${pageHero({ eyebrow: "Podium Watch rankings", title: "Ohio rankings start here.", description: "Choose cross country or track and field, then select boys or girls and the division you want to follow." })}
  <section class="section section-paper"><div class="container"><div class="ranking-browser"><article class="ranking-browser-card"><p class="eyebrow">Four divisions</p><h2>Cross Country Rankings</h2><p>Individual and team rankings for boys and girls across Divisions 1 through 4.</p><a class="button button-primary" href="/rankings/cross-country/">Open cross country</a></article><article class="ranking-browser-card"><p class="eyebrow">Five divisions</p><h2>Track and Field Rankings</h2><p>Running events, relays, jumps, and throws for boys and girls across Divisions 1 through 5.</p><a class="button button-primary" href="/rankings/track-and-field/">Open track and field</a></article><article class="ranking-browser-card"><p class="eyebrow">Official coaches poll</p><h2>OATCCC Coaches Poll</h2><p>The official Ohio Association of Track and Cross Country Coaches poll, all eight boys and girls divisions, shared with full credit to OATCCC.</p><a class="button button-primary" href="/rankings/oatccc/">Open OATCCC poll</a></article><article class="ranking-browser-card"><p class="eyebrow">By grade and division</p><h2>Top 10</h2><p>The ten fastest season-best times in each grade, for boys and girls across Divisions 1 through 4.</p><a class="button button-primary" href="/rankings/top-10/">Open Top 10</a></article><article class="ranking-browser-card"><p class="eyebrow">Real 5K times</p><h2>State Leaders</h2><p>Ohio's fastest verified 5K cross country times, filterable by year, grade, and division -- built entirely from Podium Watch's own results.</p><a class="button button-primary" href="/rankings/leaders/">Open State Leaders</a></article></div></div></section>`;
  return layout({ site, title: "Rankings", description: "Ohio high school cross country and track and field rankings by sport, gender, and division.", pathname: "/rankings/", content });
}

function sportIndexPage(sportName, sportPath, divisionCount) {
  const description = sportPath === "cross-country" ? "Choose boys or girls, then select one of Ohio's four cross country divisions." : "Choose boys or girls, then select one of Ohio's five track and field divisions.";
  const divisionLinks = Array.from({ length: divisionCount }, (_, index) => index + 1).map((division) => `<a class="division-card" href="/rankings/${sportPath}/boys/division-${division}/"><strong>Division ${division}</strong><span>Open boys rankings</span></a>`).join("");
  const content = `${pageHero({ eyebrow: "Rankings", title: `${sportName} Rankings`, description })}
  <section class="section section-paper"><div class="container">${breadcrumb([{ label: "Home", href: "/" }, { label: "Rankings", href: "/rankings/" }, { label: sportName }])}<div class="gender-tabs"><a href="/rankings/${sportPath}/boys/division-1/">Boys rankings</a><a href="/rankings/${sportPath}/girls/division-1/">Girls rankings</a></div><div class="division-grid${divisionCount === 5 ? " track-grid" : ""}">${divisionLinks}</div><div class="info-card" style="margin-top:24px"><h3>Looking for girls rankings?</h3><p>Choose Girls Rankings above, then select the division. Every division page has a clear empty state until a ranking file is published.</p></div></div></section>`;
  return layout({ site, title: `${sportName} Rankings`, description, pathname: `/rankings/${sportPath}/`, content });
}

function divisionPage({ sportName, sportPath, division, divisionCount, gender, rankings }) {
  const pathname = `/rankings/${sportPath}/${gender.toLowerCase()}/division-${division}/`;
  const matching = rankings.filter((ranking) => ranking.sportPath === sportPath && ranking.gender.toLowerCase() === gender.toLowerCase() && String(ranking.divisionNumber) === String(division));
  const otherGender = gender === "Boys" ? "Girls" : "Boys";
  // The 2026 preseason team power-ranking article for this exact
  // classification, when one exists (cross country only, divisions 1-4) --
  // this is "make sure they go under rankings cross country and then
  // correct division boys or girls" from the article spec: a direct,
  // prominent link from the real rankings hub into the matching article,
  // not a fabricated CSV row (a team's simulated score has no column in
  // content/rankings/*.csv, which is athlete-performance-list shaped).
  const preseasonMatch = sportPath === "cross-country" ? preseasonClassificationFor(gender.toLowerCase(), division) : null;
  const preseasonCallout = preseasonMatch
    ? `<div class="info-card pw-rankings-callout" style="border-left:6px solid ${escapeHtml(preseasonMatch.accent)}"><p class="eyebrow">2026 preseason team power rankings</p><h3>${escapeHtml(preseasonMatch.headline)}</h3><p>${escapeHtml(preseasonMatch.subtitle)}</p><a class="button button-dark" href="${preseasonArticleHref(preseasonMatch)}">Read the full preseason preview</a></div>`
    : "";
  const content = `${pageHero({ eyebrow: `${sportName} rankings`, title: `Division ${division} ${gender}`, description: `Published Podium Watch ${sportName.toLowerCase()} rankings for Division ${division} ${gender.toLowerCase()}.`, compact: true })}
  <section class="section section-paper"><div class="container">${breadcrumb([{ label: "Home", href: "/" }, { label: "Rankings", href: "/rankings/" }, { label: sportName, href: `/rankings/${sportPath}/` }, { label: `Division ${division} ${gender}` }])}<div class="gender-tabs"><a href="/rankings/${sportPath}/boys/division-${division}/"${gender === "Boys" ? ' aria-current="page"' : ""}>Boys</a><a href="/rankings/${sportPath}/girls/division-${division}/"${gender === "Girls" ? ' aria-current="page"' : ""}>Girls</a></div><div class="division-grid${divisionCount === 5 ? " track-grid" : ""}">${Array.from({ length: divisionCount }, (_, index) => index + 1).map((number) => `<a class="division-card" href="/rankings/${sportPath}/${gender.toLowerCase()}/division-${number}/"><strong>Division ${number}</strong><span>${number === division ? "Current division" : `View Division ${number}`}</span></a>`).join("")}</div>${preseasonCallout}<div style="margin-top:34px">${matching.length ? `<div class="rankings-grid">${matching.map((ranking) => rankingCard(ranking)).join("")}</div>` : emptyState({ title: "No rankings published here yet", description: `The Division ${division} ${gender.toLowerCase()} page is ready. Add a matching CSV file to content/rankings and rebuild the site.`, actionLabel: `View ${otherGender.toLowerCase()} rankings`, actionHref: `/rankings/${sportPath}/${otherGender.toLowerCase()}/division-${division}/` })}</div></div></section>`;
  return { pathname, html: layout({ site, title: `Division ${division} ${gender} ${sportName} Rankings`, description: `Podium Watch Division ${division} ${gender.toLowerCase()} ${sportName.toLowerCase()} rankings.`, pathname, content }) };
}

function rankingDetailPage(ranking, stories) {
  const pathname = ranking.href;
  const sportName = ranking.sportPath === "cross-country" ? "Cross Country" : "Track and Field";
  const crumbs = [{ label: "Home", href: "/" }, { label: "Rankings", href: "/rankings/" }, { label: sportName, href: `/rankings/${ranking.sportPath}/` }, { label: `${ranking.division} ${ranking.gender}`, href: `/rankings/${ranking.sportPath}/${ranking.genderPath}/division-${ranking.divisionNumber}/` }, { label: ranking.title }];
  const rows = ranking.rows.map((row) => {
    const athleteSeed = athleteSeedForRankingRow(ranking, row);
    const athleteName = athleteSeed
      ? `<a href="/athletes/${athleteSeed.profile_slug}/">${escapeHtml(row.athlete)}</a>`
      : escapeHtml(row.athlete);

    return `<article class="ranking-row"><div class="ranking-number">${escapeHtml(row.rank)}</div><div class="ranking-athlete"><strong>${athleteName}</strong><span>${escapeHtml(row.school)}</span></div><div class="ranking-grade">${escapeHtml(row.grade || "")}</div><div class="ranking-mark"><strong>${escapeHtml(row.timeOrMark)}</strong><small>${escapeHtml(row.event)}</small></div>${row.rankingExplanation ? `<p class="ranking-explanation">${escapeHtml(row.rankingExplanation)}</p>` : ""}</article>`;
  }).join("");
  const rankingType = String(ranking.rankingType || "Editorial ranking");
  const isVerifiedList = /verified|performance list|official/i.test(rankingType);
  const sourceUrl = /^https?:\/\//i.test(ranking.sourceUrl || "") ? ranking.sourceUrl : "";
  const relatedStory = stories.find((story) => story.slug === ranking.storySlug || (!ranking.storySlug && story.slug === ranking.slug));
  const trustCopy = isVerifiedList
    ? "This page organizes published performance data. It is not an official OHSAA ranking unless the source label explicitly says so."
    : "This order is Podium Watch editorial analysis. It is a projection based on verified information available at the time of publication, not an official OHSAA ranking.";
  const methodCopy = ranking.methodologyNote || "The full season resume matters more than one isolated result. Championship performance, consistency, head to head results, relevant track performances, returning status, and verified roster information may all be considered when they apply.";
  const sourceActions = `${sourceUrl ? `<a class="button button-outline" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">Open source</a>` : ""}<a class="button button-outline" href="/rankings/methodology/">Full methodology</a><a class="button button-outline" href="mailto:${site.contactEmail}?subject=${encodeURIComponent(`Ranking correction: ${ranking.title}`)}">Report a correction</a>`;
  const storyAction = relatedStory ? `<a class="share-button" href="/stories/${relatedStory.slug}/">Read the full ranking story</a>` : "";
  const content = `${pageHero({ eyebrow: `${ranking.sport} rankings`, title: ranking.title, description: ranking.subtitle || `${ranking.gender} ${ranking.division} rankings for the ${ranking.season} season.`, compact: true })}
  <section class="section section-paper"><div class="container">${breadcrumb(crumbs)}
    <div class="ranking-detail-header"><div><p class="eyebrow">${escapeHtml(ranking.gender)} ${escapeHtml(ranking.division)}</p><h2>${escapeHtml(ranking.event)}</h2></div><p class="ranking-updated">Last updated ${formatDate(ranking.updatedDate)}</p></div>
    <div class="info-card ranking-source-panel"><div><p><span class="ranking-trust-badge ${isVerifiedList ? "verified" : "editorial"}">${escapeHtml(rankingType)}</span></p><h3>Source and status</h3><p><strong>${escapeHtml(ranking.sourceLabel)}</strong></p><p>${escapeHtml(trustCopy)}</p></div><div class="ranking-source-actions">${sourceActions}</div></div>
    <div class="info-card" style="margin-bottom:22px"><h3>How this ranking works</h3><p>${escapeHtml(methodCopy)}</p></div>
    <div class="ranking-list">${rows}</div>
    <div class="article-actions">${storyAction}<button class="share-button" type="button" data-copy-link>Copy ranking link</button><a class="share-button" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(absoluteUrl(site, pathname))}" target="_blank" rel="noopener noreferrer">Share on Facebook</a></div>
  </div></section>`;
  return layout({ site, title: ranking.title, description: `${ranking.title}. Updated ${formatDate(ranking.updatedDate)}.`, pathname, image: `/images/stories/d${ranking.divisionNumber}_${ranking.genderPath}_top_25.svg`, content, jsonLd: breadcrumbsJsonLd(site, crumbs) });
}

async function aboutPage() {
  const filePath = path.join(root, "content", "pages", "about.md");
  const source = await fs.readFile(filePath, "utf8");
  const { data, body } = parseFrontMatter(source, path.relative(root, filePath));
  if (!data.title || !data.description) throw new Error("content/pages/about.md must include title and description front matter.");
  const content = `${pageHero({ eyebrow: "About Podium Watch", title: "Built for Ohio runners.", description: data.description })}<section class="section section-paper"><div class="container content-grid"><div><p class="eyebrow">Our purpose</p><h2>Celebrate the performance and the person.</h2><a class="button button-dark" href="/contact/">Contact Podium Watch</a></div><article class="article-content">${renderMarkdown(body)}</article></div></section>`;
  return layout({ site, title: data.title, description: data.description, pathname: "/about/", content, jsonLd: organizationJsonLd(site) });
}

function athletePage() {
  const content = `${pageHero({ eyebrow: "Athlete spotlights", title: "The story behind the result.", description: "A home for Ohio athletes to share what drives them, what they have overcome, and what they want people to remember." })}<section class="section section-paper"><div class="container content-grid"><div><p class="eyebrow">Athlete profiles</p><h2>Start with the statewide directory.</h2><p>Find athletes by name, school, graduation year, division, event, and source status.</p><a class="button button-primary" href="/athletes/">Open athlete directory</a></div><div>${emptyState({ title: "Long form spotlights are being prepared", description: "Published athlete interviews and personal stories will appear here without inventing quotes, achievements, or background information.", actionLabel: "Read current stories", actionHref: "/stories/" })}</div></div></section>`;
  return layout({ site, title: "Athlete Spotlights", description: "Podium Watch athlete spotlights and athlete profile directory for Ohio high school cross country and track and field.", pathname: "/athlete-spotlights/", content });
}

function interviewsPage() {
  const content = `${pageHero({ eyebrow: "Beyond the Podium", title: "Conversations beyond the finish line.", description: "Interviews about racing, pressure, setbacks, faith, goals, and the person behind the athlete." })}<section class="section section-paper"><div class="container">${emptyState({ title: "Interview pages are being prepared", description: "The project includes an interviews content folder and template without publishing fake guests or episodes.", actionLabel: "Visit YouTube", actionHref: site.youtubeUrl })}</div></section>`;
  return layout({ site, title: "Beyond the Podium Interviews", description: "Podium Watch interviews with Ohio high school runners and members of the running community.", pathname: "/interviews/", content });
}

// Media-credibility audit (2026-10-28), P1-6: replaced the developer
// placeholder text ("Sponsor information is managed from one data
// file..." / "No sponsors are displayed because no approved sponsor
// data was provided.") with the real copy and the two real sponsors now
// in src/data/sponsors.json. The "Visit sponsor" link is only shown
// when a sponsor has a real url -- Raising Cane's wasn't given one in
// the spec, so nothing is invented.
function sponsorsPage() {
  const sponsorMarkup = `<div class="stories-grid">${sponsors.map((sponsor) => `<article class="story-card"><div class="story-card-body"><h3>${escapeHtml(sponsor.name)}</h3>${sponsor.description ? `<p>${escapeHtml(sponsor.description)}</p>` : ""}${sponsor.url ? `<a class="button button-dark" href="${sponsor.url}" target="_blank" rel="noopener noreferrer">Visit sponsor</a>` : ""}</div></article>`).join("")}</div>`;
  const content = `${pageHero({ eyebrow: "Sponsors & Advertising", title: "Sponsors & Advertising", description: "Reach Ohio's high school running community: athletes, families, coaches, and fans." })}
  <section class="section section-paper"><div class="container">
    <p class="eyebrow">Our partners</p>
    ${sponsorMarkup}
    <div class="info-card" style="margin-top:30px">
      <p class="eyebrow">Our policy</p>
      <p>Sponsors support Podium Watch's coverage. They have no say in rankings, results, or editorial decisions. Sponsored content is always labeled. See our <a href="/standards/">Editorial Standards</a>.</p>
    </div>
    <div class="info-card" style="margin-top:18px">
      <p class="eyebrow">Partner with Podium Watch</p>
      <p>Reach Ohio's high school running community: athletes, families, coaches, and fans.</p>
      <a class="button button-dark" href="mailto:${site.contactEmail}?subject=Podium%20Watch%20Sponsorship">Email ${escapeHtml(site.contactEmail)}</a>
    </div>
  </div></section>`;
  return layout({ site, title: "Sponsors and Advertising", description: "Podium Watch sponsorship and advertising opportunities for brands that want to reach Ohio's running community.", pathname: "/sponsors/", content });
}

// Media-credibility audit (2026-10-28), P1-7: added the "based in
// Ohio" line and a clear list of contact purposes. media@podiumwatch.org
// stays the only email.
function contactPage() {
  const content = `${pageHero({ eyebrow: "Contact", title: "Connect with Podium Watch.", description: "Podium Watch is based in Ohio. Send a correction, suggest an athlete or story, ask about an interview, or discuss a sponsorship." })}<section class="section section-paper"><div class="container"><div class="contact-cards"><article class="contact-card"><p class="eyebrow">Email</p><h2>Send a message</h2><p>Podium Watch is based in Ohio. Email is the main contact method for:</p><ul style="margin:0 0 14px;padding-left:20px;line-height:1.6;"><li>News tips and story ideas</li><li>Corrections</li><li>Interview requests</li><li>Sponsorship and advertising</li></ul><a class="button button-dark" href="mailto:${site.contactEmail}">${escapeHtml(site.contactEmail)}</a></article><article class="contact-card"><p class="eyebrow">Social media</p><h2>Follow the coverage</h2><p>Use Instagram for daily posts and YouTube for interviews and longer video coverage.</p><div class="social-actions"><a class="button button-dark" href="${site.instagramUrl}" target="_blank" rel="noopener noreferrer">Instagram</a><a class="button button-outline" href="${site.youtubeUrl}" target="_blank" rel="noopener noreferrer">YouTube</a></div></article></div></div></section>`;
  return layout({ site, title: "Contact", description: "Contact Podium Watch about stories, corrections, interviews, rankings, sponsorships, and Ohio running coverage.", pathname: "/contact/", content });
}

// Staff page (2026-10-28, OHSAA media-credentialing request): a named
// editor + named staff, so a reviewer sees a real newsroom, not an
// anonymous brand account. No bios/hometowns/schools/headshots/start
// dates are invented; initials-only avatars, exactly as asked.
// Lauren Palmer removed 2026-10-28 at the user's request (temporary --
// not a data error, just left off the page for now).
// A7 (story-page-and-homepage-handoff.md, 2026-10-28): exact copy from
// the handoff, as a bio on the editor's own staff card. No photo, per
// the handoff -- keeps the initials avatar every other card uses.
const STAFF = [
  { name: "Zachary Bell", title: "Founder & Editor", bio: `Zachary Bell founded Podium Watch to give Ohio high school cross country and track and field athletes the recognition they earn. He coaches high school cross country in Ohio and leads the site's results coverage, rankings and stories. Contact: <a href="mailto:${site.contactEmail}">${escapeHtml(site.contactEmail)}</a>` },
  { name: "Brayleigh Becken", title: "State Meet Media Correspondent" },
  { name: "Logan Eggert", title: "State Meet Media Correspondent" }
];
function staffInitials(name) {
  const words = name.replace(/\[.*?\]/g, "").trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (words[0] || "?").slice(0, 2).toUpperCase();
}
function staffCard(person, { isEditor = false } = {}) {
  return `<article class="staff-card${isEditor ? " staff-card-editor" : ""}" id="${slugify(person.name)}">
    <div class="staff-avatar">${escapeHtml(staffInitials(person.name))}</div>
    <div>
      <h3>${escapeHtml(person.name)}</h3>
      <p class="staff-title">${escapeHtml(person.title)}</p>
      ${person.bio ? `<p class="staff-bio">${person.bio}</p>` : ""}
      ${person.instagramUrl ? `<a class="text-link" href="${person.instagramUrl}" target="_blank" rel="noopener noreferrer">${icon("instagram")} ${escapeHtml(person.instagramHandle)}</a>` : ""}
    </div>
  </article>`;
}
// Contributing Writers (P1-2, 2026-10-28): every distinct real author
// name on a published story, EXCLUDING the generic "Podium Watch"
// front-matter default (that's a brand byline, not a named person --
// see storyBylineHtml() in src/lib/html.mjs) and excluding anyone
// already a named STAFF entry above (so nobody gets two cards). Never
// invented -- pulled directly from content/stories' own real author
// front matter, nothing more.
function contributingWriterNames(stories) {
  const staffNames = new Set(STAFF.map((p) => p.name));
  const seen = new Set();
  const names = [];
  for (const story of stories) {
    const name = String(story.author || "").trim();
    if (!name || name === "Podium Watch" || staffNames.has(name) || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names.sort((a, b) => a.localeCompare(b));
}
function staffPage(stories) {
  const editor = STAFF[0];
  const rest = STAFF.slice(1);
  const writers = contributingWriterNames(stories);
  const writersSection = writers.length ? `<h2 class="staff-section-title">Contributing Writers</h2>
    <div class="staff-grid">
      ${writers.map((name) => staffCard({ name, title: "Contributing Writer" })).join("")}
    </div>` : "";
  const content = `${pageHero({ eyebrow: "Staff", title: "Staff", description: "Podium Watch covers Ohio high school cross country and track and field: results, rankings, and stories from every division." })}
  <section class="section section-paper"><div class="container">
    <div class="staff-grid">
      ${staffCard(editor, { isEditor: true })}
      ${rest.map((person) => staffCard(person)).join("")}
    </div>
    ${writersSection}
    <div class="contact-cards" style="margin-top:40px">
      <article class="contact-card"><p class="eyebrow">Email</p><h2>Contact Podium Watch</h2><a class="button button-dark" href="mailto:${site.contactEmail}">${escapeHtml(site.contactEmail)}</a></article>
      <article class="contact-card"><p class="eyebrow">Social media</p><h2>Follow the coverage</h2><a class="button button-outline" href="${site.instagramUrl}" target="_blank" rel="noopener noreferrer">${icon("instagram")} @podiumwatch</a></article>
    </div>
    <p class="staff-tips-line">News tips and corrections: <a href="mailto:${site.contactEmail}">${escapeHtml(site.contactEmail)}</a></p>
  </div></section>
  <section class="section">
    <div class="container">
      <div class="intern-banner">
        <div><p class="eyebrow">Podium Watch Is Hiring</p><h2>Join the team.</h2><p>We're recruiting Ohio high school writers to cover cross country and track and field. Unpaid, no deadline, grades 9-12.</p></div>
        <div class="intern-banner-actions"><a class="button button-dark" href="/apply/">Apply now</a><a class="text-link" href="/stories/write-for-podium-watch/">Read more ${icon("arrow")}</a></div>
      </div>
    </div>
  </section>`;
  return layout({ site, title: "Staff", description: "Meet the Podium Watch editorial staff covering Ohio high school cross country and track.", pathname: "/staff/", content });
}

function notFoundPage() {
  const content = `<section class="error-page"><div class="container"><strong>404</strong><h1>This page missed the turn.</h1><p>The page may have moved, the address may be incorrect, or the content may not be published yet.</p><div class="hero-actions" style="justify-content:center"><a class="button button-primary" href="/">Return home</a><a class="button button-outline" href="/stories/">Browse stories</a></div></div></section>`;
  // AdSense/indexing remediation (2026-09-15): this had no robots
  // override, so it fell through to layout()'s default of "index, follow"
  // -- a 404 page has no content of its own to offer and must never be
  // indexed, found via the new audit script's own indexable-page count
  // coming up one higher than the sitemap's URL count.
  return layout({ site, title: "Page Not Found", description: "The requested Podium Watch page could not be found.", pathname: "/404.html", content, robots: "noindex, follow" });
}

function xmlEscape(value = "") {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

async function build() {
  await fs.rm(dist, { recursive: true, force: true });
  await fs.mkdir(dist, { recursive: true });
  await copyDirectory(path.join(root, "public"), dist);
  await fs.mkdir(path.join(dist, "styles"), { recursive: true });
  await fs.copyFile(path.join(root, "src", "styles", "main.css"), path.join(dist, "styles", "main.css"));
  await fs.copyFile(path.join(root, "src", "styles", "admin.css"), path.join(dist, "styles", "admin.css"));

  const stories = await loadStories();
  const rankings = await loadRankings();
  // Story page redesign (2026-10-28), A4: the writer-recruitment page
  // keeps working at its real URL (Instagram may link to it), but it
  // is never a public story -- so it is kept out of every story LIST
  // (homepage, /stories/, category pages, related stories, RSS) while
  // still getting its own page below, from the full `stories` array.
  const publicStories = stories.filter((story) => story.slug !== "write-for-podium-watch");

  await writePage("/", homePage(publicStories, rankings));
  await writePage("/stories/", storiesIndexPage(publicStories));
  for (const story of stories) {
    const storyPathname = `/stories/${story.slug}/`;
    await writePage(storyPathname, storyPage(story, publicStories));
    pathLastmod.set(storyPathname, story.updatedDate || story.date);
  }
  for (const category of [...new Set(publicStories.map((story) => story.category))]) {
    const page = categoryPage(category, publicStories);
    await writePage(page.pathname, page.html);
  }

  await writePage("/meets/", meetsIndexPage(site));
  await writePage("/meetdetail/", meetDetailPage(site));
  await writePage("/admin/", adminPage(site));
await writePage("/admin/meets/", adminMeetsPage(site));
await writePage("/admin/teams/", adminTeamsPage(site));
await writePage("/admin/team-manager/", adminTeamManagerPage(site));
await writePage("/admin/team-schedules/", adminTeamSchedulesPage(site));
await writePage("/admin/team-rosters/", adminTeamRostersPage(site));
await writePage("/admin/team-content/", adminTeamContentPage(site));
await writePage("/admin/engagement/", adminEngagementPage(site));
await writePage("/admin/photographers/", adminPhotographersPage(site));
await writePage("/admin/operations/", adminOperationsPage(site, { stories, rankings }));
await writePage("/admin/statewide-data/", adminStatewideDataPage(site));
await writePage("/admin/athletes/", adminAthletesPage(site));
await writePage("/admin/recruiting/", adminRecruitingPage(site));
await writePage("/admin/results-sources/", adminResultsSourcesPage(site));
await writePage("/admin/team-instagram/", adminTeamInstagramPage(site));
await writePage("/admin/fan-poll/", adminFanPollPage(site));
await writePage("/admin/awards/", adminAwardsPage(site));
await writePage("/admin/path-to-state/", adminPathToStatePage(site));
await writePage("/fan-poll/", fanPollIndexPage(site).html);
// Only cross country is turned on for voters right now -- see
// docs/DECISIONS.md, 2026-08-06. fanPollDivisionPage itself is already
// sport-aware, so track and field (5 divisions) can be added here later
// with no changes to the page function.
for (const gender of ["boys", "girls"]) {
  for (let division = 1; division <= 4; division += 1) {
    const page = fanPollDivisionPage(site, {
      sport: "cross_country",
      sportLabel: "Cross Country",
      sportPath: "cross-country",
      gender,
      divisionNumber: division
    });
    await writePage(page.pathname, page.html);
  }
}
await writePage("/pace-calculator/", paceCalculatorPage(site));
await writePage("/splits-calculator/", splitsCalculatorPage(site));
await writePage("/scoring-calculator/", scoringCalculatorPage(site));
await writePage("/team-login/", teamLoginPage(site));
await writePage("/team-dashboard/", teamDashboardPage(site));
// Photographer Network republished (2026-09-24) -- see docs/DECISIONS.md.
await writePage("/photographer-login/", photographerLoginPage(site));
await writePage("/photographer-dashboard/", photographerDashboardPage(site));
await writePage("/team-schedule/", teamSchedulePage(site));
await writePage("/team-roster/", teamRosterPage(site));
await writePage("/team-content/", teamContentPage(site));
await writePage("/team-insights/", teamInsightsPage(site));
await writePage("/team-home/", teamHomePage(site));
await writePage("/team-meet-center/", teamMeetCenterPage(site));
await writePage("/athlete-login/", athleteLoginPage(site));
await writePage("/athlete-home/", athleteHomePage(site));
await writePage("/guardian-login/", guardianLoginPage(site));
await writePage("/guardian-home/", guardianHomePage(site));
await writePage("/race/", racePublicPage(site));
await writePage("/split-watch/", splitWatchHubPage(site));
await writePage("/split-watch/plan/", splitWatchPlanPage(site));
await writePage("/split-watch/live/", splitWatchLivePage(site));
await writePage("/split-watch/review/", splitWatchReviewPage(site));
// Deliberately public -- not in any private-route list. This IS the
// unauthenticated entry point (a race day code, not a Supabase Auth
// session) -- see lib/race_day_auth.mjs.
await writePage("/split-watch/join/", splitWatchJoinPage(site));
// The scoped landing page a race-day code redirects to after join --
// see splitwatchraces.mjs's header comment. Covered by the "/split-watch/"
// private-prefix entry already (noindex), same as every other Split
// Watch page.
await writePage("/split-watch/races/", splitWatchRacesPage(site));
await writePage("/follow/", followPage(site));
await writePage("/my-podium/", myPodiumPage(site, stories));
await writePage("/my-podium-login/", myPodiumLoginPage(site));
await writePage("/privacy/", privacyPage(site));
await writePage("/standards/", standardsPage(site));
await writePage("/terms/", termsPage(site));
await writePage("/team-editor/", teamEditorPage(site));
await writePage("/team/", teamProfilePage(site));
await writePage("/teams/", teamsPage(site));
await writePage("/photographers/", photographersPage(site));
await writePage("/photographers/profile/", photographerDetailPage(site));
await writePage("/photographers/membership/", photographerMembershipPage(site));
await writePage("/ohio-schools/", ohioSchoolsPage(site));
await writePage("/claim-your-team/", claimTeamPage(site));
await writePage("/submit-results/", submitResultsPage(site));
await writePage("/submit-timing-results/", submitTimingResultsPage(site));
await writePage("/submit-photos/", submitPhotosPage(site));
await writePage("/photos/", photosPage(site));
await writePage("/admin/photo-submissions/", adminPhotoSubmissionsPage(site));
await writePage("/athletes/", athletesPage(site));
await writePage("/recruiting/", recruitingPage(site));
await writePage("/recruiting/methodology/", recruitingMethodologyPage(site));
await writePage("/recruiting/top-100/boys/", recruitingTop100Page(site, { gender: "boys" }));
await writePage("/recruiting/top-100/girls/", recruitingTop100Page(site, { gender: "girls" }));
await writePage("/recruiting/top-250/boys-cross-country/", recruitingTop250XcPage(site, { gender: "boys" }));
await writePage("/recruiting/top-250/girls-cross-country/", recruitingTop250XcPage(site, { gender: "girls" }));
await writePage("/recruiting/submit-activity/", submitRecruitingActivityPage(site));
await writePage("/apply/", applyPage(site));
await writePage("/apply/state-meet-correspondent/", applyStateMeetCorrespondentPage(site));
await writePage("/writer-login/", writerLoginPage(site));
await writePage("/writer-portal/", writerPortalPage(site));
await writePage("/writer-portal/profile/", writerPortalProfilePage(site));
await writePage("/writer-portal/admin/", writerPortalAdminPage(site));
await writePage("/writer-portal/write/", writerPortalWritePage(site));
await writePage("/writer-portal/admin/review/", writerPortalReviewPage(site));
await writePage("/writer-portal/articles/", writerPortalArticlePage(site));
await writePage("/writer-portal/authors/", writerPortalAuthorPage(site));
await writePage("/writer-portal/calendar/", writerPortalCalendarPage(site));
await writePage("/writer-portal/board/", writerPortalBoardPage(site));
await writePage("/writer-portal/style-guide/", writerPortalStyleGuidePage(site));
await writePage("/athlete/", athleteDetailPage(site));
for (const athlete of athleteSeedRows) {
  const athletePath = `/athletes/${athlete.profile_slug}/`;
  await writePage(
    athletePath,
    athleteDetailPage(site, { seed: athlete, pathname: athletePath })
  );
}
await writePage("/search/", searchPage(site));
await writePage("/athlete-of-the-week/", athleteOfTheWeekPage(site));
await writePage("/team-of-the-week/", teamOfTheWeekPage(site));
await writePage("/podium-play/", podiumPlayPage(site));
  await writePage("/tournament-hub/", tournamentHubPage(site));
  await writePage("/rankings/", rankingsIndexPage());
  await writePage("/rankings/methodology/", rankingMethodologyPage(site));
  await writePage("/rankings/oatccc/", oatcccCoachesPollPage(site));
  await writePage("/rankings/mock-meets/2026-09-17/", mockMeetsPage(site));
  for (const page of mockRegionalsAllPages(site)) {
    await writePage(page.pathname, page.html);
  }
  // Mock Districts pages (live /mock-meets/districts/...) intentionally
  // not generated yet -- see the import comment above.
  for (const page of mockPostseasonAllPages(site)) {
    await writePage(page.pathname, page.html);
  }
  await writePage("/rankings/leaders/", rankingLeadersPage(site));
  await writePage("/rankings/cross-country/", sportIndexPage("Cross Country", "cross-country", 4));
  await writePage("/rankings/track-and-field/", sportIndexPage("Track and Field", "track-and-field", 5));
  await writePage("/track-divisions/", trackDivisionsPage(site));
  for (const [sportName, sportPath, count] of [["Cross Country", "cross-country", 4], ["Track and Field", "track-and-field", 5]]) {
    for (const gender of ["Boys", "Girls"]) {
      for (let division = 1; division <= count; division += 1) {
        const page = divisionPage({ sportName, sportPath, division, divisionCount: count, gender, rankings });
        await writePage(page.pathname, page.html);
      }
    }
  }
  for (const ranking of rankings) {
    await writePage(ranking.href, rankingDetailPage(ranking, stories));
    if (ranking.updatedDate) pathLastmod.set(ranking.href, ranking.updatedDate);
  }

  await writePage("/athlete-spotlights/", athletePage());
  await writePage("/interviews/", interviewsPage());
  await writePage("/about/", await aboutPage());
  await writePage("/staff/", staffPage(stories));
  await writePage("/sponsors/", sponsorsPage());
  await writePage("/contact/", contactPage());
  await writeFile("404.html", stampCacheBustedAssetUrls(notFoundPage()));

  const searchIndex = [
    { type: "Page", title: "Home", subtitle: site.description, href: "/", searchText: "Ohio cross country track running home" },
    { type: "Page", title: "Rankings", subtitle: "Ohio cross country and track rankings", href: "/rankings/", searchText: "rankings boys girls divisions cross country track field" },
    { type: "Page", title: "Ranking Methodology", subtitle: "How Podium Watch rankings are created", href: "/rankings/methodology/", searchText: "ranking method sources corrections projections verified" },
    { type: "Page", title: "Meet Center", subtitle: "Meets, schedules, and results", href: "/meets/", searchText: "meets results schedule timing course" },
    { type: "Page", title: "Team Directory", subtitle: "Ohio team profiles", href: "/teams/", searchText: "teams schools coaches rosters schedules results" },
    { type: "Page", title: "Athlete Directory", subtitle: "Ohio athlete profiles, rankings, and sourced performances", href: "/athletes/", searchText: "athletes runners profiles recruiting graduation year performances results rankings" },
    { type: "Page", title: "Recruiting Database", subtitle: "Podium Watch Recruit Ratings and verified performance search", href: "/recruiting/", searchText: "recruiting recruits ratings stars college distance sprints hurdles jumps pole vault throws offers commitments" },
    { type: "Page", title: "Recruit Rating Methodology", subtitle: "How Podium Watch scores and verifies recruit ratings", href: "/recruiting/methodology/", searchText: "recruiting methodology stars score verified performance evaluation corrections no pay to play" },
    { type: "Page", title: "Ohio School and Division Directory", subtitle: "Official 2026 and 2027 boys cross country school assignments", href: "/ohio-schools/", searchText: "Ohio schools OHSAA boys cross country divisions school directory athletic districts enrollment" },
    { type: "Page", title: "Claim Your Team", subtitle: "Coach and team representative access", href: "/claim-your-team/", searchText: "claim team coach account manage school page roster schedule results" },
    { type: "Page", title: "Submit Results", subtitle: "Send Podium Watch your meet results, no account required", href: "/submit-results/", searchText: "submit results coach timer meet host upload paste hy-tek semi colon delimited" },
    { type: "Page", title: "Submit Timing Results", subtitle: "Timing companies hand off finished results files, no account required", href: "/submit-timing-results/", searchText: "timing company submit results upload pdf csv xlsx hy-tek hy3 file" },
    { type: "Page", title: "Write for Podium Watch", subtitle: "High school intern writer applications, no account required", href: "/apply/", searchText: "apply intern writer application high school student parent consent" },
    { type: "Page", title: "State Meet Media Correspondent Application", subtitle: "Paid media correspondent role at the 2026 OHSAA State Cross Country Championships", href: "/apply/state-meet-correspondent/", searchText: "state meet media correspondent application paid OHSAA state cross country championships Fortress Obetz stringer interview" },
    { type: "Page", title: "Writer Portal", subtitle: "Intern writer accounts: sign in, dashboard, profile, and staff writer management", href: "/writer-portal/", searchText: "writer portal login intern account article draft submitted review editor" },
    { type: "Page", title: "Ohio Tournament Hub", subtitle: "Boys cross country divisions and track regional sites", href: "/tournament-hub/", searchText: "OHSAA divisions regional sites representation tournament boys cross country track" },
    { type: "Page", title: "Athlete of the Week", subtitle: "Nominate, vote, and view winners", href: "/athlete-of-the-week/", searchText: "athlete week nominations finalists voting winner" },
    { type: "Page", title: "Team of the Week", subtitle: "Nominate, vote, and view winners", href: "/team-of-the-week/", searchText: "team week nominations finalists voting winner boys girls" },
    { type: "Page", title: "Athlete Spotlights", subtitle: "The story behind the result", href: "/athlete-spotlights/", searchText: "athletes profiles interviews stories" },
    { type: "Page", title: "Stories", subtitle: "Podium Watch articles and coverage", href: "/stories/", searchText: "articles news stories coverage" },
    ...stories.map((story) => ({ type: "Story", title: story.title, subtitle: `${story.category} | ${story.description}`, href: `/stories/${story.slug}/`, searchText: `${story.title} ${story.description} ${story.category} ${(story.tags || []).join(" ")} ${story.author}` })),
    ...rankings.map((ranking) => ({ type: "Ranking", title: ranking.title, subtitle: `${ranking.sport} | ${ranking.gender} | ${ranking.division} | Updated ${ranking.updatedDate}`, href: ranking.href, searchText: `${ranking.title} ${ranking.sport} ${ranking.gender} ${ranking.division} ${ranking.season} ${ranking.event} ${ranking.rows.map((row) => `${row.athlete} ${row.school}`).join(" ")}` })),
    ...athleteSeedRows.map((athlete) => ({
      type: "Athlete",
      title: athlete.display_name,
      subtitle: `${athlete.school_name} | Class of ${athlete.graduation_year} | ${athlete.division}`,
      href: `/athletes/${athlete.profile_slug}/`,
      searchText: `${athlete.display_name} ${athlete.school_name} ${athlete.official_school_name || ""} ${athlete.school_city || ""} ${athlete.gender} ${athlete.graduation_year} ${athlete.division} ${athlete.event} ${athlete.ranking?.title || ""}`
    })),
    ...(ohioSchoolFoundation.schools || []).map((school) => ({
      type: "Ohio School",
      title: displaySchoolName(school.school_name),
      subtitle: `${school.city} | ${school.athletic_district} | ${school.division_2026_27_2027_28}`,
      href: `/ohio-schools/?search=${encodeURIComponent(school.school_name)}`,
      searchText: `${school.school_name} ${school.city} ${school.athletic_district} ${school.school_id} ${school.division_2026_27_2027_28} ${school.division_2025_26}`
    }))
  ];
  await writeFile("search-index.json", JSON.stringify(searchIndex, null, 2));

  // AdSense/indexing remediation (2026-09-15): both prefix lists now come
  // from src/config/site.mjs, shared with layout()'s own <meta
  // name="robots"> logic (src/lib/html.mjs) -- one URL that's excluded
  // here always also carries the matching noindex tag, and vice versa,
  // since both read the same source lists. A real per-athlete page
  // (/athletes/{slug}/, as opposed to the /athletes/ directory index
  // itself) is excluded here too -- see athletedetail.mjs's own comment
  // for why: the generated HTML still lacks real performance/ranking/
  // recruiting content, only name/school/class year/division, so it's
  // not yet meaningful enough to index at volume (201 pages). This is
  // the task's own documented safe fallback, not a guess.
  const isRealAthletePage = (pathname) => pathname.startsWith("/athletes/") && pathname !== "/athletes/";
  const paths = [...generatedPaths]
    .filter((pathname) => !pathname.endsWith("404.html"))
    .filter((pathname) => !NOINDEX_NOFOLLOW_PREFIXES.some((prefix) => pathname.startsWith(prefix)))
    .filter((pathname) => !NOINDEX_FOLLOW_PREFIXES.some((prefix) => pathname.startsWith(prefix)))
    .filter((pathname) => !SITEMAP_EXACT_EXCLUDE.includes(pathname))
    .filter((pathname) => !isRealAthletePage(pathname))
    .sort();
  // Real per-page date when one is tracked (pathLastmod, populated at
  // each story/ranking writePage() call above); otherwise <lastmod> is
  // omitted entirely for that URL rather than stamping every page with
  // one shared, fake date -- <lastmod> is optional in the sitemap spec,
  // and an honest omission is better than a fabricated date.
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map((pathname) => {
    const lastmod = pathLastmod.get(pathname);
    return `  <url><loc>${xmlEscape(absoluteUrl(site, pathname))}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`;
  }).join("\n")}\n</urlset>\n`;
  await writeFile("sitemap.xml", sitemap);
  await writeFile("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${site.siteUrl}/sitemap.xml\n`);
  const rssItems = publicStories.slice(0, 30).map((story) => `<item><title>${xmlEscape(story.title)}</title><link>${xmlEscape(absoluteUrl(site, `/stories/${story.slug}/`))}</link><guid>${xmlEscape(absoluteUrl(site, `/stories/${story.slug}/`))}</guid><pubDate>${new Date(`${story.date}T12:00:00Z`).toUTCString()}</pubDate><description>${xmlEscape(story.description)}</description><category>${xmlEscape(story.category)}</category></item>`).join("");
  await writeFile("rss.xml", `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${xmlEscape(site.name)}</title><link>${xmlEscape(site.siteUrl)}</link><description>${xmlEscape(site.description)}</description><language>en-us</language>${rssItems}</channel></rss>`);
  await writeFile("site-data.json", JSON.stringify({
    generatedAt: new Date().toISOString(),
    stories: stories.map(({ html, body, ...story }) => story),
    rankings: rankings.map(({ rows, filePath, ...ranking }) => ({ ...ranking, count: rows.length })),
    athleteFoundation: {
      datasetKey: athleteFoundationSeed.dataset_key,
      recordCount: athleteSeedRows.length,
      sourceType: athleteFoundationSeed.source_type,
      lastReviewedDate: athleteFoundationSeed.last_reviewed_date
    }
  }, null, 2));

  // AdSense/indexing remediation (2026-09-15): this used to read
  // `paths.length` and call it "pages built" -- but `paths` is the
  // sitemap array, already filtered down to indexable URLs only, so that
  // number was never the real total and got confusing fast once the
  // sitemap exclusion list grew (dropped from a misleading 316 to a
  // misleading 99 the moment writer-portal/writer-login and the 200 real
  // athlete pages were correctly excluded from the sitemap, even though
  // the actual page count generated to dist/ never changed). Reporting
  // both numbers, clearly labeled, instead of one ambiguous one.
  console.log(`Built ${generatedPaths.size} pages (${paths.length} in sitemap.xml), ${stories.length} published stories, and ${rankings.length} ranking files.`);
}

build().catch((error) => {
  console.error(`\nBuild failed:\n${error.message}\n`);
  process.exit(1);
});
