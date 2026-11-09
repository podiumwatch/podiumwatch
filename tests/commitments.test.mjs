import test from "node:test";
import assert from "node:assert/strict";
import { commitmentCardSvg, commitmentLevel, latestCommitments } from "../lib/commitments_service.mjs";

test("levels from the recorded division, never guessed", () => {
  assert.equal(commitmentLevel("NCAA Division I"), "NCAA I");
  assert.equal(commitmentLevel("D2"), "NCAA II");
  assert.equal(commitmentLevel("NCAA Division III"), "NCAA III");
  assert.equal(commitmentLevel("NAIA"), "NAIA");
  assert.equal(commitmentLevel("NJCAA Division I"), "NJCAA");
  assert.equal(commitmentLevel(null), "Level not listed");
  assert.equal(commitmentLevel("club"), "Other");
});

test("one row per athlete: a signing beats the earlier commitment, a newer commitment wins", () => {
  const rows = [
    { profile_id: "a", activity_type: "commitment", activity_date: "2026-09-01", college_name: "X" },
    { profile_id: "a", activity_type: "signing", activity_date: "2026-11-11", college_name: "X" },
    { profile_id: "b", activity_type: "commitment", activity_date: "2026-08-01", college_name: "Y" },
    { profile_id: "b", activity_type: "commitment", activity_date: "2026-10-01", college_name: "Z" }
  ];
  const result = latestCommitments(rows);
  assert.equal(result.length, 2);
  assert.equal(result.find((row) => row.profile_id === "a").activity_type, "signing");
  assert.equal(result.find((row) => row.profile_id === "b").college_name, "Z");
});

test("share card: brand colors by gender, escaped text, site address, no em dashes", () => {
  const base = { athlete_name: "Bennett Lehman", school_name: "Ansonia", college: "Youngstown State", level: "Level not listed", division_label: null, gender: "boys", class_year: 2027 };
  const boys = commitmentCardSvg(base);
  assert.match(boys, /width="1080" height="1350"/);
  assert.match(boys, /#0FAF68/);
  assert.match(boys, /podiumwatch\.org\/commitments/);
  assert.doesNotMatch(boys, /Level not listed/, "an unknown level is left off the card");
  const girls = commitmentCardSvg({ ...base, gender: "girls", athlete_name: "A & B <C>", college: "Notre Dame", level: "NCAA I" });
  assert.match(girls, /#EC4899/);
  assert.match(girls, /A &amp; B &lt;C&gt;/);
  assert.ok(!/—/.test(boys + girls));
});

test("college lookup fills a missing level; unknown colleges stay not listed", async () => {
  const { levelForCollege } = await import("../lib/commitments_service.mjs");
  assert.equal(levelForCollege("Youngstown State", null), "NCAA I");
  assert.equal(levelForCollege("Kenyon College", ""), "NCAA III");
  assert.equal(levelForCollege("Some Unknown College", null), "Level not listed");
  assert.equal(levelForCollege("Youngstown State", "NCAA Division II"), "NCAA II", "a recorded division always wins");
});
