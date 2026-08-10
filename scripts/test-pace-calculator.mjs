import assert from "node:assert/strict";

// public/scripts/pace-splits.js is a plain classic script (matching every
// other file in public/scripts/ -- see that file's header comment for
// why), so it attaches its functions to window rather than using export.
// A minimal window stub is all Node needs to load it directly here.
global.window = {};
await import("../public/scripts/pace-splits.js");

const {
  MILE_METERS,
  KM_METERS,
  milesToMeters,
  kmToMeters,
  totalSecondsFromParts,
  formatSplitTime,
  formatWholeTime,
  paceForUnit,
  buildCheckpoints
} = global.window.PodiumPaceSplits;

// --- unit conversion helpers (used by the splits calculator) ---------------

assert.equal(milesToMeters(1), MILE_METERS);
assert.ok(Math.abs(milesToMeters(26.2) - 42164.8128) < 0.001, "A marathon (26.2mi) must convert to its known meter distance.");
assert.equal(milesToMeters(0), 0);
assert.equal(milesToMeters(""), 0, "A blank distance input must convert to 0, never NaN.");
assert.equal(kmToMeters(1), KM_METERS);
assert.equal(kmToMeters(21.0975), 21097.5, "A half marathon (21.0975km) must convert to its known meter distance.");

assert.equal(totalSecondsFromParts({ hours: 0, minutes: 17, seconds: 0 }), 1020, "17:00 with no hours must match the existing pace calculator's plain minutes/seconds behavior.");
assert.equal(totalSecondsFromParts({ hours: 3, minutes: 45, seconds: 0 }), 13500, "A 3:45:00 marathon goal must include the hours field, which the original pace calculator never needed.");
assert.equal(totalSecondsFromParts({}), 0, "Missing parts must default to 0, never NaN.");

// --- formatWholeTime / formatSplitTime --------------------------------------

assert.equal(formatWholeTime(1020), "17:00", "17:00 goal time must format back to 17:00.");
assert.equal(formatWholeTime(75), "1:15");
assert.equal(formatWholeTime(6300), "1:45:00", "An hour-plus goal time (a half marathon's 1:45:00) must roll into H:MM:SS, not display as the meaningless 105:00.");
assert.equal(formatWholeTime(13500), "3:45:00", "A 3:45:00 marathon goal must format with hours too.");
assert.equal(formatWholeTime(3599), "59:59", "Just under an hour must still format as plain M:SS, matching the original pace calculator's behavior.");
assert.equal(formatWholeTime(3600), "1:00:00", "Exactly one hour must roll into H:MM:SS, not stay as 60:00.");
assert.equal(formatSplitTime(204), "3:24.0", "An even 204-second split is 3:24.0.");
assert.equal(formatSplitTime(-1), "--:--", "A negative/invalid time must show a placeholder, never a wrong number.");
assert.equal(formatSplitTime(12600), "3:30:00.0", "A marathon's late-mile cumulative total (3:30:00) must roll into H:MM:SS.s, not display as the meaningless 210:00.0.");
assert.equal(formatSplitTime(3599.9), "59:59.9", "Just under an hour must still format as plain M:SS.s.");

// --- paceForUnit --------------------------------------------------------------

assert.equal(
  paceForUnit(1020, 5000, 1000),
  204,
  "A 17:00 5K is exactly 5 even kilometers, so per-km pace is exactly 1020/5 = 204 seconds."
);
assert.ok(
  Math.abs(paceForUnit(1020, 5000, MILE_METERS) - 328.306176) < 0.001,
  "A 17:00 5K's per-mile pace must scale by the mile/5000 ratio."
);

// --- buildCheckpoints: 5K by kilometer -- evenly divisible (5000 / 1000 = 5) --

{
  const rows = buildCheckpoints({ distanceMeters: 5000, goalSeconds: 1020, stepMeters: 1000 });
  assert.equal(rows.length, 5, "A 5K split by kilometer must produce exactly 5 checkpoints, not a 6th empty one.");
  assert.deepEqual(rows.map((r) => r.distanceMeters), [1000, 2000, 3000, 4000, 5000]);
  assert.ok(rows.every((r) => !r.isPartial), "Every checkpoint in an evenly-divisible distance must be a full step, none partial.");
  assert.ok(rows.every((r) => Math.abs(r.splitSeconds - 204) < 0.001), "An even pace must produce equal 204-second splits throughout.");
  assert.ok(Math.abs(rows[4].cumulativeSeconds - 1020) < 0.001, "The final checkpoint's cumulative time must equal the goal time exactly.");
}

// --- buildCheckpoints: 1600m by 400m lap -- evenly divisible (1600 / 400 = 4) --

{
  const rows = buildCheckpoints({ distanceMeters: 1600, goalSeconds: 300, stepMeters: 400 });
  assert.equal(rows.length, 4, "A 1600m split by 400m lap must produce exactly 4 checkpoints.");
  assert.deepEqual(rows.map((r) => r.distanceMeters), [400, 800, 1200, 1600]);
  assert.ok(rows.every((r) => !r.isPartial));
  assert.ok(rows.every((r) => Math.abs(r.splitSeconds - 75) < 0.001), "A 5:00 mile is 4 even 75-second laps.");
  assert.ok(Math.abs(rows[3].cumulativeSeconds - 300) < 0.001);
}

// --- buildCheckpoints: 3 mile by kilometer -- remainder (4828.032 / 1000 = 4.828...) --

{
  const distanceMeters = 3 * MILE_METERS; // 4828.032
  const rows = buildCheckpoints({ distanceMeters, goalSeconds: 1080, stepMeters: 1000 });
  assert.equal(rows.length, 5, "3 miles by kilometer must produce 4 full kilometers plus one partial final checkpoint.");
  assert.deepEqual(rows.slice(0, 4).map((r) => r.distanceMeters), [1000, 2000, 3000, 4000]);
  assert.ok(Math.abs(rows[4].distanceMeters - distanceMeters) < 0.001, "The final checkpoint must land exactly on the true finish distance, not a rounded step.");
  assert.ok(rows.slice(0, 4).every((r) => !r.isPartial), "The first 4 full kilometers must not be marked partial.");
  assert.equal(rows[4].isPartial, true, "The final, short-of-a-full-km segment must be marked partial so the UI can label it (e.g. a fractional km remainder).");
  assert.ok(Math.abs(rows[4].cumulativeSeconds - 1080) < 0.001, "The final (partial) checkpoint's cumulative time must still equal the full goal time.");
}

// --- buildCheckpoints: 10K by mile -- remainder (10000 / 1609.344 = 6.21...) ---

{
  const rows = buildCheckpoints({ distanceMeters: 10000, goalSeconds: 2400, stepMeters: MILE_METERS });
  assert.equal(rows.length, 7, "10K by mile must produce 6 full miles plus one partial final checkpoint (10000 / 1609.344 = 6.21 miles).");
  for (let i = 0; i < 6; i += 1) {
    assert.ok(Math.abs(rows[i].distanceMeters - (i + 1) * MILE_METERS) < 0.001, `Mile ${i + 1} checkpoint must land on an exact mile multiple.`);
    assert.equal(rows[i].isPartial, false, `Mile ${i + 1} must not be marked partial.`);
  }
  assert.ok(Math.abs(rows[6].distanceMeters - 10000) < 0.001, "The final checkpoint must land exactly at 10000m.");
  assert.equal(rows[6].isPartial, true, "The remainder past 6 full miles must be marked partial.");
  const partialMiles = (rows[6].distanceMeters - 6 * MILE_METERS) / MILE_METERS;
  assert.ok(Math.abs(partialMiles - 0.2137) < 0.001, "The partial final segment is about 0.21 miles past the 6th mile.");
  assert.ok(Math.abs(rows[6].cumulativeSeconds - 2400) < 0.001, "The final checkpoint's cumulative time must equal the full 40:00 goal time.");
}

console.log("Pace/split-math validation passed (shared by the pace calculator and the splits calculator).");
console.log("Time formatting (whole and fractional-second) checked, including the invalid-input placeholder.");
console.log("Per-mile and per-km pace scaling checked against a known 17:00 5K.");
console.log("Checkpoint generation checked for both evenly-divisible distances (5K by km, 1600m by lap) and remainder distances (3 mile by km, 10K by mile), including exact partial-segment distance, the partial flag, and that the final checkpoint's cumulative time always equals the full goal time.");
console.log("Mile/km-to-meters conversion and hours/minutes/seconds goal-time parsing checked, including blank-input and missing-field safety.");
