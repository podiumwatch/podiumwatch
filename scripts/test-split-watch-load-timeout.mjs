import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

// Real incident (2026-08-25): during a live race day test, everything
// worked for the other races, but the JH boys race got stuck on
// "Checking..."/"Loading live race..." forever and never resolved. The
// 2026-08-31 fix (commit 86c6de08) gave the live page, race list and hub
// a 15 s timeout and an in-place Try again.
//
// Track build Phase 1 (2026-11-12, docs/SPLIT_WATCH_TRACK_HANDOFF.md):
// every Split Watch request now goes through ONE shared helper,
// public/scripts/split-watch-request.js, and the remaining paths that
// could still wait forever are closed: code entry, position
// confirmation, plan, review, public race page, meet center, guardian
// page, the sign-in token load (team-auth-client.js's config request),
// and the sign-in checks (getUser) awaited before a page's first
// request. This file guards all of it, plus the live page's offline
// reopen and the leave-page warning. The real-browser checks (stalled
// network, offline reload) are in scripts/test-split-watch-browser.mjs.

function readSource(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}
const code = (source) => source.split("\n").filter((line) => !/^\s*\/\//.test(line)).join("\n");

// ---- 1. The shared helper itself (source) ---------------------------------
const helper = readSource("../public/scripts/split-watch-request.js");
for (const [pattern, why] of [
  [/REQUEST_TIMEOUT_MS = 15000/, "a real, bounded 15 s timeout (the 2026-08-31 value)"],
  [/new AbortController\(\)/, "an AbortController"],
  [/setTimeout\(\(\) => controller\.abort\(\), timeoutMs\)/, "abort() actually called on timeout"],
  [/signal: controller\.signal/, "the signal passed into fetch()"],
  [/clearTimeout\(timeoutId\)/, "the timer cleared when the request settles"],
  [/error\.name === "AbortError"[\s\S]{0,80}"timeout"/, "a timeout turned into a clear, typed error"],
  [/await response\.json\(\)/, "the reply body read inside the same timeout"],
  [/TOKEN_TIMEOUT_MS = \d+/, "a bounded wait for the sign-in token"],
  [/"auth_unavailable"/, "a 401 after a failed token load treated as retryable"],
  [/textContent = "Try again"/, "a Try again button in the standard failure panel"]
]) assert.match(helper, pattern, `split-watch-request.js must have ${why}`);

// ---- 2. Every Split Watch page uses it, and nothing else fetches ---------
const pages = {
  "split-watch-live.js": "splitwatchlive.mjs",
  "split-watch-races.js": "splitwatchraces.mjs",
  "split-watch-hub.js": "splitwatch.mjs",
  "split-watch-join.js": "splitwatchjoin.mjs",
  "split-watch-plan.js": "splitwatchplan.mjs",
  "split-watch-review.js": "splitwatchreview.mjs",
  "race-public.js": "racepublic.mjs",
  "team-meet-center.js": "teammeetcenter.mjs",
  "guardian-home.js": "guardianhome.mjs"
};
const sources = {};
for (const [script, page] of Object.entries(pages)) {
  const source = readSource(`../public/scripts/${script}`);
  sources[script] = source;
  assert.doesNotMatch(code(source), /\bfetch\(/, `${script} must send every request through window.PodiumSwRequest, never a bare fetch() with no timeout`);
  assert.match(source, /window\.PodiumSwRequest/, `${script} must use the shared request helper`);
  const html = readSource(`../src/pages/${page}`);
  const helperAt = html.indexOf('src="/scripts/split-watch-request.js"');
  const scriptAt = html.indexOf(`src="/scripts/${script}"`);
  assert.ok(helperAt > -1 && scriptAt > helperAt, `${page} must load split-watch-request.js before ${script}`);
  // Any sign-in check a page waits on must be bounded too.
  for (const line of code(source).split("\n").filter((l) => /getUser\(\)/.test(l))) {
    assert.match(line, /withTimeout\(/, `${script}: a getUser() call must be bounded with Request.withTimeout: ${line.trim()}`);
  }
}

// ---- 3. Every first-load failure ends on Try again ------------------------
for (const script of ["split-watch-live.js", "split-watch-races.js", "split-watch-hub.js", "split-watch-plan.js", "split-watch-review.js", "race-public.js", "team-meet-center.js", "guardian-home.js"]) {
  assert.match(sources[script], /Request\.showRetry\(loadingBox, \{[\s\S]{0,700}onRetry: \(\) => \{[\s\S]{0,200}(initialize|startPolling|startWatching)\(\);/, `${script}'s load failure must show the standard panel whose Try again re-runs the load in place`);
}
for (const script of ["split-watch-live.js", "split-watch-races.js", "split-watch-hub.js"]) {
  assert.match(sources[script], /Couldn't verify -- retry/, `${script} keeps the "Couldn't verify -- retry" wording from the 2026-08-31 fix`);
}

// ---- 4. Buttons never stay greyed out ------------------------------------
assert.match(sources["split-watch-join.js"], /submitButton\.textContent = "Checking\.\.\.";[\s\S]*catch \(error\) \{[\s\S]{0,400}submitButton\.textContent = submitLabel;\s*submitButton\.disabled = false;/, "code entry: the Join button shows Checking... and always comes back on failure");
assert.match(sources["split-watch-races.js"], /joinConfirmButton\.textContent = "Saving\.\.\.";[\s\S]*catch \(error\) \{[\s\S]{0,500}joinConfirmButton\.textContent = confirmLabel;\s*joinConfirmButton\.disabled = false;/, "position confirmation: the button always comes back on failure");

// ---- 5. Sign-in token load: bounded, and a failure isn't cached ----------
const auth = readSource("../public/scripts/team-auth-client.js");
assert.match(auth, /CONFIG_TIMEOUT_MS = \d+/, "team-auth-client.js must bound the /api/team/config/ request");
assert.match(auth, /signal: controller\.signal/, "team-auth-client.js must pass the abort signal");
assert.match(auth, /clientPromise\.catch\(\(\) => \{\s*clientPromise = null;/, "a failed config load must be forgotten so Try again can recover");

// ---- 6. Live page: offline reopen + leave-page warning -------------------
const live = sources["split-watch-live.js"];
assert.match(live, /if \(Request\.isConnectionError\(error\) && await openFromSavedCopy\(\)\) return;/, "live page: a connection failure opens the race from the copy saved on the phone");
assert.match(live, /saved\.session\.status !== "live"/, "live page: only a race already running opens offline (starting a race still needs a connection in Phase 1)");
assert.match(live, /enterOfflineMode\(\);/, "live page: offline open shows the Working offline banner");
assert.match(live, /if \(offlineMode\) leaveOfflineMode\(\);/, "live page: the first successful request clears the banner");
assert.match(live, /addEventListener\("beforeunload", \(event\) => \{\s*if \(pendingSplitCount > 0\)/, "live page: warn before leaving while taps are waiting to send");
assert.equal((live.match(/\.\.\.offlineExtras\(\)/g) || []).length >= 5, true, "live page: every saved race copy includes the offline fields");
assert.match(readSource("../src/pages/splitwatchlive.mjs"), /data-sw-offline-banner[^>]*hidden>\s*<strong>WORKING OFFLINE<\/strong>/, "live page markup: a Working offline banner, hidden by default");

// ---- 7. The helper's behaviour, with a fake network ------------------------
function loadHelper({ fetchImpl, online = true, token = "", tokenFails = false, tokenHangs = false }) {
  const context = {
    window: {},
    navigator: { onLine: online },
    fetch: fetchImpl,
    AbortController,
    setTimeout,
    clearTimeout,
    Promise,
    JSON,
    Error
  };
  context.window.PodiumTeamAuth = {
    getAccessToken: () => (tokenHangs ? new Promise(() => {}) : tokenFails ? Promise.reject(new Error("config failed")) : Promise.resolve(token))
  };
  vm.createContext(context);
  vm.runInContext(helper, context);
  return context.window.PodiumSwRequest;
}
const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
// A request that never answers, but gives up when aborted (like a real stalled fetch).
const stalled = (url, { signal }) => new Promise((resolve, reject) => signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))));

{
  const R = loadHelper({ fetchImpl: stalled });
  const started = Date.now();
  await assert.rejects(R.request("/api/x", { timeoutMs: 60 }), (e) => e.kind === "timeout" && /taking longer than expected/.test(e.message));
  assert.ok(Date.now() - started < 1000, "a stalled request gives up at its timeout");
  assert.equal(R.isConnectionError(new R.SwRequestError("timeout", "x")), true);
}
{
  const R = loadHelper({ fetchImpl: () => Promise.reject(new TypeError("Failed to fetch")), online: false });
  await assert.rejects(R.request("/api/x"), (e) => e.kind === "offline");
}
{
  const R = loadHelper({ fetchImpl: () => Promise.reject(new TypeError("Failed to fetch")) });
  await assert.rejects(R.request("/api/x"), (e) => e.kind === "network");
}
{
  // A reply whose body never finishes is still bounded.
  const R = loadHelper({ fetchImpl: (url, { signal }) => Promise.resolve({ ok: true, status: 200, json: () => new Promise((resolve, reject) => signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })))) }) });
  await assert.rejects(R.request("/api/x", { timeoutMs: 60 }), (e) => e.kind === "timeout");
}
{
  // api(): token sent, JSON body, server error message passed through.
  let sent = null;
  const R = loadHelper({ token: "tok123", fetchImpl: async (url, init) => { sent = { url, init }; return json(409, { error: "This race has already finished." }); } });
  await assert.rejects(R.api("/api/split-watch/sync/", { action: "pull_state" }), (e) => e.kind === "http" && e.status === 409 && e.message === "This race has already finished.");
  assert.equal(sent.init.headers.Authorization, "Bearer tok123");
  assert.equal(JSON.parse(sent.init.body).action, "pull_state");
}
{
  // Sign-in token load stalls: the request still goes out (cookie only) instead of hanging.
  let called = false;
  const R = loadHelper({ tokenHangs: true, fetchImpl: async () => { called = true; return json(200, { ok: true }); } });
  const timing = {};
  const data = await R.withTimeout(R.api("/x", {}, { timing }), R.TOKEN_TIMEOUT_MS + 2000);
  assert.equal(called, true);
  assert.equal(data.ok, true);
  assert.ok(timing.receivedMs >= timing.sentMs, "timing records when the request left and the reply came back");
}
{
  // 401 after a FAILED token load: retryable, no redirect.
  let redirected = false;
  const R = loadHelper({ tokenFails: true, fetchImpl: async () => json(401, { error: "Sign in required." }) });
  await assert.rejects(R.api("/x", {}, { onUnauthorized: () => { redirected = true; } }), (e) => e.kind === "auth_unavailable");
  assert.equal(redirected, false, "a connection problem must not send a coach to the code page");
}
{
  // 401 with a working (empty) token load: the page's usual redirect runs.
  let redirected = false;
  const R = loadHelper({ fetchImpl: async () => json(401, { error: "Enter your code." }) });
  await assert.rejects(R.api("/x", {}, { onUnauthorized: () => { redirected = true; } }), (e) => e.kind === "http" && e.status === 401);
  assert.equal(redirected, true);
}
{
  // useToken: false (code entry, public page) never touches the account library.
  const R = loadHelper({ tokenHangs: true, fetchImpl: async () => json(200, { team: { id: "t" } }) });
  const started = Date.now();
  assert.equal((await R.api("/api/split-watch/join/", { code: "0000" }, { useToken: false })).team.id, "t");
  assert.ok(Date.now() - started < 500);
}

console.log("Split Watch request safety (2026-08-31 incident fix, extended in track build Phase 1, 2026-11-12):");
console.log("one shared helper with a 15 s timeout covering the whole round trip; all nine Split Watch pages use it");
console.log("(no bare fetch), load it first, bound every sign-in check, and end every load failure on Try again;");
console.log("code entry and position confirmation buttons always come back; the token config load is bounded and");
console.log("not cached on failure; the live page reopens offline from the phone's saved copy and warns before");
console.log("leaving with taps unsent. Helper behaviour checked with a fake network: stall, offline, slow body,");
console.log("server error, stalled token, 401 after a failed token (retryable), 401 normal (redirect).");
