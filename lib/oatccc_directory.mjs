// The OHSAA school directory (athletic directors and head coaches), for
// install/104_OATCCC_AD_DIRECTORY.sql. PRIVATE contact data: the
// spreadsheet is never committed, nothing from it goes on a public page,
// and in the database only OATCCC staff can read it. Pure functions; used
// by scripts/import-oatccc-directory.mjs.
//
// Only the "High Schools" tab is used (Zachary, 2026-11-17: not the
// middle school tab yet). Phone numbers and assistant ADs are not kept.

export const HIGH_SCHOOL_SHEET = "High Schools";

const COLUMNS = {
  ohsaaId: "OHSAA ID",
  school: "School",
  city: "City",
  county: "County",
  district: "OHSAA District",
  adName: "Athletic Director",
  adEmail: "AD Email",
  boysXc: "Boys XC Coach",
  boysXcEmail: "Boys XC Email",
  girlsXc: "Girls XC Coach",
  girlsXcEmail: "Girls XC Email",
  boysTf: "Boys T&F Coach",
  boysTfEmail: "Boys T&F Email",
  girlsTf: "Girls T&F Coach",
  girlsTfEmail: "Girls T&F Email"
};

const text = (v) => (v === null || v === undefined ? "" : String(v).replace(/\s+/g, " ").trim());
const EMAIL = /^[^\s@<>()",;:]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/;

// "a@x.org; B@Y.org , c@z.org" -> ["a@x.org", "b@y.org", "c@z.org"].
// Anything that is not an email is reported, not kept.
export function splitEmails(cell) {
  const valid = [];
  const invalid = [];
  for (const part of text(cell).split(/[;,\s]+/).map((p) => p.trim().toLowerCase()).filter(Boolean)) {
    if (EMAIL.test(part)) { if (!valid.includes(part)) valid.push(part); } else invalid.push(part);
  }
  return { valid, invalid };
}

export function parseDirectory(rows, directoryDate) {
  if (!rows?.length) throw new Error(`The "${HIGH_SCHOOL_SHEET}" tab is empty.`);
  const header = rows[0].map(text);
  const col = Object.fromEntries(Object.entries(COLUMNS).map(([key, name]) => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`The "${HIGH_SCHOOL_SHEET}" tab has no "${name}" column.`);
    return [key, i];
  }));
  const out = [];
  const problems = { noId: 0, duplicateId: [], invalidEmails: 0, cellsWithSeveralAdEmails: 0, noAdEmail: [] };
  const seen = new Set();
  rows.slice(1).forEach((r) => {
    if (r.every((c) => text(c) === "")) return;
    const id = Number(text(r[col.ohsaaId]));
    if (!Number.isInteger(id) || id <= 0) { problems.noId++; return; }
    if (seen.has(id)) { problems.duplicateId.push(id); return; }
    seen.add(id);
    const emails = (key) => { const e = splitEmails(r[col[key]]); problems.invalidEmails += e.invalid.length; return e.valid; };
    const adEmails = emails("adEmail");
    if (adEmails.length > 1) problems.cellsWithSeveralAdEmails++;
    const row = {
      ohsaa_id: id,
      school_name: text(r[col.school]),
      city: text(r[col.city]) || null,
      county: text(r[col.county]) || null,
      ohsaa_district: text(r[col.district]) || null,
      ad_name: text(r[col.adName]) || null,
      ad_emails: adEmails,
      boys_xc_coach: text(r[col.boysXc]) || null,
      boys_xc_emails: emails("boysXcEmail"),
      girls_xc_coach: text(r[col.girlsXc]) || null,
      girls_xc_emails: emails("girlsXcEmail"),
      boys_tf_coach: text(r[col.boysTf]) || null,
      boys_tf_emails: emails("boysTfEmail"),
      girls_tf_coach: text(r[col.girlsTf]) || null,
      girls_tf_emails: emails("girlsTfEmail"),
      directory_date: directoryDate
    };
    if (!adEmails.length) problems.noAdEmail.push(`${row.school_name} (${row.city || "no city"})`);
    out.push(row);
  });
  return { rows: out, problems };
}

// The OHSAA IDs missing from Anjanette's list that Zachary asked to fill
// from the directory (2026-11-17): our tournament name -> the directory's
// school name and city. Each must match exactly one directory row.
export const ID_FILLS = [
  { tournamentName: "DEFIANCE TINORA", school: "TINORA", city: "Defiance" },
  { tournamentName: "OREGON CARDINAL STRITCH", school: "CARDINAL STRITCH CATHOLIC", city: "Oregon" },
  { tournamentName: "KIDRON CENTRAL CHRISTIAN", school: "CENTRAL CHRISTIAN", city: "Kidron" },
  { tournamentName: "PUT-IN-BAY", school: "PUT-IN-BAY", city: "Put-In-Bay" },
  // Not on Anjanette's verification list, and her division rows for it
  // have no tournament name: there is no school row to attach the ID to.
  { tournamentName: null, label: "Our Lady of the Elms (Akron)", school: "OUR LADY OF THE ELMS", city: "Akron" },
  // Her list says "CLE. LINCOLN WEST"; her division rows say "Lincoln West
  // School of Global Studies" (still a question for her).
  { tournamentName: "CLE. LINCOLN WEST", school: "LINCOLN WEST", city: "Cleveland" }
];

export function resolveIdFills(directoryRows) {
  const same = (a, b) => text(a).toLowerCase() === text(b).toLowerCase();
  return ID_FILLS.map((fill) => {
    const hits = directoryRows.filter((r) => same(r.school_name, fill.school) && same(r.city, fill.city));
    return { ...fill, ohsaaId: hits.length === 1 ? hits[0].ohsaa_id : null, matches: hits.length };
  });
}
