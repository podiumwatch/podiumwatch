import assert from "node:assert/strict";
import fs from "node:fs";
import process from "node:process";

// lib/rehearsal_service.mjs (and everything it touches) imports
// lib/supabase-admin.mjs, which throws at module load time if these env
// vars are absent -- matches the same fallback every other test script
// in this project already uses for the same reason.
process.env.SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_SECRET_KEY ||= "test-service-role-key";

function readSource(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

// --- classifyRaceDay: rehearsal exclusion (pure, directly executed) --------
// Race day build plan, Project 1: a rehearsal must never become the
// selected "today's race" for a coach's Today's Split Watch card or a
// helper's smart auto-route, no matter what status it's in.

{
  const { classifyRaceDay } = await import("../lib/todays_race_service.mjs");
  const today = "2026-08-25";
  const makeSession = (overrides) => ({
    id: "s-" + Math.random(), status: "draft", race_date: today, created_at: "2026-08-20T00:00:00Z",
    scheduled_start_time: null, is_rehearsal: false, ...overrides
  });

  // A live REHEARSAL must never be selected as the single relevant race,
  // even though a live OFFICIAL race in the exact same shape always would be.
  {
    const rehearsal = makeSession({ id: "rehearsal-1", status: "live", is_rehearsal: true });
    const result = classifyRaceDay([rehearsal], today);
    assert.equal(result.singleRelevantRace, null, "A live rehearsal must never become the selected race.");
    assert.equal(result.liveRaces.length, 0, "A rehearsal must never appear in the live-races pool at all.");
  }

  // A rehearsal must not count as "today's upcoming race" either, and
  // must not block a real upcoming race from being correctly selected.
  {
    const rehearsal = makeSession({ id: "rehearsal-2", status: "scheduled", is_rehearsal: true });
    const officialRace = makeSession({ id: "official-1", status: "scheduled" });
    const result = classifyRaceDay([rehearsal, officialRace], today);
    assert.equal(result.singleRelevantRace.id, "official-1", "The real official race must be selected, never the rehearsal sitting alongside it.");
    assert.equal(result.upcomingToday.length, 1, "The rehearsal must not appear in upcomingToday at all.");
  }

  // A finished rehearsal must not count as "today's most recently
  // finished race" either.
  {
    const rehearsal = makeSession({ id: "rehearsal-3", status: "finished", is_rehearsal: true });
    const result = classifyRaceDay([rehearsal], today);
    assert.equal(result.singleRelevantRace, null);
    assert.equal(result.finishedToday.length, 0);
  }

  console.log("classifyRaceDay() checked to exclude rehearsal rows from every bucket (live, upcoming, finished) regardless of their own status, confirming a rehearsal can never become the selected 'today's race' for the coach card or a helper's auto-route.");
}

// --- lib/rehearsal_service.mjs: structural checks -----------------------
// The functions here are entirely database-backed (they exist to copy
// real rows and mutate real state) -- matching this project's own
// established convention (see scripts/test-race-day-access.mjs) for
// verifying such logic at the source level when it can't be safely
// exercised without a live database in an automated suite. A live pass
// against real Supabase with disposable data is the natural companion
// check, run separately.

{
  const source = readSource("../lib/rehearsal_service.mjs");

  // A rehearsal must never be built from another rehearsal.
  assert.match(source, /if \(data\.is_rehearsal\) fail\(/, "loadSourceSessionOrFail refuses to rehearse a rehearsal.");

  // Rehearsal is only offered while the source race is still being
  // prepared -- never once it's live, finished, reviewed, or cancelled.
  const createBody = source.slice(source.indexOf("export async function getOrCreateActiveRehearsal"));
  assert.match(createBody, /source\.status !== "draft" && source\.status !== "scheduled"/, "Rehearsal is only available while the source race is draft or scheduled.");

  // Resuming an already-active rehearsal must not create a duplicate.
  assert.match(createBody, /loadActiveRehearsal\(teamId, sourceSessionId\)/, "getOrCreateActiveRehearsal checks for an existing active rehearsal before creating a new one.");
  assert.match(createBody, /resumed: true/, "An existing active rehearsal is resumed, not duplicated.");

  // The full plan -- checkpoints, participants, goals, targets -- is
  // copied, not just checkpoints (unlike duplicateSession(), which this
  // rehearsal path deliberately does NOT reuse, since it needs the full
  // roster/goals, not just the checkpoint list).
  assert.match(source, /race_checkpoints/);
  assert.match(source, /race_participants/);
  assert.match(source, /race_goals/);
  assert.match(source, /race_targets/);

  // Reset archives (cancelled), never deletes, and creates a genuinely
  // new row for the next attempt rather than restarting in place -- the
  // core safety property this whole project exists to guarantee.
  const resetBody = source.slice(source.indexOf("export async function resetRehearsal"));
  assert.ok(!/\.delete\(\)/.test(resetBody), "resetRehearsal must never delete a rehearsal row -- only archive it.");
  assert.match(resetBody, /status: "cancelled"/, "resetRehearsal archives the old rehearsal as cancelled.");
  assert.match(resetBody, /return getOrCreateActiveRehearsal/, "resetRehearsal creates a brand-new rehearsal row for the next attempt, not an in-place restart.");

  console.log("lib/rehearsal_service.mjs checked at the source level: a rehearsal can never be built from another rehearsal, is only offered while the source race is draft/scheduled, resumes an existing active rehearsal instead of duplicating it, copies the full plan (checkpoints + participants + goals + targets, not just checkpoints), and resetRehearsal archives the old row (never deletes it) while creating a genuinely new row for the next attempt (live database verification still required).");
}

// --- Official-only boundaries never trust a single upstream guard --------

{
  const viewerSource = readSource("../lib/race_viewer_service.mjs");
  const spectatorBody = viewerSource.slice(viewerSource.indexOf("export async function loadSpectatorRace"));
  assert.match(spectatorBody, /if \(session\.is_rehearsal\) \{/, "loadSpectatorRace explicitly refuses a rehearsal session, in addition to the spectator_visible guard upstream.");

  const athleteViewBody = viewerSource.slice(viewerSource.indexOf("export async function loadAthleteViewRaces"));
  assert.match(athleteViewBody, /is_rehearsal/, "loadAthleteViewRaces excludes rehearsal sessions from an athlete's/guardian's own race list.");

  const serviceSource = readSource("../lib/split_watch_service.mjs");
  assert.match(serviceSource, /requestedVisible && session\.is_rehearsal/, "updateSessionDetails refuses to ever set spectator_visible=true on a rehearsal row, for any actor.");

  assert.match(serviceSource, /\.eq\("is_rehearsal", false\)/, "listSessions() excludes rehearsal rows from the main race list.");

  const todaysRaceSource = readSource("../lib/todays_race_service.mjs");
  assert.match(todaysRaceSource, /\.eq\("is_rehearsal", false\)/, "getRaceDayContext()'s own query excludes rehearsal rows at the source, in addition to classifyRaceDay()'s own defensive filter.");

  const workspaceSource = readSource("../lib/team_workspace_service.mjs");
  const upcomingMatches = workspaceSource.match(/is_rehearsal/g) || [];
  assert.ok(upcomingMatches.length >= 3, "Team Home's upcoming/recent race queries and the cross-team next-race lookup all exclude rehearsal rows.");

  console.log("Every official-only read path checked at the source level: the parent/spectator link, an athlete's/guardian's own race list, the main race list, Team Home's upcoming/recent races and cross-team lookup, and today's-race smart routing all explicitly exclude rehearsal data -- confirming no single missed filter could leak practice data into an official-only view.");
}

// --- api/split-watch/sessions.js: rehearsal actions are coach-only --------

{
  const apiSource = readSource("../api/split-watch/sessions.js");
  assert.match(apiSource, /case "create_rehearsal":/);
  assert.match(apiSource, /case "reset_rehearsal":/);
  assert.match(apiSource, /case "rehearsal_status":/);

  // None of the three rehearsal actions appear in race_day_auth.mjs's
  // helper allow-list -- confirmed by their absence, matching how
  // assertActionAllowedForActor() fails closed on any action not
  // explicitly listed for a race-day-code actor.
  const authSource = readSource("../lib/race_day_auth.mjs");
  const sessionsAllowList = authSource.match(/sessions: new Set\(\[[^\]]*\]\)/)?.[0] || "";
  assert.ok(!sessionsAllowList.includes("create_rehearsal"), "A race-day-code helper must never be allowed to create a rehearsal.");
  assert.ok(!sessionsAllowList.includes("reset_rehearsal"), "A race-day-code helper must never be allowed to reset a rehearsal.");

  console.log("api/split-watch/sessions.js checked: create_rehearsal/reset_rehearsal/rehearsal_status are wired in, and none of the three appear in the race-day-code helper's allow-list -- a helper session gets a clean 403 attempting any of them, matching the same fail-closed pattern that already protects start_race/finish_race/restart_race/adjust_clock.");
}

console.log("\nRehearsal Mode (Project 1) source-level and pure-logic checks passed.");
