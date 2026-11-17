// OHSAA school directory parser (lib/oatccc_directory.mjs). TEST rows
// only: the real directory is private and never in the repository.
import test from "node:test";
import assert from "node:assert/strict";
import { splitEmails, parseDirectory, resolveIdFills, ID_FILLS } from "../lib/oatccc_directory.mjs";

const HEAD = ["OHSAA ID", "School", "City", "County", "Public/Private", "OHSAA District", "XC Div", "T&F Div", "Athletic Dept Phone", "Athletic Director", "AD Email", "Assistant ADs", "Boys XC Coach", "Boys XC Email", "Girls XC Coach", "Girls XC Email", "Boys T&F Coach", "Boys T&F Email", "Girls T&F Coach", "Girls T&F Email"];
const row = (id, school, city, adEmail, extra = {}) => {
  const r = HEAD.map(() => null);
  const set = (name, v) => { r[HEAD.indexOf(name)] = v; };
  set("OHSAA ID", id); set("School", school); set("City", city); set("Athletic Director", "TEST AD"); set("AD Email", adEmail);
  set("Athletic Dept Phone", "614-555-0100"); set("Assistant ADs", "TEST Assistant");
  for (const [k, v] of Object.entries(extra)) set(k, v);
  return r;
};

test("emails: split on ; , and spaces, lower case, duplicates and junk dropped", () => {
  assert.deepEqual(splitEmails(" A@Test.org; b@test.org , a@test.org  c@test.org"), { valid: ["a@test.org", "b@test.org", "c@test.org"], invalid: [] });
  assert.deepEqual(splitEmails("see office; d@test.org").invalid, ["see", "office"]);
  assert.deepEqual(splitEmails(null), { valid: [], invalid: [] });
});

test("directory rows: what is kept and what is not", () => {
  const { rows, problems } = parseDirectory([HEAD,
    row(101, "TEST ALPHA", "Testville", "ad1@test.org; ad2@test.org", { "Boys XC Coach": "TEST Coach", "Boys XC Email": "Coach@Test.org" }),
    row(102, "TEST BRAVO", "Testville", null),
    row(null, "TEST NO ID", "Testville", "x@test.org"),
    row(101, "TEST DUPLICATE", "Testville", "y@test.org")
  ], "2026-11-17");
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0].ad_emails, ["ad1@test.org", "ad2@test.org"]);
  assert.deepEqual(rows[0].boys_xc_emails, ["coach@test.org"]);
  assert.equal(rows[0].directory_date, "2026-11-17");
  for (const r of rows) {
    const json = JSON.stringify(r);
    assert.doesNotMatch(json, /555-0100|TEST Assistant/, "no phone numbers or assistant ADs");
  }
  assert.deepEqual(problems.noAdEmail, ["TEST BRAVO (Testville)"]);
  assert.equal(problems.noId, 1);
  assert.deepEqual(problems.duplicateId, [101]);
  assert.equal(problems.cellsWithSeveralAdEmails, 1);
});

test("missing OHSAA IDs: filled only from an exact school + city match", () => {
  const rows = ID_FILLS.map((f, i) => ({ ohsaa_id: 9000 + i, school_name: f.school, city: f.city }));
  const fills = resolveIdFills(rows);
  assert.ok(fills.every((f, i) => f.ohsaaId === 9000 + i && f.matches === 1));
  const none = resolveIdFills([{ ohsaa_id: 1, school_name: "TINORA", city: "Somewhere Else" }]);
  assert.equal(none.find((f) => f.tournamentName === "DEFIANCE TINORA").ohsaaId, null);
  assert.equal(ID_FILLS.length, 6);
});
