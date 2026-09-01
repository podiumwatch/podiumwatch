import { escapeHtml, formatDate, slugify } from "./content.mjs";
import { gtagScript } from "./analytics.mjs";

export function absoluteUrl(site, pathname = "/") {
  return new URL(pathname, site.siteUrl).toString();
}

function externalAttrs(link) {
  return link.external || /^https?:\/\//.test(link.href) ? ' target="_blank" rel="noopener noreferrer"' : "";
}

export function icon(name) {
  const icons = {
    instagram: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7Zm11.5 1.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/></svg>',
    youtube: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8ZM9.8 15.2V8.8l5.6 3.2-5.6 3.2Z"/></svg>',
    arrow: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M13.5 5 20 11.5 13.5 18l-1.4-1.4 4.1-4.1H4v-2h12.2l-4.1-4.1L13.5 5Z"/></svg>',
    search: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m20.7 19.3-4.1-4.1a7.5 7.5 0 1 0-1.4 1.4l4.1 4.1 1.4-1.4ZM5 10.5a5.5 5.5 0 1 1 11 0 5.5 5.5 0 0 1-11 0Z"/></svg>',
    calculator: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm0 2v4h12V4H6Zm0 6v2h3v-2H6Zm5 0v2h3v-2h-3Zm5 0v2h3v-2h-3ZM6 14v2h3v-2H6Zm5 0v2h3v-2h-3Zm5 0v2h3v-2h-3ZM6 18v2h3v-2H6Zm5 0v2h3v-2h-3Zm5 0v2h3v-2h-3Z"/></svg>',
    chevron: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 15.5 5 8.5l1.4-1.4L12 12.7l5.6-5.6L19 8.5Z"/></svg>',
    home: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3.2 2.5 11h2.3v9h5.6v-6h3.2v6h5.6v-9h2.3L12 3.2Z"/></svg>',
    results: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 3h8l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm7 1.5V8h3.5L13 4.5ZM8 13h8v1.6H8V13Zm0 3.4h8V18H8v-1.6ZM8 9h4v1.6H8V9Z"/></svg>',
    rankings: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 2 9.6 7.3 4 8.1l4.1 3.9L7 18l5-2.7 5 2.7-1.1-6 4.1-3.9-5.6-.8L12 2Z"/></svg>',
    meets: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M7 2v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7ZM5 10h14v10H5V10Zm2 3v2h2v-2H7Zm4 0v2h2v-2h-2Zm4 0v2h2v-2h-2Z"/></svg>',
    podium: '<svg aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="13" width="6" height="8"/><rect x="9" y="6" width="6" height="15"/><rect x="15" y="15" width="6" height="6"/></svg>'
  };
  return icons[name] || "";
}

// "Split Watch" in the main nav is a hover/click dropdown with
// two destinations -- a volunteer entering a race day code, and a coach
// who needs to get straight to their own team's Split Watch
// without re-signing-in every time (public/scripts/site.js resolves which
// team, if any, and only falls back to /team-login/ when actually
// signed out). The trigger keeps a real href to the join page so it
// degrades to a normal, working link if JS never runs -- the dropdown
// itself is a progressive enhancement over that, not a replacement for it.
// Lives in the header's utility cluster now (NAVIGATION_REBUILD_SPEC.md,
// 2026-08-21) rather than the content nav -- restyled as the green accent
// button the spec calls for, but its internal logic (the dropdown
// mechanism itself, the hover/click/coach-redirect behavior in site.js)
// is untouched from the version built 2026-08-21. See docs/DECISIONS.md.
//
// Real mobile confirmed problem (2026-08-28): Coach Sign In is a coach's
// actual, primary way into Split Watch, but it sat second, unstyled,
// below "Enter Race Day Code" -- reading like race-day-code entry was
// the only real path in. Coach Sign In now comes first, styled as the
// primary green action with its own supporting line; Enter Race Day
// Code is the clearly secondary outlined action underneath, still
// intact and still exactly the same /split-watch/join/ destination and
// data-nav-coach-link smart-redirect logic. data-nav-dropdown-sw marks
// this whole block so public/scripts/site.js can relocate it higher in
// the mobile drawer (near Meets) without touching its desktop position
// or its internal open/close and coach-redirect logic at all.
function splitWatchNavDropdown(active) {
  return `<div class="nav-dropdown nav-utility-sw" data-nav-dropdown data-nav-dropdown-sw>
    <a class="nav-dropdown-trigger" href="/split-watch/join/"${active ? ' aria-current="page"' : ""} aria-haspopup="true" aria-expanded="false" data-nav-dropdown-trigger>Split Watch</a>
    <div class="nav-dropdown-panel nav-dropdown-panel-sw" data-nav-dropdown-panel>
      <a class="nav-dropdown-sw-action nav-dropdown-sw-primary" href="/team-login/" data-nav-coach-link>
        <span class="nav-dropdown-sw-title">Coach Sign In</span>
        <span class="nav-dropdown-sw-sub">Open your races and live timing</span>
      </a>
      <a class="nav-dropdown-sw-action nav-dropdown-sw-secondary" href="/split-watch/join/">
        <span class="nav-dropdown-sw-title">Enter Race Day Code</span>
        <span class="nav-dropdown-sw-sub">Join a timing crew</span>
      </a>
    </div>
  </div>`;
}

// One shared component for every content-nav entry: "Home" (no `items`)
// renders as a plain link; everything else renders as a click-toggle
// dropdown (desktop: floating panel: mobile: in-flow accordion), all
// coordinated by the single generic data-nav-group-trigger handler in
// site.js so only one is ever open at a time. See
// NAVIGATION_REBUILD_SPEC.md and docs/DECISIONS.md, 2026-08-21.
function navGroup(link, currentPath) {
  if (!link.items) {
    const active = link.href === "/" ? currentPath === "/" : currentPath.startsWith(link.href);
    return `<a class="nav-top-link" href="${link.href}"${active ? ' aria-current="page"' : ""}>${escapeHtml(link.label)}</a>`;
  }
  const active = link.items.some((item) => currentPath.startsWith(item.href));
  const itemLinks = link.items.map((item) => {
    const itemActive = currentPath.startsWith(item.href);
    return `<a href="${item.href}"${itemActive ? ' aria-current="page"' : ""}>${escapeHtml(item.label)}</a>`;
  }).join("");
  // data-nav-group-name is a plain lowercase slug of the group's own
  // label ("meets", "rankings", ...) -- a stable hook site.js uses to
  // find the Meets group specifically, so it can relocate the Split
  // Watch dropdown to sit right after it on mobile (see
  // splitWatchNavDropdown()'s own comment above for why).
  return `<div class="nav-group" data-nav-group data-nav-group-name="${escapeHtml(slugify(link.label))}">
    <button class="nav-group-trigger" type="button"${active ? ' aria-current="page"' : ""} aria-haspopup="true" aria-expanded="false" data-nav-group-trigger>${escapeHtml(link.label)}<span class="nav-caret">${icon("chevron")}</span></button>
    <div class="nav-group-panel" data-nav-group-panel>${itemLinks}</div>
  </div>`;
}

export function header(site, currentPath = "/") {
  const navGroups = site.navigation.map((link) => navGroup(link, currentPath)).join("");
  const splitWatchActive = currentPath.startsWith("/split-watch/") || currentPath === "/team-login/";
  // Real, date-aware content, computed fresh in the browser every load
  // (public/scripts/ohio-today.js) -- never a single hardcoded season
  // message that goes stale the moment the calendar day moves past it.
  // This static fallback (shown until JS runs, and if it never does) is
  // deliberately evergreen -- no specific date, no LIVE claim -- so a
  // visitor never sees a wrong date or an unearned "live" badge either
  // way. data-ticker-live starts hidden; only PodiumOhioToday finding a
  // real live signal is allowed to unhide it.
  const ticker = `<div class="sports-ticker"><a class="container sports-ticker-inner" href="/meets/" data-ticker>
    <span class="ticker-live" data-ticker-live hidden>LIVE</span>
    <strong class="ticker-desktop-only" data-ticker-headline>OHIO RUNNING</strong>
    <span class="ticker-desktop-only" data-ticker-detail>Meets, results, and rankings across the state</span>
    <span class="ticker-desktop-only ticker-cta">View calendar ${icon("arrow")}</span>
    <span class="ticker-mobile-only" data-ticker-mobile>Ohio running &middot; Meets, results, and rankings</span>
  </a></div>`;
  return `${ticker}<header class="site-header" data-header>
  <div class="container nav-wrap">
    <a class="brand" href="/" aria-label="Podium Watch home">
      <img src="${site.logoMark}" width="48" height="48" alt="">
      <span><b>Podium</b><b>Watch</b></span>
    </a>
    <div class="nav-mobile-actions">
      <button class="nav-icon-button nav-mobile-search" type="button" aria-haspopup="dialog" aria-label="Search" data-search-open>${icon("search")}</button>
      <button class="menu-button" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Open navigation" data-menu-button>
        <span></span><span></span><span></span>
      </button>
    </div>
    <nav id="site-nav" class="site-nav" aria-label="Main navigation" data-site-nav data-open="false">
      ${navGroups}
      <div class="nav-utility">
        <button class="nav-icon-button nav-utility-search" type="button" aria-haspopup="dialog" aria-label="Search" data-search-open>${icon("search")}<span>Search</span></button>
        <a class="nav-utility-calc" href="/pace-calculator/">${icon("calculator")}<span>Pace Calculator</span></a>
        <span data-nav-dropdown-sw-anchor hidden></span>
        ${splitWatchNavDropdown(splitWatchActive)}
        <div class="nav-utility-social-row">
          <a class="nav-utility-watch" href="${site.youtubeUrl}" target="_blank" rel="noopener noreferrer">Watch</a>
          <a class="nav-utility-instagram" href="${site.instagramUrl}" target="_blank" rel="noopener noreferrer" aria-label="Instagram">${icon("instagram")}</a>
        </div>
      </div>
    </nav>
  </div>
  <div class="nav-overlay" data-nav-overlay></div>
  <dialog class="search-dialog" aria-labelledby="search-dialog-title" data-search-dialog>
    <div class="search-dialog-inner">
      <div class="search-dialog-heading"><div><p class="eyebrow">Search Podium Watch</p><h2 id="search-dialog-title">Find what you need.</h2></div><button class="search-dialog-close" type="button" aria-label="Close search" data-search-close>Close</button></div>
      <form class="global-search-form" action="/search/" method="get" role="search">
        <label class="search-field search-field-large"><span class="visually-hidden">Search Podium Watch</span>${icon("search")}<input type="search" name="q" placeholder="Athlete, school, team, meet, ranking, or story" autocomplete="off" data-search-dialog-input></label>
        <button class="button button-primary" type="submit">Search</button>
      </form>
      <p class="search-shortcut-note">Press Ctrl and K or the slash key to open search from anywhere.</p>
    </div>
  </dialog>
</header>`;
}

export function footer(site) {
  const groups = Object.entries(site.footerLinks).map(([heading, links]) => `<div class="footer-column"><strong>${escapeHtml(heading)}</strong>${links.map((link) => `<a href="${link.href}"${externalAttrs(link)}>${escapeHtml(link.label)}</a>`).join("")}</div>`).join("");
  return `<footer class="site-footer">
  <div class="container footer-grid">
    <div class="footer-brand">
      <img src="${site.logoLight || site.logo}" width="112" height="112" alt="Podium Watch">
      <p>Ohio high school running, all in one place.</p>
    </div>
    ${groups}
  </div>
  <div class="container footer-bottom">
    <span>© <span data-year></span> ${escapeHtml(site.copyrightText)}</span>
    <span>Independent Ohio high school running coverage.</span>
  </div>
</footer>`;
}

// Sports-utility-first, matching what a mobile visitor actually reaches
// for: Home, My Podium, Results, Rankings, Meets. Stories and Voting stay
// reachable from the main menu instead -- five destinations keeps every
// tap target comfortably above 44px on a 360px-wide screen. Each link's
// aria-current gets set by public/scripts/site.js (the dock is shared
// chrome, rendered once in layout(), with no per-page pathname passed in
// here). My Podium added 2026-08-28 -- see docs/MY_PODIUM_MASTER_BUILD_PLAN.md.
function mobileDock() {
  return `<nav class="mobile-dock" aria-label="Mobile quick navigation" data-mobile-dock>
    <a href="/" aria-label="Home" data-dock-path="/">${icon("home")}<b>Home</b></a>
    <a href="/my-podium/" aria-label="My Podium" data-dock-path="/my-podium/">${icon("podium")}<b>My Podium</b></a>
    <a href="/meets/?view=results" aria-label="Latest results" data-dock-path="/meets/?view=results">${icon("results")}<b>Results</b></a>
    <a href="/rankings/" aria-label="Rankings" data-dock-path="/rankings/">${icon("rankings")}<b>Rankings</b></a>
    <a href="/meets/" aria-label="Meets" data-dock-path="/meets/">${icon("meets")}<b>Meets</b></a>
  </nav>`;
}

export function breadcrumb(items) {
  return `<nav class="breadcrumbs" aria-label="Breadcrumb"><ol>${items.map((item, index) => `<li>${item.href && index !== items.length - 1 ? `<a href="${item.href}">${escapeHtml(item.label)}</a>` : `<span aria-current="page">${escapeHtml(item.label)}</span>`}</li>`).join("")}</ol></nav>`;
}

export function metadata({ site, title, description, pathname, image, canonicalUrl, type = "website", publishedTime, modifiedTime, jsonLd = [], robots = "index, follow" }) {
  const fullTitle = title === site.name ? title : `${title} | ${site.name}`;
  const canonical = canonicalUrl || absoluteUrl(site, pathname);
  const socialImage = absoluteUrl(site, image || site.defaultSocialImage);
  const articleMeta = type === "article" ? `${publishedTime ? `<meta property="article:published_time" content="${publishedTime}">` : ""}${modifiedTime ? `<meta property="article:modified_time" content="${modifiedTime}">` : ""}` : "";
  const scripts = (Array.isArray(jsonLd) ? jsonLd : [jsonLd]).filter(Boolean).map((data) => `<script type="application/ld+json">${JSON.stringify(data).replaceAll("<", "\\u003c")}</script>`).join("\n");
  return `<title>${escapeHtml(fullTitle)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="${escapeHtml(robots)}">
<link rel="canonical" href="${canonical}">
<meta property="og:site_name" content="${escapeHtml(site.name)}">
<meta property="og:type" content="${type}">
<meta property="og:title" content="${escapeHtml(fullTitle)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${socialImage}">
<meta property="og:image:alt" content="${escapeHtml(`${title} from ${site.name}`)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(fullTitle)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${socialImage}">
${articleMeta}
${scripts}`;
}

// chromeless: true skips the full site header/footer/mobile-dock entirely
// -- for a genuinely time-critical, full-focus tool screen (Live Race
// Mode) where the standard nav chrome is not just unnecessary but a real
// hazard: a fixed mobile bottom-tab bar sitting under a coach's thumb
// during frantic live-timing taps risks navigating away from a live race
// by accident. Every other page keeps the default (false) -- this is
// deliberately opt-in, not a new default.
export function layout({ site, title, description, pathname, content, image, canonicalUrl, type, publishedTime, modifiedTime, jsonLd, bodyClass = "", robots, chromeless = false, extraHead = "" }) {
  const privatePrefixes = [
    "/admin/",
    "/team-login/",
    "/team-dashboard/",
    "/team-editor/",
    "/team-schedule/",
    "/team-roster/",
    "/team-content/",
    "/team-insights/",
    "/split-watch/",
    "/team-home/",
    "/team-meet-center/",
    "/athlete-login/",
    "/athlete-home/",
    "/guardian-login/",
    "/guardian-home/",
    "/photographer-login/",
    "/photographer-dashboard/",
    "/follow/",
    "/my-podium-login/"
  ];
  const resolvedRobots = robots || (privatePrefixes.some((prefix) => pathname.startsWith(prefix)) ? "noindex, nofollow" : "index, follow");
  // Admin pages get their own stylesheet + shell script injected here,
  // in <head> (render-blocking), so the persistent sidebar is fully
  // styled on first paint -- no flash of unstyled chrome. Landing this
  // in layout() rather than per-page also means every admin page gets
  // it immediately, including ones not yet migrated to adminShell()
  // (src/lib/adminshell.mjs), which is what makes a page-at-a-time
  // rollout safe. See docs/DECISIONS.md, 2026-08-16.
  const isAdminRoute = pathname.startsWith("/admin/");
  const adminHead = isAdminRoute
    ? '\n<link rel="stylesheet" href="/styles/admin.css">\n<script src="/scripts/admin-shell.js" defer></script>'
    : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#090909">
${metadata({ site, title, description, pathname, image, canonicalUrl, type, publishedTime, modifiedTime, jsonLd, robots: resolvedRobots })}
<link rel="icon" href="/images/branding/favicon.ico" sizes="any">
<link rel="icon" href="/images/branding/favicon.png" type="image/png">
<link rel="apple-touch-icon" href="/images/branding/apple_touch_icon.png">
<link rel="stylesheet" href="/styles/main.css">${adminHead}
${gtagScript()}
<style>
/* [hidden] must always win the cascade, sitewide. main.css has no rule
   for this at all, and several page-specific style blocks set their own
   display property on an element that also gets toggled via the hidden
   property/attribute (same selector specificity as the browser's own
   built-in [hidden] { display: none } rule) -- since those page styles
   load after the UA stylesheet, the class rule was winning, so setting
   an element's hidden property to true had zero visual effect.
   Confirmed live: every published team's public profile page
   (teamprofile.mjs's .team-profile-live-strip, display: flex) showed an
   empty red bar between the header and Team Instagram section on every
   load, regardless of whether that team actually had a live race --
   team-profile.js's own liveStrip.hidden = races.length === 0 logic was
   already correct, the CSS just silently ignored it. Same bug class
   already found and fixed the same way in Live Race Mode and,
   separately, in admin.css -- this is the sitewide fix so it can't
   recur on any other public page either. */
[hidden] { display: none !important; }
</style>
<script src="/scripts/ohio-today.js" defer></script>
<script src="/scripts/site.js" defer></script>
<script>
  window.va = window.va || function () {
    (window.vaq = window.vaq || []).push(arguments);
  };
</script>
<script defer src="/_vercel/insights/script.js"></script>
<script>
  window.si = window.si || function () {
    (window.siq = window.siq || []).push(arguments);
  };
</script>
<script defer src="/_vercel/speed-insights/script.js"></script>${extraHead}
</head>
<body class="${bodyClass}">
<a class="skip-link" href="#main-content">Skip to main content</a>
${chromeless ? "" : header(site, pathname)}
<main id="main-content">${content}</main>
${chromeless ? "" : footer(site)}
${chromeless ? "" : mobileDock()}
</body>
</html>`;
}

// Three real, structured fallback images keyed off the story's own
// category field (never inferred/guessed) -- so a Cross Country piece
// without a featured photo shows a cross country-flavored card and a
// Track and Field piece shows a track-flavored one, instead of the same
// single generic wordmark card repeating across every empty slot.
export function storyFallbackImage(category) {
  const normalized = String(category || "").toLowerCase();
  if (normalized.includes("track")) return "/images/stories/story_fallback_track.svg";
  if (normalized.includes("cross country")) return "/images/stories/story_fallback_xc.svg";
  return "/images/stories/story_fallback.svg";
}

export function storyCard(story, { featured = false } = {}) {
  const fallback = storyFallbackImage(story.category);
  const image = story.featuredImage || fallback;
  return `<article class="story-card${featured ? " story-card-featured" : ""}" data-story-card data-category="${escapeHtml(story.category.toLowerCase())}" data-search="${escapeHtml(`${story.title} ${story.description} ${story.category} ${(story.tags || []).join(" ")}`.toLowerCase())}">
    <a class="story-card-image" href="/stories/${story.slug}/" aria-label="Read ${escapeHtml(story.title)}">
      <img src="${image}" data-fallback="${fallback}" alt="${escapeHtml(story.featuredImageAlt || "")}" loading="lazy" width="960" height="540">
    </a>
    <div class="story-card-body">
      <div class="story-meta"><span class="category">${escapeHtml(story.category)}</span><span>${formatDate(story.date)}</span><span>${story.readingMinutes} min read</span></div>
      <h3><a href="/stories/${story.slug}/">${escapeHtml(story.title)}</a></h3>
      <p>${escapeHtml(story.description)}</p>
      <a class="read-link" href="/stories/${story.slug}/">Read story ${icon("arrow")}</a>
    </div>
  </article>`;
}

export function rankingCard(ranking) {
  return `<article class="ranking-card">
    <p>${escapeHtml(ranking.sport)}</p>
    <h3>${escapeHtml(ranking.title)}</h3>
    <span>${escapeHtml(ranking.subtitle || `${ranking.gender} ${ranking.division}`)}</span>
    <small>Updated ${formatDate(ranking.updatedDate)}</small>
    <a href="${ranking.href}">View rankings ${icon("arrow")}</a>
  </article>`;
}

export function pageHero({ eyebrow, title, description, compact = false }) {
  return `<section class="page-hero${compact ? " page-hero-compact" : ""}"><div class="container"><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1>${escapeHtml(title)}</h1>${description ? `<p>${escapeHtml(description)}</p>` : ""}</div></section>`;
}

export function emptyState({ title, description, actionLabel, actionHref }) {
  return `<div class="empty-state"><div class="empty-state-mark">PW</div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p>${actionLabel ? `<a class="button button-primary" href="${actionHref}">${escapeHtml(actionLabel)}</a>` : ""}</div>`;
}

export function websiteJsonLd(site) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: site.name,
    url: site.siteUrl,
    description: site.description,
    publisher: { "@type": "Organization", name: site.name, logo: absoluteUrl(site, site.logo) },
    potentialAction: { "@type": "SearchAction", target: `${site.siteUrl}/search/?q={search_term_string}`, "query-input": "required name=search_term_string" }
  };
}

export function organizationJsonLd(site) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.name,
    url: site.siteUrl,
    logo: absoluteUrl(site, site.logo),
    sameAs: [site.instagramUrl, site.youtubeUrl]
  };
}

export function articleJsonLd(site, story) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: story.title,
    description: story.description,
    datePublished: story.date,
    dateModified: story.updatedDate || story.date,
    mainEntityOfPage: absoluteUrl(site, `/stories/${story.slug}/`),
    image: absoluteUrl(site, story.featuredImage || site.defaultSocialImage),
    author: { "@type": story.author === site.name ? "Organization" : "Person", name: story.author },
    publisher: { "@type": "Organization", name: site.name, logo: { "@type": "ImageObject", url: absoluteUrl(site, site.logo) } },
    articleSection: story.category,
    keywords: (story.tags || []).join(", ")
  };
}

export function breadcrumbsJsonLd(site, items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      item: absoluteUrl(site, item.href || "/")
    }))
  };
}

export function categorySlug(category) {
  return slugify(category);
}
