import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import * as Laps from "../lib/race_laps.mjs";

// Split Watch track build Phase 2: lap mode (3200, 1600, 800).
// docs/SPLIT_WATCH_TRACK_HANDOFF.md. All data here is obviously fake test
// data and stays in this file.

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

// ---- Checkpoints built from the event --------------------------------------
{
  const labels = (args) => Laps.generateLapCheckpoints(args).map((c) => `${c.distance_meters}${c.location === "mark_200" ? "m" : ""}${c.is_finish ? "F" : ""}`).join(",");
  assert.equal(labels({ eventKey: "3200", lapLengthMeters: 400 }), "400,800,1200,1600,2000,2400,2800,3200F");
  assert.equal(labels({ eventKey: "1600", lapLengthMeters: 400 }), "400,800,1200,1600F");
  assert.equal(labels({ eventKey: "800", lapLengthMeters: 400 }), "400,800F");
  assert.equal(labels({ eventKey: "800", lapLengthMeters: 400, include200Marks: true }), "200m,400,600m,800F");
  assert.equal(Laps.generateLapCheckpoints({ eventKey: "3200", lapLengthMeters: 200 }).length, 16, "a 200 m track: a checkpoint every lap");
  assert.equal(labels({ eventKey: "800", lapLengthMeters: 200, include200Marks: true }), "200,400,600,800F", "the 200 m mark option only applies on a 400 m track");
  assert.ok(Laps.generateLapCheckpoints({ eventKey: "3200", lapLengthMeters: 400 }).every((c) => c.location === "finish_line" && c.is_exchange === false));
  assert.equal(Laps.generateLapCheckpoints({ eventKey: "1600", lapLengthMeters: 400 })[3].label, "Finish (1600)");
  assert.throws(() => Laps.generateLapCheckpoints({ eventKey: "5000", lapLengthMeters: 400 }));
  assert.throws(() => Laps.generateLapCheckpoints({ eventKey: "1600", lapLengthMeters: 300 }));
  assert.equal(Laps.doubleTapWindowSeconds(400), 15, "suggested 15 s for 400 m laps");
  assert.equal(Laps.doubleTapWindowSeconds(200), 8, "8 s for 200 m laps");
}

// ---- A fake race_splits table with the real one-row-per-entry-per-lap rule ----
function makeTable() {
  const rows = [];
  const revisions = [];
  let nextId = 1;
  const keyOf = (r) => `${r.race_participant_id}|${r.race_checkpoint_id}`;
  const assertUnique = (row) => {
    if (rows.some((r) => r !== row && keyOf(r) === keyOf(row))) throw new Error(`unique violation ${keyOf(row)}`);
  };
  return {
    rows,
    revisions,
    entry: (pid) => rows.filter((r) => r.race_participant_id === pid),
    // The same steps pushSplits' writeLapTap runs, against this table.
    applyLapTap({ checkpoints, participantId, location, tap, windowSeconds }) {
      const entryRows = rows.filter((r) => r.race_participant_id === participantId);
      const resolution = Laps.resolveLapTap({ checkpoints, splits: entryRows, location, tapElapsedSeconds: tap.elapsedSeconds, windowSeconds });
      if (resolution.action === "duplicate" || resolution.action === "finished") return { resolution };
      const { ops } = Laps.planLapWrites({ resolution, entryRows, checkpoints, location, tap });
      for (const op of ops) {
        if (op.op === "move") {
          const row = rows.find((r) => r.id === op.id);
          const moved = { ...row, race_checkpoint_id: op.to };
          assertUnique(moved);
          row.race_checkpoint_id = op.to;
        } else if (op.op === "update") {
          const row = rows.find((r) => r.id === op.id);
          Object.assign(row, op.values);
          assertUnique(row);
          row.revision += 1;
          revisions.push({ id: row.id, reason: op.changeReason, elapsed: op.values.elapsed_seconds });
        } else if (op.op === "insert") {
          const row = { id: nextId++, race_participant_id: participantId, revision: 1, ...op.values };
          assertUnique(row);
          rows.push(row);
          revisions.push({ id: row.id, reason: "recorded", elapsed: row.elapsed_seconds });
        }
      }
      return { resolution, ops };
    },
    // An undo: the row stays, its time is cleared (a revision).
    undo(participantId, checkpointId) {
      const row = rows.find((r) => r.race_participant_id === participantId && r.race_checkpoint_id === checkpointId);
      row.elapsed_seconds = null;
      row.revision += 1;
      revisions.push({ id: row.id, reason: "undo", elapsed: null });
    }
  };
}
const withIds = (list, prefix) => list.map((c, i) => ({ ...c, id: `${prefix}-cp-${i + 1}` }));
const tapOf = (elapsedSeconds, n) => ({ clientSplitId: `pw_rcc_test_${String(n).padStart(16, "0")}`, elapsedSeconds, wallClockCapturedAt: "2026-11-12T12:00:00.000Z", captureMethod: "single_tap", deviceId: "test-phone" });

// ---- A simulated 3200 with 24 entries, lapped once and twice -------------------
{
  const checkpoints = withIds(Laps.generateLapCheckpoints({ eventKey: "3200", lapLengthMeters: 400 }), "sim3200");
  const windowSeconds = Laps.doubleTapWindowSeconds(400);
  // 24 fake entries, lap paces 62 s to 95 s (each lap a little uneven).
  let seed = 3200;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const entries = Array.from({ length: 24 }, (_, i) => {
    const pace = 62 + (33 * i) / 23;
    let t = 0;
    const passes = Array.from({ length: 8 }, () => (t += pace * (0.97 + rand() * 0.06)));
    return { id: `test-entry-${i + 1}`, passes };
  });
  // Every crossing of the finish line, in time order, with some double taps.
  const crossings = entries.flatMap((e) => e.passes.map((t, lap) => ({ id: e.id, t, lap }))).sort((a, b) => a.t - b.t);
  const table = makeTable();
  let n = 0;
  let ignoredDoubles = 0;
  let nextPasserFirst = 0;
  let nextPasserTop3 = 0;
  let orderChecks = 0;
  for (const c of crossings) {
    // Before the tap: is the entry that actually crosses next at the top of the order?
    const running = entries.filter((e) => !Laps.lapState({ checkpoints, splits: table.entry(e.id) }).finished);
    const order = Laps.orderByNextPass(running.map((e, i) => {
      const state = Laps.lapState({ checkpoints, splits: table.entry(e.id) });
      return { id: e.id, expected: Laps.expectedNextPassSeconds(state, null), rosterIndex: i, out: false };
    }));
    if (c.lap >= 2) { orderChecks += 1; if (order[0] === c.id) nextPasserFirst += 1; if (order.slice(0, 3).includes(c.id)) nextPasserTop3 += 1; }
    table.applyLapTap({ checkpoints, participantId: c.id, location: "finish_line", tap: tapOf(c.t, n++), windowSeconds });
    if (rand() < 0.15) {
      // A nervous second tap on the same runner a few seconds later.
      const second = table.applyLapTap({ checkpoints, participantId: c.id, location: "finish_line", tap: tapOf(c.t + 1 + rand() * 6, n++), windowSeconds });
      assert.equal(second.resolution.action, "duplicate", "a double tap inside the window is ignored");
      ignoredDoubles += 1;
    }
  }
  const leaderFinish = Math.min(...entries.map((e) => e.passes[7]));
  const lappedTwice = entries.filter((e) => e.passes.filter((t) => t <= leaderFinish).length <= 6).length;
  const lappedOnce = entries.filter((e) => e.passes.filter((t) => t <= leaderFinish).length === 7).length;
  assert.ok(lappedTwice >= 3, `some runners are lapped twice (${lappedTwice})`);
  assert.ok(lappedOnce >= 1, `some runners are lapped once (${lappedOnce})`);
  for (const e of entries) {
    const byCp = new Map(table.entry(e.id).map((r) => [r.race_checkpoint_id, r.elapsed_seconds]));
    e.passes.forEach((t, lap) => assert.equal(byCp.get(checkpoints[lap].id), t, `${e.id} lap ${lap + 1} is on the right lap`));
    assert.equal(Laps.lapState({ checkpoints, splits: table.entry(e.id) }).finished, true);
    const extra = table.applyLapTap({ checkpoints, participantId: e.id, location: "finish_line", tap: tapOf(e.passes[7] + 60, n++), windowSeconds });
    assert.equal(extra.resolution.action, "finished", "a finished entry can't be tapped past the finish");
  }
  assert.equal(table.rows.length, 24 * 8, "exactly one row per entry per lap -- 192 taps, nothing lost, nothing doubled");
  console.log(`Simulated 3200: 24 entries (${lappedOnce} lapped once, ${lappedTwice} lapped twice), 192 laps all on the right lap, ${ignoredDoubles} double taps ignored; the next runner to cross was first in the order ${nextPasserFirst} of ${orderChecks} times and in the top 3 ${nextPasserTop3} times.`);
  // Laps vary a few percent, so two runners a second apart can swap; the
  // check is that the next runner is within thumb reach at the top.
  assert.ok(nextPasserTop3 / orderChecks >= 0.95, "after the first laps, the next runner to cross is in the top 3 of the order");
  assert.ok(nextPasserFirst / orderChecks >= 0.7, "and usually first");
}

// ---- Two phones on one entry: the stale lap sequence ------------------------------
{
  const checkpoints = withIds(Laps.generateLapCheckpoints({ eventKey: "1600", lapLengthMeters: 400 }), "two");
  const windowSeconds = 15;
  const table = makeTable();
  const P = "test-entry-two-phones";
  // Phone A records laps 1 and 2.
  table.applyLapTap({ checkpoints, participantId: P, location: "finish_line", tap: tapOf(70, 1), windowSeconds });
  table.applyLapTap({ checkpoints, participantId: P, location: "finish_line", tap: tapOf(140, 2), windowSeconds });
  // Phone B hasn't heard about lap 2: on its screen the runner has 1 lap.
  const staleView = table.entry(P).filter((r) => r.race_checkpoint_id === checkpoints[0].id);
  const bGuess = Laps.resolveLapTap({ checkpoints, splits: staleView, location: "finish_line", tapElapsedSeconds: 210, windowSeconds });
  assert.equal(bGuess.checkpoint.id, checkpoints[1].id, "phone B guesses lap 2 (stale)");
  // On the next pass (lap 3), B's tap reaches the server: later than the
  // latest recorded split by more than the window -> next open lap (3).
  const landed = table.applyLapTap({ checkpoints, participantId: P, location: "finish_line", tap: tapOf(210, 3), windowSeconds });
  assert.equal(landed.resolution.action, "append");
  assert.equal(landed.resolution.checkpoint.id, checkpoints[2].id, "B's stale tap lands on lap 3, not lap 2");
  // Phone A also tapped that same pass, 0.4 s later: same pass, first saved wins.
  const aSame = table.applyLapTap({ checkpoints, participantId: P, location: "finish_line", tap: tapOf(210.4, 4), windowSeconds });
  assert.equal(aSame.resolution.action, "duplicate");
  assert.equal(aSame.resolution.split.elapsed_seconds, 210, "the first saved time wins");
  assert.deepEqual(table.entry(P).map((r) => [r.race_checkpoint_id, r.elapsed_seconds]).sort(), [[checkpoints[0].id, 70], [checkpoints[1].id, 140], [checkpoints[2].id, 210]].sort());
}

{
  // A late tap from phone B fills a lap phone A missed: A has 70 and 210
  // (it missed lap 2, so its 210 sits on lap 2); B's 140 arrives late.
  const checkpoints = withIds(Laps.generateLapCheckpoints({ eventKey: "1600", lapLengthMeters: 400 }), "late");
  const table = makeTable();
  const P = "test-entry-late";
  table.applyLapTap({ checkpoints, participantId: P, location: "finish_line", tap: tapOf(70, 1), windowSeconds: 15 });
  table.applyLapTap({ checkpoints, participantId: P, location: "finish_line", tap: tapOf(210, 2), windowSeconds: 15 });
  const late = table.applyLapTap({ checkpoints, participantId: P, location: "finish_line", tap: tapOf(140, 3), windowSeconds: 15 });
  assert.equal(late.resolution.action, "insert");
  assert.ok(late.ops.some((op) => op.op === "move"), "A's 210 moves up one lap (it keeps its own row and time)");
  const byCp = new Map(table.entry(P).map((r) => [r.race_checkpoint_id, r.elapsed_seconds]));
  assert.deepEqual([byCp.get(checkpoints[0].id), byCp.get(checkpoints[1].id), byCp.get(checkpoints[2].id)], [70, 140, 210]);
}

{
  // Same, but lap 3 holds an undone row: times shift up through the rows,
  // each change a revision; nothing collides and nothing is lost.
  const checkpoints = withIds(Laps.generateLapCheckpoints({ eventKey: "1600", lapLengthMeters: 400 }), "undone");
  const table = makeTable();
  const P = "test-entry-undone";
  table.applyLapTap({ checkpoints, participantId: P, location: "finish_line", tap: tapOf(70, 1), windowSeconds: 15 });
  table.applyLapTap({ checkpoints, participantId: P, location: "finish_line", tap: tapOf(210, 2), windowSeconds: 15 });
  table.applyLapTap({ checkpoints, participantId: P, location: "finish_line", tap: tapOf(280, 3), windowSeconds: 15 });
  table.undo(P, checkpoints[2].id); // the 280 was a mistake
  const late = table.applyLapTap({ checkpoints, participantId: P, location: "finish_line", tap: tapOf(140, 4), windowSeconds: 15 });
  assert.equal(late.resolution.action, "insert");
  assert.ok(late.ops.every((op) => op.op === "update"), "into an undone row, the times shift (updates), never a colliding move");
  const byCp = new Map(table.entry(P).map((r) => [r.race_checkpoint_id, r.elapsed_seconds]));
  assert.deepEqual([byCp.get(checkpoints[0].id), byCp.get(checkpoints[1].id), byCp.get(checkpoints[2].id), byCp.get(checkpoints[3].id)], [70, 140, 210, undefined]);
  assert.ok(table.revisions.filter((r) => r.reason === "manual_correction").length >= 2, "each shifted time is a revision");
  assert.equal(table.rows.length, 3, "no extra rows");
}

// ---- Undo, double tap, finish --------------------------------------------------------
{
  const checkpoints = withIds(Laps.generateLapCheckpoints({ eventKey: "800", lapLengthMeters: 400, include200Marks: true }), "u");
  const table = makeTable();
  const P = "test-entry-undo";
  table.applyLapTap({ checkpoints, participantId: P, location: "finish_line", tap: tapOf(64.2, 1), windowSeconds: 15 });
  assert.equal(table.entry(P)[0].race_checkpoint_id, checkpoints[1].id, "the finish line phone's first tap is the 400, not the 200 m mark");
  table.applyLapTap({ checkpoints, participantId: P, location: "mark_200", tap: tapOf(31.0, 2), windowSeconds: 15 });
  assert.equal(table.entry(P).find((r) => r.elapsed_seconds === 31.0).race_checkpoint_id, checkpoints[0].id, "the 200 m mark phone records the 200");
  // Undo the 400: state goes back, the row stays with a revision.
  table.undo(P, checkpoints[1].id);
  const state = Laps.lapState({ checkpoints, splits: table.entry(P), location: "finish_line" });
  assert.equal(state.done, 0);
  assert.equal(state.next.id, checkpoints[1].id, "after undo the next tap re-records the 400");
  assert.ok(table.revisions.some((r) => r.reason === "undo"), "undo keeps a revision");
  const redo = table.applyLapTap({ checkpoints, participantId: P, location: "finish_line", tap: tapOf(64.5, 3), windowSeconds: 15 });
  assert.equal(redo.ops[0].op, "update", "the undone row is reused (one row per entry per lap)");
  table.applyLapTap({ checkpoints, participantId: P, location: "finish_line", tap: tapOf(131.9, 4), windowSeconds: 15 });
  const done = Laps.lapState({ checkpoints, splits: table.entry(P), location: "finish_line" });
  assert.equal(done.finished, true);
  assert.equal(Math.round(done.lastLapSeconds * 10) / 10, 67.4, "last lap = 131.9 - 64.5");
  assert.equal(table.applyLapTap({ checkpoints, participantId: P, location: "finish_line", tap: tapOf(200, 5), windowSeconds: 15 }).resolution.action, "finished");
}

// ---- Browser copy = server copy ---------------------------------------------------
{
  const context = { window: {}, Math, Number, Object, Map, Array, Error, String, Boolean };
  vm.createContext(context);
  vm.runInContext(read("../public/scripts/race-laps.js"), context);
  const B = context.window.PodiumRaceLaps;
  const same = (a, b, what) => assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), what);
  for (const args of [{ eventKey: "3200", lapLengthMeters: 400 }, { eventKey: "800", lapLengthMeters: 400, include200Marks: true }, { eventKey: "1600", lapLengthMeters: 200 }]) {
    same(B.generateLapCheckpoints(args), Laps.generateLapCheckpoints(args), "generateLapCheckpoints parity");
  }
  const checkpoints = withIds(Laps.generateLapCheckpoints({ eventKey: "1600", lapLengthMeters: 400 }), "p");
  const splits = [{ race_checkpoint_id: "p-cp-1", elapsed_seconds: 70 }, { race_checkpoint_id: "p-cp-2", elapsed_seconds: 210 }];
  for (const t of [75, 140, 290, 500]) {
    same(B.resolveLapTap({ checkpoints, splits, tapElapsedSeconds: t, windowSeconds: 15 }), Laps.resolveLapTap({ checkpoints, splits, tapElapsedSeconds: t, windowSeconds: 15 }), `resolveLapTap parity at ${t}`);
  }
  same(B.lapState({ checkpoints, splits }), Laps.lapState({ checkpoints, splits }), "lapState parity");
  same(B.doubleTapWindowSeconds(200), Laps.doubleTapWindowSeconds(200), "window parity");
  const libBody = read("../lib/race_laps.mjs").replace(/^\/\/ Split Watch lap mode rules[\s\S]*?\n\n/, "").replace(/^export /gm, "").replace(/\s+/g, " ");
  const browserBody = read("../public/scripts/race-laps.js").split("(() => {")[1].split("window.PodiumRaceLaps =")[0].replace(/\s+/g, " ");
  assert.equal(browserBody.trim(), libBody.trim(), "public/scripts/race-laps.js is an exact copy of lib/race_laps.mjs (regenerate it after any change)");
}

// ---- Wiring, and cross country unchanged ---------------------------------------------
{
  const service = read("../lib/split_watch_service.mjs");
  assert.match(service, /if \(lapMode && incoming\.lapTap && !existing && incoming\.elapsedSeconds !== null/, "only a NEW lap tap in a lap mode race takes the lap path");
  assert.match(service, /const lapMode = lapColumns && session\.tap_mode === "lap";/, "a race is lap mode only when its tap_mode says so (every existing race defaults to 'checkpoint')");
  assert.match(service, /\.\.\.\(eventKey \? \{ tap_mode: "lap", event_key: eventKey, lap_length_meters: lapLengthMeters \} : \{\}\)/, "cross country and custom races are created exactly as before");
  assert.match(service, /\.\.\.\(lapColumns \? \{ clock_offset_ms: incoming\.clockOffsetMs, clock_uncertainty_ms: incoming\.clockUncertaintyMs \} : \{\}\)/, "each tap's clock correction is saved, once the columns exist");
  assert.match(service, /function hasLapColumns\(sessionRow\)/, "code works before install/96 runs (new fields left out)");
  const live = read("../public/scripts/split-watch-live.js");
  assert.match(live, /function renderRunnerList\(\) \{\s*if \(isLapMode\(\)\) \{\s*renderLapList\(\);\s*return;\s*\}/, "the live page only switches to lap buttons for a lap mode race");
  assert.match(live, /detail\.session\.tap_mode === "lap"/);
  assert.match(read("../src/pages/splitwatchlive.mjs"), /src="\/scripts\/race-laps\.js"/);
  const sql = read("../install/96_SPLIT_WATCH_LAP_MODE.sql");
  const code = sql.split("\n").filter((l) => !/^\s*--/.test(l)).join("\n");
  assert.doesNotMatch(code, /\bdrop\b|\brename\b/i, "the migration only adds");
  for (const column of ["tap_mode text not null default 'checkpoint'", "event_key text", "lap_length_meters numeric", "location text", "is_exchange boolean not null default false", "disqualified boolean not null default false", "clock_offset_ms numeric", "clock_uncertainty_ms numeric"]) {
    assert.ok(code.includes(column), `install/96 adds ${column}`);
  }
}

console.log("Lap mode checked: checkpoints per event and track, a 24-entry 3200 with lapped runners, the two-phone stale");
console.log("lap sequence, a late tap filling a missed lap (with and without an undone row), double taps, undo with a");
console.log("revision, no taps past the finish, browser/server parity, and cross country left on its old path.");
