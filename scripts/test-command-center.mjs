import assert from "node:assert/strict";
import fs from "node:fs";
import process from "node:process";

// Several imports below (transitively) load lib/supabase-admin.mjs,
// which throws at module load time if these are absent -- matches the
// same fallback every other test script in this project already uses.
process.env.SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_SECRET_KEY ||= "test-service-role-key";

function readSource(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

// --- classifyRaceDay(): the new "upcoming window" fallback ----------------
// Race Day Command Center (Project 2): "If no race remains today, select
// the nearest upcoming incomplete race within the approved upcoming
// window" -- and that must still never outrank a race actually live or
// scheduled today, and must still outrank a race merely finished today.

{
  const { classifyRaceDay, UPCOMING_WINDOW_DAYS } = await import("../lib/todays_race_service.mjs");
  const today = "2026-08-27";
  const makeSession = (overrides) => ({
    id: "s-" + Math.random(), status: "draft", race_date: today, created_at: "2026-08-20T00:00:00Z",
    scheduled_start_time: null, is_rehearsal: false, ...overrides
  });

  // Nothing today, but a real meet in 3 days -- that race, not the
  // finished-today fallback, must become the single relevant race.
  {
    const finishedToday = makeSession({ id: "finished-today", status: "finished" });
    const upcomingIn3Days = makeSession({ id: "upcoming-3d", status: "scheduled", race_date: "2026-08-30" });
    const result = classifyRaceDay([finishedToday, upcomingIn3Days], today);
    assert.equal(result.singleRelevantRace.id, "upcoming-3d", "An upcoming race within the window must outrank a race merely finished today.");
    assert.equal(result.nearestUpcoming.length, 1);
  }

  // A race 30 days out (well beyond the window) must NOT be selected --
  // finished-today should win instead, matching the spec's own "a
  // finished race may appear as a recent secondary item" language (it's
  // still the best available answer once nothing closer exists).
  {
    const finishedToday = makeSession({ id: "finished-today-2", status: "finished" });
    const farAway = makeSession({ id: "far-away", status: "scheduled", race_date: "2026-09-26" });
    const result = classifyRaceDay([finishedToday, farAway], today);
    assert.equal(result.singleRelevantRace.id, "finished-today-2", "A race far outside the upcoming window must not be selected over today's finished race.");
    assert.equal(result.nearestUpcoming.length, 0);
  }

  // A live race today must still outrank an upcoming race within the
  // window -- the window fallback only ever applies when NOTHING is
  // live and NOTHING is scheduled for today itself.
  {
    const live = makeSession({ id: "live-now", status: "live" });
    const upcomingIn2Days = makeSession({ id: "upcoming-2d", status: "scheduled", race_date: "2026-08-29" });
    const result = classifyRaceDay([live, upcomingIn2Days], today);
    assert.equal(result.singleRelevantRace.id, "live-now");
  }

  // A race scheduled for today itself must still outrank an upcoming
  // race found via the window (today always wins over "soon").
  {
    const todayRace = makeSession({ id: "today-race", status: "scheduled" });
    const upcomingIn2Days = makeSession({ id: "upcoming-2d-b", status: "scheduled", race_date: "2026-08-29" });
    const result = classifyRaceDay([todayRace, upcomingIn2Days], today);
    assert.equal(result.singleRelevantRace.id, "today-race");
  }

  assert.equal(UPCOMING_WINDOW_DAYS, 14, "The documented upcoming window is 14 days.");

  console.log("classifyRaceDay() checked: an upcoming race within the window outranks a race merely finished today, a race outside the window does not get selected, and both live-today and scheduled-today races still outrank the window fallback entirely.");
}

// --- evaluateRaceReadiness(): the shared checklist -------------------------

{
  const { evaluateRaceReadiness, READINESS_ITEM_IDS } = await import("../lib/race_readiness_service.mjs");

  const baseSession = { name: "Districts", race_date: "2026-08-27", distance_meters: 5000, spectator_visible: false, is_rehearsal: false };

  // No participants and no finish checkpoint -- both real blocking
  // problems, both must be reported, and hasBlockingIssue must be true.
  {
    const result = evaluateRaceReadiness({
      session: baseSession, checkpoints: [], participantCount: 0, readyGoalCount: 0,
      raceDayCodeActive: false, rehearsalStatus: { has_rehearsal: false },
      planHref: "/plan", rosterHref: "/plan"
    });
    assert.equal(result.hasBlockingIssue, true);
    const blockingIds = result.blockingIssues.map((i) => i.id);
    assert.ok(blockingIds.includes(READINESS_ITEM_IDS.ROSTER), "No participants must be a blocking issue.");
    assert.ok(blockingIds.includes(READINESS_ITEM_IDS.FINISH_CHECKPOINT), "No finish checkpoint must be a blocking issue.");
  }

  // A fully-set-up race: participants, a finish checkpoint, every goal
  // entered, code active, parent page on, rehearsal completed and
  // current -- must report zero blocking issues and "Ready for race day."
  {
    const result = evaluateRaceReadiness({
      session: { ...baseSession, spectator_visible: true },
      checkpoints: [{ id: "c1", is_finish: false }, { id: "c2", is_finish: true }],
      participantCount: 3, readyGoalCount: 3,
      raceDayCodeActive: true,
      rehearsalStatus: { has_rehearsal: true, status: "finished", outdated: false },
      planHref: "/plan", rosterHref: "/plan"
    });
    assert.equal(result.hasBlockingIssue, false);
    assert.equal(result.attentionCount, 0);
    assert.equal(result.summaryLabel, "Ready for race day");
    assert.ok(result.items.every((i) => i.status === "complete"));
  }

  // Goals not entered, no timing crew code, parent page off, never
  // rehearsed -- all real, but none of them may block the start.
  {
    const result = evaluateRaceReadiness({
      session: baseSession,
      checkpoints: [{ id: "c1", is_finish: true }],
      participantCount: 4, readyGoalCount: 0,
      raceDayCodeActive: false,
      rehearsalStatus: { has_rehearsal: false },
      planHref: "/plan", rosterHref: "/plan"
    });
    assert.equal(result.hasBlockingIssue, false, "Missing goals/crew/parent-page/rehearsal must never block the official start.");
    assert.ok(result.attentionCount > 0);
    assert.match(result.summaryLabel, /item.*need/);
  }

  // An outdated rehearsal (roster/checkpoints changed since practicing)
  // must show as not-complete, distinctly worded from "never rehearsed."
  {
    const result = evaluateRaceReadiness({
      session: baseSession,
      checkpoints: [{ id: "c1", is_finish: true }],
      participantCount: 1, readyGoalCount: 1,
      raceDayCodeActive: true,
      rehearsalStatus: { has_rehearsal: true, status: "finished", outdated: true },
      planHref: "/plan", rosterHref: "/plan"
    });
    const rehearsalItem = result.items.find((i) => i.id === READINESS_ITEM_IDS.REHEARSAL);
    assert.equal(rehearsalItem.status, "recommended");
    assert.match(rehearsalItem.explanation, /changed since/);
  }

  console.log("evaluateRaceReadiness() checked: no participants and no finish checkpoint are the only two blocking issues, a fully-ready race reports zero attention items, missing goals/timing-crew/parent-page/rehearsal are all real but never blocking, and an outdated rehearsal is worded distinctly from never having practiced at all.");
}

// --- primaryActionForCommandCenter(): the five states ----------------------

{
  const { primaryActionForCommandCenter } = await import("../lib/race_readiness_service.mjs");
  const hrefs = { liveHref: "/live", planHref: "/plan", reviewHref: "/review" };

  assert.deepEqual(
    primaryActionForCommandCenter({ session: { status: "live" }, hasBlockingIssue: false, ...hrefs }),
    { label: "Return to Live Timing", href: "/live" }
  );
  assert.deepEqual(
    primaryActionForCommandCenter({ session: { status: "draft" }, hasBlockingIssue: true, ...hrefs }),
    { label: "Open Race Setup", href: "/plan" }
  );
  assert.deepEqual(
    primaryActionForCommandCenter({ session: { status: "scheduled" }, hasBlockingIssue: true, ...hrefs }),
    { label: "Open Race Setup", href: "/plan" },
    "A scheduled race with a critical item missing must still route to setup, not the race day screen."
  );
  assert.deepEqual(
    primaryActionForCommandCenter({ session: { status: "scheduled" }, hasBlockingIssue: false, ...hrefs }),
    { label: "Go to Race Day Screen", href: "/live" }
  );
  assert.deepEqual(
    primaryActionForCommandCenter({ session: { status: "finished" }, hasBlockingIssue: false, ...hrefs }),
    { label: "Review Results", href: "/review" }
  );

  console.log("primaryActionForCommandCenter() checked against all five spec states, including that a scheduled race with a blocking issue routes to setup rather than the race day screen.");
}

// --- Server-side enforcement: startRace() reuses the same checklist -------

{
  const source = readSource("../lib/split_watch_service.mjs");
  const startBody = source.slice(source.indexOf("export async function startRace"));
  assert.match(startBody, /if \(!session\.is_rehearsal\) \{/, "The official-start readiness gate must never run for a rehearsal.");
  assert.match(startBody, /findBlockingReadinessIssues\(/, "startRace() must reuse the exact same readiness function the Command Center displays, not a second copy of the rules.");
  assert.match(startBody, /fail\(\s*\n?\s*"This race isn't ready to start yet/, "A blocked start must explain exactly why, not fail generically.");

  console.log("lib/split_watch_service.mjs checked at the source level: startRace() enforces the same blocking readiness rules the Command Center displays, and explicitly skips that gate for a rehearsal (Project 1 must never be restricted by a Project 2 rule).");
}

// --- api/split-watch/sessions.js: readiness is coach-only ------------------

{
  const source = readSource("../api/split-watch/sessions.js");
  const todayBody = source.slice(source.indexOf('case "today"'), source.indexOf('case "create"'));
  assert.match(todayBody, /actor\.type === "team_user"/, "The 'today' action must only compute the readiness checklist for a real coach, never a race-day-code helper.");
  assert.match(todayBody, /buildCommandCenterContext/, "The 'today' action must delegate to the shared Command Center context builder.");

  console.log("api/split-watch/sessions.js checked: the 'today' action only computes the readiness checklist for a real coach account -- a race-day-code helper gets the plain race-day context only, unchanged from before this project.");
}

console.log("\nRace Day Command Center (Project 2) source-level and pure-logic checks passed.");
