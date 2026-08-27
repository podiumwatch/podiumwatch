import assert from "node:assert/strict";
import fs from "node:fs";
import process from "node:process";

process.env.SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_SECRET_KEY ||= "test-service-role-key";

function readSource(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

// --- presenceLabel(): the pure presence-threshold logic --------------------

{
  const { presenceLabel } = await import("../lib/timing_crew_service.mjs");
  const now = Date.parse("2026-08-27T12:00:00Z");

  assert.equal(presenceLabel(null, { now }), "Not connected yet");
  assert.equal(presenceLabel(new Date(now - 10 * 1000).toISOString(), { now }), "Connected now");
  assert.equal(presenceLabel(new Date(now - 5 * 60 * 1000).toISOString(), { now }), "Last seen 5 min ago");
  assert.equal(presenceLabel(new Date(now - 20 * 60 * 1000).toISOString(), { now }), "Offline, captures stored locally");
  assert.equal(presenceLabel(new Date(now - 5 * 60 * 1000).toISOString(), { now, revoked: true }), "Access revoked", "A revoked helper must show as revoked regardless of how recently they were seen.");

  console.log("presenceLabel() checked: not-yet-connected, connected-now (<90s), last-seen-N-min (<10min), offline (>=10min), and revoked always wins regardless of recency.");
}

// --- lib/race_day_auth.mjs: assertHelperCanCaptureAt() ----------------------

{
  const { assertHelperCanCaptureAt } = await import("../lib/race_day_auth.mjs");
  const coach = { type: "team_user" };

  // A real coach is never restricted, no matter what.
  assert.doesNotThrow(() => assertHelperCanCaptureAt(coach, { sessionId: "race-1", checkpointIds: ["anything"] }));

  // A helper not assigned to THIS race at all is refused.
  const unassignedElsewhere = { type: "race_day_code", raceSessionId: "race-2", capability: "checkpoint", checkpointId: "cp-1" };
  assert.throws(() => assertHelperCanCaptureAt(unassignedElsewhere, { sessionId: "race-1", checkpointIds: ["cp-1"] }));

  // A helper assigned to this race but a DIFFERENT checkpoint is refused.
  const wrongCheckpoint = { type: "race_day_code", raceSessionId: "race-1", capability: "checkpoint", checkpointId: "cp-1" };
  assert.throws(() => assertHelperCanCaptureAt(wrongCheckpoint, { sessionId: "race-1", checkpointIds: ["cp-2"] }));

  // A helper assigned to their own checkpoint is allowed.
  assert.doesNotThrow(() => assertHelperCanCaptureAt(wrongCheckpoint, { sessionId: "race-1", checkpointIds: ["cp-1"] }));

  // A helper not yet assigned any checkpoint (waiting) is refused.
  const waiting = { type: "race_day_code", raceSessionId: "race-1", capability: null, checkpointId: null };
  assert.throws(() => assertHelperCanCaptureAt(waiting, { sessionId: "race-1", checkpointIds: ["cp-1"] }));

  // "backup" capability may capture at any checkpoint in their own race.
  const backup = { type: "race_day_code", raceSessionId: "race-1", capability: "backup", checkpointId: null };
  assert.doesNotThrow(() => assertHelperCanCaptureAt(backup, { sessionId: "race-1", checkpointIds: ["cp-1", "cp-2"] }));

  // A mixed batch where even ONE checkpoint doesn't match is refused --
  // a helper can't smuggle in a capture for another checkpoint alongside
  // a legitimate one in the same push_splits batch.
  assert.throws(() => assertHelperCanCaptureAt(wrongCheckpoint, { sessionId: "race-1", checkpointIds: ["cp-1", "cp-2"] }));

  console.log("assertHelperCanCaptureAt() checked: a coach is never restricted, a helper assigned to the wrong race or wrong checkpoint (or not assigned at all) is refused, 'backup' capability may capture anywhere in its own race, and a mixed-checkpoint batch is refused even if only one entry is wrong.");
}

// --- lib/race_day_auth.mjs: individual revocation + preserved regenerate ---

{
  const source = readSource("../lib/race_day_auth.mjs");

  const resolveBody = source.slice(source.indexOf("export async function resolveRaceDaySession"), source.indexOf("// --- the one function"));
  assert.match(resolveBody, /if \(data\.revoked_at\) return null;/, "resolveRaceDaySession must treat a revoked session exactly like an expired one.");

  const regenerateBody = source.slice(source.indexOf("export async function regenerateRaceDayCode"));
  assert.match(regenerateBody, /revokeExistingHelpers = false/, "Regenerating the code must preserve existing helper grants by default.");
  assert.match(regenerateBody, /if \(revokeExistingHelpers\) \{/, "Wiping every helper's session must be an explicit opt-in, not the default.");

  console.log("lib/race_day_auth.mjs checked: a revoked helper session is rejected on the very next request (not just blocked from future joins), and regenerating the code preserves existing helper grants unless the coach explicitly opts into revoking everyone.");
}

// --- api/split-watch/sync.js: checkpoint-scoped enforcement is opt-in -----

{
  const syncSource = readSource("../api/split-watch/sync.js");
  assert.match(syncSource, /sessionHasPositions\(sessionId\)/, "Checkpoint-scoped enforcement must only apply when the race actually has positions defined.");
  assert.match(syncSource, /assertHelperCanCaptureAt\(actor, \{ sessionId, checkpointIds \}\)/, "sync.js must call the real enforcement function, not a local reimplementation.");

  console.log("api/split-watch/sync.js checked: checkpoint-scoped enforcement only runs for a race that actually has positions defined (sessionHasPositions()) -- a race with none stays exactly as open as every race before this project.");
}

// --- api/split-watch/crew.js: coach-only except reading positions --------

{
  const crewApiSource = readSource("../api/split-watch/crew.js");
  for (const action of ["list_positions", "create_position", "update_position", "delete_position", "list_crew", "reassign", "revoke"]) {
    assert.match(crewApiSource, new RegExp(`case "${action}":`), `crew.js must wire in the ${action} action.`);
  }

  const authSource = readSource("../lib/race_day_auth.mjs");
  const crewAllowList = authSource.match(/crew: new Set\(\[[^\]]*\]\)/)?.[0] || "";
  assert.ok(crewAllowList.includes("list_positions"), "A helper must be able to read the position list (needed to pick their own at join time).");
  for (const coachOnlyAction of ["create_position", "update_position", "delete_position", "list_crew", "reassign", "revoke"]) {
    assert.ok(!crewAllowList.includes(coachOnlyAction), `${coachOnlyAction} must stay coach-only.`);
  }

  console.log("api/split-watch/crew.js checked: every action is wired in, and a race-day-code helper may only read the position list -- creating/editing/deleting a position, the crew panel, reassigning, and revoking all stay coach-only.");
}

// --- lib/timing_crew_service.mjs: structural checks ------------------------

{
  const crewSource = readSource("../lib/timing_crew_service.mjs");

  const createBody = crewSource.slice(crewSource.indexOf("export async function createPosition"), crewSource.indexOf("export async function updatePosition"));
  assert.match(createBody, /cleanedCapability !== "backup" && !cleanedCheckpointId/, "createPosition must require a checkpoint unless the position is a backup timer.");

  const deleteBody = crewSource.slice(crewSource.indexOf("export async function deletePosition"), crewSource.indexOf("// --- coach: the crew panel"));
  assert.ok(!/race_day_sessions/.test(deleteBody), "Deleting a position must never itself touch a helper's session row -- the foreign key (on delete set null) handles that, not application code.");

  const revokeBody = crewSource.slice(crewSource.indexOf("export async function revokeHelper"));
  assert.ok(!/\.delete\(\)/.test(revokeBody), "revokeHelper must never delete the session row -- only mark it revoked, preserving it as a real audit record.");
  assert.match(revokeBody, /revoked_at: new Date\(\)\.toISOString\(\)/);

  console.log("lib/timing_crew_service.mjs checked: a position requires a checkpoint unless it's a backup timer, deleting a position never directly touches a helper's session (the database foreign key does), and revoking a helper only marks revoked_at -- it never deletes the session row.");
}

// --- install/27: purely additive ------------------------------------------

{
  const migration = readSource("../install/27_SPLIT_WATCH_TIMING_CREW.sql");
  assert.ok(!/drop table|drop column|truncate/i.test(migration), "The Timing Crew migration must be purely additive -- no drops, no truncates.");

  const raceDaySessionsAlter = migration.slice(migration.indexOf("alter table public.race_day_sessions"), migration.indexOf("create index if not exists race_day_sessions_race_session_index"));
  assert.match(raceDaySessionsAlter, /race_session_id uuid references public\.race_sessions\(id\) on delete set null/);
  assert.match(raceDaySessionsAlter, /race_position_id uuid references public\.race_positions\(id\) on delete set null/);
  assert.ok(!/cascade/i.test(raceDaySessionsAlter), "race_day_sessions' two new foreign keys must use 'set null,' never 'cascade' -- deleting a race or position must never delete a helper's session.");

  console.log("install/27_SPLIT_WATCH_TIMING_CREW.sql checked: purely additive, and race_day_sessions' new foreign keys use 'on delete set null' rather than cascade -- deleting a race or a position clears a helper's now-invalid assignment without deleting their session.");
}

console.log("\nTiming Crew (Project 3) source-level and pure-logic checks passed.");
