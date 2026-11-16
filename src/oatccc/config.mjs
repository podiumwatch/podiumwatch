// OATCCC section (podiumwatch.org/oatccc/), built 2026-11-16.
//
// Everything here is OFF unless a Vercel environment variable turns it on.
// A missing or blank variable means off, so merging this code changes
// nothing on the live site.
//
//   OATCCC_LIVE=1               the hub, the header lockup, the ABCs,
//                               Divisions and Eligibility & Verification
//                               pages, the announcement article and the
//                               OATCCC menu item. Off: none of those pages
//                               or their images are written to dist/, so
//                               every address is a real 404.
//   OATCCC_INDOOR_FULL_LIVE=1   adds Overview, Declarations and fees, Meet
//                               day and FAQ (text copied from oatccc.com).
//                               Needs OATCCC_LIVE too. Off: their menu spots
//                               link to the oatccc.com indoor page.
//   OATCCC_VERIFICATION_LIVE=1  adds the verification admin queue, the
//                               athletic director page, the "Athletic
//                               director sign-in" button and the
//                               verification API. Needs OATCCC_LIVE too.
//
// Changing a variable needs a redeploy (the pages are static).

function on(name, env) {
  return String(env[name] ?? "").trim() === "1";
}

export function oatcccFlags(env = process.env) {
  const live = on("OATCCC_LIVE", env);
  return {
    live,
    indoorFull: live && on("OATCCC_INDOOR_FULL_LIVE", env),
    verification: live && on("OATCCC_VERIFICATION_LIVE", env),
    // Search engines may index the section only on the real production
    // launch. Local and preview builds stay noindex.
    indexable: live && env.VERCEL_ENV === "production"
  };
}

export const OATCCC_BASE = "/oatccc/";
export const INDOOR_BASE = "/oatccc/indoor/high-school/";

export const OATCCC_SITE = "https://www.oatccc.com";
export const LINKS = {
  join: "https://www.oatccc.com/About-Us/Join/",
  indoorPage: "https://www.oatccc.com/Indoor-Track-Field/High-School-State-Meet/",
  contact: "https://www.oatccc.com/Contact-Us/",
  membershipJoin: "https://www.oatccc.com/Coaches/Membership/Join/",
  coachesPoll: "https://www.oatccc.com/Cross-Country/Coaches-Poll/",
  hallOfFame: "https://www.oatccc.com/HOF/",
  clinic: "https://www.oatccc.com/Clinics/Track-And-Field/",
  membership: "https://www.oatccc.com/Coaches/Membership/",
  about: "https://www.oatccc.com/About-Us/",
  academicAllOhio: "https://www.oatccc.com/Academic-All-Ohio/",
  crostenScholarship: "https://www.oatccc.com/Scholarships/Marvin-Crosten-Scholarship/",
  gaborScholarship: "https://www.oatccc.com/Scholarships/Dale-Gabor-Scholarship/",
  elementaryGrant: "https://www.oatccc.com/Coaches/Grants/Elementary-School-Grant/",
  middleSchoolMeet: "https://www.oatccc.com/Indoor-Track-Field/Middle-School-State-Meet/",
  // The draft links the list with "?gid=0#gid=0"; oatccc.com links the
  // same sheet with "?usp=sharing". Same document.
  verificationList: "https://docs.google.com/spreadsheets/d/1qBuvVYSnmb6WWczb3BBx_NsJj0JnnoCaxk3O4-6XaDQ/edit?usp=sharing",
  milesplitOhio: "https://oh.milesplit.com/",
  phoneticForm: "https://forms.gle/i8PMJ9iW7Ywhz4Ht9",
  tickets: "https://fan.hudl.com/usa/oh/geneva/organization/158468/spire-academy/tickets",
  parkingFee: "https://www.passportparking.com/",
  parkingMap: "https://portal.tripleseat.com/public_profile/comments/344759558/download_file?asset_id=124959712",
  foodOptions: "https://portal.tripleseat.com/public_profile/comments/344759558/download_file?asset_id=124959711"
};

// The six corporate sponsors, as oatccc.com lists and links them. Text
// only, no logos (Zachary, 2026-11-16).
export const SPONSORS = [
  { name: "MF Athletic", href: "https://www.everythingtrackandfield.com/" },
  { name: "Asics", href: "https://asics.com/" },
  { name: "MileSplit OH", href: "https://oh.milesplit.com/" },
  { name: "1st Place Spiritwear", href: "https://1stplacespiritwear.com/" },
  { name: "Champion Teamwear", href: "http://championteamwear.com/" },
  { name: "Snap Mobile", href: "https://snapraise.com/" }
];

// OATCCC tab bar. Tabs without a Podium Watch page yet go to oatccc.com.
export function oatcccTabs() {
  return [
    { key: "home", label: "Home", href: OATCCC_BASE },
    { key: "indoor", label: "Indoor State Meet", href: `${INDOOR_BASE}abcs/` },
    { key: "polls", label: "Coaches’ Polls", href: LINKS.coachesPoll },
    { key: "hof", label: "Hall of Fame & Awards", href: LINKS.hallOfFame },
    { key: "clinics", label: "Clinics", href: LINKS.clinic },
    { key: "membership", label: "Membership", href: LINKS.membership },
    { key: "about", label: "About", href: LINKS.about }
  ];
}

// High School Indoor State Meet pages, in menu order. `full: true` pages
// need OATCCC_INDOOR_FULL_LIVE; until then their spot links to oatccc.com.
export const INDOOR_PAGES = [
  { key: "overview", slug: "", label: "Overview", full: true },
  { key: "abcs", slug: "abcs/", label: "ABCs of the Indoor Season" },
  { key: "divisions", slug: "divisions/", label: "Divisions" },
  { key: "eligibility", slug: "eligibility-and-verification/", label: "Eligibility & Verification" },
  { key: "declarations", slug: "declarations-and-fees/", label: "Declarations and fees", full: true },
  { key: "meetday", slug: "meet-day/", label: "Meet day", full: true },
  { key: "faq", slug: "faq/", label: "FAQ", full: true }
];

export function indoorPath(key) {
  const page = INDOOR_PAGES.find((item) => item.key === key);
  if (!page) throw new Error(`Unknown OATCCC indoor page: ${key}`);
  return INDOOR_BASE + page.slug;
}

// Where a page's menu spot points: our page when it is built, otherwise
// the oatccc.com indoor page.
export function indoorHref(key, flags) {
  const page = INDOOR_PAGES.find((item) => item.key === key);
  if (page.full && !flags.indoorFull) return LINKS.indoorPage;
  return indoorPath(key);
}

// The announcement article. Built only with OATCCC_LIVE, and the build
// stops if the body is still the placeholder (scripts/build.mjs).
export const ARTICLE_LAUNCH_KEY = "oatccc";
export const ARTICLE_PLACEHOLDER_MARKER = "OATCCC-ARTICLE-PLACEHOLDER";
