// Builds src/oatccc/more/leaders.json from Matt Schock's OATCCC leadership
// list (a private CSV kept in _private/, never committed).
//
//   node scripts/oatccc-leaders-import.mjs _private/oatccc-leaders-2026-emails-only.csv
//
// Only these columns are read: Position, First Name, Last Name,
// School/Affiliation, OATCCC Email, Personal/Work Email. Any other column
// (phone numbers, mailing addresses) is ignored and never written anywhere.
// Wording is kept exactly as Matt wrote it. Email addresses are stored
// encoded (reversed, then base64) so no plain address is in the repository
// or the page HTML; scripts/oatccc-email.js decodes them on tap.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "src", "oatccc", "more", "leaders.json");
const COLUMNS = ["Position", "First Name", "Last Name", "School/Affiliation", "OATCCC Email", "Personal/Work Email"];

export function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export const encodeEmail = (address) => Buffer.from([...address].reverse().join(""), "utf8").toString("base64");

export function leadersFromCsv(text) {
  const [head, ...body] = parseCsv(text);
  const at = COLUMNS.map((name) => head.findIndex((h) => h.trim() === name));
  const missing = COLUMNS.filter((_, i) => at[i] < 0);
  if (missing.length) throw new Error(`Missing column(s): ${missing.join(", ")}`);
  const leaders = [];
  for (const cells of body) {
    const [role, first, last, affiliation, oatccc, personal] = at.map((i) => cells[i] ?? "");
    if (!role.trim()) continue;
    const emails = [oatccc, personal].map((e) => e.trim()).filter(Boolean)
      .filter((e, i, all) => all.findIndex((x) => x.toLowerCase() === e.toLowerCase()) === i);
    for (const e of emails) if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error(`Not an email address in row "${role}"`);
    leaders.push({
      role: role.trim(),
      name: `${first.trim()} ${last.trim()}`.trim(),
      affiliation: affiliation.trim(),
      e: emails.map(encodeEmail),
      photo: null
    });
  }
  return leaders;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) { console.error("Usage: node scripts/oatccc-leaders-import.mjs <csv>"); process.exit(1); }
  const leaders = leadersFromCsv(fs.readFileSync(file, "utf8"));
  const data = {
    source: "Matt Schock, 2026 OATCCC Contact Information (OATCCC President)",
    imported: new Date().toISOString().slice(0, 10),
    note: "Emails are reversed then base64 encoded. photo: a path under /images/oatccc/leaders/ when Matt sends headshots.",
    leaders
  };
  fs.writeFileSync(OUT, JSON.stringify(data, null, 2) + "\n");
  console.log(`${leaders.length} rows written to ${path.relative(ROOT, OUT)}`);
}
