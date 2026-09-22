import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Real incident (2026-08-31): multiple real people reported their votes
// "not being counted" on Athlete/Team of the Week. No vote was ever
// lost -- every one was safely in the database the whole time. The bug
// was in vote-count *display*: api/aotw/current.js, api/totw/current.js,
// and lib/awards_service.mjs's admin getWeekDetail() each fetched every
// vote row for a week with one unbounded .select(...) and tallied
// vote_count per finalist in JavaScript. Supabase/PostgREST silently
// caps an unbounded select at 1,000 rows -- it never errors, it just
// stops returning more -- so once the real AOTW week passed 1,000 total
// votes, every displayed count was undercounted, and the gap only grew
// as more real people voted. Full story: docs/DECISIONS.md, 2026-08-31.
//
// This guards two things: the three known, now-fixed call sites still
// use a real count() aggregate (not a bulk select tallied client-side),
// and a repo-wide scan for the same dangerous shape appearing anywhere
// else in the future -- a .select() that is never given count:"exact"
// but whose result is fed into a "tally occurrences per key" loop
// (the (map.get(key) || 0) + 1 shape every one of the three real bugs
// shared) is exactly the pattern that fails this silently, so a fourth
// instance of it anywhere in api/ or lib/ should fail this test, not
// wait for a fourth round of confused real users.

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSource(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function listSourceFiles(relativeDir) {
  const results = [];
  const absoluteDir = path.join(root, relativeDir);

  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    const relativeEntryPath = path.join(relativeDir, entry.name);

    if (entry.isDirectory()) {
      results.push(...listSourceFiles(relativeEntryPath));
      continue;
    }

    if (/\.(mjs|js)$/.test(entry.name)) {
      results.push(relativeEntryPath);
    }
  }

  return results;
}

// --- the one remaining known, real, now-fixed call site -----------------
//
// Vote tallying Redis pilot (2026-09-15 Team of the Week, extended to
// Athlete of the Week 2026-09-21): api/totw/current.js and
// api/aotw/current.js no longer count votes from Supabase at all -- vote
// counts for both awards now come from Redis (lib/award_vote_redis.mjs),
// which has no 1,000-row cap to silently hit in the first place, so
// count:"exact" is no longer the relevant safeguard for either file.
// lib/awards_service.mjs's getWeekDetail() keeps its old Supabase
// count("exact") code path in place as a generic fallback (dead for both
// aotw and totw now that both set voteBackend: "redis" in TYPES, but
// left in place rather than removed -- see docs/DECISIONS.md), so it's
// still asserted below. Confirmed directly (not just by the app routes'
// absence from this list) via a live round-trip test of every
// award_vote_redis.mjs function against the real database before either
// route changed.

const knownFixedFiles = [
  "lib/awards_service.mjs"
];

for (const relativePath of knownFixedFiles) {
  const source = readSource(relativePath);
  assert.match(
    source,
    /count:\s*["']exact["']/,
    `${relativePath} must compute its vote_count with a real count("exact") aggregate, not a bulk select tallied client-side`
  );
}

// api/totw/current.js and api/aotw/current.js: guard the Redis fix stays
// in place on both, the same spirit as the count:"exact" assertion
// above -- fail loudly if either file ever goes back to querying its
// votes table directly instead.
const totwCurrentSource = readSource("api/totw/current.js");
assert.doesNotMatch(
  totwCurrentSource,
  /\.from\(\s*["']totw_votes["']/,
  "api/totw/current.js must not query totw_votes directly -- Team of the Week vote counts come from Redis (lib/award_vote_redis.mjs) now, not a per-finalist Supabase count."
);
assert.match(
  totwCurrentSource,
  /getRedisVoteCounts/,
  "api/totw/current.js should read Team of the Week vote counts through lib/award_vote_redis.mjs's getRedisVoteCounts()."
);

const aotwCurrentSource = readSource("api/aotw/current.js");
assert.doesNotMatch(
  aotwCurrentSource,
  /\.from\(\s*["']aotw_votes["']/,
  "api/aotw/current.js must not query aotw_votes directly -- Athlete of the Week vote counts come from Redis (lib/award_vote_redis.mjs) now, not a per-finalist Supabase count."
);
assert.match(
  aotwCurrentSource,
  /getRedisVoteCounts/,
  "api/aotw/current.js should read Athlete of the Week vote counts through lib/award_vote_redis.mjs's getRedisVoteCounts()."
);

console.log("The one known real Supabase call site (lib/awards_service.mjs's dead-fallback branch) still uses a real count(\"exact\") aggregate; api/totw/current.js and api/aotw/current.js confirmed on the Redis vote-count path instead, with no direct votes-table query.");

// --- repo-wide scan for the same dangerous shape recurring elsewhere ---
// Heuristic, not a full parser: a file is flagged only if it BOTH (a)
// contains the "tally occurrences per key" increment shape every one of
// the three real bugs shared -- (something.get(key) || 0) + 1, or the
// plain-object equivalent -- AND (b) has no count:"exact" anywhere in
// the same file to pair with it. A file can legitimately use this tally
// shape on data that was never fetched from Supabase at all (in which
// case it has nothing to do with this bug and won't also need
// count:"exact") -- this is deliberately loose enough to accept an
// occasional false positive rather than risk missing a real one; a
// genuine false positive gets added to KNOWN_SAFE_EXCEPTIONS below with
// a comment explaining why, not silently ignored.
const TALLY_INCREMENT_PATTERN = /\(\s*[\w.]+(?:\.get\([^)]*\)|\[[^\]]*\])\s*\|\|\s*0\s*\)\s*\+\s*1/;
const SUPABASE_SELECT_PATTERN = /\.from\(\s*[^)]*\)[\s\S]{0,80}?\.select\(/;
const COUNT_EXACT_PATTERN = /count:\s*["']exact["']/;

// Files already confirmed safe by direct reasoning, not by this
// heuristic -- listed explicitly so a real future finding can never be
// silently swallowed by treating "already on this list" as equivalent
// to "already checked this specific occurrence." Both entries below were
// checked by hand on 2026-08-31, the day this test was written: their
// tally loops are fed by queries that already carry an explicit, generous
// .limit() (5,000-30,000, several also time-windowed or scoped to one
// team/school) rather than no limit at all -- the specific "silently
// defaults to 1,000 with nothing set" shape this test exists to catch.
// They are not immune to ever needing a real count() aggregate if real
// volume keeps growing, just not exposed to the exact failure that
// caused the 2026-08-31 incident today.
const KNOWN_SAFE_EXCEPTIONS = new Set([
  path.join("api", "recruiting", "index.js"), // summary() is fed by queries with .limit(5000)/.limit(10000).
  path.join("lib", "engagement_service.mjs") // aggregateAnalytics() is fed by queries with .limit(20000)/.limit(30000), both time-windowed.
]);

const flagged = [];

for (const relativePath of [...listSourceFiles("api"), ...listSourceFiles("lib")]) {
  if (KNOWN_SAFE_EXCEPTIONS.has(relativePath)) {
    continue;
  }

  const source = readSource(relativePath);

  if (!TALLY_INCREMENT_PATTERN.test(source)) {
    continue;
  }

  if (!SUPABASE_SELECT_PATTERN.test(source)) {
    continue;
  }

  if (COUNT_EXACT_PATTERN.test(source)) {
    continue;
  }

  flagged.push(relativePath);
}

assert.deepEqual(
  flagged,
  [],
  `Found a Supabase select() feeding a per-key tally with no count("exact") anywhere in the file -- the exact shape that caused the 2026-08-31 vote-undercounting incident. Flagged: ${flagged.join(", ")}. Either fix it the same way (a real count aggregate) or, if it is a genuine false positive on data that never came from an unbounded Supabase query, add it to KNOWN_SAFE_EXCEPTIONS above with a comment explaining why.`
);
console.log("Repo-wide scan of api/ and lib/ found no other occurrence of the dangerous shape (an uncounted select feeding a per-key tally).");
