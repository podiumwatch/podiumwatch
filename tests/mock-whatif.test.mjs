// The Mock State "What if?" editor re-scores in the browser
// (public/scripts/mock-whatif.js). These tests hold it to the server's own
// engine (src/lib/mock_scoring.mjs): with no edits it must reproduce every
// published State result exactly, and with an edit it must match the
// engine run on the same edited field.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { scoreTeams } from "../src/lib/mock_scoring.mjs";
import { stateWhatIfField } from "../src/pages/mockpostseason.mjs";

const read = (rel) => fs.readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const sandbox = {};
vm.runInNewContext(read("../public/scripts/mock-whatif.js"), sandbox);
// The script runs in its own realm; copy its results into plain values so
// strict deep-equality compares contents, not array prototypes.
const plain = (v) => JSON.parse(JSON.stringify(v));
const { parseTime, formatTime } = sandbox.PWWhatIf;
const scoreField = (field, edits) => plain(sandbox.PWWhatIf.scoreField(field, edits));

const seasonData = JSON.parse(read("../src/data/mock-postseason-2026.json"));
const realData = JSON.parse(read("../src/data/mock-postseason-2026-real.json"));
const realBases = JSON.parse(read("../src/data/mock-postseason-2026-real-state-bases.json"));

const sections = [
  ...Object.entries(seasonData.stateResults).map(([k, s]) => [`season ${k}`, s]),
  ...Object.entries(realData.stateResults).map(([k, s]) => [`real ${k}`, s]),
  ...Object.entries(realBases).flatMap(([basis, byKey]) => Object.entries(byKey).map(([k, s]) => [`real ${basis} ${k}`, s]))
].filter(([, s]) => !s.unavailable && !s.incomplete && s.teams && s.teams.length);

test("parses and formats what-if times", () => {
  assert.equal(parseTime("15:44"), 94400);
  assert.equal(parseTime("15:44.2"), 94420);
  assert.equal(parseTime(" 15:44.25 "), 94425);
  assert.equal(parseTime("9:59.9"), 59990);
  assert.equal(parseTime("15:60"), null);
  assert.equal(parseTime("1544"), null);
  assert.equal(parseTime("7:00"), null, "below 8:00 is rejected");
  assert.equal(parseTime("46:00"), null, "above 45:00 is rejected");
  assert.equal(formatTime(94400), "15:44.0");
  assert.equal(formatTime(94420), "15:44.2");
  assert.equal(formatTime(94425), "15:44.25");
});

test(`with no edits, reproduces every published State result (${sections.length} sections)`, () => {
  assert.ok(sections.length >= 30, `expected all State sections, got ${sections.length}`);
  for (const [label, s] of sections) {
    const result = scoreField(stateWhatIfField(s), {});
    const published = s.teams.filter((t) => t.complete);
    const mine = result.teams.filter((t) => t.complete);
    assert.deepEqual(mine.map((t) => t.name), published.map((t) => t.name), `${label}: team order`);
    mine.forEach((t, i) => {
      assert.equal(t.score, published[i].score, `${label}: ${t.name} score`);
      assert.equal(t.sixth, published[i].sixthPlace, `${label}: ${t.name} sixth`);
      assert.equal(t.rank, i + 1, `${label}: ${t.name} rank`);
    });
    const indPlace = new Map(result.individuals.map((r) => [r.key, r.place]));
    for (const q of s.individuals || []) {
      assert.equal(indPlace.get(`${q.originalTeam}|${q.name}`), q.placePoints, `${label}: individual ${q.name} overall place`);
    }
  }
});

test("an edited time re-scores exactly like the server engine", () => {
  for (const [label, s] of sections.filter(([l]) => /D4$|D2$/.test(l)).slice(0, 6)) {
    const field = stateWhatIfField(s);
    // Move the 5th runner of the 4th-ranked team to the front of the race.
    const target = s.teams.filter((t) => t.complete)[3];
    const runner = [...target.runners].sort((a, b) => a.timeCentiseconds - b.timeCentiseconds)[4];
    const fastest = Math.min(...s.teams.flatMap((t) => t.runners.map((r) => r.timeCentiseconds)), ...(s.individuals || []).map((q) => q.timeCentiseconds));
    const newCs = fastest - 10;
    const edits = { [`${target.name}|${runner.name}`]: newCs };

    const engine = scoreTeams(s.teams.map((t) => ({
      name: t.name,
      runners: t.runners.map((r) => ({ name: r.name, timeCentiseconds: t.name === target.name && r.name === runner.name ? newCs : r.timeCentiseconds }))
    })), []);
    const mine = scoreField(field, edits);
    const engineComplete = engine.teams.filter((t) => t.complete);
    const mineComplete = mine.teams.filter((t) => t.complete);
    assert.deepEqual(mineComplete.map((t) => [t.name, t.score, t.sixth]), engineComplete.map((t) => [t.name, t.score, t.sixthPlace]), `${label}: edited standings`);
    assert.equal(mine.runners.find((r) => r.key === `${target.name}|${runner.name}`).place, 1, `${label}: edited runner now first overall`);
  }
});

test("a team below five runners is not scored", () => {
  const field = { teams: [
    { name: "A", label: "A", runners: [1, 2, 3, 4, 5].map((n) => ({ key: `A|${n}`, name: String(n), label: String(n), cs: 90000 + n })) },
    { name: "B", label: "B", runners: [1, 2, 3, 4].map((n) => ({ key: `B|${n}`, name: String(n), label: String(n), cs: 89000 + n })) }
  ], individuals: [] };
  const r = scoreField(field, {});
  assert.equal(r.teams[0].name, "A");
  assert.equal(r.teams[0].score, 5 + 6 + 7 + 8 + 9, "B's runners still take places 1-4");
  assert.equal(r.teams[1].complete, false);
  assert.equal(r.teams[1].score, null);
});
