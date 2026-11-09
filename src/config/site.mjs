// AdSense/indexing remediation (2026-09-15): siteUrl was the throwaway
// Vercel-assigned domain, not the real custom domain -- confirmed live
// (identical content-length and ETag on both podiumwatch.vercel.app and
// www.podiumwatch.site; the bare podiumwatch.site correctly 308-redirects
// to www.podiumwatch.site) that www.podiumwatch.site is the real,
// intended, working production domain. This one value drives every
// canonical tag, the sitemap, structured data, and robots.txt across the
// whole site (see absoluteUrl() in src/lib/html.mjs) -- so fixing it here
// fixes all of them at once, no per-page changes needed.
//
// Domain switch (2026-10-28): podiumwatch.org is now the primary domain
// (podiumwatch.site redirects to it) -- same reasoning applies, same
// single value to change.
export const site = {
  name: "Podium Watch",
  shortName: "Podium Watch",
  description: "Ohio high school cross country and track and field rankings, stories, interviews, and athlete coverage.",
  siteUrl: "https://www.podiumwatch.org",
  defaultAuthor: "Podium Watch",
  contactEmail: "media@podiumwatch.org",
  instagramUrl: "https://www.instagram.com/podiumwatch/",
  youtubeUrl: "https://www.youtube.com/@podiumwatchohio",
  logo: "/images/branding/podium_watch_logo_dark.png",
  logoLight: "/images/branding/podium_watch_logo_light.png",
  logoMark: "/images/branding/podium_watch_logo_light.png",
  defaultSocialImage: "/images/social/podium_watch_default_social.png",
  copyrightText: "Podium Watch",
  // Rebuilt 2026-08-21 (NAVIGATION_REBUILD_SPEC.md) into 7 grouped
  // entries -- "Home" stays a flat link, the rest carry `items` and
  // render as a dropdown (desktop) / accordion (mobile) in
  // header()'s navGroup(). "Split Watch" and "Pace Calculator"
  // are deliberately NOT in this list at all anymore -- they've moved to
  // the header's separate utility cluster (see header() in
  // src/lib/html.mjs), styled as tools/actions rather than browsing
  // categories. Fan Poll used to appear twice (once here, once
  // hardcoded in the old "Explore" bar that this rebuild removes
  // entirely) -- it now exists exactly once, under Voting.
  //
  // The spec's proposed Rankings items were "Cross Country / Indoor
  // Track / Outdoor Track" -- confirmed directly against
  // scripts/build.mjs that no indoor/outdoor split exists anywhere in
  // the ranking system (only /rankings/cross-country/ and
  // /rankings/track-and-field/ are real, generated pages), so this uses
  // the two pages that actually exist rather than linking to pages that
  // don't.
  navigation: [
    { label: "Home", href: "/" },
    // Media-credibility audit (2026-10-28): "lead with news, not
    // rankings/recruiting/merch." My Podium and Merch (both real,
    // working, unchanged -- see their own notes below, now moved inside
    // "More") were the two flat top-level links taking the most
    // prominent nav real estate right after Home; replaced with News
    // and Results so a reviewer's first impression of the nav is a
    // newsroom, not a shop/fan-tool.
    { label: "News", href: "/stories/" },
    { label: "Results", items: [
      { label: "Latest Results", href: "/meets/?view=results" },
      { label: "2026 State Results", href: "/state/2026/" },
      { label: "2026 Regionals", href: "/regionals/2026/" },
      { label: "2026 Districts", href: "/districts/2026/" }
    ] },
    { label: "Rankings", items: [
      { label: "Cross Country", href: "/rankings/cross-country/" },
      { label: "Track and Field", href: "/rankings/track-and-field/" },
      { label: "Top 10", href: "/rankings/top-10/" },
      { label: "Track Divisions", href: "/track-divisions/" },
      { label: "State Leaders", href: "/rankings/leaders/" },
      { label: "OATCCC Coaches Poll", href: "/rankings/oatccc/" }
    ] },
    // Mock Meets (2026-09-21, dropdown added 2026-10-19, repointed to
    // /mock-postseason/ 2026-10-20, repointed again 2026-11-01): the three
    // tab links open the real-results universe at /mock-postseason/real/
    // (real Oct 24 district and Oct 31 regional results, State projected
    // from the real qualifiers). The season-best universe at
    // /mock-postseason/ stays reachable from the homepage card and the
    // "View season-best projection instead" toggle. Both universes are
    // still noindex'd and out of the sitemap -- see NOINDEX_NOFOLLOW_PREFIXES
    // below. The old /mock-meets/ hub
    // (src/pages/mockregionals.mjs, "2026 Mock Regionals & State") has real
    // live features not yet in /mock-postseason/ (CSV export + live search
    // at /rankings/mock-meets/2026-09-17/, medal highlighting, a
    // crumbs/sub-nav pill row, and a district-qualifier feed table on
    // regional pages), so it stays linked rather than removed -- kept as
    // one combined legacy entry below instead of the old duplicate-pointing
    // "Regionals"/"State" pair. Districts (src/pages/mockdistricts.mjs,
    // src/data/mock-districts-2026.json) is a separate, still-unused old
    // build, deliberately left out of scripts/build.mjs's page list.
    { label: "Mock Meets", items: [
      { label: "Districts", href: "/mock-postseason/real/?tab=districts" },
      { label: "Regionals", href: "/mock-postseason/real/?tab=regionals" },
      { label: "State", href: "/mock-postseason/real/?tab=state" },
      // Podium Watch's own season-best projection, added 2026-11-01 so
      // every view is reachable from the menu.
      { label: "Podium Watch projection", href: "/mock-postseason/" }
      // "2026 Mock Meets (Regionals & State)" (/mock-meets/) removed from
      // the menu 2026-11-02 at Zachary's request so the dropdown shows the
      // main views only. The legacy pages stay live at their URLs:
      // { label: "2026 Mock Meets (Regionals & State)", href: "/mock-meets/" }
    ] },
    // AdSense readiness (2026-09-16): Meets, Teams & Schools, and
    // Athletes hidden from the top nav for now, real request -- a
    // simpler, shorter nav while the site is under AdSense review. The
    // pages themselves are unchanged and still fully live (direct URL,
    // sitemap, footer links, internal links from other pages all still
    // work) -- only removed from this primary nav. Commented out rather
    // than deleted so restoring them later is a one-line uncomment, not
    // a rebuild from scratch.
    // { label: "Meets", items: [
    //   { label: "Meet Calendar", href: "/meets/" },
    //   { label: "Tournament Hub", href: "/tournament-hub/" }
    // ] },
    // { label: "Teams & Schools", items: [
    //   { label: "Teams", href: "/teams/" },
    //   { label: "Ohio Schools", href: "/ohio-schools/" }
    // ] },
    // { label: "Athletes", items: [
    //   { label: "Athletes", href: "/athletes/" },
    //   { label: "Recruiting", href: "/recruiting/" }
    // ] },
    // Media-credibility audit (2026-10-28): the standalone "Voting"
    // dropdown and the top-level "My Podium"/"Merch" links are all
    // folded into "More" now, in the order requested: About, Staff,
    // Contact, then Voting's old items, Pace Calculator, Merch. My
    // Podium (2026-08-28, docs/MY_PODIUM_MASTER_BUILD_PLAN.md) and
    // Merch (2026-09-15, the free Spring/Amaze Commerce storefront --
    // no cart/checkout exists on this site, Spring already solves
    // that) are both real, unchanged, still-working pages/links -- only
    // their nav prominence moved, per the same reasoning as News/Results
    // replacing them above. My Podium stays reachable from the mobile
    // bottom dock (public/scripts/site.js) exactly as it did before.
    { label: "More", items: [
      { label: "About", href: "/about/" },
      { label: "Staff", href: "/staff/" },
      { label: "Contact", href: "/contact/" },
      // Weekly awards paused for the season (2026-11-09); the 2026
      // Athlete/Team/Coach of the Year takes their place.
      { label: "2026 Year Awards", href: "/awards/2026/" },
      { label: "Fan Poll", href: "/fan-poll/" },
      { label: "Podium Play", href: "/podium-play/" },
      { label: "Pace Calculator", href: "/pace-calculator/" },
      { label: "Merch", href: "https://app.amazecommerce.com/shop/podiumwatch" }
    ] }
  ],
  footerLinks: {
    Coverage: [
      { label: "Rankings", href: "/rankings/" },
      { label: "Meets", href: "/meets/" },
      { label: "Teams", href: "/teams/" },
      { label: "Ohio Schools", href: "/ohio-schools/" },
      { label: "Fan Poll", href: "/fan-poll/" },
      { label: "Pace Calculator", href: "/pace-calculator/" },
      { label: "Splits Calculator", href: "/splits-calculator/" },
      { label: "Meet Scoring Calculator", href: "/scoring-calculator/" },
      { label: "Claim Your Team", href: "/claim-your-team/" },
      { label: "Athletes", href: "/athletes/" },
      { label: "Tournament Hub", href: "/tournament-hub/" },
      { label: "Ranking Methodology", href: "/rankings/methodology/" },
      { label: "Cross Country", href: "/rankings/cross-country/" },
      { label: "Track and Field", href: "/rankings/track-and-field/" },
      { label: "Top 10", href: "/rankings/top-10/" },
      { label: "State Leaders", href: "/rankings/leaders/" },
      { label: "OATCCC Coaches Poll", href: "/rankings/oatccc/" }
    ],
    // Media-credibility audit (2026-10-28), P2-2: reordered to the exact
    // list given -- News, About, Staff, Editorial Standards, Sponsors,
    // Contact, Privacy, Terms. Athletes/Athlete of the Week/Team of the
    // Week/Podium Play were real, unchanged links; they just moved out
    // of this specific column (still reachable via Coverage/nav/More).
    "Podium Watch": [
      { label: "News", href: "/stories/" },
      { label: "About", href: "/about/" },
      { label: "Staff", href: "/staff/" },
      { label: "Editorial Standards", href: "/standards/" },
      { label: "Sponsors", href: "/sponsors/" },
      { label: "Contact", href: "/contact/" },
      { label: "Privacy", href: "/privacy/" },
      { label: "Terms", href: "/terms/" }
    ],
    Connect: [
      { label: "Instagram", href: "https://www.instagram.com/podiumwatch/", external: true },
      { label: "YouTube", href: "https://www.youtube.com/@podiumwatchohio", external: true },
      { label: "Contact", href: "/contact/" }
    ]
  },
  brand: {
    black: "#090909",
    ink: "#171717",
    muted: "#626262",
    paper: "#f6f4ee",
    white: "#ffffff",
    green: "#0faf68",
    greenDark: "#08784a"
  },
  replaceBeforeLaunch: []
};

// AdSense/indexing remediation (2026-09-15): one shared source of truth
// for "this path should never be indexed," used by BOTH the sitemap
// generator (scripts/build.mjs, excludes the URL entirely) and the
// shared page layout (src/lib/html.mjs's layout(), sets <meta
// name="robots">) -- previously these were two independently-maintained
// copies of the same list that had already drifted (writer portal and
// writer login were in neither one). Split into two tiers because they
// need different robots values, not just "exclude or don't":
//
// NOINDEX_NOFOLLOW_PREFIXES: real private/authenticated areas -- a
// signed-out visitor gets a login wall, not real content, and search
// engines should not follow links out of these into other private pages.
//
// NOINDEX_FOLLOW_PREFIXES: public, working, unauthenticated utility
// pages that should stay out of search results but whose outgoing links
// (to real public pages) are still fine to follow -- generic query-param
// shells with no record selected (bare /athlete/, /team/, /meetdetail/,
// /race/) and internal site search (/search/, matching Google's own
// long-standing guidance against indexing internal search results).
export const NOINDEX_NOFOLLOW_PREFIXES = [
  // Weekly awards paused for the season (2026-11-09): the pages only say
  // so and point to /awards/2026/. Remove when the weekly awards return.
  "/athlete-of-the-week/",
  "/team-of-the-week/",
  // Mock Postseason (src/pages/mockpostseason.mjs): linked from the Mock
  // Meets nav since 2026-10-20 and live, but kept out of search engines
  // and the sitemap by Zachary's choice (confirmed 2026-11-01). Remove
  // this line only when he says to index it.
  "/mock-postseason/",
  "/admin/",
  "/writer-portal/",
  "/writer-login/",
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

export const NOINDEX_FOLLOW_PREFIXES = [
  "/search/",
  // Media-credibility audit (2026-10-28): /photographers/ (0
  // photographers published, including /photographers/membership/) is
  // real, working, and reachable by direct URL -- just unlinked from
  // nav/footer/homepage and out of search results until there's real
  // content. Safe as a prefix here: there is no other real page under
  // /photographers/ with 0 photographers in the directory (detail pages
  // are per-photographer and simply don't exist yet).
  //
  // /recruiting/ is deliberately NOT a blanket prefix here -- unlike
  // photographers, /recruiting/top-100/ and /recruiting/submit-activity/
  // are real, populated, live pages the task did not ask to hide (only
  // the empty /recruiting/ search database and /recruiting/methodology/
  // were named). Those two get `robots` set directly on their own
  // layout() call instead -- see src/pages or scripts/build.mjs's
  // recruiting index/methodology page generators.
  "/photographers/",
  // State Meet Media Correspondent application (2026-11-04, Zachary):
  // role filled. The form still works by direct URL but stays out of
  // search engines, the sitemap and site search.
  "/apply/state-meet-correspondent/"
];

// Exact paths (not prefixes) excluded from the sitemap only -- each of
// these already carries the right <meta name="robots"> itself (set
// directly by its own page generator, not via the prefix lists above,
// since e.g. /athlete/ is a prefix of the real, legitimately-indexable
// /athletes/{slug}/ pages and must not be prefix-matched). Kept here,
// next to the prefix lists, so every sitemap-exclusion rule stays in one
// file instead of split across this file and build.mjs.
export const SITEMAP_EXACT_EXCLUDE = [
  "/athlete/",
  "/team/",
  "/meetdetail/",
  "/race/",
  // Media-credibility audit (2026-10-28): carry their own robots:
  // "noindex, follow" (src/pages/recruiting.mjs, recruitingmethodology.mjs).
  "/recruiting/",
  "/recruiting/methodology/",
  "/search-index.json"
];

// AdSense/indexing remediation (2026-09-15): pages that stay indexable
// (real explanatory content around them, confirmed directly against the
// built HTML -- none of these are bare/empty) but are still, at their
// core, a submission form -- exactly what AdSense's own policy calls out
// separately from indexing ("no AdSense on login/search/private/empty/
// submission screens"). Kept as its own list rather than folded into the
// noindex lists above because the two decisions are genuinely different:
// these pages ARE worth indexing, they're just not worth putting an ad
// next to while someone is mid-submission.
// WO-28 (2026-11-09): AdSense loads only on these page types. Athlete
// profiles, team pages, forms, account pages, admin and tools never carry
// programmatic ads (team and ranking pages carry sponsor slots instead).
export const ADSENSE_ALLOWED_PREFIXES = [
  "/stories/",
  "/rankings/",
  "/meets/",
  "/meetdetail/"
];

export const NO_ADS_PATHS = [
  "/submit-results/",
  "/submit-timing-results/",
  "/recruiting/submit-activity/",
  "/apply/",
  "/apply/state-meet-correspondent/"
];