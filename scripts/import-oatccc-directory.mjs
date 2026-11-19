// Loads the OHSAA school directory (High Schools tab only) into
// oatccc_directory_schools (install/104_OATCCC_AD_DIRECTORY.sql), matches
// each school to oatccc_schools by OHSAA ID, and fills in the OHSAA IDs
// missing from Anjanette's list (lib/oatccc_directory.mjs ID_FILLS).
//
// PRIVATE contact data: the spreadsheet stays out of git, and this script
// never prints a name, email or phone number; only counts, school names
// and OHSAA IDs.
//
// Dry run (default; reads only the two spreadsheets on this machine,
// touches nothing):
//   node scripts/import-oatccc-directory.mjs \
//     --file "dataimports/Ohio_XC_Track_Coach_AD_Directory_2026-11-17.xlsx" \
//     --list "dataimports/e0ffa64e-2027-OATCCC-Divisions_-_Verification_School_Names.xlsx"
//
// Write (Zachary's OK; after migration 104 and the school-list import):
//   node --env-file=../podium_watch_site/.env.local scripts/import-oatccc-directory.mjs --file "<directory.xlsx>" --apply
//
// --apply upserts directory rows by OHSAA ID (never deletes), fills the
// missing OHSAA IDs on oatccc_schools and oatccc_school_divisions (only
// where empty), and links each directory row to its oatccc_schools row.
import readXlsxFile from "read-excel-file/node";
import { HIGH_SCHOOL_SHEET, parseDirectory, resolveIdFills } from "../lib/oatccc_directory.mjs";
import { SHEETS, parseVerificationNames, parseDivisionRows } from "../lib/oatccc_school_list.mjs";

const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const file = arg("--file");
const listFile = arg("--list");
const apply = process.argv.includes("--apply");
if (!file) { console.error('Usage: node scripts/import-oatccc-directory.mjs --file "<directory.xlsx>" [--list "<Anjanette list.xlsx>"] [--apply]'); process.exit(1); }

// The directory's date: --date, or the YYYY-MM-DD in its file name.
const directoryDate = arg("--date") || (file.match(/(\d{4}-\d{2}-\d{2})/) || [])[1];
if (!directoryDate) { console.error("Give the directory's date with --date YYYY-MM-DD."); process.exit(1); }

const sheets = await readXlsxFile(file);
const tab = sheets.find((s) => s.sheet === HIGH_SCHOOL_SHEET);
if (!tab) { console.error(`No "${HIGH_SCHOOL_SHEET}" tab in ${file}.`); process.exit(1); }
const { rows, problems } = parseDirectory(tab.data, directoryDate);
const fills = resolveIdFills(rows);
const byId = new Map(rows.map((r) => [r.ohsaa_id, r]));

console.log(`Directory (${directoryDate}), ${HIGH_SCHOOL_SHEET} tab: ${rows.length} schools.`);
console.log(`  Rows without an OHSAA ID: ${problems.noId}. Duplicate OHSAA IDs: ${problems.duplicateId.length}.`);
console.log(`  AD email cells with more than one address: ${problems.cellsWithSeveralAdEmails}. Entries that are not email addresses (left out): ${problems.invalidEmails}.`);
const shared = new Map();
for (const r of rows) for (const e of r.ad_emails) shared.set(e, (shared.get(e) || 0) + 1);
console.log(`  AD emails listed for more than one school: ${[...shared.values()].filter((n) => n > 1).length} (those ADs choose between their schools).`);
console.log(`\nSchools with no AD email (${problems.noAdEmail.length}): ${problems.noAdEmail.join("; ") || "none"}`);
console.log("\nOHSAA IDs to fill in from the directory:");
for (const f of fills) {
  const where = f.tournamentName ? `"${f.tournamentName}"` : f.label;
  const note = f.ohsaaId == null ? `NOT FOUND (${f.matches} matches): left empty` : f.tournamentName ? "" : " (not on Anjanette's list: nothing to attach it to)";
  console.log(`  ${where} -> ${f.ohsaaId ?? "-"}  [directory: ${f.school}, ${f.city}]${note}`);
}

if (listFile) {
  const wb = await readXlsxFile(listFile);
  const sh = (n) => { const s = wb.find((x) => x.sheet === n); if (!s) throw new Error(`No "${n}" tab in ${listFile}.`); return s.data; };
  const names = parseVerificationNames(sh(SHEETS.names)).names;
  const divisionRows = [...parseDivisionRows(sh(SHEETS.boys), "boys"), ...parseDivisionRows(sh(SHEETS.girls), "girls")];
  const idByName = new Map();
  for (const r of divisionRows) if (r.tournamentName && r.ohsaaId) idByName.set(r.tournamentName, r.ohsaaId);
  for (const f of fills) if (f.tournamentName && f.ohsaaId && !idByName.has(f.tournamentName)) idByName.set(f.tournamentName, f.ohsaaId);
  const matched = names.filter((n) => byId.has(idByName.get(n)));
  const unmatched = names.filter((n) => !byId.has(idByName.get(n)));
  console.log(`\nAnjanette's verification list: ${names.length} schools; matched to the directory by OHSAA ID: ${matched.length}.`);
  console.log(`  On her list, no directory match (${unmatched.length}): ${unmatched.map((n) => `${n}${idByName.has(n) ? ` (ID ${idByName.get(n)} not in directory)` : " (no OHSAA ID)"}`).join("; ") || "none"}`);
  // Her division rows with no OHSAA ID and no tournament name: they are not
  // on her list and not in the directory under that ID.
  const fillNames = new Set(fills.map((f) => f.school.toLowerCase()));
  const orphan = new Map();
  for (const r of divisionRows) {
    if (r.tournamentName || r.ohsaaId) continue;
    const key = `${r.schoolName}, ${r.city}`;
    if (fillNames.has(r.schoolName.toLowerCase()) || /lincoln west/i.test(r.schoolName)) continue;
    const inDirectory = rows.some((d) => d.school_name.toLowerCase() === r.schoolName.toLowerCase() && (d.city || "").toLowerCase() === r.city.toLowerCase());
    if (!inDirectory) orphan.set(key, [...(orphan.get(key) || []), r.gender]);
  }
  console.log(`  In her division sheets (no tournament name, no OHSAA ID), no directory match (${orphan.size}): ${[...orphan].map(([k, g]) => `${k} (${g.join(", ")})`).join("; ") || "none"}`);
  // Schools in the directory that are not on her list (for information).
  const listIds = new Set(names.map((n) => idByName.get(n)).filter(Boolean));
  console.log(`  Directory schools not on her list: ${rows.filter((r) => !listIds.has(r.ohsaa_id)).length} (kept in the directory; they cannot be picked in the form).`);
}

if (!apply) {
  console.log("\nDry run: nothing written. Add --apply after migration 104 and the school-list import (Zachary's OK).");
  process.exit(0);
}

const { supabaseAdmin } = await import("../lib/supabase-admin.mjs");
const { selectAll } = await import("../lib/supabase_paging.mjs");
const loadSchools = async () => {
  const { data, error } = await selectAll(() => supabaseAdmin.from("oatccc_schools").select("id, tournament_name, ohsaa_id, on_verification_list, is_test"), { maxRows: 5000 });
  if (error) throw new Error(`oatccc_schools: ${error.message}`);
  return data;
};
let schools = await loadSchools();
if (!schools.some((s) => s.on_verification_list)) { console.error("No schools on the verification list yet: run scripts/import-oatccc-school-divisions.mjs --apply first."); process.exit(1); }

for (const f of fills.filter((x) => x.tournamentName && x.ohsaaId)) {
  for (const table of ["oatccc_schools", "oatccc_school_divisions"]) {
    const { error } = await supabaseAdmin.from(table).update({ ohsaa_id: f.ohsaaId }).eq("tournament_name", f.tournamentName).is("ohsaa_id", null);
    if (error) throw new Error(`${table} ${f.tournamentName}: ${error.message}`);
  }
}
schools = await loadSchools();
const schoolByOhsaa = new Map(schools.filter((s) => !s.is_test && s.ohsaa_id).map((s) => [s.ohsaa_id, s.id]));
const now = new Date().toISOString();
const payload = rows.map((r) => ({ ...r, oatccc_school_id: schoolByOhsaa.get(r.ohsaa_id) || null, updated_at: now }));
for (let i = 0; i < payload.length; i += 200) {
  const { error } = await supabaseAdmin.from("oatccc_directory_schools").upsert(payload.slice(i, i + 200), { onConflict: "ohsaa_id" });
  if (error) throw new Error(`Directory: ${error.message}`);
}
console.log(`\nLoaded ${payload.length} directory rows; linked to a verification-list school: ${payload.filter((r) => r.oatccc_school_id).length}. Filled OHSAA IDs: ${fills.filter((x) => x.tournamentName && x.ohsaaId).length}.`);
