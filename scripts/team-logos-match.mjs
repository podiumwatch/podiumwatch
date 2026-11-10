// WO-11 logos, step 1 (read only): match dataimports/logo_map.json to the
// logo files in dataimports/pw_logos/schools/ and to schools with team pages.
//
//   node --env-file=.env.local scripts/team-logos-match.mjs
//
// Rules (Zachary, 2026-11-10):
//   - logo_map.json maps Athletic.net short school names (saved as school
//     aliases) to flattened file names ("10-15__adena.png"). A map file is
//     matched to a real file by normalized name: lowercase, ignoring
//     spaces, underscores, dots and the extension.
//   - A name is used only when it points to exactly one school (bare names
//     like Perry or Jackson shared by several schools go to review).
//   - Missing files and files that won't convert (.eps) are listed,
//     never guessed, and no logo is ever pulled from the web.
// Writes dataimports/team_logos_match.json for the processing step.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const MAP = path.join(root, "dataimports/logo_map.json");
const DIR = path.join(root, "dataimports/pw_logos/schools");
const { supabaseAdmin: db } = await import("../lib/supabase-admin.mjs");
const { selectAll } = await import("../lib/supabase_paging.mjs");
const { normalizeLookup } = await import("../lib/ohio_foundation_service.mjs");
const all = async (build) => { const { data, error } = await selectAll(build, { maxRows: 20000 }); if (error) throw error; return data; };

export const fileKey = (name) => String(name).toLowerCase().replace(/\.[a-z0-9]+$/, "").replace(/[\s_.]+/g, "");
const map = JSON.parse(fs.readFileSync(MAP, "utf8"));
const expansions = JSON.parse(fs.readFileSync(path.join(root, "src/data/mock-postseason-school-expansions-2026.json"), "utf8"));
const files = fs.readdirSync(DIR).filter((f) => fs.statSync(path.join(DIR, f)).isFile());
const filesByKey = new Map();
for (const f of files) { const k = fileKey(f); if (!filesByKey.has(k)) filesByKey.set(k, []); filesByKey.get(k).push(f); }

const [schools, aliases, teams] = await Promise.all([
  all(() => db.from("ohio_schools").select("id, school_name, city, status").neq("status", "merged")),
  all(() => db.from("ohio_school_aliases").select("school_id, alias, normalized_alias")),
  all(() => db.from("team_pages").select("id, slug, school_name, city, ohio_school_id, logo_url").is("merged_into_team_id", null).is("archived_at", null))
]);
const activeSchool = new Set(schools.map((s) => s.id));
const keyToSchools = new Map();
const add = (key, id) => { const k = normalizeLookup(key); if (!k || !activeSchool.has(id)) return; if (!keyToSchools.has(k)) keyToSchools.set(k, new Set()); keyToSchools.get(k).add(id); };
for (const s of schools) { add(s.school_name, s.id); add(`${s.school_name} ${s.city}`, s.id); }
for (const a of aliases) add(a.normalized_alias, a.school_id);
const teamBySchool = new Map();
for (const t of teams) if (t.ohio_school_id) { if (!teamBySchool.has(t.ohio_school_id)) teamBySchool.set(t.ohio_school_id, []); teamBySchool.get(t.ohio_school_id).push(t); }
const schoolById = new Map(schools.map((s) => [s.id, s]));

// The map's up_* and ovccl_* names point at files that were renamed when the
// folders were put together. Zachary matched them by school (2026-11-10).
// Calvert, Pandora-Gilboa and Van Buren have no file and stay in review.
const MANUAL = {
  "Old Fort": "old fort.png",
  "Buckeye Central": "buckeyecentral.png",
  "Leipsic": "leipsic.webp",
  "Bellaire": "bellaire.png",
  "St. Clairsville": "st. clairsville.png",
  "Martins Ferry": "martinsferry.png",
  "Shadyside": "shadyside.webp",
  "Barnesville": "10-15/barnesville.jpg",
  "Cambridge": "10-15/cambridge.jpg",
  "East Liverpool": "10-15/east liverpool.png",
  "Indian Creek": "10-15/indian creek.jpg",
  "Steubenville": "Adding 10.6/stubenville.png",
  "Harrison Central": "Adding 10.6/harrisoncentral.jpg",
  "Union Local": "Adding 10.6/union local.jpg",
  "Buckeye Local": "Adding 10.6/buckeye local.jpg",
  "Edison (Richmond)": "Adding 10.6/edison richmond.jpg"
};
// Folder paths were flattened with "__" ("10-15/x.jpg" -> "10-15__x.jpg").
const manualKey = (file) => fileKey(file.replace(/\//g, "__"));

const report = { generated_at: new Date().toISOString(), map_entries: Object.keys(map).length, files: files.length, matched: [], review: [], missing_files: [], unconvertible: [], no_team_page: [], unused_files: [] };
const usedFiles = new Set();
for (const [name, mapFile] of Object.entries(map)) {
  const candidates = filesByKey.get(MANUAL[name] ? manualKey(MANUAL[name]) : fileKey(mapFile)) || [];
  if (MANUAL[name] && !candidates.length) throw new Error(`Manual logo file not found for ${name}: ${MANUAL[name]}`);
  if (!candidates.length) { report.missing_files.push({ name, map_file: mapFile }); continue; }
  const file = candidates[0];
  usedFiles.add(file);
  if (/\.eps$/i.test(file)) { report.unconvertible.push({ name, file }); continue; }
  // The alias first; if no school has it, the curated short-name expansion
  // ("Day. Northridge" -> "Northridge (Dayton)"). Either way only a single
  // exact school counts.
  let ids = [...(keyToSchools.get(normalizeLookup(name)) || [])];
  if (!ids.length && expansions[name]) ids = [...(keyToSchools.get(normalizeLookup(expansions[name].replace(/s*(([^)]*))s*$/, " $1"))) || [])];
  if (ids.length !== 1) { report.review.push({ name, file, reason: ids.length ? `${ids.length} schools match this name` : "no school matches this name", candidates: ids.map((id) => { const s = schoolById.get(id); const t = (teamBySchool.get(id) || [])[0]; return { school_id: id, school: `${s.school_name} (${s.city})`, team_slug: t?.slug || null }; }) }); continue; }
  const school = schoolById.get(ids[0]);
  const team = (teamBySchool.get(ids[0]) || [])[0];
  if (!team) { report.no_team_page.push({ name, file, school: `${school.school_name} (${school.city})`, school_id: school.id }); continue; }
  report.matched.push({ name, file, school_id: school.id, school: `${school.school_name} (${school.city})`, team_id: team.id, team_slug: team.slug });
}
for (const f of files) if (!usedFiles.has(f)) report.unused_files.push(f);

// One team with several map names pointing at different files is a conflict.
const byTeam = new Map();
for (const m of report.matched) { if (!byTeam.has(m.team_slug)) byTeam.set(m.team_slug, new Set()); byTeam.get(m.team_slug).add(m.file); }
report.conflicts = [...byTeam].filter(([, set]) => set.size > 1).map(([slug, set]) => ({ team_slug: slug, files: [...set] }));
// Never pick between two files for one team: both entries go to review.
for (const conflict of report.conflicts) {
  const entries = report.matched.filter((m) => m.team_slug === conflict.team_slug);
  report.matched = report.matched.filter((m) => m.team_slug !== conflict.team_slug);
  for (const m of entries) report.review.push({ name: m.name, file: m.file, reason: `${conflict.files.length} different files point to ${m.school}`, candidates: [{ school_id: m.school_id, school: m.school, team_slug: m.team_slug }] });
}
// One file assigned to several teams.
const byFile = new Map();
for (const m of report.matched) { if (!byFile.has(m.file)) byFile.set(m.file, new Set()); byFile.get(m.file).add(m.team_slug); }
report.shared_files = [...byFile].filter(([, set]) => set.size > 1).map(([file, set]) => ({ file, teams: [...set] }));

fs.writeFileSync(path.join(root, "dataimports/team_logos_match.json"), JSON.stringify(report, null, 2));
const teamsMatched = new Set(report.matched.map((m) => m.team_slug)).size;
console.log(`Map entries ${report.map_entries}, files ${report.files}`);
console.log(`Matched to a team page: ${report.matched.length} entries -> ${teamsMatched} teams (of ${teams.length})`);
console.log(`Review (name not exactly one school): ${report.review.length}`);
console.log(`School has no team page: ${report.no_team_page.length}`);
console.log(`Missing files: ${report.missing_files.length} | won't convert: ${report.unconvertible.length} | files no entry uses: ${report.unused_files.length}`);
console.log(`Conflicts (one team, several files): ${report.conflicts.length} | one file, several teams: ${report.shared_files.length}`);
