import assert from "node:assert/strict";
import fs from "node:fs";
import { evaluateRaceReadiness, READINESS_ITEM_IDS } from "../lib/race_readiness_service.mjs";

function readSource(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

// --- evaluateRaceReadiness(): the SYNC_HEALTH item (Project 5) -----------

const baseInputs = {
  checkpoints: [{ id: "cp1", is_finish: true }],
  participantCount: 3,
  readyGoalCount: 3,
  raceDayCodeActive: true,
  rehearsalStatus: { has_rehearsal: true, status: "finished", outdated: false },
  planHref: "/plan",
  rosterHref: "/plan"
};

function syncHealthItem(session, now) {
  const result = evaluateRaceReadiness({ session, ...baseInputs, now });
  return result.items.find((i) => i.id === READINESS_ITEM_IDS.SYNC_HEALTH);
}

const NOW = Date.parse("2026-08-27T18:00:00Z");

{
  const item = syncHealthItem({ name: "R", race_date: "2026-08-27", distance_meters: 5000, status: "scheduled" }, NOW);
  assert.equal(item.status, "complete", "before the race is live, sync health reads as complete, not a false attention");
  assert.match(item.explanation, /becomes active once the race goes live/i);
}

{
  const item = syncHealthItem({ name: "R", race_date: "2026-08-27", distance_meters: 5000, status: "live", last_sync_at: null }, NOW);
  assert.equal(item.status, "attention", "a live race that has never synced at all is a real attention item");
  assert.match(item.explanation, /has never synced|no device has synced/i);
}

{
  const item = syncHealthItem({
    name: "R", race_date: "2026-08-27", distance_meters: 5000, status: "live",
    last_sync_at: new Date(NOW - 30 * 1000).toISOString()
  }, NOW);
  assert.equal(item.status, "complete", "a device that synced 30 seconds ago is healthy");
}

{
  const item = syncHealthItem({
    name: "R", race_date: "2026-08-27", distance_meters: 5000, status: "live",
    last_sync_at: new Date(NOW - 5 * 60 * 1000).toISOString()
  }, NOW);
  assert.equal(item.status, "attention", "no device syncing in 5 minutes during a live race is a real attention item");
  assert.match(item.explanation, /minutes/);
}

{
  const item = syncHealthItem({
    name: "R", race_date: "2026-08-27", distance_meters: 5000, status: "live",
    last_sync_at: new Date(NOW - 10 * 1000).toISOString(),
    last_reported_clock_offset_ms: 8000,
    last_reported_clock_offset_at: new Date(NOW - 60 * 1000).toISOString()
  }, NOW);
  assert.equal(item.status, "attention", "a recently reported 8-second clock offset is a real attention item even though sync itself is healthy");
  assert.match(item.explanation, /clock/i);
}

{
  const item = syncHealthItem({
    name: "R", race_date: "2026-08-27", distance_meters: 5000, status: "live",
    last_sync_at: new Date(NOW - 10 * 1000).toISOString(),
    last_reported_clock_offset_ms: 8000,
    last_reported_clock_offset_at: new Date(NOW - 20 * 60 * 1000).toISOString()
  }, NOW);
  assert.equal(item.status, "complete", "a bad clock offset reported 20 minutes ago is stale and must not linger as a permanent false alarm");
}

{
  const item = syncHealthItem({
    name: "R", race_date: "2026-08-27", distance_meters: 5000, status: "live",
    last_sync_at: new Date(NOW - 10 * 1000).toISOString(),
    last_reported_clock_offset_ms: 800,
    last_reported_clock_offset_at: new Date(NOW - 10 * 1000).toISOString()
  }, NOW);
  assert.equal(item.status, "complete", "a small, recent 0.8-second offset is not flagged -- must not be noisy about normal clock jitter");
}

for (const item of [
  syncHealthItem({ name: "R", race_date: "2026-08-27", distance_meters: 5000, status: "live", last_sync_at: new Date(NOW - 10 * 1000).toISOString() }, NOW)
]) {
  assert.equal(item.blocking, false, "SYNC_HEALTH must never be a blocking item -- it's an ongoing signal, not a pre-race gate");
}

console.log("evaluateRaceReadiness() SYNC_HEALTH checked: complete before the race is live, attention on total sync silence (>3 min) or a recent large clock offset (>5s, reported within the last 10 min), never blocking, and a stale bad-offset report correctly stops counting against the race.");

// --- source-level: the plumbing that feeds SYNC_HEALTH its two signals ---

{
  const serviceSource = readSource("../lib/split_watch_service.mjs");
  const recordBody = serviceSource.slice(serviceSource.indexOf("export async function recordSyncActivity"), serviceSource.indexOf("export async function pullState"));
  assert.match(recordBody, /last_sync_at:\s*new Date\(\)\.toISOString\(\)/, "recordSyncActivity always stamps last_sync_at");
  assert.match(recordBody, /Number\.isFinite\(clockOffsetMs\)/, "the clock offset fields are only written when a real finite number was actually reported");
  console.log("lib/split_watch_service.mjs checked: recordSyncActivity() always stamps activity, and only records a clock offset when one was actually reported.");
}

{
  const syncSource = readSource("../api/split-watch/sync.js");
  assert.match(syncSource, /pushSplits\(\{[\s\S]{0,80}\}\);\s*\n\s*await recordSyncActivity/, "push_splits calls recordSyncActivity after a successful push");
  assert.match(syncSource, /pullState\(\{[\s\S]{0,60}\}\);\s*\n\s*await recordSyncActivity/, "pull_state calls recordSyncActivity after a successful pull");
  assert.match(syncSource, /client_clock_offset_ms/, "the client's reported clock offset is read from the request body");
  console.log("api/split-watch/sync.js checked: both push_splits and pull_state -- the two actions every live device already polls every 8-11 seconds -- feed Race Day Health, with no dedicated new heartbeat call needed.");
}

{
  const liveSource = readSource("../public/scripts/split-watch-live.js");
  assert.match(liveSource, /lastKnownClockOffsetMs\s*=\s*offsetMs/, "the measured clock offset is kept in a plain readable variable, since Timer itself exposes no getter");
  assert.match(liveSource, /client_clock_offset_ms:\s*lastKnownClockOffsetMs/, "every apiFetch request reports the device's last known clock offset back to the server");
  console.log("public/scripts/split-watch-live.js checked: the device's own measured clock offset is reported back to the server on every request, not just kept client-local.");
}

{
  const migrationSource = readSource("../install/29_SPLIT_WATCH_RACE_DAY_HEALTH.sql");
  assert.match(migrationSource, /add column if not exists last_sync_at timestamptz/);
  assert.match(migrationSource, /add column if not exists last_reported_clock_offset_ms numeric/);
  assert.match(migrationSource, /add column if not exists last_reported_clock_offset_at timestamptz/);
  assert.ok(!/drop |truncate /i.test(migrationSource), "the migration must never drop or truncate anything");
  console.log("install/29: checked as purely additive (three new nullable columns, nothing dropped).");
}

// --- the sync-pending-count fix (a related, smaller Split Watch improvement) ---

{
  const liveSource = readSource("../public/scripts/split-watch-live.js");
  assert.match(liveSource, /function refreshPendingCount/, "a dedicated function re-queries the local store for the current unsynced count");
  assert.match(liveSource, /pendingSplitCount > 0[\s\S]{0,60}pending/, "the sync pill's label includes the pending count whenever it's non-zero");

  const recordSplitStart = liveSource.indexOf("function recordSplit(");
  const recordSplitBody = liveSource.slice(recordSplitStart, liveSource.indexOf("// Outdoor live capture redesign", recordSplitStart));
  assert.match(recordSplitBody, /refreshPendingCount\(\)/, "recordSplit refreshes the pending count immediately, not just on the next sync tick -- a sync already in flight would otherwise leave the count stale");
  assert.match(recordSplitBody, /\.then\(\(\)\s*=>\s*refreshPendingCount\(\)\)\s*\n\s*\.then\(\(\)\s*=>\s*triggerSync\(\)\)/, "refreshPendingCount() is awaited BEFORE triggerSync() runs -- calling both in parallel would race two independent queries of the same local store against each other");

  console.log("public/scripts/split-watch-live.js checked: the sync pill shows a real pending-split count, updated immediately on every capture, not just a status word.");
}

console.log("\nRace Day Health (Project 5) and the sync pending-count fix: source-level and pure-logic checks passed.");
