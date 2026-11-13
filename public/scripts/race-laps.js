// Split Watch lap mode rules -- browser copy of lib/race_laps.mjs (track
// build Phases 2 and 3, 2026-11-12). Keep the two identical: the parity
// test in scripts/test-split-watch-laps.mjs runs both on the same inputs.
// GENERATED from lib/race_laps.mjs -- edit that file, then regenerate.
// In lap mode a tap belongs to the runner: it records that entry's NEXT
// lap at the place this phone stands. Exposed as window.PodiumRaceLaps.
(() => {
  const LAP_LOCATIONS = ["finish_line", "mark_200"];
  const DEFAULT_LOCATION = "finish_line";
  const TRACK_LAP_LENGTHS = [400, 200];

  // Track events lap mode builds.
  const LAP_EVENTS = {
    "3200": { distanceMeters: 3200 },
    "1600": { distanceMeters: 1600 },
    "800": { distanceMeters: 800 }
  };

  // Relays (track build Phase 3). A relay team is ONE entry that runs laps;
  // its legs are a layer on top. finishOnly: a 4x100 has no leg splits by
  // default (an 11 second leg through an exchange zone can't be hand timed
  // meaningfully), so it is timed at the finish only.
  const RELAY_EVENTS = {
    "4x800": { legMeters: [800, 800, 800, 800] },
    "4x400": { legMeters: [400, 400, 400, 400] },
    "4x200": { legMeters: [200, 200, 200, 200] },
    "4x100": { legMeters: [100, 100, 100, 100], finishOnly: true },
    "relay_custom": { legMeters: null }
  };
  const RELAY_MAX_LEGS = 8;
  const RELAY_MAX_METERS = 10000;
  function isRelayEvent(eventKey) {
    return Object.prototype.hasOwnProperty.call(RELAY_EVENTS, String(eventKey));
  }

  // Double tap guard: a second tap on the same entry inside this window is
  // the same pass, not a new lap. Constants in one place, as the plan asks.
  const DOUBLE_TAP_WINDOW_SECONDS = { 400: 15, 200: 8 };
  function doubleTapWindowSeconds(lapLengthMeters) {
    const lap = Number(lapLengthMeters);
    if (DOUBLE_TAP_WINDOW_SECONDS[lap]) return DOUBLE_TAP_WINDOW_SECONDS[lap];
    return Number.isFinite(lap) && lap > 0 ? Math.max(5, Math.round((15 * lap) / 400)) : DOUBLE_TAP_WINDOW_SECONDS[400];
  }

  const locationOf = (checkpoint) => checkpoint.location || DEFAULT_LOCATION;
  const bySortOrder = (a, b) => a.sort_order - b.sort_order;
  const hasTime = (split) => split && split.elapsed_seconds !== null && split.elapsed_seconds !== undefined && !split.is_dns && !split.is_dnf;

  // The checkpoints for a track event: one at the finish line every lap, and
  // (800 on a 400 m track, optional) the 200 m mark halfway round each lap.
  // Rows ready for race_checkpoints (minus race_session_id).
  function generateLapCheckpoints({ eventKey, lapLengthMeters = 400, include200Marks = false }) {
    const event = LAP_EVENTS[String(eventKey)];
    if (!event) throw new Error("Pick a track event: 3200, 1600 or 800.");
    const lap = Number(lapLengthMeters);
    if (!TRACK_LAP_LENGTHS.includes(lap)) throw new Error("The track's lap length must be 400 or 200 meters.");
    const total = event.distanceMeters;
    const points = [];
    for (let d = lap; d <= total + 0.001; d += lap) points.push({ d, location: "finish_line" });
    if (include200Marks && lap === 400 && String(eventKey) === "800") {
      for (let d = 200; d < total; d += 400) points.push({ d, location: "mark_200" });
    }
    points.sort((a, b) => a.d - b.d);
    return points.map((p, index) => {
      const isFinish = Math.abs(p.d - total) < 0.001;
      const label = isFinish
        ? `Finish (${total})`
        : p.location === "mark_200"
          ? `200 m mark (${p.d})`
          : `Lap ${Math.round(p.d / lap)} (${p.d})`;
      return { label, distance_meters: p.d, sort_order: index + 1, is_finish: isFinish, location: p.location, is_exchange: false };
    });
  }

  // The leg distances for a relay event (a custom relay takes the coach's
  // own list, e.g. [1200, 400, 800, 1600] for a DMR). Throws a readable
  // message for anything that can't be run.
  function relayLegMeters({ eventKey, legMeters = null }) {
    const event = RELAY_EVENTS[String(eventKey)];
    if (!event) throw new Error("Pick a relay: 4x800, 4x400, 4x200, 4x100 or Custom relay.");
    const legs = (event.legMeters || legMeters || []).map(Number);
    if (legs.length < 2 || legs.length > RELAY_MAX_LEGS) throw new Error(`A relay needs 2 to ${RELAY_MAX_LEGS} legs.`);
    if (legs.some((d) => !Number.isFinite(d) || d <= 0 || Math.round(d) !== d || d % 100 !== 0)) {
      throw new Error("Each leg must be a whole number of meters in steps of 100 (for example 1200, 400, 800, 1600).");
    }
    if (legs.reduce((a, b) => a + b, 0) > RELAY_MAX_METERS) throw new Error(`A relay can be at most ${RELAY_MAX_METERS} meters in total.`);
    return legs;
  }

  // Each leg's place in the race: [{ leg_order, distance_meters, start_meters, end_meters }].
  function relayLegs(legMeters) {
    let at = 0;
    return (legMeters || []).map((d, index) => {
      const leg = { leg_order: index + 1, distance_meters: Number(d), start_meters: at, end_meters: at + Number(d) };
      at += Number(d);
      return leg;
    });
  }

  // The checkpoints for a relay: a split at the finish line every lap, with
  // the ones at a leg's end flagged as exchanges. An exchange that falls
  // halfway round a 400 m track (the 200 m mark, e.g. the 4x200's first and
  // third exchanges) is optional and labeled approximate, because of the
  // stagger. An exchange anywhere else (e.g. after a 100 m leg) can't be
  // tapped from either place, so it has no checkpoint: those legs are shown
  // together. A 4x100 is timed at the finish only.
  function generateRelayCheckpoints({ eventKey, lapLengthMeters = 400, legMeters = null, include200Exchanges = false }) {
    const lap = Number(lapLengthMeters);
    if (!TRACK_LAP_LENGTHS.includes(lap)) throw new Error("The track's lap length must be 400 or 200 meters.");
    const legsList = relayLegMeters({ eventKey, legMeters });
    const legs = relayLegs(legsList);
    const total = legs[legs.length - 1].end_meters;
    const exchangeAt = new Map(legs.slice(0, -1).map((leg) => [leg.end_meters, leg.leg_order]));
    const points = [];
    if (!RELAY_EVENTS[String(eventKey)].finishOnly) {
      for (let d = lap; d < total - 0.001; d += lap) points.push({ d, location: "finish_line" });
      if (lap === 400 && include200Exchanges) {
        for (const [d] of exchangeAt) if (d % 400 === 200) points.push({ d, location: "mark_200" });
      }
    }
    points.push({ d: total, location: "finish_line" });
    points.sort((a, b) => a.d - b.d);
    return points.map((p, index) => {
      const isFinish = p.d === total;
      const exchange = !isFinish && exchangeAt.has(p.d);
      const label = isFinish
        ? `Finish (${total})`
        : exchange
          ? `Exchange ${exchangeAt.get(p.d)} (${p.d}${p.location === "mark_200" ? ", approx." : ""})`
          : `Lap ${Math.round(p.d / lap)} (${p.d})`;
      return { label, distance_meters: p.d, sort_order: index + 1, is_finish: isFinish, location: p.location, is_exchange: exchange };
    });
  }

  // Leg splits from an entry's recorded times. A leg split = the time at the
  // leg's end minus the time at its start (the start of the race for leg 1).
  // Legs whose exchange has no checkpoint or no time yet are joined into one
  // segment ("Legs 1-2"). Never stored, so changing who runs a leg never
  // changes a time. Returns [{ first_leg, last_leg, start_meters,
  // end_meters, seconds (null until closed), closed_at (elapsed or null) }].
  function relayLegSegments({ checkpoints, splits, legMeters }) {
    const legs = relayLegs(legMeters);
    if (!legs.length) return [];
    const timed = new Map((splits || []).filter(hasTime).map((s) => [s.race_checkpoint_id, Number(s.elapsed_seconds)]));
    const timeAt = new Map([[0, 0]]);
    for (const c of checkpoints || []) {
      if ((c.is_exchange || c.is_finish) && timed.has(c.id)) timeAt.set(Number(c.distance_meters), timed.get(c.id));
    }
    // Boundaries that have (or could get) a checkpoint split the legs.
    const boundaryPossible = new Set((checkpoints || []).filter((c) => c.is_exchange || c.is_finish).map((c) => Number(c.distance_meters)));
    const segments = [];
    let first = legs[0];
    for (const leg of legs) {
      const isLast = leg === legs[legs.length - 1];
      const isEnd = isLast || (boundaryPossible.has(leg.end_meters) && (timeAt.has(leg.end_meters) || !laterTimeExists(timeAt, leg.end_meters)));
      if (!isEnd) continue;
      const start = timeAt.has(first.start_meters) ? timeAt.get(first.start_meters) : null;
      const end = timeAt.has(leg.end_meters) ? timeAt.get(leg.end_meters) : null;
      segments.push({
        first_leg: first.leg_order,
        last_leg: leg.leg_order,
        start_meters: first.start_meters,
        end_meters: leg.end_meters,
        seconds: start !== null && end !== null ? end - start : null,
        closed_at: end
      });
      const nextIndex = legs.indexOf(leg) + 1;
      if (nextIndex < legs.length) first = legs[nextIndex];
    }
    return segments;
  }
  // An exchange with no time yet still splits the legs while the race is
  // on (it may be tapped next); once a later boundary has a time, a missed
  // exchange is joined into one segment instead.
  function laterTimeExists(timeAt, meters) {
    for (const d of timeAt.keys()) if (d > meters) return true;
    return false;
  }

  // Which leg(s) are running now for a relay entry: the legs between the
  // last recorded pass and the next checkpoint (one leg normally; two when
  // an exchange can't be tapped, e.g. a 4x200 without 200 m mark
  // exchanges). Empty when the team has finished.
  function currentRelayLegs({ legMeters, lastDistanceMeters = 0, nextDistanceMeters = null }) {
    if (nextDistanceMeters === null || nextDistanceMeters === undefined) return [];
    const last = Number(lastDistanceMeters) || 0;
    const next = Number(nextDistanceMeters);
    return relayLegs(legMeters).filter((leg) => leg.end_meters > last && leg.start_meters < next).map((leg) => leg.leg_order);
  }

  // Where one entry stands, seen from one place on the track.
  //   checkpoints: the race's checkpoints; splits: this entry's splits.
  function lapState({ checkpoints, splits, location = DEFAULT_LOCATION }) {
    const all = [...checkpoints].sort(bySortOrder);
    const here = all.filter((c) => locationOf(c) === location);
    const timed = new Map((splits || []).filter(hasTime).map((s) => [s.race_checkpoint_id, s]));
    const recordedHere = here.filter((c) => timed.has(c.id));
    const highest = recordedHere[recordedHere.length - 1] || null;
    const next = highest ? here.find((c) => c.sort_order > highest.sort_order) || null : here[0] || null;
    const lastElapsed = highest ? Number(timed.get(highest.id).elapsed_seconds) : null;
    const previous = recordedHere.length > 1 ? recordedHere[recordedHere.length - 2] : null;
    const previousElapsed = previous ? Number(timed.get(previous.id).elapsed_seconds) : 0;
    const finish = all.find((c) => c.is_finish) || null;
    const finished = Boolean(finish && timed.has(finish.id));
    return {
      location,
      done: recordedHere.length,
      total: here.length,
      next,
      nextCheckpointId: next ? next.id : null,
      lastCheckpointId: highest ? highest.id : null,
      lastElapsed,
      // The last lap: time since the previous pass at this place (or since
      // the start for the first one).
      lastLapSeconds: highest ? lastElapsed - previousElapsed : null,
      lastLapMeters: highest ? highest.distance_meters - (previous ? previous.distance_meters : 0) : null,
      finished,
      finishElapsed: finished ? Number(timed.get(finish.id).elapsed_seconds) : null
    };
  }

  // Where a lap tap belongs, decided by TIME, never by the lap number a
  // phone guessed (a second phone may not know yet that the first recorded
  // lap 3). Used by the phone before saving a tap, and by the server when a
  // tap arrives for a checkpoint another phone already filled.
  //   duplicate: within the double tap window of a recorded pass at this
  //              place -- the same pass; the first saved wins.
  //   append:    later than every recorded pass here -- the next open lap.
  //   fill:      earlier than a recorded pass, and the lap right after the
  //              previous pass is empty -- it goes there.
  //   insert:    earlier than a recorded pass, and that lap is taken (a
  //              phone recorded a later pass there because it missed this
  //              one) -- the later passes each move up one lap (moves, last
  //              first) and the tap takes the freed lap.
  //   finished:  no lap left at this place (a tap past the finish).
  function resolveLapTap({ checkpoints, splits, location = DEFAULT_LOCATION, tapElapsedSeconds, windowSeconds }) {
    const here = [...checkpoints].filter((c) => locationOf(c) === location).sort(bySortOrder);
    const timed = new Map((splits || []).filter(hasTime).map((s) => [s.race_checkpoint_id, s]));
    const recorded = here.filter((c) => timed.has(c.id)).map((c) => ({ checkpoint: c, split: timed.get(c.id), elapsed: Number(timed.get(c.id).elapsed_seconds) }));
    const tap = Number(tapElapsedSeconds);
    const duplicate = recorded.find((r) => Math.abs(r.elapsed - tap) < windowSeconds);
    if (duplicate) return { action: "duplicate", checkpoint: duplicate.checkpoint, split: duplicate.split, moves: [] };
    if (!recorded.some((r) => r.elapsed > tap)) {
      const highest = recorded[recorded.length - 1];
      const next = highest ? here.find((c) => c.sort_order > highest.checkpoint.sort_order) : here[0];
      return next ? { action: "append", checkpoint: next, moves: [] } : { action: "finished", checkpoint: null, moves: [] };
    }
    const before = recorded.filter((r) => r.elapsed < tap).pop();
    const startIndex = before ? here.indexOf(before.checkpoint) + 1 : 0;
    let end = startIndex;
    while (end < here.length && timed.has(here[end].id)) end += 1;
    if (end >= here.length) return { action: "finished", checkpoint: null, moves: [] };
    const moves = [];
    for (let i = end - 1; i >= startIndex; i -= 1) moves.push({ split: timed.get(here[i].id), from: here[i], to: here[i + 1] });
    return { action: moves.length ? "insert" : "fill", checkpoint: here[startIndex], moves };
  }

  // When each entry should pass next: last pass + last lap (or, before the
  // first pass, the expected first lap). Entries out of the race (DNS, DNF,
  // DQ, finished) go last. Ties keep roster order, so buttons don't jump.
  function expectedNextPassSeconds(state, firstLapSeconds = null) {
    if (state.finished || !state.next) return null;
    if (state.lastElapsed === null) return Number.isFinite(firstLapSeconds) ? firstLapSeconds : null;
    const lap = Number.isFinite(state.lastLapSeconds) && state.lastLapSeconds > 0 ? state.lastLapSeconds : firstLapSeconds;
    return Number.isFinite(lap) ? state.lastElapsed + lap : null;
  }
  function orderByNextPass(items) {
    // items: [{ id, expected (seconds or null), rosterIndex, out (boolean) }]
    return [...items].sort((a, b) => {
      if (a.out !== b.out) return a.out ? 1 : -1;
      const ae = a.expected === null || a.expected === undefined ? Infinity : a.expected;
      const be = b.expected === null || b.expected === undefined ? Infinity : b.expected;
      if (ae !== be) return ae - be;
      return a.rosterIndex - b.rosterIndex;
    }).map((item) => item.id);
  }

  // The database writes for one lap tap, in a safe order (server only;
  // pushSplits runs them). race_splits allows one row per entry per
  // checkpoint, and an undone tap leaves its row in place with no time, so
  // rows can only MOVE into a checkpoint that has no row at all. When the
  // free checkpoint at the end of an insert holds an undone row, the times
  // shift up through the rows instead (each change a revision, nothing
  // lost). Returns { ops, resultRowId } where ops are, in order:
  //   { op: "move", id, to }                        row keeps its time, changes lap
  //   { op: "update", id, values, changeReason }    row takes new values (a revision)
  //   { op: "insert", values }                      a new row (the tap itself)
  // resolution: resolveLapTap(...) with action append | fill | insert.
  // entryRows: every race_splits row of this entry (timed or not).
  // tap: { clientSplitId, elapsedSeconds, wallClockCapturedAt, captureMethod, deviceId, clockOffsetMs, clockUncertaintyMs }.
  function planLapWrites({ resolution, entryRows, checkpoints, location = DEFAULT_LOCATION, tap }) {
    const here = [...checkpoints].filter((c) => locationOf(c) === location).sort(bySortOrder);
    const rowAt = new Map((entryRows || []).map((r) => [r.race_checkpoint_id, r]));
    const tapValues = (checkpointId) => ({
      race_checkpoint_id: checkpointId,
      elapsed_seconds: tap.elapsedSeconds,
      wall_clock_captured_at: tap.wallClockCapturedAt,
      capture_method: tap.captureMethod,
      device_id: tap.deviceId,
      clock_offset_ms: tap.clockOffsetMs ?? null,
      clock_uncertainty_ms: tap.clockUncertaintyMs ?? null,
      is_dns: false,
      is_dnf: false
    });
    const valuesOf = (row) => ({
      elapsed_seconds: row.elapsed_seconds,
      wall_clock_captured_at: row.wall_clock_captured_at,
      capture_method: row.capture_method,
      device_id: row.device_id,
      clock_offset_ms: row.clock_offset_ms ?? null,
      clock_uncertainty_ms: row.clock_uncertainty_ms ?? null,
      is_dns: Boolean(row.is_dns),
      is_dnf: Boolean(row.is_dnf)
    });
    // Put the tap at checkpoint id `target` (which has no timed split).
    const placeTap = (target) => {
      const undone = rowAt.get(target);
      if (undone) return { ops: [{ op: "update", id: undone.id, values: tapValues(target), changeReason: "manual_correction" }], resultRowId: undone.id };
      return { ops: [{ op: "insert", values: { ...tapValues(target), client_split_id: tap.clientSplitId } }], resultRowId: null };
    };
    if (resolution.action === "append" || resolution.action === "fill") return placeTap(resolution.checkpoint.id);
    if (resolution.action !== "insert") throw new Error(`planLapWrites: nothing to write for "${resolution.action}"`);
    const start = here.findIndex((c) => c.id === resolution.checkpoint.id);
    const freeIndex = start + resolution.moves.length; // the checkpoint the chain moves into
    const free = here[freeIndex];
    const chain = here.slice(start, freeIndex); // occupied, in lap order
    if (!rowAt.get(free.id)) {
      // Move each later pass up one lap (last first), then the tap takes the freed lap.
      const ops = chain.slice().reverse().map((c, i) => ({ op: "move", id: rowAt.get(c.id).id, to: here[freeIndex - i].id }));
      return { ops: [...ops, { op: "insert", values: { ...tapValues(resolution.checkpoint.id), client_split_id: tap.clientSplitId } }], resultRowId: null };
    }
    // The free lap holds an undone row: shift the times up instead.
    const ops = [];
    for (let i = freeIndex; i > start; i -= 1) {
      ops.push({ op: "update", id: rowAt.get(here[i].id).id, values: valuesOf(rowAt.get(here[i - 1].id)), changeReason: "manual_correction" });
    }
    const startRow = rowAt.get(here[start].id);
    ops.push({ op: "update", id: startRow.id, values: tapValues(here[start].id), changeReason: "manual_correction" });
    return { ops, resultRowId: startRow.id };
  }

  window.PodiumRaceLaps = { LAP_LOCATIONS, DEFAULT_LOCATION, TRACK_LAP_LENGTHS, LAP_EVENTS, RELAY_EVENTS, RELAY_MAX_LEGS, RELAY_MAX_METERS, isRelayEvent, DOUBLE_TAP_WINDOW_SECONDS, doubleTapWindowSeconds, generateLapCheckpoints, relayLegMeters, relayLegs, generateRelayCheckpoints, relayLegSegments, currentRelayLegs, lapState, resolveLapTap, expectedNextPassSeconds, orderByNextPass, planLapWrites };
})();
