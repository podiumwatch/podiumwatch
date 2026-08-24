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
import { teamInsightsPage } from "../src/pages/teaminsights.mjs";
import { privacyPage } from "../src/pages/privacy.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import { site } from "../src/config/site.mjs";
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
  storyCard,
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
import { tournamentHubPage } from "../src/pages/tournamenthub.mjs";
import { ohioSchoolsPage } from "../src/pages/ohioschools.mjs";
import { claimTeamPage } from "../src/pages/claimteam.mjs";
import { submitResultsPage } from "../src/pages/submitresults.mjs";
import { rankingMethodologyPage } from "../src/pages/rankingmethodology.mjs";
import { athletesPage } from "../src/pages/athletes.mjs";
import { athleteDetailPage } from "../src/pages/athletedetail.mjs";
import { adminAthletesPage } from "../src/pages/adminathletes.mjs";
import { adminRecruitingPage } from "../src/pages/adminrecruiting.mjs";
import { adminResultsSourcesPage } from "../src/pages/adminresultssources.mjs";
import { adminTeamInstagramPage } from "../src/pages/adminteaminstagram.mjs";
import { adminFanPollPage } from "../src/pages/adminfanpoll.mjs";
import { adminPathToStatePage } from "../src/pages/adminpathtostate.mjs";
import { fanPollDivisionPage, fanPollIndexPage } from "../src/pages/fanpoll.mjs";
import { paceCalculatorPage } from "../src/pages/pacecalculator.mjs";
import { splitsCalculatorPage } from "../src/pages/splitscalculator.mjs";
import { scoringCalculatorPage } from "../src/pages/scoringcalculator.mjs";
import { recruitingPage } from "../src/pages/recruiting.mjs";
import { recruitingTop100Page } from "../src/pages/recruitingtop100.mjs";
import { recruitingMethodologyPage } from "../src/pages/recruitingmethodology.mjs";

const root = process.cwd();
const dist = path.join(root, "dist");
const generatedPaths = new Set();
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
// (gender + division number), for the homepage Power Rankings widget and
// the /rankings/cross-country/ division pages, both purely by lookup.
const DIVISION_ROMAN = ["I", "II", "III", "IV"];
const preseasonClassifications = Object.values(preseasonInteractiveData.classifications || {});

function preseasonClassificationFor(genderLower, divisionNumber) {
  return preseasonClassifications.find(
    (item) => item.gender.toLowerCase() === genderLower && item.division === divisionNumber
  ) || null;
}

function preseasonArticleHref(classification) {
  return `/stories/${classification.articleSlug}/`;
}

// Top N ranked teams (never an honorable-mention row) for one
// gender/division, in the [team, label, href] shape the homepage Power
// Rankings widget already renders.
function preseasonPowerRows(genderLower, divisionNumber, count = 4) {
  const classification = preseasonClassificationFor(genderLower, divisionNumber);
  if (!classification) return [];
  const href = preseasonArticleHref(classification);
  const label = `Division ${DIVISION_ROMAN[divisionNumber - 1]} ${classification.gender}`;
  return classification.raceBoard
    .filter((row) => row.status === "ranked")
    .slice(0, count)
    .map((row) => [row.team, label, href]);
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
      sourceFile: path.relative(root, filePath)
    };
    if (!story.draft) stories.push(story);
  }
  return stories.sort((a, b) => {
    if (a.pinnedRank !== null || b.pinnedRank !== null) {
      if (a.pinnedRank === null) return 1;
      if (b.pinnedRank === null) return -1;
      if (a.pinnedRank !== b.pinnedRank) return a.pinnedRank - b.pinnedRank;
    }
    return new Date(`${b.date}T12:00:00`) - new Date(`${a.date}T12:00:00`);
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
  const featuredStory = stories.find((story) => story.featured) || stories[0];
  // Exclude the hero story from "Latest Stories" below it -- without this,
  // whenever the featured story is also among the most recent (the normal
  // case), it silently appeared twice on the homepage: once as the big
  // lead, again as the first card in the grid underneath.
  const latestStories = stories.filter((story) => story.slug !== featuredStory?.slug).slice(0, 3);
  const rankingCards = rankings.slice(0, 3).map((ranking) => rankingCard(ranking)).join("");
  const rankingsContent = rankingCards || emptyState({
    title: "Rankings are being prepared",
    description: "The rankings pages are ready. Publish a ranking CSV file to make it appear here.",
    actionLabel: "Browse rankings",
    actionHref: "/rankings/"
  });
  const storyContent = latestStories.length ? latestStories.map((story, index) => storyCard(story, { featured: index === 0 })).join("") : emptyState({
    title: "Stories are coming soon",
    description: "Add a Markdown file to content/stories and redeploy the site.",
    actionLabel: "Open stories",
    actionHref: "/stories/"
  });
  // A second, separate "Latest stories" section further down the
  // homepage ("More than a finish time") used to render this exact same
  // storyContent a second time -- the identical 3 cards, under a
  // different heading, a few sections later on the same page. A real,
  // pre-existing bug (confirmed directly: 6 links to the same story, not
  // 3, on a single homepage load) that just hadn't been reported before.
  // This section now shows the NEXT 3 stories instead, so it's actually
  // additional coverage rather than a repeat of what a visitor already
  // scrolled past.
  const moreStories = stories.filter((story) => story.slug !== featuredStory?.slug).slice(3, 6);
  const moreStoryContent = moreStories.length ? moreStories.map((story) => storyCard(story)).join("") : storyContent;

  const leadTitle = featuredStory?.title || "The teams and runners set to define Ohio cross country";
  const leadDescription = featuredStory?.description || "Rankings, results, and the stories shaping the road to state.";
  const leadHref = featuredStory ? `/stories/${featuredStory.slug}/` : "/rankings/";
  const leadImage = featuredStory?.featuredImage || "/images/social/podium_watch_default_social.png";
  // Real 2026 preseason Race Board data (top 4 ranked teams per
  // classification), not placeholder rows -- see the preseasonPowerRows
  // helper above and docs/DECISIONS.md, 2026-08-24. Every row links
  // straight to its own preseason article rather than the generic
  // /rankings/cross-country/ landing page, since that article is now the
  // actual source of the numbers being shown.
  const powerRankingData = {
    boys: {
      1: preseasonPowerRows("boys", 1),
      2: preseasonPowerRows("boys", 2),
      3: preseasonPowerRows("boys", 3),
      4: preseasonPowerRows("boys", 4)
    },
    girls: {
      1: preseasonPowerRows("girls", 1),
      2: preseasonPowerRows("girls", 2),
      3: preseasonPowerRows("girls", 3),
      4: preseasonPowerRows("girls", 4)
    }
  };
  const initialPowerRows = powerRankingData.boys[1].map(([team, label, href], index) => `<a class="power-row" href="${escapeHtml(href)}"><b>${index + 1}</b><span><strong>${escapeHtml(team)}</strong><small>${escapeHtml(label)}</small></span></a>`).join("");
  const content = `<section class="sports-home"><div class="container sports-home-grid">
    <aside class="home-quick"><h2>Quick Links</h2><a href="/rankings/"><span>01</span>State Rankings</a><a href="/meets/"><span>02</span>Meet Calendar</a><a href="/meets/"><span>03</span>Latest Results</a><a href="/athletes/"><span>04</span>Athlete Profiles</a><a href="/recruiting/"><span>05</span>Recruiting Hub</a><div class="home-newsletter"><p class="eyebrow">The Morning Lap</p><h3>Ohio running in your inbox.</h3><p>Rankings, results, and stories from across the state.</p><a href="/follow/">Join the Fleet</a></div></aside>
    <div class="home-main"><article class="home-lead"><a class="home-lead-image" href="${leadHref}"><img src="${leadImage}" alt="" width="1000" height="560"><span>2026 XC Preview</span></a><div><p class="eyebrow">Podium Watch Coverage</p><h1><a href="${leadHref}">${escapeHtml(leadTitle)}</a></h1><p>${escapeHtml(leadDescription)}</p><a class="text-link" href="${leadHref}">Read the full story ${icon("arrow")}</a></div></article><div class="home-section-title"><h2>Latest Stories</h2><a href="/stories/">View all ${icon("arrow")}</a></div><div class="stories-grid">${storyContent}</div></div>
    <aside class="home-right"><section class="home-panel power-panel"><div class="home-panel-title"><h2>Power Rankings</h2><span>Updated</span></div><div class="power-tabs" role="group" aria-label="Choose rankings gender"><button class="active" type="button" data-power-gender="boys">Boys</button><button type="button" data-power-gender="girls">Girls</button></div><label class="power-select-label"><span class="visually-hidden">Choose division</span><select data-power-division><option value="1">Division I</option><option value="2">Division II</option><option value="3">Division III</option><option value="4">Division IV</option></select></label><div class="power-list" data-power-list>${initialPowerRows}</div><a class="home-panel-link" href="/rankings/">See full rankings ${icon("arrow")}</a><script type="application/json" data-power-data>${JSON.stringify(powerRankingData).replaceAll("<", "\\u003c")}</script><script>(()=>{const panel=document.currentScript.closest('.power-panel');if(!panel)return;const data=JSON.parse(panel.querySelector('[data-power-data]').textContent);const list=panel.querySelector('[data-power-list]');const select=panel.querySelector('[data-power-division]');let gender='boys';const draw=()=>{list.innerHTML=data[gender][select.value].map((row,i)=>'<a class="power-row" href="'+row[2]+'"><b>'+(i+1)+'</b><span><strong>'+row[0]+'</strong><small>'+row[1]+'</small></span></a>').join('')};panel.querySelectorAll('[data-power-gender]').forEach(button=>button.addEventListener('click',()=>{gender=button.dataset.powerGender;panel.querySelectorAll('[data-power-gender]').forEach(item=>item.classList.toggle('active',item===button));draw()}));select.addEventListener('change',draw)})();</script></section><section class="home-panel"><div class="home-panel-title"><h2>Upcoming Meets</h2></div><a class="home-meet" href="/meets/"><b>AUG 22</b><span><strong>OHSAA Early Season Invitational</strong><small>Obetz, Ohio</small></span></a><a class="home-meet" href="/meets/"><b>AUG 25</b><span><strong>Shelby County Preview</strong><small>Russia, Ohio</small></span></a><a class="home-meet" href="/meets/"><b>AUG 29</b><span><strong>Pickerington North Classic</strong><small>Pickerington, Ohio</small></span></a><a class="home-panel-link" href="/meets/">Full meet calendar ${icon("arrow")}</a></section></aside>
  </div></section>

  <section class="section" aria-labelledby="latest-rankings-title">
    <div class="container">
      <div class="section-heading">
        <div><p class="eyebrow">Latest rankings</p><h2 id="latest-rankings-title">Who is rising in Ohio?</h2></div>
        <a class="text-link" href="/rankings/">View all rankings ${icon("arrow")}</a>
      </div>
      <div class="rankings-grid">${rankingsContent}
        <article class="ranking-card"><p>Cross Country</p><h3>Browse every division</h3><span>Boys and girls, Divisions 1 through 4</span><a href="/rankings/cross-country/">Explore cross country ${icon("arrow")}</a></article>
        <article class="ranking-card"><p>Track and Field</p><h3>Browse every event</h3><span>Boys and girls, Divisions 1 through 5</span><a href="/rankings/track-and-field/">Explore track ${icon("arrow")}</a></article>
      </div>
    </div>
  </section>

  <section class="section" aria-labelledby="trust-title">
    <div class="container">
      <div class="section-heading"><div><p class="eyebrow">Clear and trustworthy</p><h2 id="trust-title">Know what the information means.</h2></div><a class="text-link" href="/rankings/methodology/">Read the ranking method ${icon("arrow")}</a></div>
      <div class="trust-strip">
        <article><h3>Verified facts</h3><p>Results, divisions, dates, and assignments are labeled and tied to supplied or official sources when available.</p></article>
        <article><h3>Editorial projections</h3><p>Podium Watch rankings are clearly separated from official results and explained as analysis.</p></article>
        <article><h3>Corrections welcome</h3><p>Readers can report factual corrections with a source so pages stay useful and current.</p></article>
      </div>
    </div>
  </section>

  <section class="section section-paper" aria-labelledby="spotlight-title">
    <div class="container spotlight-panel">
      <div class="spotlight-copy"><p class="eyebrow">Athlete spotlights</p><h2 id="spotlight-title">The story behind the result.</h2><p>Podium Watch gives Ohio athletes a place to tell their story, share what drives them, and help the next generation of runners.</p><a class="button button-dark" href="/athlete-spotlights/">Explore athlete spotlights</a></div>
      <div class="spotlight-card"><blockquote>"The best performances are worth celebrating. The people behind them are worth knowing."</blockquote><p>New athlete profiles will appear here as they are published.</p><a class="text-link" href="/athlete-spotlights/">See the spotlight section ${icon("arrow")}</a></div>
    </div>
  </section>

  <section class="section section-dark" aria-labelledby="latest-stories-title">
    <div class="container">
      <div class="section-heading"><div><p class="eyebrow">Latest stories</p><h2 id="latest-stories-title">More than a finish time.</h2></div><a class="text-link" href="/stories/">From the newsroom ${icon("arrow")}</a></div>
      <div class="stories-grid">${moreStoryContent}</div>
    </div>
  </section>

  <section class="section" aria-labelledby="sports-title">
    <div class="container">
      <div class="section-heading"><div><p class="eyebrow">Coverage</p><h2 id="sports-title">Choose your sport.</h2></div></div>
      <div class="sport-cards">
        <article class="sport-card"><p class="eyebrow">Cross country</p><h3>Every mile matters.</h3><p>Individual rankings, team rankings, season previews, meet stories, and the road to the state championship.</p><a class="button button-primary" href="/rankings/cross-country/">Explore cross country</a></article>
        <article class="sport-card track"><p class="eyebrow">Track and field</p><h3>Every event. Every division.</h3><p>Sprints, distance, hurdles, relays, jumps, and throws across all five Ohio divisions.</p><a class="button button-primary" href="/rankings/track-and-field/">Explore track and field</a></article>
      </div>
    </div>
  </section>

  <section class="social-band"><div class="container social-grid"><div><p class="eyebrow">Follow the coverage</p><h2>@podiumwatch</h2><p>Daily Ohio cross country and track coverage, rankings, interviews, and athlete stories.</p></div><div class="social-actions"><a class="button button-dark" href="${site.instagramUrl}" target="_blank" rel="noopener noreferrer">${icon("instagram")} Follow on Instagram</a><a class="button button-outline" href="${site.youtubeUrl}" target="_blank" rel="noopener noreferrer">${icon("youtube")} Subscribe on YouTube</a></div></div></section>

  <section class="section section-paper" aria-labelledby="about-preview-title"><div class="container content-grid"><div><p class="eyebrow">About Podium Watch</p><h2 id="about-preview-title">Built for Ohio runners.</h2></div><div><p>Podium Watch covers Ohio high school cross country and track and field through rankings, stories, interviews, and meet coverage. The goal is to give athletes, teams, coaches, families, and fans one place to follow the sport and celebrate the people who make it special.</p><a class="button button-dark" href="/about/">Learn more</a></div></div></section>

  <section class="sponsor-band"><div class="container sponsor-grid"><div><p class="eyebrow">Sponsors and advertising</p><h2>Put your brand in front of Ohio's running community.</h2></div><a class="button button-primary" href="/sponsors/">Sponsor Podium Watch</a></div></section>`;

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

function storiesIndexPage(stories) {
  const featured = stories.find((story) => story.featured) || stories[0];
  const categories = [...new Set(stories.map((story) => story.category))].sort();
  const cards = stories.map((story) => storyCard(story, { featured: story.slug === featured?.slug })).join("");
  const content = `${pageHero({ eyebrow: "Podium Watch stories", title: "Stories from Ohio running.", description: "Rankings, athlete features, interviews, meet coverage, and the stories behind the performances." })}
  <section class="section section-paper"><div class="container">
    <div class="story-toolbar">
      <label class="search-field"><span class="visually-hidden">Search stories</span>${icon("search")}<input type="search" placeholder="Search stories, athletes, schools, or tags" data-story-search></label>
      <label><span class="visually-hidden">Filter by category</span><select class="category-filter" data-category-filter><option value="all">All categories</option>${categories.map((category) => `<option value="${escapeHtml(category.toLowerCase())}">${escapeHtml(category)}</option>`).join("")}</select></label>
    </div>
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

function storyPage(story, stories) {
  const storyIndex = stories.findIndex((item) => item.slug === story.slug);
  const newer = storyIndex > 0 ? stories[storyIndex - 1] : null;
  const older = storyIndex < stories.length - 1 ? stories[storyIndex + 1] : null;
  const related = stories.filter((item) => item.slug !== story.slug && (item.category === story.category || item.tags.some((tag) => story.tags.includes(tag)))).slice(0, 3);
  const pathname = `/stories/${story.slug}/`;
  const crumbs = [{ label: "Home", href: "/" }, { label: "Stories", href: "/stories/" }, { label: story.title, href: pathname }];
  const sponsor = story.sponsor ? sponsors.find((item) => item.id === story.sponsor) : null;
  const sponsorBlock = sponsor ? `<aside class="info-card" aria-label="Story sponsor"><p class="eyebrow">Story sponsor</p><h3>${escapeHtml(sponsor.name)}</h3>${sponsor.description ? `<p>${escapeHtml(sponsor.description)}</p>` : ""}<a class="button button-dark" href="${sponsor.url}" target="_blank" rel="noopener noreferrer">Visit sponsor</a></aside>` : "";
  const relatedBlock = related.length ? `<section class="related-section" aria-labelledby="related-title"><p class="eyebrow">Keep reading</p><h2 id="related-title">Related stories</h2><div class="stories-grid">${related.map((item) => storyCard(item)).join("")}</div></section>` : "";
  const navigation = newer || older ? `<nav class="story-nav" aria-label="Story navigation">${newer ? `<a href="/stories/${newer.slug}/"><span>Newer story</span><strong>${escapeHtml(newer.title)}</strong></a>` : "<span></span>"}${older ? `<a href="/stories/${older.slug}/"><span>Older story</span><strong>${escapeHtml(older.title)}</strong></a>` : ""}</nav>` : "";
  const shareText = encodeURIComponent(story.title);
  const shareUrl = encodeURIComponent(absoluteUrl(site, pathname));

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
  const articleShellAttrs = preseasonClassification
    ? ` class="article-shell pw-preseason-article" style="--pw-accent:${escapeHtml(preseasonClassification.accent)}" data-pw-article="${escapeHtml(story.slug)}"`
    : ` class="article-shell"`;
  const preseasonStickyNav = preseasonClassification
    ? `<nav class="pw-stickynav" aria-label="Article sections"><div class="pw-stickynav-inner">
        <a href="#race-board">Race Board</a>
        <a href="#race-build">Race Build</a>
        <a href="#fifth-runner">Fifth Runner</a>
        <a href="#depth">Depth</a>
        <a href="#honorable-mentions">Honorable Mentions</a>
        <a href="#reader-picks">Reader Picks</a>
      </div></nav>`
    : "";
  const preseasonDataScript = preseasonClassification
    ? `<script type="application/json" id="pw-preseason-data">${JSON.stringify(preseasonClassification).replaceAll("<", "\\u003c")}</script><script src="/scripts/preseason-article.js" defer></script>`
    : "";

  const content = `<article${articleShellAttrs}>
    <header class="article-hero"><div class="container article-hero-inner">${breadcrumb(crumbs)}<div class="article-meta"><span class="category">${escapeHtml(story.category)}</span><span>By ${escapeHtml(story.author)}</span><span>${formatDate(story.date)}</span>${story.updatedDate ? `<span>Updated ${formatDate(story.updatedDate)}</span>` : ""}<span>${story.readingMinutes} min read</span></div><h1>${escapeHtml(story.title)}</h1><p class="article-deck">${escapeHtml(story.description)}</p></div></header>
    ${preseasonStickyNav}
    ${story.featuredImage ? `<img class="article-feature-image" src="${story.featuredImage}" data-fallback="/images/stories/story_fallback.svg" alt="${escapeHtml(story.featuredImageAlt || "")}" width="1600" height="900">` : ""}
    <div class="article-layout"><div class="article-content">${story.html}</div>${sponsorBlock}<div class="article-actions" aria-label="Share this story"><button class="share-button" type="button" data-copy-link>Copy story link</button><a class="share-button" href="https://www.facebook.com/sharer/sharer.php?u=${shareUrl}" target="_blank" rel="noopener noreferrer">Share on Facebook</a><a class="share-button" href="https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}" target="_blank" rel="noopener noreferrer">Share on X</a></div>${navigation}${relatedBlock}</div>
    ${preseasonDataScript}
  </article>`;
  return layout({
    site,
    title: story.title,
    description: story.description,
    pathname,
    image: story.featuredImage || site.defaultSocialImage,
    canonicalUrl: story.canonicalUrl,
    type: "article",
    publishedTime: story.date,
    modifiedTime: story.updatedDate || story.date,
    content,
    jsonLd: [articleJsonLd(site, story), breadcrumbsJsonLd(site, crumbs)]
  });
}

function rankingsIndexPage() {
  const content = `${pageHero({ eyebrow: "Podium Watch rankings", title: "Ohio rankings start here.", description: "Choose cross country or track and field, then select boys or girls and the division you want to follow." })}
  <section class="section section-paper"><div class="container"><div class="ranking-browser"><article class="ranking-browser-card"><p class="eyebrow">Four divisions</p><h2>Cross Country Rankings</h2><p>Individual and team rankings for boys and girls across Divisions 1 through 4.</p><a class="button button-primary" href="/rankings/cross-country/">Open cross country</a></article><article class="ranking-browser-card"><p class="eyebrow">Five divisions</p><h2>Track and Field Rankings</h2><p>Running events, relays, jumps, and throws for boys and girls across Divisions 1 through 5.</p><a class="button button-primary" href="/rankings/track-and-field/">Open track and field</a></article></div></div></section>`;
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
  const content = `${pageHero({ eyebrow: `${ranking.sport} rankings`, title: ranking.title, description: ranking.subtitle || `${ranking.gender} ${ranking.division} rankings for the ${ranking.season} season.` })}
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

function sponsorsPage() {
  const sponsorMarkup = sponsors.length ? `<div class="stories-grid">${sponsors.map((sponsor) => `<article class="story-card"><div class="story-card-body"><p class="eyebrow">${escapeHtml(sponsor.type || "Sponsor")}</p><h3>${escapeHtml(sponsor.name)}</h3>${sponsor.description ? `<p>${escapeHtml(sponsor.description)}</p>` : ""}<a class="button button-dark" href="${sponsor.url}" target="_blank" rel="noopener noreferrer">Visit sponsor</a></div></article>`).join("")}</div>` : emptyState({ title: "Sponsor opportunities are open", description: "No sponsors are displayed because no approved sponsor data was provided. Podium Watch can support presenting sponsors, ranking sponsors, story sponsors, interview sponsors, and homepage partners.", actionLabel: "Ask about sponsorship", actionHref: `mailto:${site.contactEmail}?subject=Podium%20Watch%20Sponsorship` });
  const content = `${pageHero({ eyebrow: "Sponsors and advertising", title: "Reach Ohio's running community.", description: "Build awareness with athletes, families, coaches, teams, and fans who care about Ohio high school cross country and track." })}<section class="section section-paper"><div class="container"><div class="content-grid" style="margin-bottom:38px"><div><p class="eyebrow">Partner with Podium Watch</p><h2>Flexible sponsor placements.</h2></div><div><p>Podium Watch is built to support professional sponsor placements without crowding the athlete coverage. Sponsor information is managed from one data file so a future partner can appear in the right places across the site.</p><a class="button button-dark" href="mailto:${site.contactEmail}?subject=Podium%20Watch%20Sponsorship">Start a conversation</a></div></div>${sponsorMarkup}</div></section>`;
  return layout({ site, title: "Sponsors and Advertising", description: "Podium Watch sponsorship and advertising opportunities for brands that want to reach Ohio's running community.", pathname: "/sponsors/", content });
}

function contactPage() {
  const content = `${pageHero({ eyebrow: "Contact", title: "Connect with Podium Watch.", description: "Send a correction, suggest an athlete or story, ask about an interview, or discuss a sponsorship." })}<section class="section section-paper"><div class="container"><div class="contact-cards"><article class="contact-card"><p class="eyebrow">Email</p><h2>Send a message</h2><p>Email is the main contact method for website questions, corrections, story ideas, and business inquiries.</p><a class="button button-dark" href="mailto:${site.contactEmail}">${escapeHtml(site.contactEmail)}</a></article><article class="contact-card"><p class="eyebrow">Social media</p><h2>Follow the coverage</h2><p>Use Instagram for daily posts and YouTube for interviews and longer video coverage.</p><div class="social-actions"><a class="button button-dark" href="${site.instagramUrl}" target="_blank" rel="noopener noreferrer">Instagram</a><a class="button button-outline" href="${site.youtubeUrl}" target="_blank" rel="noopener noreferrer">YouTube</a></div></article></div></div></section>`;
  return layout({ site, title: "Contact", description: "Contact Podium Watch about stories, corrections, interviews, rankings, sponsorships, and Ohio running coverage.", pathname: "/contact/", content });
}

function notFoundPage() {
  const content = `<section class="error-page"><div class="container"><strong>404</strong><h1>This page missed the turn.</h1><p>The page may have moved, the address may be incorrect, or the content may not be published yet.</p><div class="hero-actions" style="justify-content:center"><a class="button button-primary" href="/">Return home</a><a class="button button-outline" href="/stories/">Browse stories</a></div></div></section>`;
  return layout({ site, title: "Page Not Found", description: "The requested Podium Watch page could not be found.", pathname: "/404.html", content });
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

  await writePage("/", homePage(stories, rankings));
  await writePage("/stories/", storiesIndexPage(stories));
  for (const story of stories) await writePage(`/stories/${story.slug}/`, storyPage(story, stories));
  for (const category of [...new Set(stories.map((story) => story.category))]) {
    const page = categoryPage(category, stories);
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
// Photographer Network is temporarily UNPUBLISHED at the user's request
// (2026-08-20) -- not ready yet. Deliberately commented out, not
// deleted: every underlying file/service/API still exists untouched,
// this is the one-line-per-route flip to bring it back. The admin tool
// (/admin/photographers/, password-gated, never public) stays live so
// work can continue privately. See docs/DECISIONS.md for the fuller
// note, including the checkout kill switch in api/photographer/checkout.js.
// await writePage("/photographer-login/", photographerLoginPage(site));
// await writePage("/photographer-dashboard/", photographerDashboardPage(site));
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
await writePage("/privacy/", privacyPage(site));
await writePage("/team-editor/", teamEditorPage(site));
await writePage("/team/", teamProfilePage(site));
await writePage("/teams/", teamsPage(site));
// See the Photographer Network unpublish note above (~line 532).
// await writePage("/photographers/", photographersPage(site));
// await writePage("/photographers/profile/", photographerDetailPage(site));
// await writePage("/photographers/membership/", photographerMembershipPage(site));
await writePage("/ohio-schools/", ohioSchoolsPage(site));
await writePage("/claim-your-team/", claimTeamPage(site));
await writePage("/submit-results/", submitResultsPage(site));
await writePage("/athletes/", athletesPage(site));
await writePage("/recruiting/", recruitingPage(site));
await writePage("/recruiting/methodology/", recruitingMethodologyPage(site));
await writePage("/recruiting/top-100/boys/", recruitingTop100Page(site, { gender: "boys" }));
await writePage("/recruiting/top-100/girls/", recruitingTop100Page(site, { gender: "girls" }));
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
  await writePage("/tournament-hub/", tournamentHubPage(site));
  await writePage("/rankings/", rankingsIndexPage());
  await writePage("/rankings/methodology/", rankingMethodologyPage(site));
  await writePage("/rankings/cross-country/", sportIndexPage("Cross Country", "cross-country", 4));
  await writePage("/rankings/track-and-field/", sportIndexPage("Track and Field", "track-and-field", 5));
  for (const [sportName, sportPath, count] of [["Cross Country", "cross-country", 4], ["Track and Field", "track-and-field", 5]]) {
    for (const gender of ["Boys", "Girls"]) {
      for (let division = 1; division <= count; division += 1) {
        const page = divisionPage({ sportName, sportPath, division, divisionCount: count, gender, rankings });
        await writePage(page.pathname, page.html);
      }
    }
  }
  for (const ranking of rankings) await writePage(ranking.href, rankingDetailPage(ranking, stories));

  await writePage("/athlete-spotlights/", athletePage());
  await writePage("/interviews/", interviewsPage());
  await writePage("/about/", await aboutPage());
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

  const privateSitemapPrefixes = ["/admin/", "/team-login/", "/team-dashboard/", "/team-editor/", "/team-schedule/", "/team-roster/", "/team-content/", "/team-insights/", "/split-watch/", "/team-home/", "/team-meet-center/", "/athlete-login/", "/athlete-home/", "/guardian-login/", "/guardian-home/", "/photographer-login/", "/photographer-dashboard/", "/follow/"];
  const paths = [...generatedPaths].filter((pathname) => !pathname.endsWith("404.html") && !privateSitemapPrefixes.some((prefix) => pathname.startsWith(prefix))).sort();
  const lastMod = stories[0]?.updatedDate || stories[0]?.date || new Date().toISOString().slice(0, 10);
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map((pathname) => `  <url><loc>${xmlEscape(absoluteUrl(site, pathname))}</loc><lastmod>${lastMod}</lastmod></url>`).join("\n")}\n</urlset>\n`;
  await writeFile("sitemap.xml", sitemap);
  await writeFile("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${site.siteUrl}/sitemap.xml\n`);
  const rssItems = stories.slice(0, 30).map((story) => `<item><title>${xmlEscape(story.title)}</title><link>${xmlEscape(absoluteUrl(site, `/stories/${story.slug}/`))}</link><guid>${xmlEscape(absoluteUrl(site, `/stories/${story.slug}/`))}</guid><pubDate>${new Date(`${story.date}T12:00:00Z`).toUTCString()}</pubDate><description>${xmlEscape(story.description)}</description><category>${xmlEscape(story.category)}</category></item>`).join("");
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

  console.log(`Built ${paths.length} pages, ${stories.length} published stories, and ${rankings.length} ranking files.`);
}

build().catch((error) => {
  console.error(`\nBuild failed:\n${error.message}\n`);
  process.exit(1);
});
