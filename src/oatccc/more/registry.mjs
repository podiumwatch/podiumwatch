// The OATCCC full site move: every new page, the section switch that
// builds it, and the oatccc.com page(s) it replaces (Zachary's handoff,
// 2026-11-17). The page text lives in src/oatccc/more/content/<key>.html,
// copied word for word by scripts/oatccc-port-pages.mjs from the crawl
// (phone numbers left off; listed in docs/OATCCC_FULL_SITE_REPORT.md).
//
// `old` paths are oatccc.com pages whose words are copied here; `aliases`
// are other oatccc.com addresses for the same page (they redirect and
// link here, but are not copied again). Both are oatccc.com paths. A link anywhere in the section to one of
// them goes to our page when the section is switched on, and to oatccc.com
// when it is off (resolveLinks in ./links.mjs).

export const MORE_PAGES = [
  // About
  { key: "about", section: "about", path: "/oatccc/about/", old: ["/About-Us/"], tab: "about", title: "About the OATCCC", description: "The Ohio Association of Track & Cross Country Coaches: history, Ed Barker and milestones." },
  { key: "leadership", section: "about", path: "/oatccc/about/leadership/", old: ["/Contact-Us/"], tab: "about", title: "OATCCC Leadership", description: "Current OATCCC officers and district representatives." },
  { key: "history-of-leadership", section: "about", path: "/oatccc/about/history-of-leadership/", old: ["/About-Us/Our-Leadership/"], tab: "about", title: "OATCCC History of Leadership", description: "Past OATCCC presidents, secretaries, treasurers and editors." },
  { key: "tributes", section: "about", path: "/oatccc/about/tributes/", old: ["/Tributes/"], tab: "about", title: "OATCCC Tributes", description: "Tributes from the Ohio Association of Track & Cross Country Coaches." },
  { key: "sponsors", section: "about", path: "/oatccc/sponsors/", old: ["/About-Us/Sponsors/", "/About-Us/Sponsors/Lend-Your-Support/"], aliases: ["/Sponsors/"], tab: "about", title: "OATCCC Sponsors", description: "The sponsors who support the Ohio Association of Track & Cross Country Coaches." },
  { key: "the-runner", section: "about", path: "/oatccc/the-runner/", old: ["/The-Runner/"], tab: "about", title: "The Runner", description: "The Runner, the OATCCC's publication." },
  // Join
  { key: "join", section: "join", path: "/oatccc/join/", old: ["/About-Us/Join/", "/Coaches/Membership/"], aliases: ["/Coaches/Membership/Join/"], tab: "membership", title: "Join the OATCCC", description: "OATCCC membership: how to join and renew." },
  // Scholarships and grants
  { key: "marv-crosten", section: "scholarships", path: "/oatccc/scholarships/marv-crosten/", old: ["/Scholarships/Marvin-Crosten-Scholarship/"], tab: "about", title: "Marv Crosten Scholarship", description: "The OATCCC Marv Crosten Scholarship." },
  { key: "dale-gabor", section: "scholarships", path: "/oatccc/scholarships/dale-gabor/", old: ["/Scholarships/Dale-Gabor-Scholarship/"], tab: "about", title: "Dale Gabor Seated Athlete Scholarship", description: "The OATCCC Dale Gabor Scholarship." },
  { key: "grants", section: "scholarships", path: "/oatccc/coaches/grants/", old: ["/Coaches/Grants/Elementary-School-Grant/"], aliases: ["/Coaches/Grants/"], tab: "about", title: "OATCCC Elementary School Grant", description: "The OATCCC elementary school grant." },
  // Forms and resources
  { key: "forms", section: "forms", path: "/oatccc/forms/", old: ["/Forms/"], tab: "about", title: "OATCCC Forms", description: "OATCCC forms for coaches." },
  { key: "resources", section: "forms", path: "/oatccc/resources/", old: ["/Resources/"], tab: "about", title: "OATCCC Resources", description: "Resources for track and cross country coaches." },
  // Clinics
  { key: "clinic-tf", section: "clinics", path: "/oatccc/clinics/track-and-field/", old: ["/Clinics/Track-And-Field/"], tab: "clinics", title: "Track & Field Coaches Clinic", description: "The OATCCC Track & Field Coaches Clinic." },
  { key: "clinic-xc", section: "clinics", path: "/oatccc/clinics/cross-country/", old: ["/Clinics/Cross-Country/"], tab: "clinics", title: "Cross Country Coaches Clinic", description: "The OATCCC Cross Country Coaches Clinic." },
  { key: "clinic-vendors", section: "clinics", path: "/oatccc/clinics/vendors/", old: ["/Clinics/Track-And-Field/Vendors/"], tab: "clinics", title: "Clinic Vendors", description: "Vendors at the OATCCC Track & Field Coaches Clinic." },
  // Meets
  { key: "mideast", section: "meets", path: "/oatccc/cross-country/mideast-meet/", old: ["/Cross-Country/Mideast-Meet/"], tab: "home", title: "Mideast Meet of Champions", description: "The Mideast Meet of Champions (cross country)." },
  { key: "midwest", section: "meets", path: "/oatccc/track/midwest-meet/", old: ["/Outdoor-Track-Field/Midwest-Meet/"], tab: "home", title: "Midwest Meet of Champions", description: "The Midwest Meet of Champions (track and field)." },
  // Academic All-Ohio and polls
  { key: "academic", section: "academic", path: "/oatccc/academic-all-ohio/", old: ["/Academic-All-Ohio/"], tab: "home", title: "Academic All-Ohio", description: "OATCCC Academic All-Ohio, with the archive by year." },
  { key: "polls", section: "polls", path: "/oatccc/polls/", old: ["/Cross-Country/Coaches-Poll/"], tab: "polls", title: "OATCCC Coaches' Polls", description: "OATCCC cross country coaches' polls, with the archive by year." },
  // Middle school
  { key: "middle-school", section: "ms", path: "/oatccc/indoor/middle-school/", old: ["/Indoor-Track-Field/Middle-School-State-Meet/"], tab: "indoor", title: "Middle School Indoor State Meet", description: "The OATCCC Middle School Indoor State Meet." }
];

// Hall of Fame and Awards (section "hof"): built from the database, not
// from content files (src/oatccc/more/hof.mjs).
export const HOF_PATHS = {
  hof: "/oatccc/hall-of-fame/",
  awards: "/oatccc/awards/"
};
export const AWARD_PAGES = [
  { key: "ed-barker", slug: "ed-barker-award", old: "/Awards/Ed-Barker-Award/", title: "Ed Barker Award" },
  { key: "coaches-of-the-year", slug: "coaches-of-the-year", old: "/Awards/Coaches-Of-The-Year/", title: "Coaches of the Year" },
  { key: "fred-dafler", slug: "fred-dafler-award", old: "/Awards/Fred-Dafler-Award/", title: "Fred Dafler Award" },
  { key: "sei", slug: "sei-awards", old: "/Awards/SEI-Awards/", title: "SEI Awards" },
  { key: "middle-school-state", slug: "middle-school-state-award", old: "/Awards/Middle-School-State-Award/", title: "Middle School State Award" }
];

export function pageByKey(key) {
  const page = MORE_PAGES.find((p) => p.key === key);
  if (!page) throw new Error(`Unknown OATCCC page: ${key}`);
  return page;
}
