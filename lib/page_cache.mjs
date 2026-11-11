// Read-only pages and APIs: CDN caching and a last-good copy (2026-11-11).
//
// Cache-Control: the CDN keeps each page for s-maxage seconds and keeps
// serving that copy for up to a day (stale-while-revalidate) while it fetches
// a new one in the background. An error is never cached (no-store), so a
// failed refresh leaves the old copy in place.
//
// Last-good copy: each server instance also keeps the latest good response
// for each page in memory. If Supabase fails, that copy is served (marked
// x-pw-stale, cached only 60 seconds so the real page returns soon) instead
// of an error. Votes, admin and tracking never use this.

export const CACHE_PAGE = "public, s-maxage=900, stale-while-revalidate=86400"; // team, athlete, results: 15 min
export const CACHE_API_60 = "public, s-maxage=60, stale-while-revalidate=600"; // meets API, awards status: 60 s
export const CACHE_STALE_FALLBACK = "public, s-maxage=60";

const MAX_ENTRIES = 300;
const MAX_BYTES = 24 * 1024 * 1024;

export function createLastGood({ maxEntries = MAX_ENTRIES, maxBytes = MAX_BYTES } = {}) {
  const store = new Map(); // key -> { type, body, size, at }
  let bytes = 0;

  function remember(key, type, body) {
    const text = typeof body === "string" ? body : JSON.stringify(body);
    const size = text.length;
    if (size > maxBytes / 4) return;
    const old = store.get(key);
    if (old) { bytes -= old.size; store.delete(key); }
    store.set(key, { type, body: text, size, at: Date.now() });
    bytes += size;
    // Oldest first (Map keeps insertion order; a re-remembered key moved to the end).
    for (const [oldKey, entry] of store) {
      if (store.size <= maxEntries && bytes <= maxBytes) break;
      store.delete(oldKey);
      bytes -= entry.size;
    }
  }

  function get(key) {
    const entry = store.get(key);
    if (!entry) return null;
    store.delete(key);
    store.set(key, entry);
    return entry;
  }

  return { remember, get, size: () => store.size, bytes: () => bytes };
}

const shared = createLastGood();
export const rememberGood = (key, type, body) => shared.remember(key, type, body);

// Sends the last good copy if there is one; returns false when there isn't.
export function sendLastGood(response, key, store = shared) {
  const entry = store.get(key);
  if (!entry) return false;
  response.setHeader("Content-Type", entry.type);
  response.setHeader("Cache-Control", CACHE_STALE_FALLBACK);
  response.setHeader("x-pw-stale", "1");
  response.status(200).send(entry.body);
  return true;
}
