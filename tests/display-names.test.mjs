import test from "node:test";
import assert from "node:assert/strict";
import { nicknameAlias, personDisplayName, schoolBaseName, schoolLabel } from "../src/lib/display_names.mjs";

test("athlete names: Mc surnames, O' names, nicknames, ALL CAPS; correct names unchanged", () => {
  assert.equal(personDisplayName("Margaret Mcdonald"), "Margaret McDonald");
  assert.equal(personDisplayName("Ashley O'brien"), "Ashley O'Brien");
  assert.equal(personDisplayName("Lillian (Lily) Kiser"), "Lillian Kiser");
  assert.equal(nicknameAlias("Lillian (Lily) Kiser"), "Lily Kiser");
  assert.equal(personDisplayName("KENNY LI"), "Kenny Li");
  for (const ok of ["Mckenzie Dorris", "Kaylee O'Neill", "Makayla McLoughlin", "Ezekiel Macnamara", "Mackenzie Patch", "Brice Fuller"]) assert.equal(personDisplayName(ok), ok);
});

test("school names: one style, generic leftovers kept, city only when the name is shared", () => {
  assert.equal(schoolBaseName("Perrysburg High School"), "Perrysburg");
  assert.equal(schoolBaseName("Hathaway Brown School"), "Hathaway Brown");
  assert.equal(schoolBaseName("DELAWARE CHRISTIAN SCHOOL"), "Delaware Christian");
  assert.equal(schoolBaseName("University School"), "University School");
  assert.equal(schoolBaseName("School for Creative and Performing Arts"), "School for Creative and Performing Arts");
  assert.equal(schoolLabel("Highland", "Medina", ["highland"]), "Highland (Medina)");
  assert.equal(schoolLabel("Fairless", "Navarre", ["highland"]), "Fairless");
  assert.equal(schoolLabel("PERRY", "MASSILLON", ["perry"]), "Perry (Massillon)");
});
