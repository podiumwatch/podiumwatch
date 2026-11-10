// Read-only audit: is every Athlete/Team/Coach of the Year nominee and
// finalist in the division they actually ran in this season?
//
//   node --env-file=.env.local scripts/audit-yearly-award-divisions.mjs [--json out.json]
//
// A school's division for a gender comes from its 2026 OHSAA district,
// regional and state races: team scores (result_team_scores) and individual
// postseason rows (athlete_performances.metadata.postseason_2026). Only when
// a school has no 2026 postseason result does it fall back to last year's
// division (ohio_school_divisions.previous_division for that gender).
// Athletes are matched by name and school against the postseason rows.
// Writes nothing to the database.
import fs from "node:fs";
import { supabaseAdmin as db } from "../lib/supabase-admin.mjs";
import { selectAll } from "../lib/supabase_paging.mjs";
import { loadYearlyAwardsPool, categoryPool } from "../lib/yearly_awards_2026.mjs";

const SEASON = 2026;
const ROMAN = { I: 1, II: 2, III: 3, IV: 4 };
const divNumber = (text) => { if (typeof text === "number") return text; const m = String(text || "").match(/\b(IV|III|II|I|[1-4])\b\s*$/); return m ? (ROMAN[m[1]] || Number(m[1])) : null; };
const all = async (build) => { const { data, error } = await selectAll(build, { maxRows: 50000 }); if (error) throw error; return data; };
const nameKey = (s) => String(s || "").toLowerCase().replace(/[^a-z]+/g, " ").trim();

const [categories, nominations, finalists, scores, postRows, divisionRows, schools] = await Promise.all([
  all(() => db.from("yearly_award_categories").select("id, slug, award, gender, division, label, finalists_published_at").eq("season", SEASON).order("slug")),
  all(() => db.from("yearly_award_nominations").select("id, category_id, nominee_key, athletic_net_id, school_id, coach_name").order("id")),
  all(() => db.from("yearly_award_finalists").select("id, category_id, nominee_key, athletic_net_id, school_id, display_name, school").order("id")),
  all(() => db.from("result_team_scores").select("meet_name, gender, division, matched_school_id").eq("season_year", SEASON).eq("sport", "cross_country").ilike("meet_name", "OHSAA Cross Country%").not("matched_school_id", "is", null).order("meet_name")),
  all(() => db.from("athlete_performances").select("id, school_id, ps:metadata->postseason_2026").eq("season_year", SEASON).not("metadata->postseason_2026", "is", null).order("id")),
  all(() => db.from("ohio_school_divisions").select("school_id, gender, division, previous_division, current").eq("sport", "cross_country").order("school_id")),
  all(() => db.from("ohio_schools").select("id, school_name, city").order("id"))
]);
const schoolName = new Map(schools.map((s) => [s.id, `${s.school_name}${s.city ? ` (${s.city})` : ""}`]));
const catById = new Map(categories.map((c) => [c.id, c]));

// 2026 division per school and gender, with where it came from.
const ran = new Map(); // `${school}|${gender}` -> Map(division -> Set(levels))
const note = (school, gender, division, level) => {
  if (!school || !gender || !division) return;
  const k = `${school}|${gender}`;
  if (!ran.has(k)) ran.set(k, new Map());
  if (!ran.get(k).has(division)) ran.get(k).set(division, new Set());
  ran.get(k).get(division).add(level);
};
const levelOf = (meet) => /State/i.test(meet) ? "state" : /Regional/i.test(meet) ? "regional" : /District/i.test(meet) ? "district" : "postseason";
for (const s of scores) note(s.matched_school_id, s.gender, divNumber(s.division), levelOf(s.meet_name));
const athletes = new Map(); // `${name}|${gender}` -> [{school, division, level}]
for (const p of postRows) {
  const ps = p.ps || {};
  const d = divNumber(ps.division);
  note(p.school_id, ps.gender, d, ps.level || "postseason");
  const n = nameKey(ps.raw?.name);
  if (n && d) { const k = `${n}|${ps.gender}`; if (!athletes.has(k)) athletes.set(k, []); athletes.get(k).push({ school: nameKey(ps.raw?.school), schoolId: p.school_id, division: d, level: ps.level }); }
}
const lastYear = new Map(divisionRows.filter((r) => r.current).map((r) => [`${r.school_id}|${r.gender}`, divNumber(r.previous_division)]));

function schoolDivision(schoolId, gender) {
  const found = ran.get(`${schoolId}|${gender}`);
  if (found?.size) {
    const divisions = [...found.keys()];
    return { divisions, source: divisions.map((d) => `D${d} (${[...found.get(d)].join(", ")})`).join(" + "), basis: "2026" };
  }
  const prev = lastYear.get(`${schoolId}|${gender}`);
  return prev ? { divisions: [prev], source: `D${prev} (last year, no 2026 postseason result)`, basis: "last_year" } : { divisions: [], source: "no 2026 result, no last-year division", basis: "none" };
}

const pool = await loadYearlyAwardsPool();
function athleteDivision(category, athleticNetId) {
  const entry = (categoryPool(pool, category.slug) || []).find((a) => a.id === String(athleticNetId));
  if (!entry) return { divisions: [], source: "not in the nominee pool", basis: "none", name: null };
  const rows = (athletes.get(`${nameKey(entry.name)}|${category.gender}`) || []).filter((r) => r.school === nameKey(entry.school) || nameKey(schoolName.get(r.schoolId)).startsWith(nameKey(entry.school)));
  if (!rows.length) return { divisions: [], source: "no 2026 postseason row matched by name and school", basis: "none", name: `${entry.name} (${entry.school})` };
  const divisions = [...new Set(rows.map((r) => r.division))];
  return { divisions, source: divisions.map((d) => `D${d} (${[...new Set(rows.filter((r) => r.division === d).map((r) => r.level))].join(", ")})`).join(" + "), basis: "2026", name: `${entry.name} (${entry.school})` };
}

const report = [];
function check(kind, row) {
  const category = catById.get(row.category_id);
  if (!category) return;
  const isAthlete = category.award === "athlete";
  const key = isAthlete ? row.athletic_net_id || row.nominee_key : row.school_id || row.nominee_key;
  const found = isAthlete ? athleteDivision(category, key) : schoolDivision(key, category.gender);
  const name = isAthlete ? found.name || row.display_name || key : schoolName.get(key) || row.school || key;
  const status = !found.divisions.length ? "unknown" : found.divisions.length > 1 ? (found.divisions.includes(category.division) ? "mixed" : "mismatch") : found.divisions[0] === category.division ? "ok" : "mismatch";
  report.push({ kind, category: category.slug, label: category.label, filed: category.division, name, key, coach: row.coach_name || row.display_name || null, ran: found.divisions, source: found.source, basis: found.basis, status });
}
for (const n of nominations) check("nomination", n);
for (const f of finalists) check("finalist", f);

// One line per nominee per category.
const grouped = new Map();
for (const r of report) {
  const k = `${r.category}|${r.key}`;
  if (!grouped.has(k)) grouped.set(k, { ...r, nominations: 0, finalist: false, coaches: new Set() });
  const g = grouped.get(k);
  if (r.kind === "nomination") g.nominations += 1; else g.finalist = true;
  if (r.coach && categories.find((c) => c.slug === r.category)?.award === "coach") g.coaches.add(r.coach);
}
const rows = [...grouped.values()];
const tally = rows.reduce((t, r) => ({ ...t, [r.status]: (t[r.status] || 0) + 1 }), {});
console.log(`Nominees checked: ${rows.length} (${nominations.length} nominations, ${finalists.length} finalist rows) ->`, JSON.stringify(tally));
for (const status of ["mismatch", "mixed", "unknown"]) {
  const list = rows.filter((r) => r.status === status).sort((a, b) => a.category.localeCompare(b.category) || String(a.name).localeCompare(String(b.name)));
  if (!list.length) continue;
  console.log(`\n${status.toUpperCase()} (${list.length})`);
  for (const r of list) console.log(`  ${r.category} [filed D${r.filed}] ${r.name}${r.coaches.size ? ` | coach: ${[...r.coaches].join(", ")}` : ""} | ran ${r.source} | ${r.nominations} nomination(s)${r.finalist ? ", FINALIST" : ""}`);
}
const jsonAt = process.argv.indexOf("--json");
if (jsonAt > 0) fs.writeFileSync(process.argv[jsonAt + 1], JSON.stringify(rows.map((r) => ({ ...r, coaches: [...r.coaches] })), null, 2));
