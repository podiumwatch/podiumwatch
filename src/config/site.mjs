// AdSense/indexing remediation (2026-09-15): siteUrl was the throwaway
// Vercel-assigned domain, not the real custom domain -- confirmed live
// (identical content-length and ETag on both podiumwatch.vercel.app and
// www.podiumwatch.site; the bare podiumwatch.site correctly 308-redirects
// to www.podiumwatch.site) that www.podiumwatch.site is the real,
// intended, working production domain. This one value drives every
// canonical tag, the sitemap, structured data, and robots.txt across the
// whole site (see absoluteUrl() in src/lib/html.mjs) -- so fixing it here
// fixes all of them at once, no per-page changes needed.
export const site = {
  name: "Podium Watch",
  shortName: "Podium Watch",
  description: "Ohio high school cross country and track and field rankings, stories, interviews, and athlete coverage.",
  siteUrl: "https://www.podiumwatch.site",
  defaultAuthor: "Podium Watch",
  contactEmail: "podiumwatchohio@gmail.com",
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
    // My Podium (2026-08-28): the new personalized, accountless
    // destination -- kept as a flat top-level link, right after Home,
    // matching how prominently it needs to read as its own first-class
    // section rather than one more item buried inside a dropdown. See
    // docs/MY_PODIUM_MASTER_BUILD_PLAN.md.
    { label: "My Podium", href: "/my-podium/" },
    // Merch (2026-09-15): a free Spring (Amaze Commerce) storefront, not
    // a page on this site -- no cart/checkout exists here, and building
    // one just for this would be real engineering effort Spring already
    // solves for free. Flat top-level link (matching My Podium's own
    // prominence) rather than buried in a dropdown, since visibility is
    // the whole point of a revenue feature. externalAttrs() in
    // navGroup() (src/lib/html.mjs) opens it in a new tab automatically
    // since the href is a full https:// URL.
    { label: "Merch", href: "https://app.amazecommerce.com/shop/podiumwatch" },
    { label: "Rankings", items: [
      { label: "Cross Country", href: "/rankings/cross-country/" },
      { label: "Track and Field", href: "/rankings/track-and-field/" },
      { label: "State Leaders", href: "/rankings/leaders/" },
      { label: "OATCCC Coaches Poll", href: "/rankings/oatccc/" }
    ] },
    // Mock Meets (2026-09-21): explicit user request for its own visible
    // top-level tab, not buried in the Rankings dropdown -- see
    // src/pages/mockregionals.mjs for the feature itself (real 2026 OHSAA
    // regional structure, team-only mock meets).
    { label: "Mock Meets", href: "/mock-meets/" },
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
    { label: "Voting", items: [
      { label: "Team of the Week", href: "/team-of-the-week/" },
      { label: "Athlete of the Week", href: "/athlete-of-the-week/" },
      { label: "Fan Poll", href: "/fan-poll/" },
      // Podium Play (2026-09-02): a standalone home for the mini games,
      // always playable regardless of whether a vote is currently open
      // -- see src/pages/podiumplay.mjs's own header for why this needed
      // to exist separately from the weekly award pages.
      { label: "Podium Play", href: "/podium-play/" }
    ] },
    { label: "More", items: [
      { label: "Stories", href: "/stories/" },
      { label: "About", href: "/about/" }
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
      { label: "Recruiting", href: "/recruiting/" },
      { label: "Recruit Rating Methodology", href: "/recruiting/methodology/" },
      { label: "Tournament Hub", href: "/tournament-hub/" },
      { label: "Ranking Methodology", href: "/rankings/methodology/" },
      { label: "Cross Country", href: "/rankings/cross-country/" },
      { label: "Track and Field", href: "/rankings/track-and-field/" },
      { label: "State Leaders", href: "/rankings/leaders/" },
      { label: "OATCCC Coaches Poll", href: "/rankings/oatccc/" }
    ],
    "Podium Watch": [
      { label: "Stories", href: "/stories/" },
      { label: "Athletes", href: "/athletes/" },
      { label: "Recruiting", href: "/recruiting/" },
      { label: "Athlete of the Week", href: "/athlete-of-the-week/" },
      { label: "Team of the Week", href: "/team-of-the-week/" },
      { label: "Podium Play", href: "/podium-play/" },
      { label: "About", href: "/about/" },
      { label: "Privacy", href: "/privacy/" }
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
  "/search/"
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
export const NO_ADS_PATHS = [
  "/submit-results/",
  "/submit-timing-results/",
  "/recruiting/submit-activity/",
  "/apply/"
];