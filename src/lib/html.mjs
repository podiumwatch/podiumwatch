import { escapeHtml, formatDate, slugify } from "./content.mjs";

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
    search: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m20.7 19.3-4.1-4.1a7.5 7.5 0 1 0-1.4 1.4l4.1 4.1 1.4-1.4ZM5 10.5a5.5 5.5 0 1 1 11 0 5.5 5.5 0 0 1-11 0Z"/></svg>'
  };
  return icons[name] || "";
}

export function header(site, currentPath = "/") {
  const primaryLabels = new Set(["Home", "Rankings", "Meets", "Teams", "Ohio Schools", "Fan Poll", "Athletes", "Recruiting", "Stories"]);
  const navLinks = site.navigation.filter((link) => primaryLabels.has(link.label)).map((link) => {
    const active = link.href === "/" ? currentPath === "/" : currentPath.startsWith(link.href);
    return `<a href="${link.href}"${active ? ' aria-current="page"' : ""}>${escapeHtml(link.label)}</a>`;
  }).join("");
  return `<div class="sports-ticker"><div class="container sports-ticker-inner"><span class="ticker-live">LIVE</span><strong>OHIO XC SEASON</strong><span>Practice underway statewide</span><span>First meets August 22</span><a href="/meets/">View calendar ${icon("arrow")}</a></div></div><header class="site-header" data-header>
  <div class="container nav-wrap">
    <a class="brand" href="/" aria-label="Podium Watch home">
      <img src="${site.logoMark}" width="48" height="48" alt="">
      <span><b>Podium</b><b>Watch</b></span>
    </a>
    <button class="menu-button" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Open navigation" data-menu-button>
      <span></span><span></span><span></span>
    </button>
    <nav id="site-nav" class="site-nav" aria-label="Main navigation" data-site-nav data-open="false">
      ${navLinks}
      <button class="nav-search-button" type="button" aria-haspopup="dialog" data-search-open>${icon("search")}<span>Search</span></button>
      <a class="nav-watch" href="${site.youtubeUrl}" target="_blank" rel="noopener noreferrer">Watch</a>
      <a class="nav-instagram" href="${site.instagramUrl}" target="_blank" rel="noopener noreferrer">Instagram</a>
    </nav>
  </div>
  <div class="section-nav"><div class="container"><strong>Explore</strong><a href="/rankings/cross-country/">Boys XC</a><a href="/rankings/cross-country/">Girls XC</a><a href="/rankings/track-and-field/">Track and Field</a><a href="/fan-poll/">Fan Poll</a><a href="/tournament-hub/">Tournament Hub</a><a href="/athlete-of-the-week/">Athlete of the Week</a><a href="/team-of-the-week/">Team of the Week</a><a href="/about/">About</a></div></div>
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

function mobileDock() {
  return `<nav class="mobile-dock" aria-label="Mobile quick navigation">
    <a href="/" aria-label="Home"><span aria-hidden="true">⌂</span><b>Home</b></a>
    <a href="/rankings/" aria-label="Rankings"><span aria-hidden="true">★</span><b>Rankings</b></a>
    <a href="/meets/" aria-label="Meets and results"><span aria-hidden="true">▦</span><b>Meets</b></a>
    <a href="/stories/" aria-label="Latest stories"><span aria-hidden="true">▤</span><b>Stories</b></a>
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

export function layout({ site, title, description, pathname, content, image, canonicalUrl, type, publishedTime, modifiedTime, jsonLd, bodyClass = "", robots }) {
  const privatePrefixes = [
    "/admin/",
    "/team-login/",
    "/team-dashboard/",
    "/team-editor/",
    "/team-schedule/",
    "/team-roster/",
    "/team-content/",
    "/team-insights/",
    "/follow/"
  ];
  const resolvedRobots = robots || (privatePrefixes.some((prefix) => pathname.startsWith(prefix)) ? "noindex, nofollow" : "index, follow");
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
<link rel="stylesheet" href="/styles/main.css">
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
<script defer src="/_vercel/speed-insights/script.js"></script>
</head>
<body class="${bodyClass}">
<a class="skip-link" href="#main-content">Skip to main content</a>
${header(site, pathname)}
<main id="main-content">${content}</main>
${footer(site)}
${mobileDock()}
</body>
</html>`;
}

export function storyCard(story, { featured = false } = {}) {
  const image = story.featuredImage || "/images/stories/story_fallback.svg";
  return `<article class="story-card${featured ? " story-card-featured" : ""}" data-story-card data-category="${escapeHtml(story.category.toLowerCase())}" data-search="${escapeHtml(`${story.title} ${story.description} ${story.category} ${(story.tags || []).join(" ")}`.toLowerCase())}">
    <a class="story-card-image" href="/stories/${story.slug}/" aria-label="Read ${escapeHtml(story.title)}">
      <img src="${image}" data-fallback="/images/stories/story_fallback.svg" alt="${escapeHtml(story.featuredImageAlt || "")}" loading="lazy" width="960" height="540">
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
