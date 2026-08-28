export const site = {
  name: "Podium Watch",
  shortName: "Podium Watch",
  description: "Ohio high school cross country and track and field rankings, stories, interviews, and athlete coverage.",
  siteUrl: "https://podiumwatch.vercel.app",
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
    { label: "Rankings", items: [
      { label: "Cross Country", href: "/rankings/cross-country/" },
      { label: "Track and Field", href: "/rankings/track-and-field/" },
      { label: "OATCCC Coaches Poll", href: "/rankings/oatccc/" }
    ] },
    { label: "Meets", items: [
      { label: "Meet Calendar", href: "/meets/" },
      { label: "Tournament Hub", href: "/tournament-hub/" }
    ] },
    { label: "Teams & Schools", items: [
      { label: "Teams", href: "/teams/" },
      { label: "Ohio Schools", href: "/ohio-schools/" }
    ] },
    { label: "Athletes", items: [
      { label: "Athletes", href: "/athletes/" },
      { label: "Recruiting", href: "/recruiting/" }
    ] },
    { label: "Voting", items: [
      { label: "Team of the Week", href: "/team-of-the-week/" },
      { label: "Athlete of the Week", href: "/athlete-of-the-week/" },
      { label: "Fan Poll", href: "/fan-poll/" }
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
      { label: "OATCCC Coaches Poll", href: "/rankings/oatccc/" }
    ],
    "Podium Watch": [
      { label: "Stories", href: "/stories/" },
      { label: "Athletes", href: "/athletes/" },
      { label: "Recruiting", href: "/recruiting/" },
      { label: "Athlete of the Week", href: "/athlete-of-the-week/" },
      { label: "Team of the Week", href: "/team-of-the-week/" },
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