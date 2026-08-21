import assert from "node:assert/strict";
import process from "node:process";

// lib/athlete_goal_service.mjs imports lib/supabase-admin.mjs, which
// calls createClient() at module load time and throws if these env vars
// are absent -- this suite only exercises the pure, no-database
// nearestDistanceBucket() function, but importing the module at all
// still triggers that top-level call. Same fallback pattern
// scripts/test-race-command-center.mjs already uses for the same reason.
process.env.SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_SECRET_KEY ||= "test-service-role-key";

const { DISTANCE_BUCKETS, nearestDistanceBucket } = await import("../lib/athlete_goal_service.mjs");

// --- DISTANCE_BUCKETS structural sanity -------------------------------------

{
  const keys = DISTANCE_BUCKETS.map((b) => b.key);
  assert.equal(new Set(keys).size, keys.length, "Every distance bucket key must be unique.");

  for (const bucket of DISTANCE_BUCKETS) {
    assert.ok(Number.isFinite(bucket.meters) && bucket.meters > 0, `${bucket.key} must have a positive meters value.`);
    assert.ok(typeof bucket.label === "string" && bucket.label.length > 0, `${bucket.key} must have a real label.`);
  }
}

// --- nearestDistanceBucket() -------------------------------------------------

{
  // Each bucket's own canonical distance must map back to itself.
  for (const bucket of DISTANCE_BUCKETS) {
    assert.equal(
      nearestDistanceBucket(bucket.meters),
      bucket.key,
      `A race at exactly ${bucket.meters}m must map to the ${bucket.key} bucket.`
    );
  }
}

{
  // A certified course is rarely exactly round -- confirm realistic
  // near-miss distances still land on the intended bucket.
  assert.equal(nearestDistanceBucket(4980), "5000m", "A 4980m course (a slightly short '5K') must still map to 5000m.");
  assert.equal(nearestDistanceBucket(1600), "1600m", "A literal 1600m track race must map to the Mile/1600m bucket.");
  assert.equal(nearestDistanceBucket(3200), "3200m", "A literal 3200m track race must map to the 2 Mile/3200m bucket.");
}

{
  // Midpoint tie-breaking between adjacent buckets (3000m and 3200m,
  // roughly 109m apart at the midpoint) -- this is the one place a real
  // ambiguity could exist, since every other pair of buckets is spread
  // far enough apart that "nearest" is never a close call.
  assert.equal(nearestDistanceBucket(3100), "3000m", "3100m sits closer to 3000m than to 3218.688m.");
  assert.equal(nearestDistanceBucket(3150), "3200m", "3150m sits closer to 3218.688m than to 3000m.");
}

{
  // A goal exists for a 2-mile race and a completely different 5K race
  // must never resolve to the same bucket -- this is the exact
  // distance-blindness bug being fixed (the old carryover logic had no
  // idea these were different distances at all).
  assert.notEqual(
    nearestDistanceBucket(3218.688),
    nearestDistanceBucket(5000),
    "A 2-mile race and a 5K race must resolve to different buckets."
  );
}

{
  // Invalid/missing distances must never crash or silently pick a bucket.
  assert.equal(nearestDistanceBucket(0), null, "Zero distance must resolve to no bucket.");
  assert.equal(nearestDistanceBucket(-500), null, "Negative distance must resolve to no bucket.");
  assert.equal(nearestDistanceBucket(NaN), null, "NaN distance must resolve to no bucket.");
  assert.equal(nearestDistanceBucket(null), null, "Null distance must resolve to no bucket.");
  assert.equal(nearestDistanceBucket(undefined), null, "Undefined distance must resolve to no bucket.");
}

console.log("Athlete goal book (lib/athlete_goal_service.mjs) validated:");
console.log("DISTANCE_BUCKETS checked for unique keys, positive meters, and real labels.");
console.log("nearestDistanceBucket() checked to map every bucket's own canonical distance back to itself, realistic near-miss course distances (a 4980m '5K', a literal 1600m/3200m track race) to the intended bucket, and the one real midpoint ambiguity (3000m vs 3200m) to whichever side it actually sits closer to.");
console.log("Confirmed a 2-mile distance and a 5K distance resolve to different buckets -- this is the exact distance-blindness bug the goal book exists to fix (the old goal-carryover logic sorted an athlete's prior races by date only, with no idea what distance any of them were).");
console.log("Invalid distances (zero, negative, NaN, null, undefined) checked to resolve to no bucket rather than crashing or guessing.");
console.log("NOT covered here (requires install/21_ATHLETE_STANDARD_GOALS.sql live in Supabase): the actual database-backed read/write paths -- getStandardGoalsForAthlete(s), saveStandardGoals(), upsertStandardGoalFromRace(), and the api/team/roster.js get_standard_goals/save_standard_goals actions. Verified separately with Playwright against the real built Team Roster page (mocked API) for the client-side UI; a live Supabase pass with real throwaway data is the natural next check once the migration has been run.");
