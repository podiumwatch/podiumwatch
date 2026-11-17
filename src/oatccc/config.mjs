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
//   OATCCC_DIVISION_LIST_LIVE=1 adds the searchable "Divisions by school"
//                               table to the Divisions page. Needs
//                               OATCCC_LIVE too. Off until Anjanette
//                               confirms the school-list data issues.
//
// The full site move (branch oatccc-full-site, 2026-11-17). Every page
// below needs OATCCC_LIVE=1, OATCCC_MORE_LIVE=1 AND its own section switch,
// so sections can be released one at a time. While a section is off, hub
// tabs, cards and links point to the page on oatccc.com.
//   OATCCC_ABOUT_LIVE=1         About, Leadership, History of leadership,
//                               Tributes, Sponsors, The Runner
//   OATCCC_JOIN_LIVE=1          Join (payment stays on oatccc.com)
//   OATCCC_SCHOLARSHIPS_LIVE=1  Marv Crosten, Dale Gabor, Elementary grant
//   OATCCC_FORMS_LIVE=1         Forms, Resources
//   OATCCC_CLINICS_LIVE=1       Track & field, Cross country, Vendors
//   OATCCC_MEETS_LIVE=1         Mideast Meet, Midwest Meet
//   OATCCC_ACADEMIC_LIVE=1      Academic All-Ohio
//   OATCCC_POLLS_LIVE=1         Coaches' Polls archive
//   OATCCC_MS_LIVE=1            Middle School Indoor State Meet
//   OATCCC_HOF_LIVE=1           Hall of Fame and Awards (read from the
//                               database at build time; migration 103)
//   OATCCC_FILES_HOSTED=1       file links go to the oatccc-public Storage
//                               bucket instead of oatccc.com (only after
//                               the files are uploaded)
//
// Changing a variable needs a redeploy (the pages are static).

function on(name, env) {
  return String(env[name] ?? "").trim() === "1";
}

// Section switches for the full site move (key -> variable).
export const MORE_SECTIONS = {
  about: "OATCCC_ABOUT_LIVE",
  join: "OATCCC_JOIN_LIVE",
  scholarships: "OATCCC_SCHOLARSHIPS_LIVE",
  forms: "OATCCC_FORMS_LIVE",
  clinics: "OATCCC_CLINICS_LIVE",
  meets: "OATCCC_MEETS_LIVE",
  academic: "OATCCC_ACADEMIC_LIVE",
  polls: "OATCCC_POLLS_LIVE",
  ms: "OATCCC_MS_LIVE",
  hof: "OATCCC_HOF_LIVE"
};

export function oatcccFlags(env = process.env) {
  const live = on("OATCCC_LIVE", env);
  const more = live && on("OATCCC_MORE_LIVE", env);
  const sections = Object.fromEntries(Object.entries(MORE_SECTIONS).map(([key, name]) => [key, more && on(name, env)]));
  return {
    live,
    indoorFull: live && on("OATCCC_INDOOR_FULL_LIVE", env),
    verification: live && on("OATCCC_VERIFICATION_LIVE", env),
    divisionList: live && on("OATCCC_DIVISION_LIST_LIVE", env),
    more,
    sections,
    filesHosted: live && on("OATCCC_FILES_HOSTED", env),
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
  // oatccc.com contact page: kept for "All contacts" on the hub and the
  // pages copied word for word from oatccc.com.
  contact: "https://www.oatccc.com/Contact-Us/",
  // "Contact the Chair" buttons email Anjanette directly with this
  // subject (her answer, 2026-11-17).
  chairEmail: "awhitman@oatccc.com",
  chairMailto: "mailto:awhitman@oatccc.com?subject=Indoor%20State%20Meet",
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
  // The Google Sheet verification list link was removed 2026-11-17: no
  // longer needed (Anjanette). The list will be on the Eligibility page.
  milesplitOhio: "https://oh.milesplit.com/",
  phoneticForm: "https://forms.gle/i8PMJ9iW7Ywhz4Ht9",
  tickets: "https://fan.hudl.com/usa/oh/geneva/organization/158468/spire-academy/tickets",
  parkingFee: "https://www.passportparking.com/"
  // Parking Map and Onsite Food Options are shown as plain text: their
  // Tripleseat links open a Tripleseat sign-in page (checked 2026-11-16).
  // Waiting on the OATCCC for working files (docs/NEXT_SESSION.md).
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
// A tab goes to our page when its section is switched on (full site move),
// otherwise to oatccc.com.
export function oatcccTabs(flags = {}) {
  const on = (section) => Boolean(flags.sections?.[section]);
  return [
    { key: "home", label: "Home", href: OATCCC_BASE },
    { key: "indoor", label: "Indoor State Meet", href: `${INDOOR_BASE}abcs/` },
    { key: "polls", label: "Coaches’ Polls", href: on("polls") ? "/oatccc/polls/" : LINKS.coachesPoll },
    { key: "hof", label: "Hall of Fame & Awards", href: on("hof") ? "/oatccc/hall-of-fame/" : LINKS.hallOfFame },
    { key: "clinics", label: "Clinics", href: on("clinics") ? "/oatccc/clinics/track-and-field/" : LINKS.clinic },
    { key: "membership", label: "Membership", href: on("join") ? "/oatccc/join/" : LINKS.membership },
    { key: "about", label: "About", href: on("about") ? "/oatccc/about/" : LINKS.about }
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
