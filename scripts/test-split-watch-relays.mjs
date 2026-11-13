import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import process from "node:process";
import vm from "node:vm";

// Split Watch track build Phase 3: relays (4x800, 4x400, 4x200, 4x100,
// custom). docs/SPLIT_WATCH_TRACK_HANDOFF.md. All data here is obviously
// fake test data ("Test Runner A1", "Test School") and stays in this file;
// nothing reaches Supabase -- the service runs against an in-memory fake.

process.env.SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_SECRET_KEY ||= "test-service-role-key";

const Laps = await import("../lib/race_laps.mjs");
const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const close = (a, b, message) => assert.ok(Math.abs(a - b) < 1e-6, `${message}: ${a} vs ${b}`);

// ---- 1. Presets: exchanges where they belong -----------------------------------
{
  const shape = (args) => Laps.generateRelayCheckpoints(args).map((c) => `${c.distance_meters}${c.location === "mark_200" ? "m" : ""}${c.is_exchange ? "X" : ""}${c.is_finish ? "F" : ""}`).join(",");
  assert.equal(shape({ eventKey: "4x800" }), "400,800X,1200,1600X,2000,2400X,2800,3200F", "4x800: every 400, exchanges at 800, 1600, 2400");
  assert.equal(shape({ eventKey: "4x400" }), "400X,800X,1200X,1600F", "4x400: every 400 is an exchange");
  assert.equal(shape({ eventKey: "4x200" }), "400X,800F", "4x200: the second exchange and the finish");
  assert.equal(shape({ eventKey: "4x200", include200Exchanges: true }), "200mX,400X,600mX,800F", "4x200 optional 200 m mark exchanges");
  assert.match(Laps.generateRelayCheckpoints({ eventKey: "4x200", include200Exchanges: true })[0].label, /approx/, "200 m mark exchanges are labeled approximate");
  assert.equal(shape({ eventKey: "4x100" }), "400F", "4x100: finish only");
  assert.equal(shape({ eventKey: "4x100", include200Exchanges: true }), "400F", "4x100 stays finish only");
  assert.equal(shape({ eventKey: "4x400", lapLengthMeters: 200 }), "200,400X,600,800X,1000,1200X,1400,1600F", "a 200 m track: a split every lap");
  assert.equal(shape({ eventKey: "4x200", lapLengthMeters: 200 }), "200X,400X,600X,800F", "4x200 on a 200 m track: every exchange at the finish line");
  assert.equal(shape({ eventKey: "relay_custom", legMeters: [1200, 400, 800, 1600] }), "400,800,1200X,1600X,2000,2400X,2800,3200,3600,4000F", "DMR: exchanges at 1200, 1600, 2400");
  assert.throws(() => Laps.relayLegMeters({ eventKey: "relay_custom", legMeters: [400] }), /2 to 8 legs/);
  assert.throws(() => Laps.relayLegMeters({ eventKey: "relay_custom", legMeters: [400, 350] }), /steps of 100/);
  assert.throws(() => Laps.relayLegMeters({ eventKey: "relay_custom", legMeters: [] }));
  assert.throws(() => Laps.generateRelayCheckpoints({ eventKey: "4x800", lapLengthMeters: 300 }));
  assert.equal(Laps.isRelayEvent("4x800"), true);
  assert.equal(Laps.isRelayEvent("1600"), false);
}

// ---- 2. Leg segments and the current leg (pure) --------------------------------
{
  const checkpoints = Laps.generateRelayCheckpoints({ eventKey: "4x200" }).map((c, i) => ({ ...c, id: "cp" + i }));
  // Without 200 m mark exchanges, legs 1-2 and 3-4 are shown together.
  const splits = [{ race_checkpoint_id: "cp0", elapsed_seconds: 51.2 }, { race_checkpoint_id: "cp1", elapsed_seconds: 103.9 }];
  const segments = Laps.relayLegSegments({ checkpoints, splits, legMeters: [200, 200, 200, 200] });
  assert.deepEqual(segments.map((s) => [s.first_leg, s.last_leg]), [[1, 2], [3, 4]]);
  close(segments[0].seconds, 51.2, "legs 1-2");
  close(segments[1].seconds, 103.9 - 51.2, "legs 3-4");
  assert.deepEqual(Laps.currentRelayLegs({ legMeters: [200, 200, 200, 200], lastDistanceMeters: 0, nextDistanceMeters: 400 }), [1, 2]);
  assert.deepEqual(Laps.currentRelayLegs({ legMeters: [800, 800, 800, 800], lastDistanceMeters: 1200, nextDistanceMeters: 1600 }), [2]);
  assert.deepEqual(Laps.currentRelayLegs({ legMeters: [800, 800, 800, 800], lastDistanceMeters: 1600, nextDistanceMeters: 2000 }), [3]);
  assert.deepEqual(Laps.currentRelayLegs({ legMeters: [800, 800, 800, 800], lastDistanceMeters: 3200, nextDistanceMeters: null }), []);

  // A missed exchange in a 4x400 joins those two legs once a later pass is in.
  const cps400 = Laps.generateRelayCheckpoints({ eventKey: "4x400" }).map((c, i) => ({ ...c, id: "q" + i }));
  const missed = Laps.relayLegSegments({ checkpoints: cps400, splits: [{ race_checkpoint_id: "q0", elapsed_seconds: 55 }, { race_checkpoint_id: "q2", elapsed_seconds: 168 }], legMeters: [400, 400, 400, 400] });
  assert.deepEqual(missed.map((s) => [s.first_leg, s.last_leg, s.seconds]), [[1, 1, 55], [2, 3, 113], [4, 4, null]]);
  // An exchange not tapped YET still splits the legs (it may come next).
  const running = Laps.relayLegSegments({ checkpoints: cps400, splits: [{ race_checkpoint_id: "q0", elapsed_seconds: 55 }], legMeters: [400, 400, 400, 400] });
  assert.deepEqual(running.map((s) => [s.first_leg, s.last_leg]), [[1, 1], [2, 2], [3, 3], [4, 4]]);
}

// ---- 3. Browser copy is identical --------------------------------------------
{
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(read("../public/scripts/race-laps.js"), context);
  const B = context.window.PodiumRaceLaps;
  const same = (a, b, message) => assert.equal(JSON.stringify(a), JSON.stringify(b), message);
  for (const args of [{ eventKey: "4x800" }, { eventKey: "4x200", include200Exchanges: true }, { eventKey: "relay_custom", legMeters: [1200, 400, 800, 1600] }, { eventKey: "4x400", lapLengthMeters: 200 }]) {
    same(B.generateRelayCheckpoints(args), Laps.generateRelayCheckpoints(args), "generateRelayCheckpoints parity " + JSON.stringify(args));
  }
  const checkpoints = Laps.generateRelayCheckpoints({ eventKey: "4x400" }).map((c, i) => ({ ...c, id: "p" + i }));
  const splits = [{ race_checkpoint_id: "p0", elapsed_seconds: 55.5 }, { race_checkpoint_id: "p1", elapsed_seconds: 112.25 }];
  same(B.relayLegSegments({ checkpoints, splits, legMeters: [400, 400, 400, 400] }), Laps.relayLegSegments({ checkpoints, splits, legMeters: [400, 400, 400, 400] }), "relayLegSegments parity");
  same(B.currentRelayLegs({ legMeters: [200, 200, 200, 200], lastDistanceMeters: 0, nextDistanceMeters: 400 }), Laps.currentRelayLegs({ legMeters: [200, 200, 200, 200], lastDistanceMeters: 0, nextDistanceMeters: 400 }), "currentRelayLegs parity");
}

// ---- 4. The real service against an in-memory database ------------------------
// A small fake of the Supabase query builder: enough for the relay paths
// (create, save teams, record lap taps, review). Unique rules match the
// real tables (one split per entry per checkpoint; one leg row per team
// per leg order).
const db = {
  team_pages: [], race_sessions: [], race_checkpoints: [], race_participants: [], race_goals: [], race_targets: [],
  race_splits: [], race_split_revisions: [], race_relay_legs: [], team_athletes: [], team_seasons: [], team_roster_entries: []
};
const UNIQUE = {
  race_splits: [["client_split_id"], ["race_participant_id", "race_checkpoint_id"]],
  race_relay_legs: [["race_participant_id", "leg_order"]]
};
const DEFAULTS = {
  race_participants: () => ({ status: "scheduled", strategy: "even_pace", sort_order: 0, metadata: {}, team_athlete_id: null, manual_name: null, race_group: null, entry_type: "individual", disqualified: false }),
  race_splits: () => ({ revision: 1, is_dns: false, is_dnf: false, pack_capture_id: null, clock_offset_ms: null, clock_uncertainty_ms: null }),
  race_relay_legs: () => ({ team_athlete_id: null, manual_name: null })
};
function uniqueViolation(table, row, ignore) {
  for (const cols of UNIQUE[table] || []) {
    if (db[table].some((r) => r !== row && r !== ignore && cols.every((c) => r[c] === row[c] && row[c] !== undefined && row[c] !== null))) return { code: "23505", message: `duplicate key on ${table}(${cols})` };
  }
  return null;
}
function from(table) {
  const state = { op: "select", filters: [], order: [], limit: null, single: null, values: null, onConflict: null, head: false };
  const builder = {
    select(_cols, opts = {}) { if (state.op === "select") state.head = Boolean(opts.head); return builder; },
    eq(col, v) { state.filters.push((r) => (col.includes(".") ? true : r[col] === v)); return builder; },
    neq(col, v) { state.filters.push((r) => r[col] !== v); return builder; },
    in(col, list) { state.filters.push((r) => list.includes(r[col])); return builder; },
    is(col, v) { state.filters.push((r) => (r[col] ?? null) === v); return builder; },
    not(col, _op, v) { state.filters.push((r) => (r[col] ?? null) !== v); return builder; },
    order(col, opts = {}) { if (!opts.foreignTable) state.order.push([col, opts.ascending !== false]); return builder; },
    limit(n) { state.limit = n; return builder; },
    maybeSingle() { state.single = "maybe"; return builder; },
    single() { state.single = "one"; return builder; },
    insert(values) { state.op = "insert"; state.values = values; return builder; },
    update(values) { state.op = "update"; state.values = values; return builder; },
    upsert(values, opts = {}) { state.op = "upsert"; state.values = values; state.onConflict = opts.onConflict; return builder; },
    delete() { state.op = "delete"; return builder; },
    then(resolve, reject) { try { resolve(run()); } catch (error) { reject(error); } }
  };
  const matches = () => db[table].filter((r) => state.filters.every((f) => f(r)));
  function finish(rows) {
    let out = rows.map((r) => ({ ...r }));
    for (const [col, asc] of state.order) out.sort((a, b) => ((a[col] > b[col]) - (a[col] < b[col])) * (asc ? 1 : -1));
    if (state.limit !== null) out = out.slice(0, state.limit);
    if (state.head) return { data: null, count: out.length, error: null };
    if (state.single === "one") return out.length === 1 ? { data: out[0], error: null } : { data: null, error: { message: "not one row" } };
    if (state.single === "maybe") return { data: out[0] || null, error: null };
    return { data: out, error: null };
  }
  function run() {
    if (state.op === "select") return finish(matches());
    if (state.op === "delete") { const gone = new Set(matches()); db[table] = db[table].filter((r) => !gone.has(r)); if (table === "race_participants") db.race_relay_legs = db.race_relay_legs.filter((l) => !db.race_participants.some(() => false) && ![...gone].some((p) => p.id === l.race_participant_id)); return { data: null, error: null }; }
    if (state.op === "update") {
      const rows = matches();
      for (const r of rows) {
        const next = { ...r, ...state.values };
        const err = uniqueViolation(table, next, r);
        if (err) return { data: null, error: err };
      }
      for (const r of rows) Object.assign(r, state.values);
      return finish(rows);
    }
    const list = Array.isArray(state.values) ? state.values : [state.values];
    const written = [];
    for (const values of list) {
      if (state.op === "upsert" && state.onConflict) {
        const cols = state.onConflict.split(",");
        const existing = db[table].find((r) => cols.every((c) => r[c] === values[c]));
        if (existing) {
          const err = uniqueViolation(table, { ...existing, ...values }, existing);
          if (err) return { data: null, error: err };
          Object.assign(existing, values);
          written.push(existing);
          continue;
        }
      }
      const row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...(DEFAULTS[table] ? DEFAULTS[table]() : {}), ...values };
      const err = uniqueViolation(table, row, null);
      if (err) return { data: null, error: err };
      db[table].push(row);
      written.push(row);
    }
    state.filters = [];
    return finish(written);
  }
  return builder;
}
const { supabaseAdmin } = await import("../lib/supabase-admin.mjs");
supabaseAdmin.from = from;
const Service = await import("../lib/split_watch_service.mjs");

// Fake team, season and roster (8 obviously fake runners).
const TEAM = crypto.randomUUID();
db.team_pages.push({ id: TEAM, school_name: "Test School", archived_at: null, merged_into_team_id: null });
const SEASON = crypto.randomUUID();
db.team_seasons.push({ id: SEASON, team_id: TEAM, sport: "track", is_current: true });
const runners = ["A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4"].map((tag) => {
  const athlete = { id: crypto.randomUUID(), first_name: "Test Runner", last_name: tag, display_name: "Test Runner " + tag, status: "active", gender: "boys", graduation_year: 2099 };
  db.team_athletes.push(athlete);
  db.team_roster_entries.push({ athlete_id: athlete.id, season_id: SEASON, grade: 11 });
  return athlete;
});
const byTag = (tag) => runners.find((r) => r.last_name === tag);
let splitCounter = 0;
const newSplitId = () => "pw_rcc_testrelay" + String(++splitCounter).padStart(8, "0") + "abcdefgh";

async function makeRelay(body) {
  const { session } = await Service.createSession({ teamId: TEAM, actor: { userId: null }, body: { name: "Test relay (fake)", race_date: "2026-11-12", sport: "track", distance_meters: 400, ...body } });
  return session;
}
function teamsBody(legTags) {
  return legTags.map(([name, tags]) => ({ name, legs: tags.map((tag) => (tag ? { team_athlete_id: byTag(tag).id } : {})) }));
}
async function tapLaps(session, participantId, times) {
  // Every pass at the finish line, sent as lap taps the server places by time.
  const checkpoints = db.race_checkpoints.filter((c) => c.race_session_id === session.id).sort((a, b) => a.sort_order - b.sort_order);
  for (const t of times) {
    const state = Laps.lapState({ checkpoints, splits: db.race_splits.filter((s) => s.race_participant_id === participantId) });
    await Service.pushSplits({
      teamId: TEAM, sessionId: session.id,
      splits: [{ client_split_id: newSplitId(), race_participant_id: participantId, race_checkpoint_id: state.next.id, elapsed_seconds: t, wall_clock_captured_at: new Date().toISOString(), capture_method: "single_tap", lap_tap: true }]
    });
  }
}
const cumulative = (laps) => laps.reduce((acc, lap) => [...acc, Number(((acc[acc.length - 1] || 0) + lap).toFixed(2))], []);

// ---- 4a. 4x800 and 4x400, two teams each -------------------------------------
for (const [eventKey, lapsA, lapsB] of [
  ["4x800", [61.2, 63.4, 62.0, 64.9, 60.8, 63.1, 61.7, 62.5], [66.0, 68.3, 65.2, 69.9, 67.1, 68.8, 66.4, 67.0]],
  ["4x400", [52.31, 53.07, 51.88, 50.95], [56.4, 57.2, 55.9, 58.1]]
]) {
  const session = await makeRelay({ event_key: eventKey, lap_length_meters: 400 });
  assert.equal(session.tap_mode, "lap");
  assert.deepEqual(session.relay_leg_meters, Laps.RELAY_EVENTS[eventKey].legMeters);
  const saved = await Service.saveRelayTeams({ teamId: TEAM, sessionId: session.id, teams: teamsBody([["A team", ["A1", "A2", "A3", "A4"]], ["B team", ["B1", "B2", "B3", "B4"]]]) });
  assert.equal(saved.participants.length, 2);
  assert.ok(saved.participants.every((p) => p.entry_type === "relay"));
  const teamA = saved.participants.find((p) => p.manual_name === "A team");
  const teamB = saved.participants.find((p) => p.manual_name === "B team");
  await tapLaps(session, teamA.id, cumulative(lapsA));
  await tapLaps(session, teamB.id, cumulative(lapsB));

  for (const [team, laps, tags] of [[teamA, lapsA, ["A1", "A2", "A3", "A4"]], [teamB, lapsB, ["B1", "B2", "B3", "B4"]]]) {
    const review = await Service.getIndividualReview({ teamId: TEAM, sessionId: session.id, participantId: team.id });
    const total = cumulative(laps).at(-1);
    close(review.relay.total_seconds, total, `${eventKey} ${team.manual_name} total`);
    assert.equal(review.relay.segments.length, 4, `${eventKey}: four separate legs`);
    const sum = review.relay.segments.reduce((a, s) => a + s.seconds, 0);
    close(sum, total, `${eventKey} ${team.manual_name}: leg splits sum to the team total`);
    assert.deepEqual(review.relay.segments.map((s) => s.names[0]), tags.map((t) => "Test Runner " + t), `${eventKey} ${team.manual_name}: the right athlete on each leg`);
    const lapsPerLeg = laps.length / 4;
    review.relay.segments.forEach((segment, i) => {
      const expected = laps.slice(i * lapsPerLeg, (i + 1) * lapsPerLeg).reduce((a, b) => a + b, 0);
      close(segment.seconds, expected, `${eventKey} ${team.manual_name} leg ${i + 1} split`);
    });
    if (eventKey === "4x800") {
      // 400 splits inside each 800 leg: the review's lap column, by leg.
      const legOneRows = review.checkpoints.filter((row) => row.leg_order === 1);
      assert.equal(legOneRows.length, 2, "two 400s inside an 800 leg");
      close(legOneRows[0].lap_seconds, laps[0], "first 400 of leg 1");
      close(legOneRows[1].lap_seconds, laps[1], "second 400 of leg 1");
    }
  }

  // ---- 4b. Changing the leg order mid race: names move, times don't.
  if (eventKey === "4x800") {
    const before = db.race_splits.filter((s) => s.race_participant_id === teamA.id).map((s) => `${s.race_checkpoint_id}:${s.elapsed_seconds}`).sort();
    await Service.saveRelayTeams({ teamId: TEAM, sessionId: session.id, teams: [
      { id: teamA.id, name: "A team", legs: [{ team_athlete_id: byTag("A3").id }, { team_athlete_id: byTag("A1").id }, { manual_name: "Test Guest Runner" }, {}] },
      { id: teamB.id, name: "B team", legs: ["B1", "B2", "B3", "B4"].map((t) => ({ team_athlete_id: byTag(t).id })) }
    ] });
    const after = db.race_splits.filter((s) => s.race_participant_id === teamA.id).map((s) => `${s.race_checkpoint_id}:${s.elapsed_seconds}`).sort();
    assert.deepEqual(after, before, "changing the leg order never changes a recorded time");
    const review = await Service.getIndividualReview({ teamId: TEAM, sessionId: session.id, participantId: teamA.id });
    assert.deepEqual(review.relay.segments.map((s) => s.names[0]), ["Test Runner A3", "Test Runner A1", "Test Guest Runner", "TBD"], "names reassigned to the new order");
    close(review.relay.segments[0].seconds, lapsA[0] + lapsA[1], "leg 1's time is unchanged after the reorder");
    assert.equal(db.race_relay_legs.filter((l) => l.race_participant_id === teamA.id).length, 4, "still one row per leg");

    // A team with recorded times can't be deleted by leaving it out.
    await assert.rejects(Service.saveRelayTeams({ teamId: TEAM, sessionId: session.id, teams: [{ id: teamA.id, name: "A team", legs: [{}, {}, {}, {}] }] }), /can't be removed/);
    // The individual-runner save is refused on a relay (it would delete the teams).
    await assert.rejects(Service.saveParticipants({ teamId: TEAM, sessionId: session.id, participants: [] }), /relay/i);
    // Validation: same athlete twice, wrong leg count, a runner not on the roster.
    await assert.rejects(Service.saveRelayTeams({ teamId: TEAM, sessionId: session.id, teams: [{ id: teamA.id, name: "A team", legs: [{ team_athlete_id: byTag("A1").id }, { team_athlete_id: byTag("A1").id }, {}, {}] }, { id: teamB.id, name: "B team", legs: [{}, {}, {}, {}] }] }), /more than one leg/);
    await assert.rejects(Service.saveRelayTeams({ teamId: TEAM, sessionId: session.id, teams: [{ id: teamA.id, name: "A team", legs: [{}, {}] }, { id: teamB.id, name: "B team", legs: [{}, {}, {}, {}] }] }), /exactly 4 legs/);
    await assert.rejects(Service.saveRelayTeams({ teamId: TEAM, sessionId: session.id, teams: [{ id: teamA.id, name: "A team", legs: [{ team_athlete_id: crypto.randomUUID() }, {}, {}, {}] }, { id: teamB.id, name: "B team", legs: [{}, {}, {}, {}] }] }), /roster/);
    await assert.rejects(Service.saveRelayTeams({ teamId: TEAM, sessionId: session.id, teams: [{ id: teamA.id, name: "A team", legs: [{}, {}, {}, {}] }, { id: teamB.id, name: "a TEAM", legs: [{}, {}, {}, {}] }] }), /both called/);
  }
}

// ---- 4c. Custom relay with unequal legs (1200, 400, 800, 1600) ------------------
{
  const session = await makeRelay({ event_key: "relay_custom", lap_length_meters: 400, relay_leg_meters: [1200, 400, 800, 1600] });
  assert.equal(Number(session.distance_meters), 4000, "a DMR is 4000 m");
  const checkpoints = db.race_checkpoints.filter((c) => c.race_session_id === session.id);
  assert.deepEqual(checkpoints.filter((c) => c.is_exchange).map((c) => Number(c.distance_meters)).sort((a, b) => a - b), [1200, 1600, 2400], "exchanges at 1200, 1600 and 2400");
  const { participants } = await Service.saveRelayTeams({ teamId: TEAM, sessionId: session.id, teams: teamsBody([["A team", ["A1", "A2", "A3", "A4"]]]) });
  const team = participants[0];
  const laps = [62, 64, 66, 55, 63, 65, 68, 69, 70, 67]; // ten 400s
  await tapLaps(session, team.id, cumulative(laps));
  const review = await Service.getIndividualReview({ teamId: TEAM, sessionId: session.id, participantId: team.id });
  const expected = [laps.slice(0, 3), laps.slice(3, 4), laps.slice(4, 6), laps.slice(6)].map((part) => part.reduce((a, b) => a + b, 0));
  review.relay.segments.forEach((segment, i) => close(segment.seconds, expected[i], `DMR leg ${i + 1} split`));
  assert.deepEqual(review.relay.segments.map((s) => s.end_meters - s.start_meters), [1200, 400, 800, 1600]);
  close(review.relay.total_seconds, laps.reduce((a, b) => a + b, 0), "DMR total");
}

// ---- 4d. Lapped relay team: taps still land on the right lap ------------------
{
  const session = await makeRelay({ event_key: "4x800", lap_length_meters: 400 });
  const { participants } = await Service.saveRelayTeams({ teamId: TEAM, sessionId: session.id, teams: teamsBody([["A team", [null, null, null, null]], ["B team", [null, null, null, null]]]) });
  const [fast, slow] = participants;
  // Interleave passes in time order: the slow team is lapped late.
  const fastTimes = cumulative([58, 58, 58, 58, 58, 58, 58, 58]);
  const slowTimes = cumulative([75, 75, 75, 75, 75, 75, 75, 75]);
  const passes = [...fastTimes.map((t) => [fast.id, t]), ...slowTimes.map((t) => [slow.id, t])].sort((a, b) => a[1] - b[1]);
  for (const [id, t] of passes) await tapLaps(session, id, [t]);
  for (const [team, times] of [[fast, fastTimes], [slow, slowTimes]]) {
    const cps = db.race_checkpoints.filter((c) => c.race_session_id === session.id).sort((a, b) => a.sort_order - b.sort_order);
    const got = cps.map((c) => (db.race_splits.find((s) => s.race_participant_id === team.id && s.race_checkpoint_id === c.id) || {}).elapsed_seconds);
    assert.deepEqual(got, times, "every pass on its own lap");
  }
  const review = await Service.getIndividualReview({ teamId: TEAM, sessionId: session.id, participantId: fast.id });
  assert.deepEqual(review.relay.segments.map((s) => s.names[0]), ["TBD", "TBD", "TBD", "TBD"], "legs with nobody set show TBD");
}

// ---- 4e. Cross country and individual track races are unchanged ---------------
{
  const { session } = await Service.createSession({ teamId: TEAM, actor: { userId: null }, body: { name: "Test XC (fake)", race_date: "2026-11-12", sport: "cross_country", distance_meters: 5000, checkpoints: [] } });
  assert.equal(session.relay_leg_meters, undefined, "a cross country race carries no relay fields");
  const detail = await Service.getSessionDetail({ teamId: TEAM, sessionId: session.id });
  assert.equal(detail.relay_legs, undefined, "and no relay legs");
  const { session: mile } = await Service.createSession({ teamId: TEAM, actor: { userId: null }, body: { name: "Test 1600 (fake)", race_date: "2026-11-12", sport: "track", event_key: "1600", lap_length_meters: 400, distance_meters: 1600, checkpoints: [] } });
  assert.equal(mile.relay_leg_meters, undefined);
  await assert.rejects(Service.saveRelayTeams({ teamId: TEAM, sessionId: mile.id, teams: [] }), /isn't a relay/);
}

// ---- 5. Wiring (source checks) ------------------------------------------------
{
  assert.match(read("../api/split-watch/plan.js"), /case "save_relay_teams"/);
  assert.match(read("../lib/race_day_auth.mjs"), /plan: new Set\(\[\]\)/, "relay teams stay a coach-only plan action");
  const live = read("../public/scripts/split-watch-live.js");
  assert.match(live, /relayNowLine/);
  assert.match(live, /relay_legs: saved\.relay_legs/, "leg names open offline from the saved copy");
  assert.match(read("../public/scripts/race-local-store.js"), /relay_legs: Array\.isArray\(relayLegs\)/);
  assert.match(read("../lib/rehearsal_service.mjs"), /race_relay_legs/, "a rehearsal copies relay legs");
  assert.match(read("../lib/rehearsal_service.mjs"), /tap_mode: source\.tap_mode/, "a rehearsal stays a lap mode race");
  const sql = read("../install/97_SPLIT_WATCH_RELAYS.sql");
  assert.match(sql, /To undo/);
  assert.doesNotMatch(sql, /^\s*(drop|alter table [^\n]* (drop|rename))/im, "additive only (drops appear only in the undo comment)");
}

console.log("Relays checked: presets and exchanges for every relay and track, 4x800 and 4x400 with two teams each");
console.log("(leg splits sum to the team total, the right athlete on every leg, 400s inside 800 legs), a mid-race leg");
console.log("reorder that moves names but no times, a custom 1200/400/800/1600 relay, lapped relay teams, validation,");
console.log("browser/server parity, and cross country and individual races unchanged.");
