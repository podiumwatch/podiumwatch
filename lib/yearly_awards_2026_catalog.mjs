// The 2026 awards catalog (every category and finalist) for the public
// vote and status endpoints, with a last-good-copy fallback (2026-11-11).
//
// During the Nov 10 surge Supabase timed out for about three minutes and
// 38 votes failed while loading the category, before Redis was touched.
// Now:
//   - a fresh copy is reused for 10 seconds per server instance;
//   - each refresh has a 2.5 second timeout;
//   - every good copy is kept in memory and saved to Redis (at most once a
//     minute per instance);
//   - if Supabase fails or is slow, the last good copy is served (memory
//     first, then Redis) and Supabase isn't asked again for 5 seconds.
// Votes are still counted in Redis, so voting never waits on Supabase once
// any good copy exists. Category status is worked out from the clock, so an
// older copy still opens and closes voting on time.

export const CATALOG_REDIS_KEY = "yoty2026:catalog";
export const FRESH_MS = 10_000;
export const TIMEOUT_MS = 2_500;
export const RETRY_AFTER_FAILURE_MS = 5_000;
export const REDIS_SAVE_EVERY_MS = 60_000;

export function createCatalog({ load, redisGet, redisSet, freshMs = FRESH_MS, timeoutMs = TIMEOUT_MS, retryMs = RETRY_AFTER_FAILURE_MS, saveEveryMs = REDIS_SAVE_EVERY_MS, now = () => Date.now(), log = console } = {}) {
  let memory = null; // { at, value }
  let inflight = null;
  let retryAt = 0;
  let savedAt = 0;

  function withTimeout() {
    const controller = new AbortController();
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error(`awards catalog timed out after ${timeoutMs} ms`));
      }, timeoutMs);
    });
    return Promise.race([load(controller.signal), timeout]).finally(() => clearTimeout(timer));
  }

  async function fallback(cause) {
    retryAt = now() + retryMs;
    if (memory) {
      log.warn?.(`[awards] Supabase unavailable, serving the saved catalog: ${cause?.message || cause}`);
      return { ...memory.value, stale: true };
    }
    let saved = null;
    try {
      saved = await redisGet();
      if (typeof saved === "string") saved = JSON.parse(saved);
    } catch (redisError) {
      log.error?.("[awards] Saved catalog unavailable in Redis:", redisError?.message || redisError);
    }
    if (saved && Array.isArray(saved.categories) && Array.isArray(saved.finalists)) {
      memory = { at: 0, value: { categories: saved.categories, finalists: saved.finalists } };
      log.warn?.(`[awards] Supabase unavailable, serving the Redis catalog: ${cause?.message || cause}`);
      return { ...memory.value, stale: true };
    }
    throw cause;
  }

  async function refresh() {
    let value;
    try {
      value = await withTimeout();
      if (!value || !Array.isArray(value.categories) || !Array.isArray(value.finalists)) throw new Error("awards catalog came back empty");
    } catch (loadError) {
      return fallback(loadError);
    }
    memory = { at: now(), value };
    retryAt = 0;
    if (now() - savedAt >= saveEveryMs) {
      savedAt = now();
      try {
        await redisSet(JSON.stringify(value));
      } catch (redisError) {
        log.error?.("[awards] Could not save the catalog to Redis:", redisError?.message || redisError);
      }
    }
    return value;
  }

  async function get() {
    if (memory && memory.at && now() - memory.at < freshMs) return memory.value;
    // Supabase just failed: answer from the saved copy without waiting.
    if (memory && now() < retryAt) return { ...memory.value, stale: true };
    if (!inflight) inflight = refresh().finally(() => { inflight = null; });
    return inflight;
  }

  return { get, reset: () => { memory = null; inflight = null; retryAt = 0; savedAt = 0; } };
}
