// Season phases (WO-07). The homepage, menus and dated calls to action
// follow the calendar instead of being edited by hand: the build picks
// the phase from its own date, and a nightly rebuild keeps it current.
// Ohio has no true off-season: indoor track runs December to the OATCCC
// indoor state meet in early March, then outdoor track to the OHSAA state
// meet in early June. Dates here are the 2026-27 calendar; confirm each
// year against OHSAA and OATCCC (ohio_tournament_stage_calendar).

export const SEASON_PHASES = [
  { key: "xc-regular", label: "Cross country regular season", from: "2026-08-01", to: "2026-10-23" },
  { key: "xc-postseason", label: "Cross country postseason", from: "2026-10-24", to: "2026-11-07" },
  { key: "xc-wrapup", label: "Cross country wrap-up", from: "2026-11-08", to: "2026-11-30" },
  { key: "indoor", label: "Indoor track", from: "2026-12-01", to: "2027-03-07" },
  { key: "track-regular", label: "Outdoor track regular season", from: "2027-03-08", to: "2027-05-15" },
  { key: "track-postseason", label: "Outdoor track postseason", from: "2027-05-16", to: "2027-06-06" },
  { key: "summer", label: "Summer", from: "2027-06-07", to: "2027-07-31" }
];

// Ohio's calendar date (America/New_York) for a moment in time.
export function ohioDateKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

// The phase for a date. Before the first phase or after the last, the
// nearest one is used, so a stale calendar never breaks the homepage.
export function seasonPhase(now = new Date()) {
  const today = ohioDateKey(now);
  const match = SEASON_PHASES.find((phase) => phase.from <= today && today <= phase.to);
  if (match) return match;
  return today < SEASON_PHASES[0].from ? SEASON_PHASES[0] : SEASON_PHASES[SEASON_PHASES.length - 1];
}

// Dated calls to action. Each one hides itself after expiresAt, both at
// build time and in the browser (data-expires, public/scripts/site.js),
// so it disappears on time even between rebuilds.
export const DATED_CTAS = {
  awardsNominations: {
    href: "/awards/2026/",
    title: "Nominate the 2026 Athletes, Teams and Coaches of the Year",
    detail: "24 categories, boys and girls, Divisions I to IV. Nominations close Monday at 9:00 PM ET.",
    startsAt: "2026-11-08T00:00:00Z",
    expiresAt: "2026-11-10T02:00:00Z"
  },
  awardsVoting: {
    href: "/awards/2026/",
    title: "Vote for the 2026 Athletes, Teams and Coaches of the Year",
    detail: "Pick one finalist in each category. Voting closes Friday, Nov. 13 at 9:00 PM ET.",
    startsAt: "2026-11-10T05:00:00Z",
    expiresAt: "2026-11-14T02:00:00Z"
  },
  awardsWinners: {
    href: "/awards/2026/",
    title: "2026 Athletes, Teams and Coaches of the Year",
    detail: "See the winners in all 24 categories.",
    // No fixed start time (Zachary, 2026-11-13): it turns on by itself
    // once winners are actually published in all 24 categories, checked
    // in the browser (public/scripts/site.js, data-show-when). startsAt
    // is only the earliest it could ever show (voting close).
    startsAt: "2026-11-14T02:00:00Z",
    expiresAt: "2026-12-31T05:00:00Z",
    showWhen: "awards-2026-winners"
  }
};

// Pure: is a dated item live at this moment? An item with showWhen also
// needs a condition only the browser can check, so the build always
// renders it hidden.
export function isLive(item, now = new Date()) {
  if (item.showWhen) return false;
  const t = now.getTime();
  if (item.startsAt && t < new Date(item.startsAt).getTime()) return false;
  if (item.expiresAt && t >= new Date(item.expiresAt).getTime()) return false;
  return true;
}
