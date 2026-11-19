// OATCCC school list and divisions (lib/oatccc_school_list.mjs) and the
// "Divisions by school" switch. TEST rows only: the OATCCC's workbook is
// never in the repository.
import test from "node:test";
import assert from "node:assert/strict";
import { parseVerificationNames, parseDivisionRows, findIssues, databaseRows, divisionForEnrollment } from "../lib/oatccc_school_list.mjs";
import { oatcccFlags } from "../src/oatccc/config.mjs";
import { oatcccOutputs } from "../src/oatccc/build.mjs";
import { site } from "../src/config/site.mjs";

const HEAD = (g) => ["OhsaaSchoolId", "SchoolName", "City", "AthleticDistrict", `${g}BaseEnrollment`, `${g}TrackFieldTournamentDivision`, "OhsaaTournamentName", "HyTekCode"];

const namesSheet = [["OhsaaTournamentName"], ["TEST ALPHA"], ["TEST BRAVO "], [null], ["TEST CHARLIE"], ["TEST ALPHA"]];
const boysSheet = [HEAD("Boys"),
  [1, "TEST ALPHA HS", "Testville", "Northeast", 500, "D-1", "TEST ALPHA", "TALP"],
  [2, "TEST BRAVO HS", "Testville", "Northeast", 200, "D-3", "TEST BRAVO", "TBRA"],
  [null, "TEST DELTA HS", "Testville", "Northeast", 100, "D-4", null, "TDEL"],
  [4, "TEST ECHO HS", "Testville", "Northeast", 300, "D-4", "TEST ECHO", "TECH"]];
const girlsSheet = [HEAD("Girls"),
  [1, "TEST ALPHA HS", "Testville", "Northeast", 460, "D-1", "TEST ALPHA", "TALP"],
  ["", "TEST BRAVO HS", "Testville", "Northeast", 210, "D-2", "TEST BRAVO", "TBRA"]];

test("names: trimmed, blanks skipped, duplicates dropped and reported", () => {
  const list = parseVerificationNames(namesSheet);
  assert.deepEqual(list.names, ["TEST ALPHA", "TEST BRAVO", "TEST CHARLIE"]);
  assert.deepEqual(list.trimmed, ["TEST BRAVO "]);
  assert.deepEqual(list.duplicates, ["TEST ALPHA"]);
});

test("a missing column stops the import", () => {
  assert.throws(() => parseDivisionRows([["OhsaaSchoolId", "SchoolName"]], "boys"), /no "City" column/);
});

test("enrollment tables (Anjanette, 2027)", () => {
  assert.equal(divisionForEnrollment("girls", 449), "D-1");
  assert.equal(divisionForEnrollment("girls", 448), "D-2");
  assert.equal(divisionForEnrollment("boys", 464), "D-2");
  assert.equal(divisionForEnrollment("boys", 465), "D-1");
  assert.equal(divisionForEnrollment("boys", 124), "D-4");
  assert.equal(divisionForEnrollment("girls", 124), "D-3");
});

test("issues are reported, never fixed", () => {
  const names = parseVerificationNames(namesSheet).names;
  const boys = parseDivisionRows(boysSheet, "boys");
  const girls = parseDivisionRows(girlsSheet, "girls");
  const issues = findIssues({ names, boys, girls });
  assert.deepEqual(issues.noTournamentName.map((r) => r.schoolName), ["TEST DELTA HS"]);
  assert.deepEqual(issues.divisionButNotOnList.map((r) => r.tournamentName), ["TEST ECHO"]);
  assert.deepEqual(issues.noOhsaaId.map((r) => `${r.gender}:${r.schoolName}`), ["boys:TEST DELTA HS", "girls:TEST BRAVO HS"]);
  assert.deepEqual(issues.divisionMismatch.map((r) => r.tournamentName), ["TEST ECHO"]);
  assert.deepEqual(issues.onListWithoutDivision, { boys: ["TEST CHARLIE"], girls: ["TEST CHARLIE"] });
  // Nothing changed in the rows themselves.
  assert.equal(boys.find((r) => r.tournamentName === "TEST ECHO").division, "D-4");
});

test("database rows: keyed on tournament name; no name, not loaded", () => {
  const names = parseVerificationNames(namesSheet).names;
  const rows = databaseRows({ names, boys: parseDivisionRows(boysSheet, "boys"), girls: parseDivisionRows(girlsSheet, "girls") }, 2027);
  assert.deepEqual(rows.schools.map((s) => [s.tournament_name, s.ohsaa_id, s.hytek_code, s.on_verification_list]), [["TEST ALPHA", 1, "TALP", true], ["TEST BRAVO", 2, "TBRA", true], ["TEST CHARLIE", null, null, true]]);
  assert.equal(rows.divisions.length, 5);
  assert.ok(rows.divisions.every((d) => d.tournament_name && d.meet_year === 2027));
});

test("Divisions by school: only with its own switch, on top of OATCCC_LIVE", () => {
  const page = (env) => oatcccOutputs(site, oatcccFlags(env)).pages.find((p) => p.pathname === "/oatccc/indoor/high-school/divisions/");
  const assets = (env) => oatcccOutputs(site, oatcccFlags(env)).assets.map(([, to]) => to);
  assert.doesNotMatch(page({ OATCCC_LIVE: "1" }).html, /data-ox-divisions/);
  assert.ok(!assets({ OATCCC_LIVE: "1" }).includes("scripts/oatccc-divisions.js"));
  assert.equal(oatcccFlags({ OATCCC_DIVISION_LIST_LIVE: "1" }).divisionList, false);
  const on = { OATCCC_LIVE: "1", OATCCC_DIVISION_LIST_LIVE: "1" };
  assert.match(page(on).html, /Divisions by school/);
  assert.match(page(on).html, /\/scripts\/oatccc-divisions\.js/);
  assert.ok(assets(on).includes("scripts/oatccc-divisions.js"));
});

test("division API answers 404 while switched off", async () => {
  delete process.env.OATCCC_LIVE;
  delete process.env.OATCCC_DIVISION_LIST_LIVE;
  const { default: handler } = await import("../api/oatccc/divisions.js");
  let status = 0;
  const response = { setHeader() {}, status(code) { status = code; return this; }, json() { return this; } };
  await handler({ method: "GET", query: {} }, response);
  assert.equal(status, 404);
});
