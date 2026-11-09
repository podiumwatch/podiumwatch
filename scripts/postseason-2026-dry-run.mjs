// WO-05 dry run: what importing the official 2026 postseason would do.
// READ ONLY. Nothing is written to the database. Writes a report to
// dataimports/postseason_2026_to_results/report.json and prints a summary.
//
//   node --env-file=.env.local scripts/postseason-2026-dry-run.mjs
//
// Sources (official, verified by Zachary):
//   Districts Oct. 24: dataimports/real_district_results_2026/real_district_results_2026_parsed.json
//   Regionals Oct. 31: dataimports/real_regional_results_2026/real_regional_results_2026_parsed.json
//   State Nov. 7:      dataimports/2026_Ohio_XC_State_Meet_Results_and_Bibs.xlsx
//     race sheets "D1 Girls" .. "D4 Boys" plus "Team Scores"; the "No Result"
//     sheet is skipped (rostered alternates, not DNFs); "Entry SB/PR" and
//     "PB / SB" are the meet's entry marks, never our own verified PRs.
//
// Matching, in order (WO-05): Athletic.net athlete id (regionals carry
// it), then exact name (after Podium Watch's spelling corrections) plus
// school (aliases and short-name expansions) plus gender, then stop and
// list. Nothing is guessed: a row with two candidates is "ambiguous", a
// row with none is "unresolved".
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const read = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const { supabaseAdmin } = await import("../lib/supabase-admin.mjs");
const { selectAll } = await import("../lib/supabase_paging.mjs");
const { normalizeLookup } = await import("../lib/ohio_foundation_service.mjs");
const { default: readXlsx } = await import("read-excel-file/node");

const expansions = read("src/data/mock-postseason-school-expansions-2026.json");
const nameOverrides = read("src/data/mock-postseason-name-overrides-2026.json");
const overrideByName = new Map(Object.entries(nameOverrides).map(([key, value]) => [normalizeLookup(key.split("|")[0]), normalizeLookup(value)]));

// ---- Load profiles, aliases, schools (read only) ----
const all = async (build, maxRows = 200000) => { const { data, error } = await selectAll(build, { maxRows }); if (error) throw error; return data; };
const profiles = await all(() => supabaseAdmin.from("athlete_profiles").select("id, slug, display_name, gender, graduation_year, current_school_id, current_team_id").is("merged_into_profile_id", null).is("archived_at", null));
const aliases = await all(() => supabaseAdmin.from("athlete_profile_aliases").select("id, profile_id, alias, normalized_alias, alias_type"));
const schools = await all(() => supabaseAdmin.from("ohio_schools").select("id, school_name, city"));
const schoolAliases = await all(() => supabaseAdmin.from("ohio_school_aliases").select("id, school_id, normalized_alias"));
const teams = await all(() => supabaseAdmin.from("team_pages").select("id, school_name, slug, ohio_school_id, city").is("merged_into_team_id", null));

const profileById = new Map(profiles.map((p) => [p.id, p]));
const byAthleticNetId = new Map();
const namesByProfile = new Map();
for (const p of profiles) namesByProfile.set(p.id, new Set([normalizeLookup(p.display_name)]));
for (const a of aliases) {
  if (!profileById.has(a.profile_id)) continue;
  if (a.alias_type === "external_id") {
    const match = String(a.alias || "").match(/athletic\.net\/athlete\/(\d+)/i);
    if (match) byAthleticNetId.set(match[1], a.profile_id);
  } else if (a.alias_type === "name") {
    namesByProfile.get(a.profile_id).add(normalizeLookup(a.alias));
  }
}

// School name keys -> school id.
const schoolKeys = new Map();
const addSchoolKey = (key, id) => { const k = normalizeLookup(key); if (!k) return; if (!schoolKeys.has(k)) schoolKeys.set(k, new Set()); schoolKeys.get(k).add(id); };
for (const s of schools) { addSchoolKey(s.school_name, s.id); addSchoolKey(String(s.official_school_name || "").replace(/\s*\([^)]*\)\s*$/, ""), s.id); addSchoolKey(`${s.school_name} ${s.city}`, s.id); }
for (const a of schoolAliases) addSchoolKey(a.normalized_alias, a.school_id);
const teamSchool = new Map(teams.filter((t) => t.ohio_school_id).map((t) => [t.id, t.ohio_school_id]));

function schoolIdsFor(rawSchool) {
  const candidates = [rawSchool];
  const expanded = expansions[rawSchool];
  if (expanded) {
    // "Edison (Richmond)": try the name with its city first; the bare name
    // ("Edison") only if the city form finds nothing.
    const withCity = expanded.replace(/\s*\(([^)]*)\)\s*$/, " $1");
    const cityIds = new Set([...(schoolKeys.get(normalizeLookup(withCity)) || [])]);
    if (cityIds.size) return cityIds;
    candidates.push(expanded, expanded.replace(/\s*\([^)]*\)\s*$/, ""));
  }
  const ids = new Set();
  for (const candidate of candidates) for (const id of schoolKeys.get(normalizeLookup(candidate)) || []) ids.add(id);
  // A short name that matches many schools ("Northwest") only counts when
  // the expansion picked one.
  return ids;
}

// Name index: normalized name -> profile ids.
const byName = new Map();
for (const [id, names] of namesByProfile) for (const n of names) { if (!byName.has(n)) byName.set(n, []); byName.get(n).push(id); }

function matchRow({ name, school, gender, athleticNetId }) {
  if (athleticNetId && byAthleticNetId.has(String(athleticNetId))) return { how: "athletic_net_id", profileId: byAthleticNetId.get(String(athleticNetId)) };
  const raw = normalizeLookup(name);
  const names = new Set([raw, overrideByName.get(raw)].filter(Boolean));
  const schoolIds = schoolIdsFor(school);
  const candidates = new Set();
  for (const n of names) for (const id of byName.get(n) || []) {
    const p = profileById.get(id);
    if (gender && p.gender && p.gender !== gender) continue;
    const pSchool = p.current_school_id || teamSchool.get(p.current_team_id);
    if (schoolIds.size && pSchool && schoolIds.has(pSchool)) candidates.add(id);
  }
  if (candidates.size === 1) return { how: "name_and_school", profileId: [...candidates][0] };
  if (candidates.size > 1) return { how: "ambiguous", candidates: [...candidates].map((id) => profileById.get(id).slug) };
  return { how: schoolIds.size ? "unresolved" : "unresolved_school_unknown" };
}

const toTenths = (seconds) => Math.round(seconds * 10) / 10;
const markText = (seconds) => { const s = toTenths(seconds); const m = Math.floor(s / 60); const rest = (s - m * 60).toFixed(1).padStart(4, "0"); return `${m}:${rest}`; };
const parseClock = (text) => { const m = String(text || "").match(/^(\d+):(\d{2}(?:\.\d+)?)$/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

// ---- Gather rows ----
const meets = [];
// Districts
const districts = read("dataimports/real_district_results_2026/real_district_results_2026_parsed.json");
for (const race of districts.races) {
  meets.push({ level: "district", meet: race.meetName, date: race.date, gender: race.gender, division: race.division, rows: race.individualResults.map((r) => ({ place: r.place, name: r.name, grade: r.grade, school: r.school, seconds: parseClock(r.time), athleticNetId: null })), teams: race.teamScores.map((t) => ({ place: t.place, school: t.school, score: t.score })) });
}
// Regionals
const regionals = read("dataimports/real_regional_results_2026/real_regional_results_2026_parsed.json");
for (const race of regionals.races) {
  meets.push({ level: "regional", meet: `${race.siteName || race.site} Regional`, date: regionals.meetDate || "2026-10-31", gender: race.gender, division: race.division, athleticNetMeetId: race.meetId, rows: race.results.filter((r) => !r.dnf).map((r) => ({ place: r.place, name: r.name, grade: r.grade, school: r.schoolFull || r.school, schoolShort: r.school, seconds: r.seconds ?? parseClock(r.time), athleticNetId: r.athleticNetId })), teams: race.teamScores.map((t) => ({ place: t.place, school: t.schoolFull || t.school, score: t.points })) });
}
// State
const stateFile = path.join(root, "dataimports/2026_Ohio_XC_State_Meet_Results_and_Bibs.xlsx");
const sheets = await readXlsx(stateFile);
const raceSheet = /^D([1-4]) (Girls|Boys)$/;
const gradeFlags = [];
for (const { sheet, data } of sheets) {
  const m = sheet.match(raceSheet);
  if (!m) continue;
  const header = data[0];
  const col = (label) => header.indexOf(label);
  const rows = data.slice(1).filter((r) => r[col("Place")] != null && r[col("Athlete")]).map((r) => {
    let grade = r[col("Grade")];
    // Sr/Jr/So/Fr = 12/11/10/9 (Zachary, 2026-11-09); anything else is flagged.
    if (typeof grade !== "number") {
      const word = { sr: 12, jr: 11, so: 10, fr: 9 }[String(grade || "").trim().toLowerCase()];
      gradeFlags.push(`${sheet}: ${r[col("Athlete")]} (${r[col("School")]}) grade "${grade}"${word ? ` read as ${word}` : " (not read)"}`);
      grade = word ?? null;
    }
    return { place: r[col("Place")], name: r[col("Athlete")], grade, school: r[col("School")], seconds: toTenths(Number(r[col("Time")]) * 86400), teamIndiv: r[col("Team / Indiv")], athleticNetId: null };
  });
  meets.push({ level: "state", meet: "OHSAA Cross Country State Championships", date: "2026-11-07", gender: m[2].toLowerCase(), division: Number(m[1]), rows, teams: [] });
}
const teamSheet = sheets.find((s) => s.sheet === "Team Scores")?.data || [];
for (const r of teamSheet.slice(1)) {
  const m = String(r[0] || "").match(/^D([1-4]) (Girls|Boys)$/);
  if (!m) continue;
  const race = meets.find((x) => x.level === "state" && x.division === Number(m[1]) && x.gender === m[2].toLowerCase());
  race.teams.push({ place: r[1], school: r[2], score: r[3] });
}

// ---- Match ----
const report = { generatedAt: new Date().toISOString(), readOnly: true, levels: {}, unresolvedSample: [], ambiguous: [], teamUnmatched: [], gradeFlags, checks: {} };
for (const level of ["district", "regional", "state"]) report.levels[level] = { races: 0, rows: 0, athletic_net_id: 0, name_and_school: 0, ambiguous: 0, unresolved: 0, unresolved_school_unknown: 0, team_rows: 0, team_rows_matched: 0, missing_time: 0 };
for (const race of meets) {
  const stats = report.levels[race.level];
  stats.races += 1;
  for (const row of race.rows) {
    stats.rows += 1;
    if (row.seconds == null) stats.missing_time += 1;
    const result = matchRow({ ...row, gender: race.gender });
    stats[result.how] += 1;
    row.match = result;
    if (result.how === "ambiguous") report.ambiguous.push(`${race.level} D${race.division} ${race.gender}: ${row.name} (${row.school}) -> ${result.candidates.join(", ")}`);
    else if (result.how.startsWith("unresolved") && report.unresolvedSample.filter((x) => x.startsWith(race.level)).length < 25) report.unresolvedSample.push(`${race.level} D${race.division} ${race.gender}: ${row.name} (${row.school})${result.how === "unresolved_school_unknown" ? " [school not recognized]" : ""}`);
  }
  for (const team of race.teams) {
    stats.team_rows += 1;
    const ids = schoolIdsFor(team.school);
    if (ids.size === 1) stats.team_rows_matched += 1;
    else report.teamUnmatched.push(`${race.level} D${race.division} ${race.gender}: ${team.school}${ids.size > 1 ? " (more than one school)" : ""}`);
  }
}

// Unique runners with no profile (one per name + school + gender), and
// school names the matcher doesn't recognize.
const newRunners = new Map();
const unknownSchools = new Map();
const unknownSchoolDivisions = new Map();
for (const race of meets) {
  for (const row of race.rows) {
    if (row.match.how === "unresolved") {
      const key = `${race.gender}|${normalizeLookup(row.name)}|${normalizeLookup(row.school)}`;
      if (!newRunners.has(key)) newRunners.set(key, { name: row.name, school: row.school, gender: race.gender, grade: row.grade, levels: new Set() });
      newRunners.get(key).levels.add(race.level);
    }
    if (row.match.how === "unresolved_school_unknown") {
      unknownSchools.set(row.school, (unknownSchools.get(row.school) || 0) + 1);
      if (!unknownSchoolDivisions.has(row.school)) unknownSchoolDivisions.set(row.school, new Set());
      unknownSchoolDivisions.get(row.school).add(`D${race.division} ${race.gender} ${race.level}${race.meet ? ` (${race.meet})` : ""}`);
    }
  }
}
report.newRunners = { count: newRunners.size, reachedState: [...newRunners.values()].filter((r) => r.levels.has("state")).length, sample: [...newRunners.values()].slice(0, 20).map((r) => `${r.name} (${r.school}, ${r.gender}, grade ${r.grade ?? "?"}) ${[...r.levels].join("/")}`) };
report.unknownSchools = [...unknownSchools.entries()].sort((a, b) => b[1] - a[1]).map(([school, rows]) => `${school} (${rows} rows)`);

// ---- Review lists (Zachary, 2026-11-09) ----
// Grades: numbers, or Sr/Jr/So/Fr. Class year for 2026-27: 12 = 2027,
// 11 = 2028, 10 = 2029, 9 = 2030.
const GRADE_WORDS = { sr: 12, jr: 11, so: 10, fr: 9 };
const gradeNumber = (value) => { const n = Number(value); if (Number.isInteger(n) && n >= 9 && n <= 12) return n; return GRADE_WORDS[String(value || "").trim().toLowerCase()] ?? null; };
const classYear = (grade) => (grade ? 2027 + (12 - grade) : null);

// Similar name at the same school (so a new profile would likely be a
// duplicate): same last name and same first initial, or names within
// two letters of each other.
function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const profilesBySchool = new Map();
for (const p of profiles) { const sid = p.current_school_id || teamSchool.get(p.current_team_id); if (!sid) continue; if (!profilesBySchool.has(sid)) profilesBySchool.set(sid, []); profilesBySchool.get(sid).push(p); }
function similarAtSchool(name, schoolIds, gender) {
  const n = normalizeLookup(name);
  const [first = "", ...rest] = n.split(" ");
  const last = rest[rest.length - 1] || "";
  for (const sid of schoolIds) for (const p of profilesBySchool.get(sid) || []) {
    if (gender && p.gender && p.gender !== gender) continue;
    const pn = normalizeLookup(p.display_name);
    const [pf = "", ...pr] = pn.split(" ");
    const pl = pr[pr.length - 1] || "";
    if ((last && last === pl && first[0] === pf[0]) || editDistance(n, pn) <= 2) return p.slug;
  }
  return null;
}

// New profiles: one per name + school + grade across all three meets.
const creations = new Map();
const creationReview = [];
for (const race of meets) {
  for (const row of race.rows) {
    if (row.match.how !== "unresolved") continue;
    const grade = gradeNumber(row.grade);
    const key = `${race.gender}|${normalizeLookup(row.name)}|${normalizeLookup(expansions[row.school] || row.school)}|${grade ?? "?"}`;
    if (creations.has(key)) { const c = creations.get(key); c.levels.add(race.level); if (row.athleticNetId && !c.athleticNetId) c.athleticNetId = String(row.athleticNetId); continue; }
    const schoolIds = schoolIdsFor(row.school);
    const similar = similarAtSchool(row.name, schoolIds, race.gender);
    const entry = { name: row.name, school: row.school, schoolIds: [...schoolIds], gender: race.gender, grade, classYear: classYear(grade), athleticNetId: row.athleticNetId ? String(row.athleticNetId) : null, levels: new Set([race.level]) };
    if (similar || schoolIds.size !== 1 || !grade) {
      creationReview.push(`${row.name} (${row.school}, ${race.gender}, grade ${row.grade ?? "?"}): ${similar ? `similar profile ${similar}` : schoolIds.size !== 1 ? "school not one exact match" : "no grade"}`);
      creations.set(key, { ...entry, review: true });
      continue;
    }
    creations.set(key, entry);
  }
}
const toCreate = [...creations.values()].filter((c) => !c.review);
report.profileCreation = {
  would_create: toCreate.length,
  with_athletic_net_id: toCreate.filter((c) => c.athleticNetId).length,
  reached_state: toCreate.filter((c) => c.levels.has("state")).length,
  review_list: creationReview.length,
  review_sample: creationReview,
  class_years: toCreate.reduce((acc, c) => { acc[c.classYear] = (acc[c.classYear] || 0) + 1; return acc; }, {})
};

// Merge list for the ambiguous rows: candidate profiles with evidence.
const ambiguousGroups = new Map();
for (const race of meets) for (const row of race.rows) {
  if (row.match.how !== "ambiguous") continue;
  const key = row.match.candidates.slice().sort().join("|");
  if (!ambiguousGroups.has(key)) ambiguousGroups.set(key, { candidates: row.match.candidates, rows: [], sourceClassYears: new Set() });
  ambiguousGroups.get(key).rows.push(`${race.level} ${row.place} ${row.name} (${row.school}), grade ${row.grade ?? "?"}`);
  const sourceGrade = gradeNumber(row.grade);
  if (sourceGrade) ambiguousGroups.get(key).sourceClassYears.add(classYear(sourceGrade));
}
const slugToProfile = new Map(profiles.map((p) => [p.slug, p]));
const candidateIds = [...new Set([...ambiguousGroups.values()].flatMap((g) => g.candidates.map((slug) => slugToProfile.get(slug).id)))];
const perfCounts = new Map();
for (let i = 0; i < candidateIds.length; i += 100) {
  const { data, error } = await supabaseAdmin.from("athlete_performances").select("profile_id").in("profile_id", candidateIds.slice(i, i + 100));
  if (error) throw error;
  for (const r of data) perfCounts.set(r.profile_id, (perfCounts.get(r.profile_id) || 0) + 1);
}
const externalIds = new Map();
for (const a of aliases) if (a.alias_type === "external_id" && /athletic\.net\/athlete\/\d+/.test(a.alias)) externalIds.set(a.profile_id, a.alias.match(/athlete\/(\d+)/)[1]);
const schoolName = new Map(schools.map((s) => [s.id, `${s.school_name} (${s.city})`]));
report.mergeList = [...ambiguousGroups.values()].map((group) => {
  const evidence = group.candidates.map((slug) => {
    const p = slugToProfile.get(slug);
    return { slug, name: p.display_name, class_year: p.graduation_year, school: schoolName.get(p.current_school_id || teamSchool.get(p.current_team_id)) || null, performances: perfCounts.get(p.id) || 0, athletic_net_id: externalIds.get(p.id) || null };
  });
  // Suggested keep: the Phlipot spelling (Zachary), else the profile with
  // an Athletic.net id, else more results, else the one whose slug names
  // the school. A suggestion only; Zachary approves every merge.
  const official = group.sourceClassYears.size === 1 ? [...group.sourceClassYears][0] : null;
  // Zachary's rule: the class year from the official results wins; then the
  // Phlipot spelling, an Athletic.net id, more results.
  const ranked = [...evidence].sort((a, b) => Number(b.class_year === official) - Number(a.class_year === official) || Number(/phlipot/i.test(b.name)) - Number(/phlipot/i.test(a.name)) || Number(Boolean(b.athletic_net_id)) - Number(Boolean(a.athletic_net_id)) || b.performances - a.performances || b.slug.length - a.slug.length);
  // Two or more class years apart could be two different runners: those go
  // on a separate list for Zachary instead of the merge list.
  const years = evidence.map((e) => e.class_year).filter((y) => Number.isInteger(y));
  const classYearGap = years.length > 1 ? Math.max(...years) - Math.min(...years) : 0;
  return { keep: ranked[0].slug, merge: ranked.slice(1).map((e) => e.slug), official_class_year: official, class_year_gap: classYearGap, possibly_different_runners: classYearGap >= 2, evidence, held_rows: group.rows };
});

// School mapping draft: candidates only, never picked automatically.
const schoolWords = (text) => normalizeLookup(text).split(" ").filter((w) => w.length > 1);
report.schoolMappingDraft = [...unknownSchools.entries()].sort((a, b) => b[1] - a[1]).map(([raw, rows]) => {
  const expanded = expansions[raw] || null;
  const words = schoolWords((expanded || raw).replace(/[()]/g, " "));
  const candidates = schools.filter((s) => {
    const hay = new Set(schoolWords(`${s.school_name} ${s.city}`));
    return words.length && words.every((w) => hay.has(w) || [...hay].some((h) => h.startsWith(w) && w.length >= 3));
  }).slice(0, 4).map((s) => `${s.school_name} (${s.city})`);
  return { source_name: raw, rows, expansion: expanded, candidates, seen_in: [...(unknownSchoolDivisions.get(raw) || [])].sort() };
});

// Spot checks Zachary asked about.
const fuller = meets.flatMap((r) => r.rows.map((row) => ({ ...row, level: r.level, meet: r.meet }))).filter((row) => /brice fuller/i.test(row.name));
report.checks.brice_fuller = fuller.map((row) => `${row.level}: ${row.meet}, place ${row.place}, ${markText(row.seconds)}, ${row.match.how}${row.match.profileId ? ` -> ${profileById.get(row.match.profileId).slug}` : ""}`);
const russia = meets.filter((r) => r.teams.some((t) => /^russia$/i.test(String(t.school))));
report.checks.russia_team = russia.map((r) => { const t = r.teams.find((x) => /^russia$/i.test(String(x.school))); return `${r.level}: ${r.meet} D${r.division} ${r.gender}, place ${t.place}, ${t.score} pts`; });
const champions = meets.filter((r) => r.level === "state").map((r) => { const w = r.rows.find((row) => row.place === 1); return `D${r.division} ${r.gender}: ${w.name} (${w.school}) ${markText(w.seconds)}`; });
report.checks.state_champions = champions;

fs.mkdirSync(path.join(root, "dataimports/postseason_2026_to_results"), { recursive: true });
fs.writeFileSync(path.join(root, "dataimports/postseason_2026_to_results/report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ levels: report.levels, ambiguous: report.ambiguous.length, teamUnmatched: report.teamUnmatched.length, gradeFlags, checks: report.checks }, null, 2));
