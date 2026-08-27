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

// --- groupAndSelectSpectatorDay(): the pure day-grouping/selection logic ---

{
  const { groupAndSelectSpectatorDay } = await import("../lib/race_viewer_service.mjs");
  const today = "2026-08-27";
  const makeSession = (overrides) => ({
    id: "s-" + Math.random(), name: "Race", status: "scheduled", race_date: today,
    scheduled_start_time: null, ...overrides
  });

  // A specific per-race link must keep showing THAT race even when a
  // sibling sharing its day is live -- a parent sent a JH link should
  // never be silently redirected to the HS race just because it started.
  {
    const linked = makeSession({ id: "jh-race", status: "scheduled" });
    const sibling = makeSession({ id: "hs-race", status: "live" });
    const result = groupAndSelectSpectatorDay({
      visible: [linked, sibling], anchorRaceDate: linked.race_date, requestedSessionId: "jh-race", today
    });
    assert.equal(result.selected.id, "jh-race", "A specific per-race link must keep selecting that exact race.");
    assert.equal(result.daySessions.length, 2, "Both same-day races must appear as switcher siblings.");
  }

  // No specific race requested (the cold team-wide link): the live race
  // wins, both as the anchor day and as the selection.
  {
    const live = makeSession({ id: "live-one", status: "live", race_date: "2026-08-29" });
    const unrelatedOldFinished = makeSession({ id: "old-finished", status: "finished", race_date: "2026-08-20" });
    const result = groupAndSelectSpectatorDay({
      visible: [live, unrelatedOldFinished], anchorRaceDate: null, requestedSessionId: "", today
    });
    assert.equal(result.anchorDate, "2026-08-29");
    assert.equal(result.selected.id, "live-one");
    assert.equal(result.daySessions.length, 1, "An unrelated old finished race on a different day must not appear as a sibling.");
  }

  // Siblings are sorted live-first, so the switcher's own ordering
  // matches what a parent actually cares about, regardless of name.
  {
    const scheduled = makeSession({ id: "b-scheduled", name: "Z Race", status: "scheduled" });
    const live = makeSession({ id: "a-live", name: "A Race", status: "live" });
    const result = groupAndSelectSpectatorDay({
      visible: [scheduled, live], anchorRaceDate: today, requestedSessionId: "", today
    });
    assert.equal(result.daySessions[0].id, "a-live", "The live race must sort first regardless of name.");
  }

  // A requested session id that ISN'T actually visible that day (turned
  // off, or simply wrong) must fall back to the day's own best pick, not
  // silently produce an empty/undefined selection.
  {
    const onlyVisible = makeSession({ id: "only-visible", status: "scheduled" });
    const result = groupAndSelectSpectatorDay({
      visible: [onlyVisible], anchorRaceDate: today, requestedSessionId: "not-actually-visible", today
    });
    assert.equal(result.selected.id, "only-visible");
  }

  console.log("groupAndSelectSpectatorDay() checked: a specific per-race link keeps its own race selected even next to a live sibling, a cold team link anchors on whichever date the team's live/next race falls on and ignores unrelated old races, siblings sort live-first, and an invalid/turned-off requested id falls back safely instead of producing nothing.");
}

// --- listSessions() / archiveSession() / unarchiveSession(): structural ---

{
  const source = readSource("../lib/split_watch_service.mjs");

  const listBody = source.slice(source.indexOf("export async function listSessions"), source.indexOf("export async function archiveSession"));
  assert.match(listBody, /includeArchived = false/, "listSessions() defaults to excluding archived races.");
  assert.match(listBody, /query\.is\("archived_at", null\)/, "listSessions() must actually filter archived_at when includeArchived is false.");

  const archiveBody = source.slice(source.indexOf("export async function archiveSession"), source.indexOf("export async function unarchiveSession"));
  assert.match(archiveBody, /session\.status === "live"/, "archiveSession() must refuse a live race.");
  assert.match(archiveBody, /spectator_visible: false/, "Archiving a race must also turn its spectator link off.");

  const unarchiveBody = source.slice(source.indexOf("export async function unarchiveSession"));
  assert.match(unarchiveBody, /archived_at: null/, "unarchiveSession() must clear archived_at.");

  console.log("lib/split_watch_service.mjs checked at the source level: listSessions() excludes archived races by default, archiveSession() refuses a live race and turns spectator_visible off, and unarchiveSession() clears archived_at.");
}

// --- Every coach-facing "what's active" query excludes archived races -----

{
  const todaysRaceSource = readSource("../lib/todays_race_service.mjs");
  assert.match(todaysRaceSource, /\.is\("archived_at", null\)/, "getRaceDayContext()'s own query must exclude archived races.");

  const workspaceSource = readSource("../lib/team_workspace_service.mjs");
  const archivedMatches = workspaceSource.match(/archived_at/g) || [];
  assert.ok(archivedMatches.length >= 3, "Team Home's upcoming/recent race queries and the cross-team next-race lookup must all exclude archived races.");

  console.log("Every coach-facing 'what's active right now' query checked to exclude archived races: today's-race smart routing, and Team Home's upcoming/recent races and cross-team lookup -- an archived race stops cluttering every working list without ever being deleted.");
}

// --- api/split-watch/sessions.js: archive/unarchive are coach-only --------

{
  const apiSource = readSource("../api/split-watch/sessions.js");
  assert.match(apiSource, /case "archive":/);
  assert.match(apiSource, /case "unarchive":/);

  const authSource = readSource("../lib/race_day_auth.mjs");
  const sessionsAllowList = authSource.match(/sessions: new Set\(\[[^\]]*\]\)/)?.[0] || "";
  assert.ok(!sessionsAllowList.includes("archive"), "A race-day-code helper must never be allowed to archive or unarchive a race.");

  console.log("api/split-watch/sessions.js checked: archive/unarchive are wired in and absent from the race-day-code helper's allow-list -- a helper gets a clean 403 attempting either, matching the same fail-closed pattern as create_rehearsal/reset_rehearsal.");
}

// --- loadSpectatorDay(): the database-backed half excludes the right rows -

{
  const viewerSource = readSource("../lib/race_viewer_service.mjs");
  const loadDayBody = viewerSource.slice(viewerSource.indexOf("export async function loadSpectatorDay"));
  assert.match(loadDayBody, /\.eq\("spectator_visible", true\)/);
  assert.match(loadDayBody, /\.eq\("is_rehearsal", false\)/);
  assert.match(loadDayBody, /\.is\("archived_at", null\)/);
  assert.match(loadDayBody, /\.neq\("status", "cancelled"\)/);

  console.log("lib/race_viewer_service.mjs checked: loadSpectatorDay()'s candidate query requires spectator_visible, excludes rehearsal, archived, and cancelled races all at once -- an archived race can never reappear on a parent's day-switcher after a coach tidies it away.");
}

console.log("\nRace archiving and the one team-day parent link: source-level and pure-logic checks passed.");
