// Podium Watch Wrapped (WO-36): a free season card for every Ohio cross
// country runner with at least 3 public 2026 results. Pure: built from the
// profile, its public 2026 cross country rows and its rows in the leaders
// function (xc_leaders). Real results only, nothing estimated. Derived
// numbers are plain arithmetic on stored times and labeled as such.

export const WRAPPED_SEASON = 2026;
export const WRAPPED_MIN_RACES = 3;

const STAGES = [["district", /^OHSAA Cross Country District\b/i], ["regional", /^OHSAA Cross Country Regional\b/i], ["state", /^OHSAA Cross Country State Championships?\b/i]];
export const stageOf = (meet) => (STAGES.find(([, re]) => re.test(String(meet || ""))) || [])[0] || null;
const STAGE_LABEL = { district: "District", regional: "Regional", state: "State" };
const ROMAN = { 1: "I", 2: "II", 3: "III", 4: "IV" };
// Undated races sort last; they can never be the "first race".
const byDate = (a, b) => (a.meet_date ? 0 : 1) - (b.meet_date ? 0 : 1) || String(a.meet_date || "").localeCompare(String(b.meet_date || "")) || String(a.meet_name || "").localeCompare(String(b.meet_name || ""));

export function ordinal(n) {
  const t = n % 100;
  return `${n}${t >= 11 && t <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" })[n % 10] || "th"}`;
}

export function formatSeconds(value) {
  if (!Number.isFinite(value)) return "";
  const tenths = Math.round(value * 10);
  const minutes = Math.floor(tenths / 600);
  const rest = (tenths - minutes * 600) / 10;
  return minutes ? `${minutes}:${rest < 10 ? "0" : ""}${rest.toFixed(1)}` : rest.toFixed(1);
}

const gradeLabel = (grade) => ({ 9: "Freshman", 10: "Sophomore", 11: "Junior", 12: "Senior" })[grade] || null;
const honorText = (text) => String(text || "").replace(/\b(first|second|third|honorable|team|mention)\b/gi, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());

// rows: the profile's public 2026 cross country performances (any event).
// ranks: { division: { rank, of, division } | null, grade: { rank, of, grade } | null }
export function buildWrapped({ profile, school, rows, ranks = {} }) {
  const season = WRAPPED_SEASON;
  const all = (rows || []).filter((r) => r.season_year === season).sort(byDate);
  const races = all.length;
  const base = {
    slug: profile.slug,
    name: profile.display_name,
    gender: profile.gender === "girls" ? "girls" : "boys",
    school: school || null,
    season,
    races,
    eligible: races >= WRAPPED_MIN_RACES
  };
  if (!base.eligible) return base;

  const timed = all.filter((r) => r.event_key === "xc_5k" && r.mark_unit === "seconds" && Number.isFinite(Number(r.mark_value)));
  const best = timed.reduce((m, r) => (!m || Number(r.mark_value) < Number(m.mark_value) ? r : m), null);
  const first = timed.find((r) => r.meet_date) || null;
  const placed = all.filter((r) => Number.isInteger(r.place) && r.place > 0 && r.result_status !== "reviewed_result");
  const bestPlace = placed.reduce((m, r) => (!m || r.place < m.place || (r.place === m.place && stageRank(r) > stageRank(m)) ? r : m), null);

  // Postseason: the official place at each OHSAA round the runner ran.
  const postseason = STAGES.map(([stage]) => {
    const row = all.find((r) => stageOf(r.meet_name) === stage);
    if (!row) return null;
    const division = row.metadata?.postseason_2026?.division || null;
    return { stage, label: STAGE_LABEL[stage], place: Number.isInteger(row.place) && row.result_status !== "reviewed_result" ? row.place : null, mark: row.mark_text || null, division: division ? `Division ${ROMAN[division] || division}` : null };
  }).filter(Boolean);
  const stateRow = all.find((r) => stageOf(r.meet_name) === "state" && r.result_status !== "reviewed_result");
  const allOhio = stateRow?.honor_label ? honorText(stateRow.honor_label) : null;

  const shape = (r) => (r ? { mark: r.mark_text, value: Number(r.mark_value), meet: r.meet_name, date: r.meet_date } : null);
  const drop = best && first && best !== first && Number(first.mark_value) > Number(best.mark_value) ? Number(first.mark_value) - Number(best.mark_value) : null;
  return {
    ...base,
    best: shape(best),
    first: shape(first),
    drop,
    drop_text: drop ? formatSeconds(drop) : null,
    first_is_best: Boolean(best && first && best === first),
    best_place: bestPlace ? { place: bestPlace.place, place_text: ordinal(bestPlace.place), meet: bestPlace.meet_name, date: bestPlace.meet_date } : null,
    postseason,
    all_ohio: allOhio,
    rank_division: ranks.division ? { ...ranks.division, text: `${ordinal(ranks.division.rank)} of ${ranks.division.of.toLocaleString("en-US")} in ${ranks.division.division}` } : null,
    rank_grade: ranks.grade ? { ...ranks.grade, text: `${ordinal(ranks.grade.rank)} of ${ranks.grade.of.toLocaleString("en-US")} ${(gradeLabel(ranks.grade.grade) || `grade ${ranks.grade.grade}`).toLowerCase()}s` } : null
  };
}

function stageRank(r) {
  return { state: 3, regional: 2, district: 1 }[stageOf(r.meet_name)] || 0;
}

// Postseason in one line, e.g. "District 3rd, Regional 12th, State 41st".
export function postseasonLine(wrapped) {
  return (wrapped.postseason || []).map((p) => `${p.label} ${p.place ? ordinal(p.place) : "ran"}`).join(", ");
}

// The latest round reached, e.g. "State qualifier, Division III".
export function furthestRound(wrapped) {
  const last = (wrapped.postseason || []).at(-1);
  if (!last) return null;
  return last.stage === "state" ? `State meet${last.division ? `, ${last.division}` : ""}` : `${last.label}${last.division ? `, ${last.division}` : ""}`;
}
