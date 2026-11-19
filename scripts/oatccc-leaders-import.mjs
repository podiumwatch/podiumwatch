// Builds src/oatccc/more/leaders.json from Matt Schock's OATCCC leadership
// list (a private CSV kept in _private/, never committed).
//
//   node scripts/oatccc-leaders-import.mjs _private/oatccc-leaders-2026-emails-only.csv
//
// Only these columns are read: Position, First Name, Last Name,
// School/Affiliation, OATCCC Email, Personal/Work Email, and (when present)
// Phone. Any other column (mailing addresses, "Phone Number" from older
// sheets) is ignored and never written anywhere. Wording is kept exactly as
// Matt wrote it. Email addresses and phone numbers are stored encoded
// (reversed, then base64) so no plain address or number is in the
// repository or the page HTML; scripts/oatccc-email.js decodes them on tap.
// Phone numbers: Matt approved them on 2026-11-19 (Zachary), except
// Anjanette Whitman's, who has none on any row.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { encodeEmail } from "../src/oatccc/email-protect.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "src", "oatccc", "more", "leaders.json");
const COLUMNS = ["Position", "First Name", "Last Name", "School/Affiliation", "OATCCC Email", "Personal/Work Email"];
const PHONE_COLUMN = "Phone";
const PHONE = /^\d{3}-\d{3}-\d{4}$/;

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

export { encodeEmail };

export function leadersFromCsv(text) {
  const [head, ...body] = parseCsv(text);
  const at = COLUMNS.map((name) => head.findIndex((h) => h.trim() === name));
  const phoneAt = head.findIndex((h) => h.trim() === PHONE_COLUMN);
  const missing = COLUMNS.filter((_, i) => at[i] < 0);
  if (missing.length) throw new Error(`Missing column(s): ${missing.join(", ")}`);
  const leaders = [];
  for (const cells of body) {
    const [role, first, last, affiliation, oatccc, personal] = at.map((i) => cells[i] ?? "");
    if (!role.trim()) continue;
    const emails = [oatccc, personal].map((e) => e.trim()).filter(Boolean)
      .filter((e, i, all) => all.findIndex((x) => x.toLowerCase() === e.toLowerCase()) === i);
    for (const e of emails) if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error(`Not an email address in row "${role}"`);
    const phone = phoneAt < 0 ? "" : String(cells[phoneAt] ?? "").trim();
    if (phone && !PHONE.test(phone)) throw new Error(`Phone not written as 000-000-0000 in row "${role}"`);
    leaders.push({
      role: role.trim(),
      name: `${first.trim()} ${last.trim()}`.trim(),
      affiliation: affiliation.trim(),
      e: emails.map(encodeEmail),
      t: phone ? [encodeEmail(phone)] : [],
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
    note: "e (emails) and t (phone) are reversed then base64 encoded. photo: a path under /images/oatccc/leaders/ when Matt sends headshots.",
    leaders
  };
  fs.writeFileSync(OUT, JSON.stringify(data, null, 2) + "\n");
  console.log(`${leaders.length} rows written to ${path.relative(ROOT, OUT)}`);
}
