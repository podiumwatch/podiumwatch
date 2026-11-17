// Loads the OATCCC school list and 2027 divisions from the OATCCC's
// workbook into install/102_OATCCC_SCHOOL_DIVISIONS.sql's tables.
//
// The workbook is the OATCCC's private document: keep it out of git (it
// lives in dataimports/, which is never committed for these files).
//
// Dry run (default): reads the workbook, prints the counts and every data
// issue, writes nothing.
//   node scripts/import-oatccc-school-divisions.mjs --file "<path to .xlsx>"
//
// Write (only on Zachary's OK, after migration 102 has been run):
//   node --env-file=.env.local scripts/import-oatccc-school-divisions.mjs --file "<path>" --apply
//
// --apply uses the server secret key (SUPABASE_URL, SUPABASE_SECRET_KEY)
// on this machine only. It upserts the 812 verification-list schools by
// tournament name and the boys/girls division rows by (year, gender,
// tournament name). It never deletes anything and never touches TEST rows.
// Safe to run again.
import readXlsxFile from "read-excel-file/node";
import { SHEETS, parseVerificationNames, parseDivisionRows, findIssues, databaseRows } from "../lib/oatccc_school_list.mjs";

const MEET_YEAR = 2027;

function arg(name) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : null;
}

const file = arg("--file");
const apply = process.argv.includes("--apply");
const asJson = process.argv.includes("--json");
if (!file) {
  console.error('Usage: node scripts/import-oatccc-school-divisions.mjs --file "<workbook.xlsx>" [--apply] [--json]');
  process.exit(1);
}

const sheets = await readXlsxFile(file);
const sheet = (name) => {
  const found = sheets.find((s) => s.sheet === name);
  if (!found) throw new Error(`The workbook has no "${name}" sheet.`);
  return found.data;
};

const list = parseVerificationNames(sheet(SHEETS.names));
const boys = parseDivisionRows(sheet(SHEETS.boys), "boys");
const girls = parseDivisionRows(sheet(SHEETS.girls), "girls");
const issues = findIssues({ names: list.names, boys, girls });
const rows = databaseRows({ names: list.names, boys, girls }, MEET_YEAR);

const label = (row) => `${row.gender} row ${row.sheetRow}: ${row.schoolName || "(no school name)"}, ${row.city || "(no city)"}${row.tournamentName ? ` [${row.tournamentName}]` : ""}${row.ohsaaIdRaw ? ` OHSAA ${row.ohsaaIdRaw}` : ""}`;

if (asJson) {
  console.log(JSON.stringify({ counts: { names: list.names.length, boys: boys.length, girls: girls.length }, trimmed: list.trimmed, duplicates: list.duplicates, issues }, null, 2));
} else {
  console.log(`Verification list: ${list.names.length} names (${list.trimmed.length} trimmed, ${list.duplicates.length} duplicates dropped)`);
  for (const name of list.trimmed) console.log(`  trimmed: ${JSON.stringify(name)}`);
  for (const name of list.duplicates) console.log(`  duplicate: ${name}`);
  console.log(`Boys division rows: ${boys.length}. Girls division rows: ${girls.length}.`);
  const section = (title, items, fmt = label) => {
    console.log(`\n${title}: ${items.length}`);
    for (const item of items) console.log(`  ${fmt(item)}`);
  };
  section("Division but no name on the verification list (an AD can't pick them)", issues.divisionButNotOnList);
  section("Division but no tournament name (not imported)", issues.noTournamentName);
  section("Division rows without an OHSAA id", issues.noOhsaaId);
  section("Division doesn't match the enrollment tables", issues.divisionMismatch, (row) => `${label(row)} enrollment ${row.enrollment} division ${row.division}`);
  section("Unknown division value", issues.unknownDivision, (row) => `${label(row)} division ${JSON.stringify(row.division)}`);
  section("Same tournament name twice in one sheet", issues.duplicateKeys);
  section("On the verification list, no boys division", issues.onListWithoutDivision.boys, (name) => name);
  section("On the verification list, no girls division", issues.onListWithoutDivision.girls, (name) => name);
  console.log(`\nReady to load: ${rows.schools.length} schools, ${rows.divisions.length} division rows (${MEET_YEAR}).`);
}

if (!apply) {
  if (!asJson) console.log("Dry run: nothing written. Add --apply to load (only on Zachary's OK, after migration 102).");
  process.exit(0);
}

if (issues.duplicateKeys.length) {
  console.error("Stopped: the same tournament name appears twice in one sheet. Ask the OATCCC which row is right.");
  process.exit(1);
}

const { supabaseAdmin } = await import("../lib/supabase-admin.mjs");
const chunk = (items, size) => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size));

for (const batch of chunk(rows.schools, 200)) {
  const { error } = await supabaseAdmin.from("oatccc_schools").upsert(batch, { onConflict: "tournament_name" });
  if (error) throw new Error(`Schools: ${error.message}`);
}
for (const batch of chunk(rows.divisions, 200)) {
  const { error } = await supabaseAdmin.from("oatccc_school_divisions").upsert(batch, { onConflict: "meet_year,gender,tournament_name" });
  if (error) throw new Error(`Divisions: ${error.message}`);
}
console.log(`Loaded ${rows.schools.length} schools and ${rows.divisions.length} division rows.`);
