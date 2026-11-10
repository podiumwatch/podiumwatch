import { supabaseAdmin } from "./supabase-admin.mjs";
import { selectAll } from "./supabase_paging.mjs";

// The cross country division a school's boys or girls team actually ran in
// a season, from that season's OHSAA district, regional and state races:
// team scores (result_team_scores) and individual postseason rows
// (athlete_performances.metadata.postseason_{season}). The latest round
// wins (state over regional over district). Only when a school has no
// postseason result that season does it fall back to last year's division
// (ohio_school_divisions.previous_division for that gender), then to the
// school's current listed division. Awards (Coach, Team and Athlete of
// the Year) file nominees with this, never with the boys division alone.

const ROMAN = { I: 1, II: 2, III: 3, IV: 4 };
const RANK = { district: 1, regional: 2, state: 3 };
export const divisionNumber = (value) => {
  if (typeof value === "number") return value >= 1 && value <= 4 ? value : null;
  const m = String(value || "").match(/\b(IV|III|II|I|[1-4])\s*$/);
  return m ? ROMAN[m[1]] || Number(m[1]) : null;
};
const levelOf = (meet) => (/State/i.test(meet) ? "state" : /Regional/i.test(meet) ? "regional" : /District/i.test(meet) ? "district" : null);

async function all(build) {
  const { data, error } = await selectAll(build, { maxRows: 50000 });
  if (error) throw error;
  return data;
}

// Pure: pick one division per school and gender from postseason sightings.
export function pickSeasonDivisions(sightings) {
  const best = new Map();
  for (const s of sightings) {
    const division = divisionNumber(s.division);
    const rank = RANK[s.level] || 0;
    if (!s.schoolId || !s.gender || !division || !rank) continue;
    const key = `${s.schoolId}|${s.gender}`;
    const current = best.get(key);
    if (!current || rank > current.rank) best.set(key, { division, rank, level: s.level });
  }
  return best;
}

export async function loadSeasonDivisions(season) {
  const [scores, perfs, listed] = await Promise.all([
    all(() => supabaseAdmin.from("result_team_scores").select("meet_name, gender, division, matched_school_id").eq("season_year", season).eq("sport", "cross_country").ilike("meet_name", "OHSAA Cross Country%").not("matched_school_id", "is", null).order("meet_name")),
    all(() => supabaseAdmin.from("athlete_performances").select("id, school_id, ps:metadata->postseason_" + season).eq("season_year", season).not(`metadata->postseason_${season}`, "is", null).order("id")),
    all(() => supabaseAdmin.from("ohio_school_divisions").select("school_id, gender, division, previous_division, current").eq("sport", "cross_country").eq("current", true).order("school_id"))
  ]);
  const ran = pickSeasonDivisions([
    ...scores.map((s) => ({ schoolId: s.matched_school_id, gender: s.gender, division: s.division, level: levelOf(s.meet_name) })),
    ...perfs.map((p) => ({ schoolId: p.school_id, gender: p.ps?.gender, division: p.ps?.division, level: p.ps?.level }))
  ]);
  const fallback = new Map(listed.map((r) => [`${r.school_id}|${r.gender}`, { previous: divisionNumber(r.previous_division), listed: divisionNumber(r.division) }]));
  return {
    // { division, basis: "2026" | "last_year" | "listed" } or null
    get(schoolId, gender) {
      const hit = ran.get(`${schoolId}|${gender}`);
      if (hit) return { division: hit.division, basis: String(season), level: hit.level };
      const f = fallback.get(`${schoolId}|${gender}`);
      if (f?.previous) return { division: f.previous, basis: "last_year" };
      if (f?.listed) return { division: f.listed, basis: "listed" };
      return null;
    }
  };
}
