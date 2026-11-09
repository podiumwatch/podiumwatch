// Season results hubs (WO-37): /state/{year}/, /regionals/{year}/,
// /districts/{year}/. One pattern for every year and, later, track: add
// the year here once its official results are imported (WO-05 pipeline).
// /state/ (and /regionals/, /districts/) redirect to the newest year.
//
// Meets are found by their slug in the meets table. Stories are listed by
// hand so a hub never links a story by guesswork; tests check each one
// against its file in content/stories/.

export const HUB_STAGES = {
  state: {
    path: "state",
    level: "state",
    title: (year) => `${year} Ohio High School Cross Country State Meet Results`,
    heading: (year) => `${year} Ohio Cross Country State Championships`,
    slugPattern: (year) => `${year}-ohsaa-state-championships`,
    fullResults: true,
    timingCredit: "Results by SEO Timing"
  },
  regionals: {
    path: "regionals",
    level: "regional",
    title: (year) => `${year} Ohio High School Cross Country Regional Results`,
    heading: (year) => `${year} Ohio Cross Country Regionals`,
    slugPattern: (year) => `${year}-ohsaa-regional-%`,
    fullResults: false,
    timingCredit: null
  },
  districts: {
    path: "districts",
    level: "district",
    title: (year) => `${year} Ohio High School Cross Country District Results`,
    heading: (year) => `${year} Ohio Cross Country Districts`,
    slugPattern: (year) => `${year}-ohsaa-district-%`,
    fullResults: false,
    timingCredit: null
  }
};

// Years with imported official results, newest first.
export const HUB_YEARS = {
  state: [2026],
  regionals: [2026],
  districts: [2026]
};

// Linked stories per hub. "recap" = written after the meet; "preview" =
// written before it (projections, labeled as such on the page).
export const HUB_STORIES = {
  "state/2026": [
    { slug: "quintin-parrish-heart-surgery-state-meet", title: "18 Months After Heart Surgery, Quintin Parrish Scored at State", date: "2026-11-08", kind: "recap" },
    { slug: "division-i-state-breakdown-2026", title: "Division I: Springboro and Mason Meet Again, and Mentor Is the Sleeper", date: "2026-11-03", kind: "preview" },
    { slug: "division-ii-state-breakdown-2026", title: "Division II: Watterson's 35, a Two-Point Thriller and the Sophomore Takeover", date: "2026-11-03", kind: "preview" },
    { slug: "division-iii-state-breakdown-2026", title: "Division III: Four Boys Under 15:00, and Woodridge Is Back for More", date: "2026-11-03", kind: "preview" },
    { slug: "division-iv-state-breakdown-2026", title: "Division IV: Lehman Hunts a Repeat, and Mount Gilead and Russia Battle for a State Title", date: "2026-11-03", kind: "preview" }
  ]
};

export const hubStage = (key) => HUB_STAGES[key] || null;
export const newestHubYear = (key) => (HUB_YEARS[key] || [])[0] || null;
export const hubPath = (key, year) => `/${HUB_STAGES[key].path}/${year}/`;
export const allHubPaths = () => Object.keys(HUB_STAGES).flatMap((key) => (HUB_YEARS[key] || []).map((year) => hubPath(key, year)));

// The hub a meet slug belongs to, for links from the ticker and meet pages.
export function hubForMeetSlug(slug) {
  const m = String(slug || "").match(/^(\d{4})-ohsaa-(state-championships|regional-|district-)/);
  if (!m) return null;
  const key = m[2] === "state-championships" ? "state" : m[2] === "regional-" ? "regionals" : "districts";
  return (HUB_YEARS[key] || []).includes(Number(m[1])) ? hubPath(key, Number(m[1])) : null;
}
