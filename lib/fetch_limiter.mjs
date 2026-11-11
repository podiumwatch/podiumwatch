// Caps how many Supabase requests one server instance has open at once
// (2026-11-11). On Nov 10 team pages ran out of sockets during the voting
// surge (EMFILE, getaddrinfo EBUSY): each team page starts up to 8 queries
// at once, and with many visitors sharing an instance that multiplied into
// hundreds of open connections. Requests over the cap wait their turn; if
// too many are waiting, or one waits too long, it fails fast so the page
// can serve its last good copy (lib/page_cache.mjs) instead of piling up.

export const MAX_IN_FLIGHT = 16;
export const MAX_QUEUE = 400;
export const MAX_WAIT_MS = 5_000;

export function createLimitedFetch({ max = MAX_IN_FLIGHT, maxQueue = MAX_QUEUE, maxWaitMs = MAX_WAIT_MS, fetchImpl = (...args) => fetch(...args) } = {}) {
  let active = 0;
  const queue = [];

  function release() {
    active--;
    while (queue.length && active < max) {
      const next = queue.shift();
      if (next.done) continue;
      next.done = true;
      clearTimeout(next.timer);
      active++;
      next.resolve();
    }
  }

  function acquire() {
    if (active < max) {
      active++;
      return Promise.resolve();
    }
    if (queue.length >= maxQueue) return Promise.reject(Object.assign(new Error("Too many database requests waiting on this server."), { code: "PW_DB_BUSY" }));
    return new Promise((resolve, reject) => {
      const entry = { resolve, done: false, timer: null };
      entry.timer = setTimeout(() => {
        if (entry.done) return;
        entry.done = true;
        reject(Object.assign(new Error("Waited too long for a database connection."), { code: "PW_DB_BUSY" }));
      }, maxWaitMs);
      queue.push(entry);
    });
  }

  async function limitedFetch(input, init) {
    await acquire();
    try {
      // Read the whole body before freeing the slot: the connection stays
      // busy until the body has arrived, not just the headers.
      const response = await fetchImpl(input, init);
      const empty = [101, 204, 205, 304].includes(response.status) || init?.method === "HEAD";
      const body = empty ? null : await response.arrayBuffer();
      return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
    } finally {
      release();
    }
  }

  limitedFetch.stats = () => ({ active, waiting: queue.filter((entry) => !entry.done).length });
  return limitedFetch;
}
