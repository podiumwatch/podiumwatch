import fs from "node:fs/promises";
import path from "node:path";
import { site } from "../src/config/site.mjs";
import sponsors from "../src/data/sponsors.json" with { type: "json" };
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

const root = process.cwd();
const dist = path.join(root, "dist");
const generatedPaths = new Set();

async function writeFile(relativePath, content) {
  const clean = relativePath.replace(/^\/+/, "");
  const target = path.join(dist, clean);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, "utf8");
  generatedPaths.add(`/${clean.replace(/index\.html$/, "").replace(/\\/g, "/")}`.replace(/\/+/g, "/"));
}

async function writePage(route, html) {
  const cleanRoute = route === "/" ? "" : route.replace(/^\/+|\/+$/g, "");
  await writeFile(path.join(cleanRoute, "index.html"), html);
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
      draft: data.draft === true,
      readingMinutes: readingTime(body),
      sourceFile: path.relative(root, filePath)
    };
    if (!story.draft) stories.push(story);
  }
  return stories.sort((a, b) => new Date(`${b.date}T12:00:00`) - new Date(`${a.date}T12:00:00`));
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
  const latestStories = stories.slice(0, 3);
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

  const content = `<section class="hero">
    <div class="container hero-grid">
      <div>
        <p class="eyebrow">Ohio high school running</p>
        <h1>The home of Ohio high school running.</h1>
        <p class="hero-text">Rankings, stories, interviews, and coverage of Ohio high school cross country and track and field.</p>
        <div class="hero-actions">
          <a class="button button-primary" href="/rankings/">View latest rankings</a>
          <a class="button button-outline" href="/stories/">Read latest stories</a>
        </div>
        <div class="hero-proof" aria-label="Coverage information">
          <div><strong>4</strong><span>Cross country divisions</span></div>
          <div><strong>5</strong><span>Track divisions</span></div>
          <div><strong>1</strong><span>Ohio running community</span></div>
        </div>
      </div>
      <div class="hero-logo-panel" aria-hidden="true">
        <img src="${site.logo}" width="520" height="520" alt="">
        <p>Rankings. Results. Stories.</p>
      </div>
    </div>
  </section>

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

  <section class="section section-paper" aria-labelledby="spotlight-title">
    <div class="container spotlight-panel">
      <div class="spotlight-copy"><p class="eyebrow">Athlete spotlights</p><h2 id="spotlight-title">The story behind the result.</h2><p>Podium Watch gives Ohio athletes a place to tell their story, share what drives them, and help the next generation of runners.</p><a class="button button-dark" href="/athlete-spotlights/">Explore athlete spotlights</a></div>
      <div class="spotlight-card"><blockquote>“The best performances are worth celebrating. The people behind them are worth knowing.”</blockquote><p>New athlete profiles will appear here as they are published.</p><a class="text-link" href="/athlete-spotlights/">See the spotlight section ${icon("arrow")}</a></div>
    </div>
  </section>

  <section class="section section-dark" aria-labelledby="latest-stories-title">
    <div class="container">
      <div class="section-heading"><div><p class="eyebrow">Latest stories</p><h2 id="latest-stories-title">More than a finish time.</h2></div><a class="text-link" href="/stories/">From the newsroom ${icon("arrow")}</a></div>
      <div class="stories-grid">${storyContent}</div>
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
  const content = `<article class="article-shell">
    <header class="article-hero"><div class="container article-hero-inner">${breadcrumb(crumbs)}<div class="article-meta"><span class="category">${escapeHtml(story.category)}</span><span>By ${escapeHtml(story.author)}</span><span>${formatDate(story.date)}</span>${story.updatedDate ? `<span>Updated ${formatDate(story.updatedDate)}</span>` : ""}<span>${story.readingMinutes} min read</span></div><h1>${escapeHtml(story.title)}</h1><p class="article-deck">${escapeHtml(story.description)}</p></div></header>
    ${story.featuredImage ? `<img class="article-feature-image" src="${story.featuredImage}" data-fallback="/images/stories/story_fallback.svg" alt="${escapeHtml(story.featuredImageAlt || "")}" width="1600" height="900">` : ""}
    <div class="article-layout"><div class="article-content">${story.html}</div>${sponsorBlock}<div class="article-actions" aria-label="Share this story"><button class="share-button" type="button" data-copy-link>Copy story link</button><a class="share-button" href="https://www.facebook.com/sharer/sharer.php?u=${shareUrl}" target="_blank" rel="noopener noreferrer">Share on Facebook</a><a class="share-button" href="https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}" target="_blank" rel="noopener noreferrer">Share on X</a></div>${navigation}${relatedBlock}</div>
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
  const content = `${pageHero({ eyebrow: `${sportName} rankings`, title: `Division ${division} ${gender}`, description: `Published Podium Watch ${sportName.toLowerCase()} rankings for Division ${division} ${gender.toLowerCase()}.`, compact: true })}
  <section class="section section-paper"><div class="container">${breadcrumb([{ label: "Home", href: "/" }, { label: "Rankings", href: "/rankings/" }, { label: sportName, href: `/rankings/${sportPath}/` }, { label: `Division ${division} ${gender}` }])}<div class="gender-tabs"><a href="/rankings/${sportPath}/boys/division-${division}/"${gender === "Boys" ? ' aria-current="page"' : ""}>Boys</a><a href="/rankings/${sportPath}/girls/division-${division}/"${gender === "Girls" ? ' aria-current="page"' : ""}>Girls</a></div><div class="division-grid${divisionCount === 5 ? " track-grid" : ""}">${Array.from({ length: divisionCount }, (_, index) => index + 1).map((number) => `<a class="division-card" href="/rankings/${sportPath}/${gender.toLowerCase()}/division-${number}/"><strong>Division ${number}</strong><span>${number === division ? "Current division" : `View Division ${number}`}</span></a>`).join("")}</div><div style="margin-top:34px">${matching.length ? `<div class="rankings-grid">${matching.map((ranking) => rankingCard(ranking)).join("")}</div>` : emptyState({ title: "No rankings published here yet", description: `The Division ${division} ${gender.toLowerCase()} page is ready. Add a matching CSV file to content/rankings and rebuild the site.`, actionLabel: `View ${otherGender.toLowerCase()} rankings`, actionHref: `/rankings/${sportPath}/${otherGender.toLowerCase()}/division-${division}/` })}</div></div></section>`;
  return { pathname, html: layout({ site, title: `Division ${division} ${gender} ${sportName} Rankings`, description: `Podium Watch Division ${division} ${gender.toLowerCase()} ${sportName.toLowerCase()} rankings.`, pathname, content }) };
}

function rankingDetailPage(ranking) {
  const pathname = ranking.href;
  const sportName = ranking.sportPath === "cross-country" ? "Cross Country" : "Track and Field";
  const crumbs = [{ label: "Home", href: "/" }, { label: "Rankings", href: "/rankings/" }, { label: sportName, href: `/rankings/${ranking.sportPath}/` }, { label: `${ranking.division} ${ranking.gender}`, href: `/rankings/${ranking.sportPath}/${ranking.genderPath}/division-${ranking.divisionNumber}/` }, { label: ranking.title }];
  const rows = ranking.rows.map((row) => `<article class="ranking-row"><div class="ranking-number">${escapeHtml(row.rank)}</div><div class="ranking-athlete"><strong>${escapeHtml(row.athlete)}</strong><span>${escapeHtml(row.school)}</span></div><div class="ranking-grade">${escapeHtml(row.grade || "")}</div><div class="ranking-mark"><strong>${escapeHtml(row.timeOrMark)}</strong><small>${escapeHtml(row.event)}</small></div>${row.rankingExplanation ? `<p class="ranking-explanation">${escapeHtml(row.rankingExplanation)}</p>` : ""}</article>`).join("");
  const content = `${pageHero({ eyebrow: `${ranking.sport} rankings`, title: ranking.title, description: ranking.subtitle || `${ranking.gender} ${ranking.division} rankings for the ${ranking.season} season.` })}
  <section class="section section-paper"><div class="container">${breadcrumb(crumbs)}<div class="ranking-detail-header"><div><p class="eyebrow">${escapeHtml(ranking.gender)} ${escapeHtml(ranking.division)}</p><h2>${escapeHtml(ranking.event)}</h2></div><p class="ranking-updated">Last updated ${formatDate(ranking.updatedDate)}</p></div><div class="info-card" style="margin-bottom:22px"><h3>How this ranking works</h3><p>Rankings are based on verified results and the Podium Watch ranking method. State championship performance receives the most weight, followed by the complete season resume and relevant track performances. Rankings may change when new verified results become available.</p></div><div class="ranking-list">${rows}</div><div class="article-actions"><a class="share-button" href="/stories/${ranking.slug}/">Read the full ranking story</a></div></div></section>`;
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
  const content = `${pageHero({ eyebrow: "Athlete spotlights", title: "The story behind the result.", description: "A home for Ohio athletes to share what drives them, what they have overcome, and what they want people to remember." })}<section class="section section-paper"><div class="container">${emptyState({ title: "Athlete spotlights are coming", description: "No athlete profiles are published yet, so this page does not display invented names or achievements. Published profiles will appear here automatically when the athlete content workflow is added.", actionLabel: "Read current stories", actionHref: "/stories/" })}</div></section>`;
  return layout({ site, title: "Athlete Spotlights", description: "Podium Watch athlete spotlights from Ohio high school cross country and track and field.", pathname: "/athlete-spotlights/", content });
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

  const stories = await loadStories();
  const rankings = await loadRankings();

  await writePage("/", homePage(stories, rankings));
  await writePage("/stories/", storiesIndexPage(stories));
  for (const story of stories) await writePage(`/stories/${story.slug}/`, storyPage(story, stories));
  for (const category of [...new Set(stories.map((story) => story.category))]) {
    const page = categoryPage(category, stories);
    await writePage(page.pathname, page.html);
  }

  await writePage("/rankings/", rankingsIndexPage());
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
  for (const ranking of rankings) await writePage(ranking.href, rankingDetailPage(ranking));

  await writePage("/athlete-spotlights/", athletePage());
  await writePage("/interviews/", interviewsPage());
  await writePage("/about/", await aboutPage());
  await writePage("/sponsors/", sponsorsPage());
  await writePage("/contact/", contactPage());
  await writeFile("404.html", notFoundPage());

  const paths = [...generatedPaths].filter((pathname) => !pathname.endsWith("404.html")).sort();
  const lastMod = stories[0]?.updatedDate || stories[0]?.date || new Date().toISOString().slice(0, 10);
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map((pathname) => `  <url><loc>${xmlEscape(absoluteUrl(site, pathname))}</loc><lastmod>${lastMod}</lastmod></url>`).join("\n")}\n</urlset>\n`;
  await writeFile("sitemap.xml", sitemap);
  await writeFile("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${site.siteUrl}/sitemap.xml\n`);
  const rssItems = stories.slice(0, 30).map((story) => `<item><title>${xmlEscape(story.title)}</title><link>${xmlEscape(absoluteUrl(site, `/stories/${story.slug}/`))}</link><guid>${xmlEscape(absoluteUrl(site, `/stories/${story.slug}/`))}</guid><pubDate>${new Date(`${story.date}T12:00:00Z`).toUTCString()}</pubDate><description>${xmlEscape(story.description)}</description><category>${xmlEscape(story.category)}</category></item>`).join("");
  await writeFile("rss.xml", `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${xmlEscape(site.name)}</title><link>${xmlEscape(site.siteUrl)}</link><description>${xmlEscape(site.description)}</description><language>en-us</language>${rssItems}</channel></rss>`);
  await writeFile("site-data.json", JSON.stringify({ generatedAt: new Date().toISOString(), stories: stories.map(({ html, body, ...story }) => story), rankings: rankings.map(({ rows, filePath, ...ranking }) => ({ ...ranking, count: rows.length })) }, null, 2));

  console.log(`Built ${paths.length} pages, ${stories.length} published stories, and ${rankings.length} ranking files.`);
}

build().catch((error) => {
  console.error(`\nBuild failed:\n${error.message}\n`);
  process.exit(1);
});