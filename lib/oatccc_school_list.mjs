// OATCCC school list and divisions, from the OATCCC's workbook
// "2027-OATCCC-Divisions - Verification School Names.xlsx" (Anjanette,
// Nov 17, 2026). The workbook is the OATCCC's private document and is
// never committed; scripts/import-oatccc-school-divisions.mjs reads it
// from disk and calls these pure functions.
//
// Sheets used:
//   "Verification School Names"  one column, OhsaaTournamentName: the ONLY
//                                names allowed in the AD form's dropdown.
//   "Boys-OATCCC-Divisions"      OhsaaSchoolId, SchoolName, City,
//   "Girls-OATCCC-Divisions"     AthleticDistrict, <Boys|Girls>BaseEnrollment,
//                                <Boys|Girls>TrackFieldTournamentDivision,
//                                OhsaaTournamentName, HyTekCode
//
// Nothing is guessed or fixed here: names are only trimmed, and every
// problem is reported back for the OATCCC to answer.

export const SHEETS = {
  names: "Verification School Names",
  boys: "Boys-OATCCC-Divisions",
  girls: "Girls-OATCCC-Divisions"
};

export const DIVISIONS = ["D-1", "D-2", "D-3", "D-4"];

// Anjanette's enrollment tables for 2027 (her answers, Nov 17, 2026).
export const ENROLLMENT_RANGES = {
  girls: { "D-1": [449, Infinity], "D-2": [207, 448], "D-3": [124, 206], "D-4": [1, 123] },
  boys: { "D-1": [465, Infinity], "D-2": [221, 464], "D-3": [125, 220], "D-4": [1, 124] }
};

const text = (value) => (value === null || value === undefined ? "" : String(value).trim());

function headerIndex(header, wanted, sheet) {
  const index = header.findIndex((cell) => text(cell) === wanted);
  if (index < 0) throw new Error(`Sheet "${sheet}" has no "${wanted}" column.`);
  return index;
}

// rows: array of arrays, first row the header.
export function parseVerificationNames(rows) {
  if (!rows?.length) throw new Error(`Sheet "${SHEETS.names}" is empty.`);
  const col = headerIndex(rows[0], "OhsaaTournamentName", SHEETS.names);
  const names = [];
  const trimmed = [];
  const duplicates = [];
  const seen = new Set();
  for (const row of rows.slice(1)) {
    const raw = row[col];
    if (raw === null || raw === undefined || String(raw).trim() === "") continue;
    const name = text(raw);
    if (String(raw) !== name) trimmed.push(String(raw));
    if (seen.has(name)) { duplicates.push(name); continue; }
    seen.add(name);
    names.push(name);
  }
  return { names, trimmed, duplicates };
}

export function parseDivisionRows(rows, gender) {
  const sheet = SHEETS[gender];
  if (!rows?.length) throw new Error(`Sheet "${sheet}" is empty.`);
  const label = gender === "boys" ? "Boys" : "Girls";
  const header = rows[0];
  const col = {
    ohsaaId: headerIndex(header, "OhsaaSchoolId", sheet),
    schoolName: headerIndex(header, "SchoolName", sheet),
    city: headerIndex(header, "City", sheet),
    district: headerIndex(header, "AthleticDistrict", sheet),
    enrollment: headerIndex(header, `${label}BaseEnrollment`, sheet),
    division: headerIndex(header, `${label}TrackFieldTournamentDivision`, sheet),
    tournamentName: headerIndex(header, "OhsaaTournamentName", sheet),
    hytek: headerIndex(header, "HyTekCode", sheet)
  };
  const out = [];
  rows.slice(1).forEach((row, i) => {
    if (row.every((cell) => text(cell) === "")) return;
    const ohsaa = text(row[col.ohsaaId]);
    const enrollment = text(row[col.enrollment]);
    out.push({
      gender,
      sheetRow: i + 2,
      ohsaaId: /^\d+$/.test(ohsaa) ? Number(ohsaa) : null,
      ohsaaIdRaw: ohsaa,
      schoolName: text(row[col.schoolName]),
      city: text(row[col.city]),
      district: text(row[col.district]),
      enrollment: /^\d+$/.test(enrollment) ? Number(enrollment) : null,
      division: text(row[col.division]),
      tournamentName: text(row[col.tournamentName]),
      hytekCode: text(row[col.hytek])
    });
  });
  return out;
}

export function divisionForEnrollment(gender, enrollment) {
  if (!Number.isFinite(enrollment)) return null;
  for (const [division, [low, high]] of Object.entries(ENROLLMENT_RANGES[gender])) {
    if (enrollment >= low && enrollment <= high) return division;
  }
  return null;
}

// Everything the OATCCC should look at. Reported, never fixed.
export function findIssues({ names, boys, girls }) {
  const list = new Set(names);
  const issues = {
    divisionButNotOnList: [],   // a division, but an AD can't pick the school
    noTournamentName: [],       // can't be keyed; not imported
    noOhsaaId: [],
    divisionMismatch: [],       // division doesn't match the enrollment tables
    unknownDivision: [],
    duplicateKeys: [],          // same tournament name twice in one sheet
    onListWithoutDivision: { boys: [], girls: [] }
  };
  for (const rows of [boys, girls]) {
    const seen = new Set();
    for (const row of rows) {
      if (!row.tournamentName) issues.noTournamentName.push(row);
      else if (!list.has(row.tournamentName)) issues.divisionButNotOnList.push(row);
      if (row.tournamentName) {
        if (seen.has(row.tournamentName)) issues.duplicateKeys.push(row);
        seen.add(row.tournamentName);
      }
      if (row.ohsaaId === null) issues.noOhsaaId.push(row);
      if (!DIVISIONS.includes(row.division)) issues.unknownDivision.push(row);
      else if (row.enrollment !== null && divisionForEnrollment(row.gender, row.enrollment) !== row.division) issues.divisionMismatch.push(row);
    }
  }
  for (const [gender, rows] of [["boys", boys], ["girls", girls]]) {
    const has = new Set(rows.map((row) => row.tournamentName).filter(Boolean));
    issues.onListWithoutDivision[gender] = names.filter((name) => !has.has(name));
  }
  return issues;
}

// Rows ready for the database (install/102_OATCCC_SCHOOL_DIVISIONS.sql).
// Division rows without a tournament name can't be keyed and are left
// out (they are in the issues report).
export function databaseRows({ names, boys, girls }, meetYear) {
  const byName = new Map();
  for (const row of [...boys, ...girls]) {
    if (!row.tournamentName) continue;
    const school = byName.get(row.tournamentName) || {};
    if (school.ohsaa_id == null && row.ohsaaId !== null) school.ohsaa_id = row.ohsaaId;
    if (!school.hytek_code && row.hytekCode) school.hytek_code = row.hytekCode;
    if (!school.city && row.city) school.city = row.city;
    if (!school.ohsaa_school_name && row.schoolName) school.ohsaa_school_name = row.schoolName;
    byName.set(row.tournamentName, school);
  }
  const schools = names.map((name) => ({
    name,
    tournament_name: name,
    city: byName.get(name)?.city || null,
    ohsaa_id: byName.get(name)?.ohsaa_id ?? null,
    ohsaa_school_name: byName.get(name)?.ohsaa_school_name || null,
    hytek_code: byName.get(name)?.hytek_code || null,
    on_verification_list: true,
    is_test: false
  }));
  const divisions = [...boys, ...girls]
    .filter((row) => row.tournamentName)
    .map((row) => ({
      meet_year: meetYear,
      gender: row.gender,
      tournament_name: row.tournamentName,
      ohsaa_id: row.ohsaaId,
      ohsaa_school_name: row.schoolName || null,
      city: row.city || null,
      athletic_district: row.district || null,
      enrollment: row.enrollment,
      division: row.division,
      hytek_code: row.hytekCode || null
    }));
  return { schools, divisions };
}
