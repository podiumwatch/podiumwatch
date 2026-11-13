import { merchSection } from "../src/lib/merch_card.mjs";
import { frontStoryShape } from "../src/pages/home.mjs";
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
import { supportPage } from "../src/pages/support.mjs";
import { termsPage } from "../src/pages/terms.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import { site, NOINDEX_NOFOLLOW_PREFIXES, NOINDEX_FOLLOW_PREFIXES, SITEMAP_EXACT_EXCLUDE } from "../src/config/site.mjs";
import sponsors from "../src/data/sponsors.json" with { type: "json" };
import ohioSchoolFoundation from "../public/data/ohio-school-foundation-2026-27.json" with { type: "json" };
import athleteFoundationSeed from "../public/data/athlete-foundation-seed-2026.json" with { type: "json" };
import preseasonInteractiveData from "../public/data/podium-watch-2026-preseason-interactive-data.json" with { type: "json" };
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
  storyImageStyle,
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
import { searchPage } from "../src/pages/search.mjs";
import { athleteOfTheWeekPage, teamOfTheWeekPage, weeklyAwardsPausedPage } from "../src/pages/weeklyawards.mjs";
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
import { mockPostseasonAllPages, mockPostseasonPartFiles, mockPostseasonStateBasisFiles } from "../src/pages/mockpostseason.mjs";
// mockDistrictsAllPages (src/pages/mockdistricts.mjs) is built and
// committed but deliberately not called below yet -- the user wants Mock
// Districts kept off the live site until more district data is sent and
// real school/division coverage improves. Re-add the call in the page
// loop below (and the "Districts" nav item in src/config/site.mjs) when
// told to make it live.
// import { mockDistrictsAllPages } from "../src/pages/mockdistricts.mjs";
import { trackDivisionsPage } from "../src/pages/trackdivisions.mjs";
import { athletesPage } from "../src/pages/athletes.mjs";
import { athleteDetailPage } from "../src/pages/athletedetail.mjs";
import { adminAthletesPage } from "../src/pages/adminathletes.mjs";
import { adminRecruitingPage } from "../src/pages/adminrecruiting.mjs";
import { adminResultsSourcesPage } from "../src/pages/adminresultssources.mjs";
import { adminTeamInstagramPage } from "../src/pages/adminteaminstagram.mjs";
import { adminShortLinksPage } from "../src/pages/adminshortlinks.mjs";
import { adminFrontPagePage } from "../src/pages/adminfrontpage.mjs";
import { teamInstagramPage } from "../src/pages/teaminstagram.mjs";
import { teamBanquetPage } from "../src/pages/teambanquet.mjs";
import { wrappedSearchPage } from "../src/pages/wrapped.mjs";
import { adminWrappedPage } from "../src/pages/adminwrapped.mjs";
import { adminTeamLogosPage } from "../src/pages/adminteamlogos.mjs";
import { adminSponsorReportPage } from "../src/pages/adminsponsorreport.mjs";
import { adminPartnerPage } from "../src/pages/adminpartnerpage.mjs";
import { sponsorSlotHtml } from "../lib/site_sponsors.mjs";
import { COMMITMENT_CLASSES } from "../src/lib/commitment_rows.mjs";
import { allHubPaths } from "../src/config/season_hubs.mjs";
import { applyImageFocus } from "./image-focus.mjs";
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
import { statePicksPage } from "../src/pages/statepicks.mjs";
import statePicksField from "../public/data/state-picks-2026.json" with { type: "json" };
import { yearlyAwardsCategoryPage, yearlyAwardsHubPage } from "../src/pages/yearlyawards2026.mjs";
import { adminAwards2026Page } from "../src/pages/adminawards2026.mjs";
import yearlyAwardsPool from "../public/data/yearly-awards-2026-pool.json" with { type: "json" };
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
// lookup. No longer used for the homepage widget, which shows the OATCCC poll
// (src/pages/home.mjs).
const preseasonClassifications = Object.values(preseasonInteractiveData.classifications || {});

function preseasonClassificationFor(genderLower, divisionNumber) {
  return preseasonClassifications.find(
    (item) => item.gender.toLowerCase() === genderLower && item.division === divisionNumber
  ) || null;
}

function preseasonArticleHref(classification) {
  return `/stories/${classification.articleSlug}/`;
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
  // Rankings pages: the Podium Watch Shop card at the very bottom, below
  // everything (never above the presenting sponsors or inside a list).
  // Not on the OATCCC Coaches Poll (no sponsors there).
  if (/^\/rankings\//.test(route) && !/^\/rankings\/oatccc\//.test(route)) html = html.replace("</main>", `${merchSection({ placement: "rankings-end", from: route })}</main>`);
  const cleanRoute = route === "/" ? "" : route.replace(/^\/+|\/+$/g, "");
  await writeFile(path.join(cleanRoute, "index.html"), stampCacheBustedAssetUrls(html));
}

function pathFromSport(sport) {
  return sport.toLowerCase().includes("track") ? "track-and-field" : "cross-country";
}

// Draft previews (2026-11-13): a story with draft: true is never built on
// production. On Vercel preview deployments and local builds it gets its
// own page so it can be checked before it goes live: marked noindex, with
// a "Draft" banner, and left out of every list, feed, search and the
// sitemap. PW_SHOW_DRAFTS=0 or 1 overrides.
const SHOW_DRAFTS = process.env.PW_SHOW_DRAFTS ? process.env.PW_SHOW_DRAFTS === "1" : process.env.VERCEL_ENV !== "production";
const draftStories = [];
const draftPaths = new Set();

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
      // An explicit `readTime` (minutes) overrides the auto-computed
      // word-count estimate -- useful for a deliberately condensed
      // story where the real reading time is shorter than its word
      // count alone would suggest.
      readingMinutes: Number.isFinite(Number(data.readTime)) ? Number(data.readTime) : readingTime(body),
      sourceFile: path.relative(root, filePath),
      // Story page redesign (2026-10-28), B4: series grouping.
      seriesOrder: Number.isFinite(Number(data.seriesOrder)) ? Number(data.seriesOrder) : null
    };
    if (!story.draft) stories.push(story);
    else draftStories.push(story);
  }
  // Every story photo gets a crop point so faces stay in the wide frames
  // (front page, cards, headers); a story's own featuredImagePosition wins.
  const focus = await applyImageFocus(stories);
  if (focus.computed) console.log(`Photo crop points: ${focus.computed} new, ${focus.cached} cached.`);
  if (focus.missing.length) console.warn(`Photo crop points not computed (center crop used): ${focus.missing.join(", ")}`);
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


// The homepage is rendered on the server (api/pages/home.js, src/pages/home.mjs;
// site redesign step 7) so the admin-set lead is decided before the page is sent.

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

// Story page redesign v3 "simple" (2026-10-28): one calm centered
// column (headline, dek, byline, one image, the story, a plain sign-off)
// -- ported from dataimports/podium-watch-story-page.html v3, replacing
// the earlier v1 (dark split hero, at-a-glance strip, sticky TOC rail,
// boxed end-matter cards). Every story renders through this one
// template; a story's region headings get their "where" line styling
// from a plain CSS h2 + p rule (see main.css) -- the body markdown
// itself just needs a plain paragraph right after each region heading,
// nothing structural in front matter.

// Transforms the body HTML renderMarkdown() already produced:
// - a paragraph that opens with a bold run-in phrase ("Watterson's
//   wave.") becomes a styled run-in subhead instead of plain <strong>
// - a trailing "*Results are from...*" disclaimer paragraph (this
//   site's standing sourcing-note convention) is pulled out of the body
//   entirely and returned separately, for the plain sign-off at the end
// - any remaining standalone italic paragraph (the "co-champion" note
//   convention in the district recaps) becomes a plain muted note line
function transformStoryBody(story) {
  // The template already renders the title in .sp-head; a body that
  // opens by repeating it as "# Title" would show a second H1.
  let html = story.html.replace(/^\s*<h1[^>]*>[\s\S]*?<\/h1>\s*/, "");
  // Any further "# Heading" in a body is a section heading, not a page
  // title: keep one H1 per page.
  html = html.replace(/<h1(\s[^>]*)?>/g, "<h2$1>").replace(/<\/h1>/g, "</h2>");
  let sourcingNote = null;
  const trailingNote = html.match(/<p><em>([^<]+)<\/em><\/p>\s*$/);
  if (trailingNote) {
    sourcingNote = trailingNote[1];
    html = html.slice(0, trailingNote.index).trimEnd();
  }
  html = html.replace(/<p><strong>([^<]+\.)<\/strong>/g, '<p><span class="sp-runin">$1</span>');
  html = html.replace(/<p><em>([^<]+)<\/em><\/p>/g, '<p class="sp-note">$1</p>');
  // A plain paragraph right after a region heading, reading "<site(s)>
  // district(s) · <regional> regional", is the "where" line -- matched
  // by shape rather than position so it never catches an unrelated
  // paragraph (e.g. the "Up next" section also uses a plain <h2>).
  html = html.replace(/<p>([^<]+ districts? · [^<]+ regional)<\/p>/g, '<p class="sp-where">$1</p>');
  return { html, sourcingNote };
}

function storyPage(story, stories, { draft = false } = {}) {
  const storyIndex = stories.findIndex((item) => item.slug === story.slug);
  const newer = !draft && storyIndex > 0 ? stories[storyIndex - 1] : null;
  const older = !draft && storyIndex >= 0 && storyIndex < stories.length - 1 ? stories[storyIndex + 1] : null;
  const pathname = `/stories/${story.slug}/`;
  const sponsor = story.sponsor ? sponsors.find((item) => item.id === story.sponsor) : null;
  const sponsorBlock = sponsor ? `<p class="sp-note"><strong>${escapeHtml(sponsor.name)}</strong>${sponsor.description ? ` &mdash; ${escapeHtml(sponsor.description)}` : ""}${sponsor.url ? ` <a class="sp-link" href="${sponsor.url}" target="_blank" rel="noopener noreferrer">Visit sponsor</a>` : ""}</p>` : "";
  const shareText = encodeURIComponent(story.title);
  const shareUrl = encodeURIComponent(absoluteUrl(site, pathname));
  const type = storyType(story);
  const heroImage = story.heroImage || story.featuredImage || "";
  const fallback = storyFallbackImage(story.category);

  // Series line (B3.1): only when this story and at least one sibling
  // share a `series` value, ordered by seriesOrder. A single plain text
  // row, not a dark band.
  const seriesMembers = story.series ? stories.filter((item) => item.series === story.series).sort((a, b) => (a.seriesOrder ?? 0) - (b.seriesOrder ?? 0)) : [];
  const seriesLabel = story.seriesLabel || story.series?.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const seriesBar = seriesMembers.length > 1 ? `<nav class="sp-series" aria-label="${escapeHtml(seriesLabel)}"><div class="container sp-series-inner">
    <span class="sp-series-label">${escapeHtml(seriesLabel)}</span>
    ${seriesMembers.map((item) => `<a href="/stories/${item.slug}/"${item.slug === story.slug ? " aria-current=\"page\"" : ""}>${escapeHtml(item.seriesNavLabel || item.seriesLabel || item.title.split(":")[0])}</a>`).join("")}
  </div></nav>` : "";

  // Hero: real hero image with a 16:9 crop, or a branded black title
  // card instead of an empty box when a story has no hero image.
  const heroArt = heroImage
    ? `<figure class="sp-hero-art"><div class="sp-wide"><img src="${heroImage}" data-fallback="${fallback}" data-check-hero-width="true" alt="${escapeHtml(story.heroAlt || story.featuredImageAlt || "")}" width="1600" height="900" loading="eager" fetchpriority="high"${storyImageStyle(story, { hero: true })}></div>${(story.heroCaption || story.heroCredit) ? `<figcaption>${story.heroCaption ? escapeHtml(story.heroCaption) : ""}${story.heroCredit ? `<span class="sp-credit">${escapeHtml(story.heroCredit)}</span>` : ""}</figcaption>` : ""}</figure>`
    : `<figure class="sp-hero-art"><div class="sp-wide"><div class="sp-hero-art-fallback"><img src="${site.logoLight || site.logo}" alt=""><span>${escapeHtml(story.title)}</span></div></div></figure>`;

  const genuinelyUpdated = (story.updated || (story.updatedDate && story.updatedDate !== story.date)) ? (story.updated || story.updatedDate) : null;

  const { html: bodyHtml, sourcingNote } = transformStoryBody(story);

  // Plain sign-off: the sourcing note (if the body had a trailing
  // italic disclaimer paragraph) plus the standing corrections line.
  // No boxed card, no copy button -- matches the simple end-of-story
  // treatment exactly.
  const endBlock = `<div class="sp-end"><div class="sp-col">
    <hr>
    ${sourcingNote ? `<p>${sourcingNote}</p>` : ""}
    <p>Spotted an error? Email <span class="sp-mail-text">${site.contactEmail}</span>.</p>
  </div></div>`;

  // Related (B3.13): other stories in the same series when there is
  // one, otherwise the 3 newest stories of the same type. The hiring
  // page is never shown in any story list (A4).
  const relatedPool = stories.filter((item) => item.slug !== story.slug && item.slug !== "write-for-podium-watch");
  const related = story.series
    ? relatedPool.filter((item) => item.series === story.series).sort((a, b) => (a.seriesOrder ?? 0) - (b.seriesOrder ?? 0)).slice(0, 3)
    : relatedPool.filter((item) => storyType(item) === type).slice(0, 3);
  const relatedTitle = story.series ? `More from ${seriesLabel}` : "More from Podium Watch";
  const relatedBlock = related.length ? `<section class="sp-related"><div class="sp-wide"><h2>${escapeHtml(relatedTitle)}</h2><div class="sp-cards">
    ${related.map((item) => `<a class="sp-card" href="/stories/${item.slug}/"><img src="${item.featuredImage || item.heroImage || storyFallbackImage(item.category)}" alt="" width="640" height="360"${storyImageStyle(item)}><div><span class="sp-k">${escapeHtml(storyType(item))}</span><h3>${escapeHtml(item.title)}</h3></div></a>`).join("")}
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
  ${draft ? `<p class="sp-draft-banner" role="note"><strong>Draft preview.</strong> Not published: this page is not linked anywhere and search engines are told to skip it.</p>` : ""}
  ${seriesBar}
  <div id="sp-story-top">
  <header class="sp-head"><div class="sp-col">
    <p class="sp-kicker">${escapeHtml(type)}${story.divisions ? ` &middot; ${story.divisions === "All" ? "All Divisions" : `Division ${story.divisions}`}` : ""}</p>
    <h1>${escapeHtml(story.title)}</h1>
    <p class="sp-dek">${escapeHtml(story.description)}</p>
    <div class="sp-byline">
      <span>By ${storyBylineHtml(story.author)} &nbsp;&middot;&nbsp; ${formatDate(story.date)}${genuinelyUpdated ? ` &nbsp;&middot;&nbsp; Updated ${formatDate(genuinelyUpdated)}` : ""} &nbsp;&middot;&nbsp; ${story.readingMinutes} min read</span>
      <div class="sp-share" aria-label="Share this story">
        <span class="sp-toast" data-sp-toast hidden>Link copied</span>
        <button type="button" data-sp-copy-link aria-label="Copy link"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.6 13.4a1 1 0 0 1 0-1.4l3.5-3.5a3 3 0 1 1 4.2 4.2l-2 2a1 1 0 1 1-1.4-1.4l2-2a1 1 0 1 0-1.4-1.4l-3.5 3.5a1 1 0 0 1-1.4 0ZM13.4 10.6a1 1 0 0 1 0 1.4l-3.5 3.5a3 3 0 1 1-4.2-4.2l2-2a1 1 0 0 1 1.4 1.4l-2 2a1 1 0 1 0 1.4 1.4l3.5-3.5a1 1 0 0 1 1.4 0Z"/></svg></button>
        <a href="https://x.com/intent/post?url=${shareUrl}&text=${shareText}" target="_blank" rel="noopener noreferrer" aria-label="Share on X"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.8 3h3.1l-6.8 7.7 8 10.3h-6.2l-4.9-6.3L5.4 21H2.3l7.2-8.3L1.8 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z"/></svg></a>
        <a href="https://www.facebook.com/sharer/sharer.php?u=${shareUrl}" target="_blank" rel="noopener noreferrer" aria-label="Share on Facebook"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H7.9v3h2.6V21h3Z"/></svg></a>
      </div>
    </div>
    <div class="sp-front-page" data-front-page-runs data-slug="${escapeHtml(story.slug)}" hidden></div>
  </div></header>

  ${heroArt}

  <article class="sp-article"><div class="sp-col">${bodyHtml}${sponsorBlock}</div></article>
  ${/oatccc.*poll|write-for-podium-watch/.test(story.slug) ? "" : merchSection({ placement: "story-end", from: pathname })}

  ${endBlock}

  ${navigation ? `<div class="container">${navigation}</div>` : ""}
  ${relatedBlock}
  </div>
  ${preseasonDataScript}
  <script src="/scripts/story-view.js" defer></script>
  <script src="/scripts/story-page.js" defer></script>
  <script src="/scripts/story-front-page.js" defer></script>
  </div>`;

  return layout({
    site,
    title: story.title,
    description: story.description,
    pathname,
    // socialImage (2026-11-03): a story may name its own 1200x630
    // link-preview card; otherwise the hero is the preview.
    // socialImageWidth/Height (2026-11-13) for a card that isn't 1200x630.
    image: story.socialImage || heroImage || site.defaultSocialImage,
    imageWidth: story.socialImage ? Number(story.socialImageWidth) || 1200 : heroImage ? 1600 : undefined,
    imageHeight: story.socialImage ? Number(story.socialImageHeight) || 630 : heroImage ? 900 : undefined,
    canonicalUrl: story.canonicalUrl,
    type: "article",
    publishedTime: story.date,
    modifiedTime: genuinelyUpdated || story.date,
    content,
    ...(draft ? { robots: "noindex, nofollow" } : {}),
    jsonLd: [articleJsonLd(site, story), breadcrumbsJsonLd(site, [{ label: "Home", href: "/" }, { label: "Stories", href: "/stories/" }, { label: story.title }])],
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
  <section class="section section-paper"><div class="container">${breadcrumb([{ label: "Home", href: "/" }, { label: "Rankings", href: "/rankings/" }, { label: sportName }])}<div class="gender-tabs"><a href="/rankings/${sportPath}/boys/division-1/">Boys rankings</a><a href="/rankings/${sportPath}/girls/division-1/">Girls rankings</a></div><div class="division-grid${divisionCount === 5 ? " track-grid" : ""}">${divisionLinks}</div><div class="info-card" style="margin-top:24px"><h3>Looking for girls rankings?</h3><p>Choose Girls Rankings above, then select the division. Rankings for each division appear here as they are published.</p></div></div></section>`;
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
  <section class="section section-paper"><div class="container">${breadcrumb([{ label: "Home", href: "/" }, { label: "Rankings", href: "/rankings/" }, { label: sportName, href: `/rankings/${sportPath}/` }, { label: `Division ${division} ${gender}` }])}${sponsorSlotHtml(pathname)}<div class="gender-tabs"><a href="/rankings/${sportPath}/boys/division-${division}/"${gender === "Boys" ? ' aria-current="page"' : ""}>Boys</a><a href="/rankings/${sportPath}/girls/division-${division}/"${gender === "Girls" ? ' aria-current="page"' : ""}>Girls</a></div><div class="division-grid${divisionCount === 5 ? " track-grid" : ""}">${Array.from({ length: divisionCount }, (_, index) => index + 1).map((number) => `<a class="division-card" href="/rankings/${sportPath}/${gender.toLowerCase()}/division-${number}/"><strong>Division ${number}</strong><span>${number === division ? "Current division" : `View Division ${number}`}</span></a>`).join("")}</div>${preseasonCallout}<div style="margin-top:34px">${matching.length ? `<div class="rankings-grid">${matching.map((ranking) => rankingCard(ranking)).join("")}</div>` : emptyState({ title: "No rankings published here yet", description: `The Division ${division} ${gender.toLowerCase()} page will show rankings here when they are published.`, actionLabel: `View ${otherGender.toLowerCase()} rankings`, actionHref: `/rankings/${sportPath}/${otherGender.toLowerCase()}/division-${division}/` })}</div></div></section>`;
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
      // No seeded profile: linked in the browser if the name and school
      // match exactly one profile (public/scripts/name-links.js). Schools too.
      : `<span data-pw-athlete="${escapeHtml(row.athlete)}" data-pw-athlete-school="${escapeHtml(row.school)}">${escapeHtml(row.athlete)}</span>`;

    return `<article class="ranking-row"${row.sport === "Cross Country" ? ` data-pw-division="${escapeHtml(row.division || "")}" data-pw-gender="${escapeHtml(row.gender || "")}"` : ""}><div class="ranking-number">${escapeHtml(row.rank)}</div><div class="ranking-athlete"><strong>${athleteName}</strong><span data-pw-school="${escapeHtml(row.school)}">${escapeHtml(row.school)}</span></div><div class="ranking-grade">${escapeHtml(row.grade || "")}</div><div class="ranking-mark"><strong>${escapeHtml(row.timeOrMark)}</strong><small>${escapeHtml(row.event)}</small></div>${row.rankingExplanation ? `<p class="ranking-explanation">${escapeHtml(row.rankingExplanation)}</p>` : ""}</article>`;
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
  <section class="section section-paper"><div class="container">${breadcrumb(crumbs)}${sponsorSlotHtml(pathname)}
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

// Interviews and Athlete Spotlights (site fixes, 2026-11-13): no "coming
// soon" box. Each page lists the published stories tagged for it
// ("Interview" / "Athlete Spotlight", case-insensitive) and shows that
// list by itself as soon as the first one is published.
const storiesTagged = (stories, wanted) => stories.filter((story) => (story.tags || []).some((tag) => wanted.includes(String(tag).trim().toLowerCase())));
const SPOTLIGHT_TAGS = ["athlete spotlight", "athlete spotlights", "spotlight"];
const INTERVIEW_TAGS = ["interview", "interviews", "beyond the podium"];

function athletePage(stories = []) {
  const spotlights = storiesTagged(stories, SPOTLIGHT_TAGS);
  const directory = `<div><p class="eyebrow">Athlete profiles</p><h2>Start with the statewide directory.</h2><p>Find athletes by name, school, graduation year, division, event, and source status.</p><a class="button button-primary" href="/athletes/">Open athlete directory</a></div>`;
  const list = spotlights.length ? `<section class="section section-paper" aria-labelledby="spotlights-title"><div class="container"><div class="section-heading"><div><p class="eyebrow">Athlete spotlights</p><h2 id="spotlights-title">Latest spotlights</h2></div></div><div class="stories-grid">${spotlights.map((story) => storyCard(story)).join("")}</div></div></section>` : "";
  const content = `${pageHero({ eyebrow: "Athlete spotlights", title: "The story behind the result.", description: "A home for Ohio athletes to share what drives them, what they have overcome, and what they want people to remember." })}${list}<section class="section section-paper"><div class="container">${directory}</div></section>`;
  return layout({ site, title: "Athlete Spotlights", description: "Podium Watch athlete spotlights and athlete profile directory for Ohio high school cross country and track and field.", pathname: "/athlete-spotlights/", content });
}

function interviewsPage(stories = []) {
  const interviews = storiesTagged(stories, INTERVIEW_TAGS);
  const list = interviews.length ? `<div class="section-heading"><div><p class="eyebrow">Beyond the Podium</p><h2>Latest interviews</h2></div></div><div class="stories-grid">${interviews.map((story) => storyCard(story)).join("")}</div>` : "";
  const content = `${pageHero({ eyebrow: "Beyond the Podium", title: "Conversations beyond the finish line.", description: "Interviews about racing, pressure, setbacks, faith, goals, and the person behind the athlete." })}<section class="section section-paper"><div class="container">${list}<p${list ? ' style="margin-top:28px"' : ""}><a class="button button-outline" href="${site.youtubeUrl}" target="_blank" rel="noopener noreferrer">Watch on YouTube</a></p></div></section>`;
  return layout({ site, title: "Beyond the Podium Interviews", description: "Podium Watch interviews with Ohio high school runners and members of the running community.", pathname: "/interviews/", content });
}

// /sponsors/ is rendered on the server now (api/pages/sponsors.js,
// src/pages/sponsors.mjs) so its numbers and prices are in the HTML.

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
// Final staff list (2026-11-03, Zachary): exactly these people in this
// order. No bios, photos, ages, schools or email addresses for anyone;
// only Christian Lisle and Lauren Palmer have links.
const STAFF = [
  { name: "Zachary Bell", title: "Founder & Editor" },
  { name: "Logan Eggert", title: "Writer" },
  { name: "Matthew Lee", title: "Writer" },
  { name: "Matt McKenzie", title: "Contributing Photographer" },
  { name: "Koby Peace", title: "Contributing Photographer" },
  { name: "Alexander Schulz", title: "Contributing Photographer" },
  { name: "Christian Lisle", title: "Contributing Photographer", instagramUrl: "https://instagram.com/lislephotog", instagramHandle: "@lislephotog", websiteUrl: "https://lislephoto.com", websiteLabel: "lislephoto.com" },
  { name: "Lauren Palmer", title: "Contributing Photographer", instagramUrl: "https://instagram.com/laurenpmedia", instagramHandle: "@laurenpmedia" }
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
      ${person.websiteUrl ? `<a class="text-link" href="${person.websiteUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(person.websiteLabel)}</a>` : ""}
    </div>
  </article>`;
}
function staffPage(stories) {
  const editor = STAFF[0];
  const rest = STAFF.slice(1);
  // The automatic "Contributing Writers" section (story authors not on
  // STAFF) is off as of 2026-11-03: STAFF is the final list.
  const writersSection = "";
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
  // WO-08: the eight "2026 Division X ... Top 25" stories duplicate their
  // ranking pages (same title, same list). The /rankings/... version is
  // the one kept; the story URLs 301 there (vercel.json), so they are
  // left out of every list, the search index and the sitemap.
  const rankingDuplicateSlugs = new Set(rankings.map((ranking) => String(ranking.href || "").split("/").filter(Boolean).pop()));
  const isRankingDuplicate = (story) => rankingDuplicateSlugs.has(story.slug);
  const publicStories = stories.filter((story) => story.slug !== "write-for-podium-watch" && !isRankingDuplicate(story));

  await writePage("/stories/", storiesIndexPage(publicStories));
  for (const story of stories) {
    if (isRankingDuplicate(story)) continue;
    const storyPathname = `/stories/${story.slug}/`;
    await writePage(storyPathname, storyPage(story, publicStories));
    pathLastmod.set(storyPathname, story.updatedDate || story.date);
  }
  if (SHOW_DRAFTS) {
    await applyImageFocus(draftStories, { write: false });
    for (const story of draftStories) {
      const draftPathname = `/stories/${story.slug}/`;
      await writePage(draftPathname, storyPage(story, publicStories, { draft: true }));
      draftPaths.add(draftPathname);
    }
    if (draftStories.length) console.log(`Draft previews: ${draftStories.map((story) => story.slug).join(", ")}`);
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
await writePage("/admin/short-links/", adminShortLinksPage(site));
await writePage("/admin/team-logos/", adminTeamLogosPage(site));
// Front page lead (WO-43): published stories, newest first, in the lead shape.
await writePage("/admin/front-page/", adminFrontPagePage(site, [...stories].filter((story) => !story.draft).sort((a, b) => String(b.date).localeCompare(String(a.date))).map(frontStoryShape)));
await writePage("/admin/sponsor-report/", adminSponsorReportPage(site));
await writePage("/admin/partner-page/", adminPartnerPage(site));
// College commitment pages are server-rendered (api/pages/commitments.js).
await writePage("/admin/fan-poll/", adminFanPollPage(site));
await writePage("/admin/awards/", adminAwardsPage(site));
await writePage("/admin/awards/2026/", adminAwards2026Page(site));
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
await writePage("/support/", supportPage(site));
await writePage("/terms/", termsPage(site));
await writePage("/team-editor/", teamEditorPage(site));
await writePage("/team/", teamProfilePage(site));
// /teams/ is rendered on the server (api/pages/teams.js, redesign step 2).
await writePage("/teams/instagram/", teamInstagramPage(site));
await writePage("/teams/banquet/", teamBanquetPage(site));
await writePage("/wrapped/", wrappedSearchPage(site));
await writePage("/admin/wrapped/", adminWrappedPage(site));
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
await writePage("/state-picks/", statePicksPage(site, statePicksField));
await writePage("/awards/2026/", yearlyAwardsHubPage(site, yearlyAwardsPool));
// Category pages are rendered by api/pages/awards-2026.js (live share
// tags per finalist and the winner; 2026-11-10), so they are not written here.
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
// /athletes/{slug}/ is server-rendered now (api/pages/athlete.js, WO-09);
// the 200 static seed pages are no longer written, since a static file
// would win over the rewrite on Vercel.
await writePage("/search/", searchPage(site));
// Weekly awards paused for the season (2026-11-09); set to false to bring
// the full Athlete/Team of the Week pages back.
const WEEKLY_AWARDS_PAUSED = true;
await writePage("/athlete-of-the-week/", WEEKLY_AWARDS_PAUSED ? weeklyAwardsPausedPage(site, "athlete") : athleteOfTheWeekPage(site));
await writePage("/team-of-the-week/", WEEKLY_AWARDS_PAUSED ? weeklyAwardsPausedPage(site, "team") : teamOfTheWeekPage(site));
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
  // State time-basis files for /mock-postseason/real/ (2026-11-01): one
  // small JSON per basis and division, loaded on demand by the State
  // tab's buttons. Written straight to dist (not through writeFile) so
  // they are not counted or listed as pages.
  // Regional card bodies and State sections for both hub pages, loaded on
  // demand (site fixes F): same idea as the basis files below.
  for (const file of [...mockPostseasonPartFiles(), ...mockPostseasonStateBasisFiles()]) {
    const target = path.join(dist, file.path);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, "utf8");
  }
  // /rankings/leaders/ is rendered on the server (api/pages/leaders.js).
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
    await writePage(ranking.href, rankingDetailPage(ranking, publicStories));
    if (ranking.updatedDate) pathLastmod.set(ranking.href, ranking.updatedDate);
  }

  await writePage("/athlete-spotlights/", athletePage(publicStories));
  await writePage("/interviews/", interviewsPage(publicStories));
  await writePage("/about/", await aboutPage());
  await writePage("/staff/", staffPage(stories));
  // /sponsors/ and /commitments/YYYY/ are server-rendered (api/pages/);
  // they are added to the sitemap below instead of written here.
  await writePage("/contact/", contactPage());
  await writeFile("404.html", stampCacheBustedAssetUrls(notFoundPage()));

  const searchIndex = [
    { type: "Page", title: "Home", subtitle: site.description, href: "/", searchText: "Ohio cross country track running home" },
    { type: "Page", title: "Rankings", subtitle: "Ohio cross country and track rankings", href: "/rankings/", searchText: "rankings boys girls divisions cross country track field" },
    { type: "Page", title: "2026 Athlete, Team and Coach of the Year", subtitle: "Nominate and vote for the 2026 Ohio cross country Athletes, Teams and Coaches of the Year", href: "/awards/2026/", searchText: "athlete of the year team of the year coach of the year awards nominate vote 2026" },
    { type: "Page", title: "State Meet Picks", subtitle: "Pick all 8 state cross country team champions", href: "/state-picks/", searchText: "state meet picks predict champions contest obetz" },
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
    { type: "Page", title: "Writer Portal", subtitle: "Intern writer accounts: sign in, dashboard, profile, and staff writer management", href: "/writer-portal/", searchText: "writer portal login intern account article draft submitted review editor" },
    { type: "Page", title: "Ohio Tournament Hub", subtitle: "Boys cross country divisions and track regional sites", href: "/tournament-hub/", searchText: "OHSAA divisions regional sites representation tournament boys cross country track" },
    { type: "Page", title: "Athlete Spotlights", subtitle: "The story behind the result", href: "/athlete-spotlights/", searchText: "athletes profiles interviews stories" },
    { type: "Page", title: "College Commitments", subtitle: "Ohio cross country and track athletes committed to run in college", href: "/commitments/2027/", searchText: "commitments committed college signing recruiting class of 2027 2028" },
    { type: "Page", title: "Stories", subtitle: "Podium Watch articles and coverage", href: "/stories/", searchText: "articles news stories coverage" },
    ...stories.filter((story) => !isRankingDuplicate(story)).map((story) => ({ type: "Story", title: story.title, subtitle: `${story.category} | ${story.description}`, href: `/stories/${story.slug}/`, searchText: `${story.title} ${story.description} ${story.category} ${(story.tags || []).join(" ")} ${story.author}` })),
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
  const SERVER_RENDERED_PATHS = ["/", "/sponsors/", "/rankings/leaders/", "/teams/", ...yearlyAwardsPool.categories.map((category) => `/awards/2026/${category.slug}/`), ...COMMITMENT_CLASSES.map((year) => `/commitments/${year}/`), ...allHubPaths(), "/front-page/"];
  const paths = [...generatedPaths, ...SERVER_RENDERED_PATHS]
    .filter((pathname) => !pathname.endsWith("404.html"))
    .filter((pathname) => !NOINDEX_NOFOLLOW_PREFIXES.some((prefix) => pathname.startsWith(prefix)))
    .filter((pathname) => !NOINDEX_FOLLOW_PREFIXES.some((prefix) => pathname.startsWith(prefix)))
    .filter((pathname) => !SITEMAP_EXACT_EXCLUDE.includes(pathname))
    .filter((pathname) => !isRealAthletePage(pathname))
    .filter((pathname) => !draftPaths.has(pathname))
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
