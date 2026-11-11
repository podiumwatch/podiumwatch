// In-memory queue for analytics rows (2026-11-11). /api/engagement/track
// answers 204 right away and hands the row here; rows are written in groups
// every few seconds instead of one insert per page view.
//
// On Vercel the flush is registered with the platform's waitUntil, so the
// instance stays alive to finish it after the response is sent, and rows
// from overlapping requests on the same instance share one insert. If a
// batch write fails or times out, that batch is dropped: analytics rows are
// allowed to be lost, visitors are never allowed to wait.

export const FLUSH_MS = 3000;
export const MAX_BATCH = 200;
export const MAX_QUEUE = 2000;

export function createAnalyticsBuffer({ write, flushMs = FLUSH_MS, maxBatch = MAX_BATCH, maxQueue = MAX_QUEUE, onDrop = () => {} } = {}) {
  let queue = [];
  let pending = null;
  let timer = null;

  async function flushNow() {
    if (timer) clearTimeout(timer);
    timer = null;
    while (queue.length) {
      const batch = queue.slice(0, maxBatch);
      queue = queue.slice(maxBatch);
      try {
        await write(batch);
      } catch (error) {
        onDrop(batch.length, error);
      }
    }
  }

  // Starts (or joins) the next flush and returns its promise.
  function schedule() {
    if (pending) {
      if (queue.length >= maxBatch && timer) {
        clearTimeout(timer);
        timer = null;
        pending.fire();
      }
      return pending.promise;
    }
    let fire;
    const promise = new Promise((resolve) => {
      fire = () => {
        flushNow().finally(() => {
          pending = null;
          resolve();
          if (queue.length) schedule();
        });
      };
    });
    pending = { promise, fire };
    if (queue.length >= maxBatch) fire();
    else timer = setTimeout(fire, flushMs);
    return promise;
  }

  function add(row) {
    if (!row) return pending ? pending.promise : Promise.resolve();
    if (queue.length >= maxQueue) {
      onDrop(1, new Error("analytics queue full"));
      return schedule();
    }
    queue.push(row);
    return schedule();
  }

  return { add, flush: flushNow, size: () => queue.length };
}

// Vercel's request context (the same hook @vercel/functions' waitUntil
// reads). Outside Vercel it is absent and the timer alone keeps the
// process up long enough to flush.
export function waitUntil(promise) {
  try {
    const context = globalThis[Symbol.for("@vercel/request-context")]?.get?.();
    if (context?.waitUntil) context.waitUntil(promise);
  } catch {
    // Never let analytics affect the response.
  }
}
