// Imports the Ohio XC 2026 Athletic.net season-best rankings dataset
// (8,001 rows: Boys and Girls Divisions I-IV, 5,000m) into
// athlete_profiles / athlete_performances. See
// lib/athletic_net_rankings_service.mjs for the full design rationale.
//
// Usage (run from the repo root):
//   node --env-file=.env.local dataimports/import-ohio-xc-2026-athletic-net-rankings.mjs --preview
//   node --env-file=.env.local dataimports/import-ohio-xc-2026-athletic-net-rankings.mjs --commit
//
// --preview (default if no flag given) only reads from the database to
// match athletes and schools -- it writes nothing. --commit performs the
// real, idempotent upsert described in lib/athletic_net_rankings_service.mjs.
import fs from "node:fs";
import {
  parseAthleticNetRankingsCsv,
  validateCsvHeader,
  previewAthleticNetRankingsImport,
  commitAthleticNetRankingsImport,
  EXPECTED_COLUMNS
} from "../lib/athletic_net_rankings_service.mjs";

const CSV_PATH = "dataimports/ohio_xc_2026_top_1000_all_divisions_week7.csv";
const mode = process.argv.includes("--commit") ? "commit" : "preview";

const csvText = fs.readFileSync(CSV_PATH, "utf8");
const rawRows = parseAthleticNetRankingsCsv(csvText);

console.log(`Parsed ${rawRows.length} rows from ${CSV_PATH}.`);

const headerErrors = validateCsvHeader(Object.keys(rawRows[0] || {}));
if (headerErrors.length) {
  console.error("Header validation failed:");
  headerErrors.forEach((e) => console.error(" -", e));
  process.exit(1);
}
console.log(`Header OK: all ${EXPECTED_COLUMNS.length} expected columns present.`);

function printSummary(label, summary, datasetCheck) {
  console.log(`\n=== ${label} summary ===`);
  console.log(JSON.stringify(summary, null, 2));
  if (datasetCheck?.errors?.length) {
    console.log("\nDataset shape warnings:");
    datasetCheck.errors.forEach((e) => console.log(" -", e));
  } else {
    console.log("\nDataset shape: matches the expected per-division counts and total exactly.");
  }
}

if (mode === "preview") {
  const preview = await previewAthleticNetRankingsImport(rawRows);
  printSummary("PREVIEW (read-only, nothing written)", preview.summary, preview.dataset_check);

  const sampleUnmatched = preview.rows.filter((r) => r.row_status === "unmatched").slice(0, 15);
  if (sampleUnmatched.length) {
    console.log(`\nSample unmatched rows (first ${sampleUnmatched.length}):`);
    sampleUnmatched.forEach((r) => console.log(` - row ${r.row_number}: ${r.athlete_name} (${r.school_name}) -- ${r.errors.join(" ")}`));
  }
  const invalid = preview.rows.filter((r) => r.row_status === "invalid");
  if (invalid.length) {
    console.log(`\nInvalid rows (${invalid.length}), first 15:`);
    invalid.slice(0, 15).forEach((r) => console.log(` - row ${r.row_number}: ${r.errors.join(" ")}`));
  }
  const ambiguous = preview.rows.filter((r) => r.row_status === "ambiguous");
  if (ambiguous.length) {
    console.log(`\nAmbiguous rows (${ambiguous.length}), first 15:`);
    ambiguous.slice(0, 15).forEach((r) => console.log(` - row ${r.row_number}: ${r.athlete_name} (${r.school_name})`));
  }
} else {
  const result = await commitAthleticNetRankingsImport(rawRows, {
    sourceUrl: rawRows[0]?.rankings_page_url || null
  });
  printSummary("COMMIT", result.summary, result.dataset_check);
  console.log("\nBatch id:", result.batch_id);
  if (result.warnings?.length) {
    console.log(`\nWarnings (${result.warnings.length}):`);
    result.warnings.forEach((w) => console.log(" -", w));
  }
}
