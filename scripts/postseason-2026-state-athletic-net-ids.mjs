// WO-05, separate later step: Athletic.net athlete ids for the 2026 state
// meet, from the eight state JSON files Zachary adds to
// dataimports/real_state_results_2026/ (format: { meetId, name, asOf,
// races: [{ gender, division, indiv: [[place, name, grade, school, time,
// teamPlace, athleticNetAthleteId]], teams }] }).
//
// What it does:
//   1. Cross-checks every runner in the JSON against the official
//      spreadsheet (dataimports/2026_Ohio_XC_State_Meet_Results_and_Bibs.xlsx)
//      by race and place: name, school and time. Every difference is
//      listed. Nothing is ever changed to fix one.
//   2. For each runner whose place, name and time agree, finds the one
//      profile with that name (Podium Watch spelling corrections applied)
//      at that school and, with --write, adds the Athletic.net id to that
//      profile if it has none. It never changes places, times, or any
//      other field, and never moves an id that is already on another
//      profile (that is listed instead).
//
//   node --env-file=.env.local scripts/postseason-2026-state-athletic-net-ids.mjs           (report only)
//   node --env-file=.env.local scripts/postseason-2026-state-athletic-net-ids.mjs --write   (adds ids)
//
// Report: dataimports/postseason_2026_to_results/state_athletic_net_ids_report.json
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const folder = path.join(root, "dataimports/real_state_results_2026");
const write = process.argv.includes("--write");

if (!fs.existsSync(folder) || !fs.readdirSync(folder).some((f) => f.endsWith(".json"))) {
  console.log(`No state JSON files in ${path.relative(root, folder)}/ yet. Add the eight state-2026-*.json files and run this again.`);
  process.exit(0);
}

const { normalizeLookup } = await import("../lib/ohio_foundation_service.mjs");
const { default: readXlsx } = await import("read-excel-file/node");
const { supabaseAdmin } = await import("../lib/supabase-admin.mjs");
const { selectAll } = await import("../lib/supabase_paging.mjs");
const nameOverrides = JSON.parse(fs.readFileSync(path.join(root, "src/data/mock-postseason-name-overrides-2026.json"), "utf8"));
const expansions = JSON.parse(fs.readFileSync(path.join(root, "src/data/mock-postseason-school-expansions-2026.json"), "utf8"));
const overrideByName = new Map(Object.entries(nameOverrides).map(([key, value]) => [normalizeLookup(key.split("|")[0]), normalizeLookup(value)]));

// Spreadsheet rows by race and place.
const tenths = (seconds) => Math.round(seconds * 10) / 10;
const sheetRows = new Map();
for (const { sheet, data } of await readXlsx(path.join(root, "dataimports/2026_Ohio_XC_State_Meet_Results_and_Bibs.xlsx"))) {
  const m = sheet.match(/^D([1-4]) (Girls|Boys)$/);
  if (!m) continue;
  const header = data[0];
  const col = (label) => header.indexOf(label);
  for (const r of data.slice(1)) {
    if (r[col("Place")] == null || !r[col("Athlete")]) continue;
    sheetRows.set(`${m[2].toLowerCase()}|${m[1]}|${r[col("Place")]}`, { name: r[col("Athlete")], school: r[col("School")], seconds: tenths(Number(r[col("Time")]) * 86400) });
  }
}
const parseClock = (text) => { const m = String(text || "").match(/^(\d+):(\d{2}(?:\.\d+)?)$/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

// Profiles, school keys, existing Athletic.net ids.
const all = async (build) => { const { data, error } = await selectAll(build, { maxRows: 200000 }); if (error) throw error; return data; };
const profiles = await all(() => supabaseAdmin.from("athlete_profiles").select("id, slug, display_name, gender, current_school_id").is("merged_into_profile_id", null).is("archived_at", null));
const aliases = await all(() => supabaseAdmin.from("athlete_profile_aliases").select("id, profile_id, alias, alias_type").eq("alias_type", "external_id"));
const schools = await all(() => supabaseAdmin.from("ohio_schools").select("id, school_name, city"));
const schoolAliases = await all(() => supabaseAdmin.from("ohio_school_aliases").select("school_id, normalized_alias"));
const idOwner = new Map();
const profileHasId = new Set();
for (const a of aliases) { const m = String(a.alias).match(/athletic\.net\/athlete\/(\d+)/i); if (m) { idOwner.set(m[1], a.profile_id); profileHasId.add(a.profile_id); } }
const schoolKeys = new Map();
const addKey = (key, id) => { const k = normalizeLookup(key); if (!k) return; if (!schoolKeys.has(k)) schoolKeys.set(k, new Set()); schoolKeys.get(k).add(id); };
for (const s of schools) { addKey(s.school_name, s.id); addKey(`${s.school_name} ${s.city}`, s.id); }
for (const a of schoolAliases) addKey(a.normalized_alias, a.school_id);
const schoolIdsFor = (raw) => { const e = expansions[raw]; if (e) { const c = schoolKeys.get(normalizeLookup(e.replace(/\s*\(([^)]*)\)\s*$/, " $1"))); if (c) return c; } return schoolKeys.get(normalizeLookup(raw)) || new Set(); };

const report = { generatedAt: new Date().toISOString(), wrote: write, mismatches: [], idConflicts: [], noProfile: [], added: [], alreadyHad: 0 };
for (const file of fs.readdirSync(folder).filter((f) => f.endsWith(".json")).sort()) {
  const doc = JSON.parse(fs.readFileSync(path.join(folder, file), "utf8"));
  for (const race of doc.races || []) {
    const gender = String(race.gender).toLowerCase();
    for (const [place, name, , school, time, , athleticNetId] of race.indiv || []) {
      const label = `D${race.division} ${gender} place ${place}: ${name} (${school})`;
      const sheet = sheetRows.get(`${gender}|${race.division}|${place}`);
      const problems = [];
      if (!sheet) problems.push("no spreadsheet row at this place");
      else {
        if (normalizeLookup(sheet.name) !== normalizeLookup(name)) problems.push(`name: spreadsheet "${sheet.name}"`);
        if (normalizeLookup(sheet.school) !== normalizeLookup(school) && normalizeLookup(expansions[sheet.school] || "") !== normalizeLookup(school)) problems.push(`school: spreadsheet "${sheet.school}"`);
        const seconds = parseClock(time);
        if (seconds == null || Math.abs(tenths(seconds) - sheet.seconds) > 0.05) problems.push(`time: file ${time}, spreadsheet ${sheet.seconds}s`);
      }
      if (problems.length) { report.mismatches.push(`${label}: ${problems.join("; ")}`); continue; }
      if (!athleticNetId) continue;
      const id = String(athleticNetId);
      const names = new Set([normalizeLookup(name), overrideByName.get(normalizeLookup(name))].filter(Boolean));
      const ids = schoolIdsFor(school);
      const found = profiles.filter((p) => names.has(normalizeLookup(p.display_name)) && (!p.gender || p.gender === gender) && ids.has(p.current_school_id));
      if (found.length !== 1) { report.noProfile.push(`${label} (${found.length} profiles)`); continue; }
      const profile = found[0];
      if (idOwner.has(id)) {
        if (idOwner.get(id) === profile.id) report.alreadyHad += 1;
        else report.idConflicts.push(`${label}: id ${id} is already on another profile`);
        continue;
      }
      if (profileHasId.has(profile.id)) { report.idConflicts.push(`${label}: ${profile.slug} already has a different Athletic.net id`); continue; }
      if (write) {
        const url = `https://www.athletic.net/athlete/${id}/cross-country`;
        const { error } = await supabaseAdmin.from("athlete_profile_aliases").insert({ profile_id: profile.id, alias: url, normalized_alias: url, alias_type: "external_id", notes: "2026 OHSAA state meet results (Athletic.net)" });
        if (error) { report.idConflicts.push(`${label}: insert failed (${error.message})`); continue; }
      }
      report.added.push(`${profile.slug} <- ${id}`);
    }
  }
}

fs.mkdirSync(path.join(root, "dataimports/postseason_2026_to_results"), { recursive: true });
fs.writeFileSync(path.join(root, "dataimports/postseason_2026_to_results/state_athletic_net_ids_report.json"), JSON.stringify(report, null, 2));
console.log(`${write ? "Added" : "Would add"} ${report.added.length} ids; ${report.alreadyHad} already present; ${report.mismatches.length} mismatches with the spreadsheet; ${report.idConflicts.length} id conflicts; ${report.noProfile.length} without exactly one profile.`);
