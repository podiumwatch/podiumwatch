// WO-05: import the official 2026 Ohio cross country postseason.
// Follows Zachary's approved files exactly:
//   dataimports/postseason_2026_to_results/merge_list_APPROVED.md
//   dataimports/postseason_2026_to_results/school_mapping_APPROVED.md
//
//   node --env-file=.env.local scripts/postseason-2026-import.mjs           (plan only, no writes)
//   node --env-file=.env.local scripts/postseason-2026-import.mjs --write   (does it)
//
// Steps: 1 schools (search first, add only if missing, division per
// gender as seen in the results, source names saved as aliases);
// 2 merges (section A as listed; section B after the safety check;
// every Athletic.net id kept, alternate spellings kept as aliases);
// 3 new profiles from the official results (one per name + school +
// grade; not when the school isn't one exact match or a similar name is
// at the school); 4 results (posted tenths; hundredths only in the raw
// import record), team scores, All-Ohio labels, Path to State.
// Never computes a place, time or division. Requires install/87.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const WRITE = process.argv.includes("--write");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const dir = path.join(root, "dataimports/postseason_2026_to_results");
const read = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const { supabaseAdmin: db } = await import("../lib/supabase-admin.mjs");
const { selectAll } = await import("../lib/supabase_paging.mjs");
const { normalizeLookup } = await import("../lib/ohio_foundation_service.mjs");
const { personDisplayName } = await import("../src/lib/display_names.mjs");
const { default: readXlsx } = await import("read-excel-file/node");

const log = [];
const say = (line) => { log.push(line); console.log(line); };
const all = async (build) => { const { data, error } = await selectAll(build, { maxRows: 300000 }); if (error) throw error; return data; };
const must = (result, what) => { if (result.error) throw new Error(`${what}: ${result.error.message}`); return result.data; };
const slugify = (text) => String(text || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const ROMAN = { 1: "Division I", 2: "Division II", 3: "Division III", 4: "Division IV" };
const GRADE_WORDS = { sr: 12, jr: 11, so: 10, fr: 9 };
const gradeNumber = (value) => { const n = Number(value); if (Number.isInteger(n) && n >= 9 && n <= 12) return n; return GRADE_WORDS[String(value || "").trim().toLowerCase()] ?? null; };
const classYear = (grade) => (grade ? 2027 + (12 - grade) : null);
const tenthsUp = (seconds) => Math.ceil(Math.round(seconds * 1000) / 100) / 10; // posted times round UP to tenths
const markText = (s) => { const m = Math.floor(s / 60); return `${m}:${(s - m * 60).toFixed(1).padStart(4, "0")}`; };
const parseClock = (text) => { const m = String(text || "").match(/^(\d+):(\d{2}(?:\.\d+)?)$/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

// ---------- Counts before ----------
async function counts() {
  const c = async (table, f = (q) => q) => (await f(db.from(table).select("id", { count: "exact", head: true }))).count;
  return {
    schools: await c("ohio_schools"),
    active_profiles: await c("athlete_profiles", (q) => q.is("merged_into_profile_id", null).is("archived_at", null)),
    public_profiles: await c("athlete_profiles", (q) => q.is("merged_into_profile_id", null).is("archived_at", null).eq("public_visible", true)),
    performances: await c("athlete_performances"),
    postseason_performances: await c("athlete_performances", (q) => q.in("meet_date", ["2026-10-24", "2026-10-31", "2026-11-07"])),
    team_scores_postseason: await c("result_team_scores", (q) => q.in("meet_date", ["2026-10-24", "2026-10-31", "2026-11-07"])),
    path_to_state_rows: await c("team_advancement_status", (q) => q.eq("season_year", 2026))
  };
}
const before = await counts();
say(`BEFORE ${JSON.stringify(before)}`);

// ---------- Sources ----------
const expansions = read("src/data/mock-postseason-school-expansions-2026.json");
const nameOverrides = read("src/data/mock-postseason-name-overrides-2026.json");
const overrideByName = new Map(Object.entries(nameOverrides).map(([key, value]) => [normalizeLookup(key.split("|")[0]), normalizeLookup(value)]));
const meetRows = must(await db.from("meets").select("id, name, slug, meet_date, results_url, athleticnet_url").in("meet_date", ["2026-10-24", "2026-10-31", "2026-11-07"]), "meets");

const races = [];
const districts = read("dataimports/real_district_results_2026/real_district_results_2026_parsed.json");
for (const race of districts.races) races.push({ level: "district", siteKey: race.siteKey, session: race.session ?? 1, meetName: race.meetName, date: race.date, gender: race.gender, division: race.division, rows: race.individualResults.map((r) => ({ place: r.place, name: r.name, grade: r.grade, school: r.school, seconds: parseClock(r.time), raw: r })), teams: race.teamScores.map((t) => ({ place: t.place, school: t.school, score: t.score, raw: t })) });
const regionals = read("dataimports/real_regional_results_2026/real_regional_results_2026_parsed.json");
for (const race of regionals.races) races.push({ level: "regional", meetName: race.siteName || race.site, site: race.site, date: "2026-10-31", gender: race.gender, division: race.division, athleticNetMeetId: race.meetId, rows: race.results.filter((r) => !r.dnf).map((r) => ({ place: r.place, name: r.name, grade: r.grade, school: r.schoolFull || r.school, seconds: r.seconds ?? parseClock(r.time), athleticNetId: r.athleticNetId, stateQualifier: r.stateQualifier, raw: r })), teams: race.teamScores.map((t) => ({ place: t.place, school: t.schoolFull || t.school, score: t.points, advanced: t.advanced, raw: t })) });
for (const { sheet, data } of await readXlsx(path.join(root, "dataimports/2026_Ohio_XC_State_Meet_Results_and_Bibs.xlsx"))) {
  const m = sheet.match(/^D([1-4]) (Girls|Boys)$/);
  if (!m) continue;
  const header = data[0];
  const col = (label) => header.indexOf(label);
  races.push({ level: "state", meetName: "OHSAA Cross Country State Championships", date: "2026-11-07", gender: m[2].toLowerCase(), division: Number(m[1]), teams: [], rows: data.slice(1).filter((r) => r[col("Place")] != null && r[col("Athlete")]).map((r) => {
    const raw = Object.fromEntries(header.map((h, i) => [h, r[i]]));
    return { place: r[col("Place")], name: r[col("Athlete")], grade: gradeNumber(r[col("Grade")]), school: r[col("School")], seconds: tenthsUp(Number(r[col("Time")]) * 86400), hundredths: Math.round(Number(r[col("Time (hundredths)")]) * 86400 * 100) / 100, teamOrIndividual: r[col("Team / Indiv")], raw };
  }) });
}
const teamSheet = (await readXlsx(path.join(root, "dataimports/2026_Ohio_XC_State_Meet_Results_and_Bibs.xlsx"))).find((s) => s.sheet === "Team Scores").data;
for (const r of teamSheet.slice(1)) { const m = String(r[0] || "").match(/^D([1-4]) (Girls|Boys)$/); if (!m) continue; races.find((x) => x.level === "state" && x.division === Number(m[1]) && x.gender === m[2].toLowerCase()).teams.push({ place: r[1], school: r[2], score: r[3], raw: { race: r[0], places: r[4] } }); }

// Explicit source site -> meet page slug (no fuzzy matching).
const DISTRICT_SLUG = { CAM: "cambridge", CED: "cedarville", CG: "columbus-grove", GAL: "galion", GO: "glenoak", HD: "hilliard-darby", LCCC: "lorain-county-cc", LF: "napoleon", MAD: "madison", OW: "findlay-owens-cc", RG: "rio-grande", VOA: "voice-of-america-park" };
// A site can run two separate races for one gender and division (Hilliard
// Darby ran sessions 1 and 2). Those stay separate races everywhere.
const sessionsAt = new Map();
for (const r of districts.races) { const k = `${r.siteKey}|${r.gender}|${r.division}`; sessionsAt.set(k, (sessionsAt.get(k) || 0) + 1); }
for (const race of races) race.multiSession = race.level === "district" && sessionsAt.get(`${race.siteKey}|${race.gender}|${race.division}`) > 1;
function meetFor(race) {
  if (race.level === "state") return meetRows.find((m) => m.slug === "2026-ohsaa-state-championships");
  if (race.level === "regional") return meetRows.find((m) => m.slug === `2026-ohsaa-regional-${String(race.site).toLowerCase()}`);
  return meetRows.find((m) => m.slug === `2026-ohsaa-district-${DISTRICT_SLUG[race.siteKey]}`);
}
for (const race of races) {
  race.meet = meetFor(race);
  if (!race.meet) throw new Error(`No meet page for ${race.level} ${race.meetName} ${race.date}`);
}

// ---------- 1. Schools ----------
const mapping = fs.readFileSync(path.join(dir, "school_mapping_APPROVED.md"), "utf8").split(/\r?\n/)
  .filter((line) => /^\|\s*\d+\s*\|/.test(line))
  .map((line) => { const c = line.split("|").map((x) => x.trim()); return { n: Number(c[1]), source: c[2], name: c[3], city: c[4], status: c[5] }; });
say(`School mapping rows: ${mapping.length}`);
// Schools marked merged (a duplicate record) are never matched.
let schools = (await all(() => db.from("ohio_schools").select("id, school_name, normalized_name, city, normalized_city, athletic_district, status, metadata"))).filter((s) => s.status !== "merged");
const xcDivision = new Map((await all(() => db.from("ohio_school_divisions").select("school_id, gender, division").eq("sport", "cross_country").eq("current", true))).map((d) => [`${d.school_id}|${d.gender}`, d.division]));
// The approved mapping lists a mailing city where our table uses the
// school's own town: Manchester (Akron) is Manchester (New Franklin).
const CITY_IN_TABLE = { "manchester|akron": "New Franklin" };
const schoolAliases = await all(() => db.from("ohio_school_aliases").select("id, school_id, normalized_alias"));
const findExisting = (name, city) => {
  const nn = normalizeLookup(name);
  const nc = normalizeLookup(city);
  const exact = schools.filter((s) => normalizeLookup(s.city) === nc && normalizeLookup(s.school_name) === nn);
  if (exact.length === 1) return exact[0];
  // A name that normalizes to just the city ("Mansfield Senior" -> "mansfield")
  // would loosely match every school in that city: never loose-match it.
  if (!nn || nn === nc) return null;
  const loose =schools.filter((s) => normalizeLookup(s.city) === nc && (normalizeLookup(s.school_name).includes(nn) || nn.includes(normalizeLookup(s.school_name))));
  return loose.length === 1 ? loose[0] : null;
};
// Divisions seen per source school (gender -> division).
const seenDivisions = new Map();
for (const race of races) for (const name of [...race.rows.map((r) => r.school), ...race.teams.map((t) => t.school)]) {
  if (!seenDivisions.has(name)) seenDivisions.set(name, new Map());
  seenDivisions.get(name).set(race.gender, race.division);
}
const sourceToSchool = new Map();
const schoolReport = { existing: 0, found_on_search: [], added: [], confirm: [], division_rows: 0, aliases_added: 0 };
for (const row of mapping) {
  let school = findExisting(row.name, CITY_IN_TABLE[`${normalizeLookup(row.name)}|${normalizeLookup(row.city)}`] || row.city);
  const isAdd = /^add/i.test(row.status);
  if (isAdd && school) schoolReport.found_on_search.push(`${row.source} -> existing ${school.school_name} (${school.city})`);
  if (!school && !isAdd) throw new Error(`Approved as existing but not found: #${row.n} ${row.name} (${row.city})`);
  if (!school) {
    const pending = schoolReport.added.find((a) => a.key === `${normalizeLookup(row.name)}|${normalizeLookup(row.city)}`);
    if (pending) { school = pending.school; }
    else {
      const record = { school_name: row.name, normalized_name: normalizeLookup(row.name), city: row.city, normalized_city: normalizeLookup(row.city), status: "active", program_level: "high_school", metadata: { added_from: "2026 OHSAA cross country postseason results", approved_by: "Zachary Bell", approved_mapping_row: row.n } };
      school = WRITE ? must(await db.from("ohio_schools").insert(record).select("id, school_name, normalized_name, city, normalized_city, metadata").single(), `add school ${row.name}`) : { ...record, id: `new:${row.name}|${row.city}` };
      schools.push(school);
      schoolReport.added.push({ key: `${normalizeLookup(row.name)}|${normalizeLookup(row.city)}`, school, label: `${row.name} (${row.city})` });
      if (/CONFIRM/.test(row.status)) schoolReport.confirm.push(`${row.name} (${row.city})`);
      // Division per gender, as seen in these results.
      const genders = new Map();
      for (const m of mapping.filter((x) => normalizeLookup(x.name) === normalizeLookup(row.name) && normalizeLookup(x.city) === normalizeLookup(row.city))) for (const [g, d] of seenDivisions.get(m.source) || []) genders.set(g, d);
      for (const [gender, division] of genders) {
        schoolReport.division_rows += 1;
        if (WRITE) must(await db.from("ohio_school_divisions").insert({ school_id: school.id, sport: "cross_country", gender, season_start_year: 2026, season_end_year: 2027, season_label: "2026-27", division: ROMAN[division], official: true, current: true, metadata: { source: "2026 OHSAA cross country postseason results (division the team ran in)" } }), `division ${row.name}`);
      }
    }
  } else if (!isAdd) schoolReport.existing += 1;
  sourceToSchool.set(row.source, school.id);
  // Save the source spelling as an alias so future results match.
  const alias = normalizeLookup(row.source);
  if (alias && !schoolAliases.some((a) => a.school_id === school.id && a.normalized_alias === alias)) {
    schoolReport.aliases_added += 1;
    if (WRITE && !String(school.id).startsWith("new:")) {
      must(await db.from("ohio_school_aliases").insert({ school_id: school.id, alias: row.source, normalized_alias: alias, notes: "2026 postseason results spelling (approved mapping)" }), `alias ${row.source}`);
      schoolAliases.push({ school_id: school.id, normalized_alias: alias });
    }
  }
}
say(`Schools: ${schoolReport.existing} mapped to existing, ${schoolReport.found_on_search.length} marked add but already in the table, ${schoolReport.added.length} added, ${schoolReport.division_rows} division rows, ${schoolReport.aliases_added} aliases`);

// ---------- Matching helpers (reloaded after merges) ----------
let profiles, aliases, profileById, byAthleticNetId, byName, teams, teamBySchool;
const schoolKeys = new Map();
function rebuildSchoolKeys() {
  schoolKeys.clear();
  const add = (key, id) => { const k = normalizeLookup(key); if (!k) return; if (!schoolKeys.has(k)) schoolKeys.set(k, new Set()); schoolKeys.get(k).add(id); };
  for (const s of schools) { add(s.school_name, s.id); add(`${s.school_name} ${s.city}`, s.id); }
  for (const a of schoolAliases) add(a.normalized_alias, a.school_id);
}
function schoolIdsFor(raw) {
  if (sourceToSchool.has(raw)) return new Set([sourceToSchool.get(raw)]);
  const expanded = expansions[raw];
  if (expanded) { const c = schoolKeys.get(normalizeLookup(expanded.replace(/\s*\(([^)]*)\)\s*$/, " $1"))); if (c) return c; }
  return schoolKeys.get(normalizeLookup(raw)) || new Set();
}
// A name shared by several schools (Madison, Perry, Jackson...) is picked
// by the meet's location: keep the candidates in the OHSAA athletic
// districts this meet serves (from the schools that resolve on their own
// at this meet) whose division for this gender is the race's division.
// Used only when exactly one candidate is left.
const meetDistricts = new Map();
function computeMeetDistricts() {
  const bySlug = new Map();
  for (const race of races) for (const name of [...race.rows.map((r) => r.school), ...race.teams.map((t) => t.school)]) {
    const ids = schoolIdsFor(name); if (ids.size !== 1) continue;
    const d = schools.find((x) => x.id === [...ids][0])?.athletic_district; if (!d) continue;
    const m = bySlug.get(race.meet.slug) || new Map(); m.set(d, (m.get(d) || 0) + 1); bySlug.set(race.meet.slug, m);
  }
  for (const [slug, m] of bySlug) { const total = [...m.values()].reduce((a, b) => a + b, 0); meetDistricts.set(slug, new Set([...m].filter(([, n]) => n / total >= 0.05).map(([d]) => d))); }
}
const resolvedByLocation = new Map();
const resolvedIds = new Map();
const stillShared = new Map();
// Schools Zachary named for a shared name in a specific race.
const CONFIRMED_SCHOOL = [
  // "Perry" girls Division III at the Madison district and Boardman regional = Perry (Perry), Lake County (2026-11-09).
  { slugs: ["2026-ohsaa-district-madison", "2026-ohsaa-regional-boardman"], gender: "girls", division: 3, name: "Perry", school: ["Perry", "Perry"] }
];
function locationIds(race, raw) {
  const ids = schoolIdsFor(raw);
  const confirmed = CONFIRMED_SCHOOL.find((c) => c.name === raw && c.gender === race.gender && c.division === race.division && c.slugs.includes(race.meet.slug));
  if (confirmed) { const sc = schools.find((x) => normalizeLookup(x.school_name) === normalizeLookup(confirmed.school[0]) && normalizeLookup(x.city) === normalizeLookup(confirmed.school[1])); if (sc) return new Set([sc.id]); }
  if (ids.size <= 1) return ids;
  const districts = meetDistricts.get(race.meet.slug) || new Set();
  const want = ROMAN[race.division];
  const left = [...ids].filter((id) => { const sc = schools.find((x) => x.id === id); const div = xcDivision.get(`${id}|${race.gender}`); return sc && districts.has(sc.athletic_district) && (!div || div === want); });
  const key = `${race.level} ${race.meet.name} ${race.gender} D${race.division}: ${raw}`;
  // Regional and state: the school this name already resolved to for the
  // same gender and division in an earlier round.
  if (left.length !== 1 && race.level !== "district") {
    const earlier = new Set([...resolvedIds].filter(([k]) => k.endsWith(`|${race.gender}|${race.division}|${raw}`) && !k.startsWith(race.level)).map(([, id]) => id).filter((id) => ids.has(id)));
    if (earlier.size === 1) left.splice(0, left.length, ...earlier);
  }
  if (left.length === 1) resolvedIds.set(`${race.level}|${race.gender}|${race.division}|${raw}`, left[0]);
  if (left.length === 1) { const sc = schools.find((x) => x.id === left[0]); resolvedByLocation.set(key, `${sc.school_name} (${sc.city}, ${sc.athletic_district})`); return new Set(left); }
  stillShared.set(key, [...ids].map((id) => { const sc = schools.find((x) => x.id === id); return `${sc.school_name} (${sc.city}, ${sc.athletic_district || "no district"}, ${race.gender} ${xcDivision.get(`${id}|${race.gender}`) || "no division"})`; }));
  return ids;
}
// Names that differ only by punctuation, capitals or spacing are the same runner.
const squash = (n) => normalizeLookup(n).replace(/[^a-z]/g, "");
let bySquash;
async function loadPeople() {
  profiles = await all(() => db.from("athlete_profiles").select("id, slug, display_name, gender, graduation_year, current_school_id, current_team_id").is("merged_into_profile_id", null).is("archived_at", null));
  aliases = await all(() => db.from("athlete_profile_aliases").select("id, profile_id, alias, normalized_alias, alias_type"));
  teams = await all(() => db.from("team_pages").select("id, slug, school_name, ohio_school_id").is("merged_into_team_id", null));
  teamBySchool = new Map(teams.filter((t) => t.ohio_school_id).map((t) => [t.ohio_school_id, t.id]));
  const teamSchool = new Map(teams.filter((t) => t.ohio_school_id).map((t) => [t.id, t.ohio_school_id]));
  profileById = new Map(profiles.map((p) => [p.id, { ...p, school: p.current_school_id || teamSchool.get(p.current_team_id) || null }]));
  byAthleticNetId = new Map();
  byName = new Map();
  const addName = (n, id) => { if (!byName.has(n)) byName.set(n, new Set()); byName.get(n).add(id); };
  for (const p of profileById.values()) addName(normalizeLookup(p.display_name), p.id);
  bySquash = new Map();
  const addSquash = (n, id) => { const k = squash(n); if (!k) return; if (!bySquash.has(k)) bySquash.set(k, new Set()); bySquash.get(k).add(id); };
  for (const p of profileById.values()) addSquash(p.display_name, p.id);
  for (const a of aliases) if (a.alias_type === "name" && profileById.has(a.profile_id)) addSquash(a.alias, a.profile_id);
  for (const a of aliases) {
    if (!profileById.has(a.profile_id)) continue;
    const m = String(a.alias || "").match(/athletic\.net\/athlete\/(\d+)/i);
    if (a.alias_type === "external_id" && m) byAthleticNetId.set(m[1], a.profile_id);
    else if (a.alias_type === "name") addName(normalizeLookup(a.alias), a.profile_id);
  }
}
function matchRow(row, race) {
  const gender = race.gender;
  if (row.athleticNetId && byAthleticNetId.has(String(row.athleticNetId))) return { how: "athletic_net_id", profileId: byAthleticNetId.get(String(row.athleticNetId)) };
  const raw = normalizeLookup(row.name);
  const names = [raw, overrideByName.get(raw)].filter(Boolean);
  const allIds = schoolIdsFor(row.school);
  const schoolIds = allIds;
  const found = new Set();
  const ok = (id) => { const p = profileById.get(id); return !(p.gender && p.gender !== gender) && p.school && schoolIds.has(p.school); };
  for (const n of names) for (const id of byName.get(n) || []) if (ok(id)) found.add(id);
  if (found.size === 1) return { how: "name_and_school", profileId: [...found][0] };
  if (found.size > 1) return { how: "ambiguous", candidates: [...found] };
  const squashed = new Set([...(bySquash.get(squash(row.name)) || []), ...(overrideByName.has(raw) ? bySquash.get(squash(overrideByName.get(raw))) || [] : [])].filter(ok));
  if (squashed.size === 1) return { how: "name_squashed", profileId: [...squashed][0] };
  if (allIds.size > 1) { const located = locationIds(race, row.school); if (located.size === 1) return { how: "unresolved", schoolIds: located, byLocation: true }; }
  return { how: schoolIds.size === 1 ? "unresolved" : "unresolved_school_unknown", schoolIds };
}
rebuildSchoolKeys();
computeMeetDistricts();
await loadPeople();

// ---------- 2. Merges ----------
const report = JSON.parse(fs.readFileSync(path.join(dir, "report.json"), "utf8"));
const approvedMerge = fs.readFileSync(path.join(dir, "merge_list_APPROVED.md"), "utf8");
if (!/Approved: all 25/i.test(approvedMerge) || !/Approved to merge all 3/i.test(approvedMerge)) throw new Error("merge_list_APPROVED.md does not approve sections A and B as expected.");
const slugToId = new Map(profiles.map((p) => [p.slug, p.id]));
const mergeReport = { merged: [], sent_back: [], ids_moved: 0 };
const perfsOf = async (ids) => must(await db.from("athlete_performances").select("id, profile_id, meet_name, meet_date, event_key, school_id").in("profile_id", ids), "perfs");
for (const group of report.mergeList) {
  const keepId = slugToId.get(group.keep);
  const mergeIds = group.merge.map((s) => slugToId.get(s));
  if (!keepId || mergeIds.some((id) => !id)) { mergeReport.sent_back.push(`${group.keep}: a profile is no longer active`); continue; }
  if (group.possibly_different_runners) {
    const perfs = await perfsOf([keepId, ...mergeIds]);
    const raceKey = (p) => `${p.meet_name}|${p.meet_date}|${p.event_key}`;
    const keepRaces = new Set(perfs.filter((p) => p.profile_id === keepId).map(raceKey));
    const sameRace = perfs.some((p) => p.profile_id !== keepId && keepRaces.has(raceKey(p)));
    const schoolsSeen = new Set(perfs.map((p) => p.school_id).filter(Boolean));
    if (sameRace || schoolsSeen.size > 1) { mergeReport.sent_back.push(`${group.keep} <- ${group.merge.join(", ")}: ${sameRace ? "both have a result in the same race" : "results under different schools"}`); continue; }
  }
  for (const mergeId of mergeIds) {
    // Keep every Athletic.net id: move the merged profile's external ids first.
    const ids = aliases.filter((a) => a.profile_id === mergeId && a.alias_type === "external_id");
    mergeReport.ids_moved += ids.length;
    if (WRITE) {
      for (const a of ids) must(await db.from("athlete_profile_aliases").update({ profile_id: keepId, notes: "Moved from a merged duplicate profile (2026 postseason import)" }).eq("id", a.id), "move id");
      // (name aliases: checked live, since an earlier merge in this group may have moved one)
      const keepAliases = new Set(must(await db.from("athlete_profile_aliases").select("normalized_alias").eq("profile_id", keepId), "keep aliases").map((x) => x.normalized_alias));
      for (const a of must(await db.from("athlete_profile_aliases").select("id, normalized_alias").eq("profile_id", mergeId).neq("alias_type", "external_id"), "merge aliases")) {
        if (keepAliases.has(a.normalized_alias)) must(await db.from("athlete_profile_aliases").delete().eq("id", a.id), "drop dup alias");
        else must(await db.from("athlete_profile_aliases").update({ profile_id: keepId }).eq("id", a.id), "move alias");
      }
      must(await db.rpc("athlete_merge_profiles_v1", { p_source_profile_id: mergeId, p_target_profile_id: keepId, p_actor: "Podium Watch (approved merge list, 2026-11-09)", p_reason: `2026 postseason import, approved by Zachary. Official results class of ${group.official_class_year}.` }), "merge");
    }
  }
  if (WRITE && group.official_class_year) must(await db.from("athlete_profiles").update({ graduation_year: group.official_class_year, graduation_year_source: "2026 OHSAA postseason official results" }).eq("id", keepId), "class year");
  mergeReport.merged.push(`${group.keep} <- ${group.merge.join(", ")}`);
}
// Samuel Phlipot: display name and the Philpot spelling as an alias.
const phlipot = slugToId.get("samuel-phlipot-russia-2027");
if (WRITE && phlipot) {
  must(await db.from("athlete_profiles").update({ display_name: "Samuel Phlipot", normalized_name: "samuel phlipot" }).eq("id", phlipot), "phlipot name");
  const { data: has } = await db.from("athlete_profile_aliases").select("id").eq("profile_id", phlipot).eq("normalized_alias", "samuel philpot");
  if (!has?.length) must(await db.from("athlete_profile_aliases").insert({ profile_id: phlipot, alias: "Samuel Philpot", normalized_alias: "samuel philpot", alias_type: "name", notes: "Official results spelling (approved, 2026-11-09)" }), "philpot alias");
}
say(`Merges: ${mergeReport.merged.length} merged, ${mergeReport.ids_moved} Athletic.net ids moved, ${mergeReport.sent_back.length} sent back`);
if (WRITE) await loadPeople();

// ---------- 3. New profiles ----------
// Similar names whose Athletic.net ids differ: separate profiles, flagged
// as possible duplicates (Zachary, 2026-11-09).
const POSSIBLE_DUPLICATES = [
  { source: "joshua johnson|bellbrook", athleticNetId: "23618878", existing: "josh-johnson-bellbrook-2027", reason: "Similar name at the same school; official 2026 regional row has Athletic.net id 23618878, the existing profile has 24239679." },
  { source: "kaylee o neill|whetstone", athleticNetId: "33483008", existing: "kaylee-o-neil-whetstone-2029", reason: "Similar name at the same school; official 2026 regional row has Athletic.net id 33483008, the existing profile has 29388230." },
  { source: "alexander franklin|hicksville", athleticNetId: "33056639", existing: "alex-franklin-hicksville-2027", reason: "Similar name at the same school; official 2026 regional row has Athletic.net id 33056639, the existing profile has 23659500." }
];
function editDistance(a, b) { const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; }
function similarAt(name, schoolId, gender) {
  const n = normalizeLookup(name); const [f = "", ...r] = n.split(" "); const l = r[r.length - 1] || "";
  for (const p of profileById.values()) {
    if (p.school !== schoolId || (p.gender && p.gender !== gender)) continue;
    const pn = normalizeLookup(p.display_name); const [pf = "", ...pr] = pn.split(" "); const pl = pr[pr.length - 1] || "";
    if ((l && l === pl && f[0] === pf[0]) || editDistance(n, pn) <= 2) return p.slug;
  }
  return null;
}
// Every slug in use, merged and archived profiles included (merged slugs redirect).
const slugs = new Set((await all(() => db.from("athlete_profiles").select("slug"))).map((p) => p.slug));
const uniqueSlug = (base) => { let s = base; let i = 2; while (slugs.has(s)) s = `${base}-${i++}`; slugs.add(s); return s; };
const newProfiles = new Map();
const creationReview = [];
for (const race of races) for (const row of race.rows) {
  row.match = matchRow(row, race);
  if (row.match.how !== "unresolved") continue;
  const grade = gradeNumber(row.grade);
  const schoolId = [...row.match.schoolIds][0];
  const key = `${race.gender}|${normalizeLookup(row.name)}|${schoolId}|${grade ?? "?"}`;
  if (newProfiles.has(key)) { const np = newProfiles.get(key); if (row.athleticNetId && !np.athleticNetId) np.athleticNetId = String(row.athleticNetId); continue; }
  if (!grade) { creationReview.push(`${row.name} (${row.school}): no grade`); newProfiles.set(key, { review: true }); continue; }
  // Zachary confirmed these are different runners from the similar profile (2026-11-09).
  const DIFFERENT_RUNNERS = ["aaron miller|garaway", "cooper moore|boardman", ...POSSIBLE_DUPLICATES.map((d) => d.source)];
  const similar = DIFFERENT_RUNNERS.includes(`${normalizeLookup(row.name)}|${normalizeLookup(row.school)}`) ? null : similarAt(row.name, schoolId, race.gender);
  if (similar) { creationReview.push(`${row.name} (${row.school}, grade ${grade}): similar profile ${similar}`); newProfiles.set(key, { review: true }); continue; }
  const parts = String(row.name).trim().split(/\s+/);
  const school = schools.find((s) => s.id === schoolId);
  newProfiles.set(key, { name: String(row.name).trim(), first: parts[0], last: parts.slice(1).join(" ") || parts[0], gender: race.gender, grade, classYear: classYear(grade), schoolId, schoolName: school?.school_name, athleticNetId: row.athleticNetId ? String(row.athleticNetId) : null });
}
const toCreate = [...newProfiles.values()].filter((p) => !p.review);
let created = 0;
for (const p of toCreate) {
  const record = {
    slug: uniqueSlug(slugify(`${p.name} ${p.schoolName || ""} ${p.classYear}`)),
    first_name: p.first, last_name: p.last, display_name: personDisplayName(p.name), normalized_name: normalizeLookup(personDisplayName(p.name)),
    gender: p.gender, graduation_year: p.classYear, graduation_year_source: "Derived from grade in the 2026 OHSAA postseason official results",
    current_school_id: p.schoolId, current_team_id: teamBySchool.get(p.schoolId) || null,
    public_visible: true, verification_status: "source_verified",
    source_identity_key: `official-results-2026|${normalizeLookup(p.name)}|${p.gender}|${p.classYear}|${p.schoolId}`
  };
  if (WRITE) {
    // An Athletic.net id already on any profile (merged ones included) means
    // this runner may already exist: review, don't create.
    if (p.athleticNetId) {
      const url = `https://www.athletic.net/athlete/${p.athleticNetId}/cross-country`;
      const owner = must(await db.from("athlete_profile_aliases").select("profile_id").eq("alias_type", "external_id").eq("normalized_alias", url), "id owner");
      if (owner.length) { creationReview.push(`${p.name} (${p.schoolName}, class of ${p.classYear}): Athletic.net id ${p.athleticNetId} is already on another profile`); continue; }
    }
    const inserted = must(await db.from("athlete_profiles").insert(record).select("id").single(), `create ${p.name}`);
    if (p.athleticNetId) {
      const url = `https://www.athletic.net/athlete/${p.athleticNetId}/cross-country`;
      must(await db.from("athlete_profile_aliases").insert({ profile_id: inserted.id, alias: url, normalized_alias: url, alias_type: "external_id", notes: "2026 OHSAA regional results (Athletic.net)" }), "id");
    }
    created += 1;
  }
}
// Created separately but flagged as a possible duplicate of the similar
// profile (their Athletic.net ids differ), for a later merge if they turn
// out to be one runner. Stored on both profiles' metadata.possible_duplicates.
if (WRITE) for (const pair of POSSIBLE_DUPLICATES) {
  const url = `https://www.athletic.net/athlete/${pair.athleticNetId}/cross-country`;
  const owner = must(await db.from("athlete_profile_aliases").select("profile_id").eq("alias_type", "external_id").eq("normalized_alias", url), "dup owner");
  const other = must(await db.from("athlete_profiles").select("id, metadata").eq("slug", pair.existing), "dup other");
  if (owner.length !== 1 || other.length !== 1) { say(`  possible duplicate not flagged (profile missing): ${pair.source}`); continue; }
  const created = must(await db.from("athlete_profiles").select("id, metadata").eq("id", owner[0].profile_id).single(), "dup created");
  const flag = async (row, otherId) => {
    const list = Array.isArray(row.metadata?.possible_duplicates) ? row.metadata.possible_duplicates : [];
    if (list.some((x) => x.profile_id === otherId)) return;
    must(await db.from("athlete_profiles").update({ metadata: { ...(row.metadata || {}), possible_duplicates: [...list, { profile_id: otherId, reason: pair.reason, flagged_at: new Date().toISOString(), flagged_by: "Podium Watch (approved by Zachary, 2026-11-09)" }] } }).eq("id", row.id), "flag");
  };
  await flag(created, other[0].id);
  await flag(other[0], created.id);
}
say(`New profiles: ${toCreate.length} ${WRITE ? "created" : "to create"} (${toCreate.filter((p) => p.athleticNetId).length} with Athletic.net id), ${creationReview.length} sent to review`);
if (WRITE) await loadPeople();

// ---------- 4. Results, team scores, All-Ohio, Path to State ----------
const allOhio = (division, place) => { const first = division === 1 ? 20 : 24; if (place <= first) return "All-Ohio first team"; if (place <= first * 2) return "All-Ohio second team"; return null; };
const sourceLabel = (race) => (race.level === "state" ? "Official results (Athletic.net). Results by SEO Timing." : "Official results (Athletic.net)");
const sourceUrl = (race) => race.meet.results_url || race.meet.athleticnet_url || null;
// One school per source name within a race: the single match, or, when
// several schools share the name (Lakewood, Madison, Perry...), the one
// school every matched runner under that name in this race belongs to.
for (const race of races) for (const row of race.rows) row.final = matchRow(row, race);
function raceSchool(race, name) {
  const ids = schoolIdsFor(name);
  if (ids.size === 1) return [...ids][0];
  if (!ids.size) return null;
  const seen = new Set(race.rows.filter((r) => r.school === name && r.final.profileId).map((r) => profileById.get(r.final.profileId).school).filter((id) => ids.has(id)));
  if (seen.size === 1) return [...seen][0];
  const located = locationIds(race, name);
  return located.size === 1 ? [...located][0] : null;
}
const perfRows = [];
const squashedAliases = new Map();
const held = { ambiguous: [], unresolved: [], school_unknown_by_name: {} };
for (const race of races) for (const row of race.rows) if (row.final.how === "unresolved_school_unknown") { const k = `${row.school} (${row.final.schoolIds.size} schools share it)`; held.school_unknown_by_name[k] = (held.school_unknown_by_name[k] || 0) + 1; }
for (const race of races) {
  for (const row of race.rows) {
    const match = row.final;
    if (!match.profileId) { held[match.how === "ambiguous" ? "ambiguous" : "unresolved"].push(`${race.level} D${race.division} ${race.gender} ${row.place} ${row.name} (${row.school})`); continue; }
    if (row.seconds == null) { held.unresolved.push(`${race.level} ${row.name}: no time`); continue; }
    const p = profileById.get(match.profileId);
    if (match.how === "name_squashed") squashedAliases.set(`${p.id}|${normalizeLookup(row.name)}`, { profile_id: p.id, alias: String(row.name).trim(), normalized_alias: normalizeLookup(row.name), alias_type: "name", notes: "Official 2026 postseason spelling (differs only by punctuation, capitals or spacing)" });
    const sourceKey = `postseason-2026|${race.level}|${race.meet.slug}|${race.gender}|d${race.division}|${row.place}|${normalizeLookup(row.name)}`;
    perfRows.push({
      profile_id: p.id, school_id: raceSchool(race, row.school), team_id: teamBySchool.get(raceSchool(race, row.school)) || null,
      sport: "cross_country", season_year: 2026, event_name: "Cross Country 5K", event_key: "xc_5k",
      mark_text: markText(row.seconds), mark_value: row.seconds, mark_unit: "seconds", record_type: "race_result",
      meet_name: race.meet.name, meet_date: race.date, meet_id: race.meet.id, place: row.place, grade: gradeNumber(row.grade),
      source_key: sourceKey, source_label: sourceLabel(race), source_url: sourceUrl(race), source_type: "official",
      verification_status: "verified", public_visible: true, result_status: "official_result",
      honor_label: race.level === "state" ? allOhio(race.division, row.place) : null,
      metadata: { postseason_2026: { level: race.level, division: race.division, gender: race.gender, ...(race.multiSession ? { session: race.session } : {}), raw: { ...row.raw, ...(row.hundredths ? { time_hundredths_seconds: row.hundredths } : {}) } } }
    });
  }
}
say(`Results: ${perfRows.length} to import; held ${held.ambiguous.length} ambiguous, ${held.unresolved.length} unresolved`);
say(`Matched by spelling only (punctuation, capitals, spacing): ${squashedAliases.size} runners`);
if (WRITE) for (const a of squashedAliases.values()) { const r = await db.from("athlete_profile_aliases").upsert(a, { onConflict: "profile_id,normalized_alias", ignoreDuplicates: true }); if (r.error) throw new Error(`alias: ${r.error.message}`); }
if (WRITE) for (let i = 0; i < perfRows.length; i += 500) must(await db.from("athlete_performances").upsert(perfRows.slice(i, i + 500), { onConflict: "source_key", ignoreDuplicates: true }), "performances");

const teamRows = [];
const teamUnmatched = [];
for (const race of races) for (const t of race.teams) {
  const schoolId = raceSchool(race, t.school);
  if (!schoolId) { teamUnmatched.push(`${race.level} D${race.division} ${race.gender}: ${t.school}`); continue; }
  teamRows.push({
    provider_key: "ohsaa", provider_meet_id: race.meet.slug, provider_event_id: `${race.level}-${race.gender}-d${race.division}-${slugify(race.meetName)}${race.multiSession ? `-session-${race.session}` : ""}`,
    meet_name: race.meet.name, meet_date: race.date, meet_id: race.meet.id, sport: "cross_country", season_year: 2026, competition_level: "high_school",
    gender: race.gender, division: ROMAN[race.division], event_name: "Cross Country 5K", team_name: t.school, normalized_team_name: normalizeLookup(t.school),
    matched_school_id: schoolId, matched_team_id: schoolId ? teamBySchool.get(schoolId) || null : null,
    place_text: String(t.place), place_numeric: Number(t.place) || null, did_not_place: false, score: t.score ?? null,
    scoring_breakdown: t.raw, source_url: sourceUrl(race), public_visible: true, verification_status: "verified"
  });
}
say(`Team scores: ${teamRows.length} written, ${teamUnmatched.length} held without one school`);
if (WRITE) for (let i = 0; i < teamRows.length; i += 300) must(await db.from("result_team_scores").upsert(teamRows.slice(i, i + 300), { onConflict: "provider_key,provider_meet_id,provider_event_id,normalized_team_name" }), "team scores");

// Path to State, per team page: district (did the team or its runners
// reach the regional?), regional (official advanced flag), state place.
const advancement = new Map();
const ordinal = (n) => `${n}${[11, 12, 13].includes(n % 100) ? "th" : ({ 1: "st", 2: "nd", 3: "rd" })[n % 10] || "th"}`;
const finish = (t, meetLabel) => ({ note: `${ordinal(Number(t.place))}${meetLabel ? ` at ${meetLabel}` : ""}, ${t.score} points`, metadata: { team_place: Number(t.place), team_score: t.score } });
const setStage = (teamId, gender, stage, values) => advancement.set(`${teamId}|${gender}|${stage}`, { team_id: teamId, sport: "cross_country", gender, season_year: 2026, stage, set_by: "2026 postseason import", ...values });
const regionalSchoolsAll = new Map();
for (const race of races.filter((r) => r.level === "regional")) for (const row of race.rows) { const s = raceSchool(race, row.school); if (!s) continue; const k = `${race.gender}|${race.division}|${s}`; regionalSchoolsAll.set(k, (regionalSchoolsAll.get(k) || 0) + 1); }
const regionalTeams = new Set(races.filter((r) => r.level === "regional").flatMap((r) => r.teams.map((t) => `${r.gender}|${r.division}|${raceSchool(r, t.school)}`)));
for (const race of races.filter((r) => r.level === "district")) for (const t of race.teams) {
  const s = raceSchool(race, t.school); const teamId = s && teamBySchool.get(s); if (!teamId) continue;
  const key = `${race.gender}|${race.division}|${s}`;
  const runnersAtRegional = regionalSchoolsAll.get(key) || 0;
  const at = `the ${race.meet.name.replace(/^OHSAA Cross Country District - /, "")} district`;
  setStage(teamId, race.gender, "district", regionalTeams.has(key)
    ? { status: "qualified_team", ...finish(t, at) }
    : runnersAtRegional ? { status: "qualified_individuals", individual_qualifier_count: runnersAtRegional, ...finish(t, at) } : { status: "eliminated", ...finish(t, at) });
}
const stateSchools = new Map();
for (const race of races.filter((r) => r.level === "state")) for (const row of race.rows) { const s = raceSchool(race, row.school); if (s) stateSchools.set(`${race.gender}|${s}`, (stateSchools.get(`${race.gender}|${s}`) || 0) + 1); }
for (const race of races.filter((r) => r.level === "regional")) for (const t of race.teams) {
  const s = raceSchool(race, t.school); const teamId = s && teamBySchool.get(s); if (!teamId) continue;
  const atState = stateSchools.get(`${race.gender}|${s}`) || 0;
  const at = `the ${race.meet.name.replace(/^OHSAA Cross Country Regional - /, "")} regional`;
  setStage(teamId, race.gender, "regional", t.advanced
    ? { status: "qualified_team", ...finish(t, at) }
    : atState ? { status: "qualified_individuals", individual_qualifier_count: atState, ...finish(t, at) } : { status: "eliminated", ...finish(t, at) });
}
for (const race of races.filter((r) => r.level === "state")) for (const t of race.teams) {
  const s = raceSchool(race, t.school); const teamId = s && teamBySchool.get(s); if (!teamId) continue;
  // The state stage is a finish, not a qualification.
  setStage(teamId, race.gender, "state", { status: "qualified_team", note: `Finished ${ordinal(Number(t.place))} as a team, ${t.score} points`, metadata: { team_place: Number(t.place), team_score: t.score, state_finish: true } });
}
const advRows = [...advancement.values()];
say(`Path to State rows: ${advRows.length}`);
if (WRITE) for (let i = 0; i < advRows.length; i += 300) must(await db.from("team_advancement_status").upsert(advRows.slice(i, i + 300), { onConflict: "team_id,sport,gender,season_year,stage" }), "advancement");

// ---------- Counts after ----------
const after = WRITE ? await counts() : null;
if (after) say(`AFTER ${JSON.stringify(after)}`);
fs.writeFileSync(path.join(dir, WRITE ? "import_result.json" : "import_plan.json"), JSON.stringify({ wrote: WRITE, before, after, schools: { ...schoolReport, added: schoolReport.added.map((a) => a.label) }, merges: mergeReport, newProfiles: { count: toCreate.length, review: creationReview }, results: { imported: perfRows.length, held, squashed: [...squashedAliases.values()].map((a) => a.alias) }, schoolByLocation: Object.fromEntries(resolvedByLocation), stillShared: Object.fromEntries(stillShared), teamScores: { count: teamRows.length, unmatched: teamUnmatched }, pathToState: advRows.length, log }, null, 2));
