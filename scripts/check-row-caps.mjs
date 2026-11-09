// Fails when code in api/ or lib/ asks Supabase for more than 1,000 rows
// with .limit(N). PostgREST returns at most 1,000 rows per request no
// matter what .limit() says, so such a query silently truncates (the
// 2026-11-09 audit found 46 of them: a 1,000-athlete directory, wrong
// State Leaders, mismatched admin totals). Use selectAll() from
// lib/supabase_paging.mjs instead. Comment lines are ignored.
//
//   node scripts/check-row-caps.mjs        (also runs inside npm run check)
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const LIMIT = /\.limit\(\s*(\d+)\s*\)/g;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(m?js)$/.test(entry.name)) out.push(full);
  }
  return out;
}

export function findRowCapViolations(source) {
  const problems = [];
  source.split(/\r?\n/).forEach((line, index) => {
    const code = line.replace(/\/\/.*$/, "");
    if (/^\s*\*/.test(line)) return;
    for (const match of code.matchAll(LIMIT)) {
      if (Number(match[1]) > 1000) problems.push({ line: index + 1, limit: Number(match[1]) });
    }
  });
  return problems;
}

export function checkRowCaps() {
  const failures = [];
  for (const dir of ["api", "lib"]) {
    for (const file of walk(path.join(root, dir))) {
      for (const problem of findRowCapViolations(fs.readFileSync(file, "utf8"))) {
        failures.push(`${path.relative(root, file).replace(/\\/g, "/")}:${problem.line} .limit(${problem.limit})`);
      }
    }
  }
  return failures;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"))) {
  const failures = checkRowCaps();
  if (failures.length) {
    console.error(`Supabase row cap: ${failures.length} quer${failures.length === 1 ? "y asks" : "ies ask"} for more than 1,000 rows with .limit(). PostgREST returns at most 1,000 per request; use selectAll() from lib/supabase_paging.mjs.`);
    for (const failure of failures) console.error(`  ${failure}`);
    process.exit(1);
  }
  console.log("Supabase row cap check passed: no .limit() over 1,000 in api/ or lib/.");
}
