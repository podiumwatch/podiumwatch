// Server-side port of the two functions from public/scripts/race-math.js
// that the API layer needs to validate or (re)compute -- target
// generation and Custom Pace strictly-increasing validation. Race
// Command Center's client scripts are plain classic browser scripts (see
// public/scripts/race-math.js's own header for why), so they cannot be
// imported directly into a Node API handler; this is a small, deliberate
// port, not a duplication risk, since both sides implement the same
// simple, already-tested proportional formula and are each covered by
// scripts/test-race-command-center.mjs.
//
// The server never trusts client-side validation alone: Custom Pace
// targets are re-validated here before being persisted, even though
// public/scripts/race-math.js also validates them in the browser first.

// Mirrors computeEvenPaceTargets() in public/scripts/race-math.js exactly.
export function computeEvenPaceTargets({ distanceMeters, goalSeconds, checkpoints }) {
  if (!(distanceMeters > 0) || !(goalSeconds > 0) || !Array.isArray(checkpoints)) {
    return [];
  }

  return checkpoints.map((checkpoint) => ({
    checkpointId: checkpoint.id,
    cumulativeSeconds: goalSeconds * (checkpoint.distanceMeters / distanceMeters)
  }));
}

// Mirrors validateCustomPaceTargets() in public/scripts/race-math.js
// exactly -- never auto-corrects, only validates.
export function validateCustomPaceTargets(checkpointSecondsInOrder) {
  if (!Array.isArray(checkpointSecondsInOrder) || checkpointSecondsInOrder.length === 0) {
    return { valid: false, firstInvalidIndex: 0 };
  }

  let previous = 0;
  for (let i = 0; i < checkpointSecondsInOrder.length; i += 1) {
    const value = checkpointSecondsInOrder[i];
    if (!(Number.isFinite(value) && value > previous)) {
      return { valid: false, firstInvalidIndex: i };
    }
    previous = value;
  }

  return { valid: true };
}
