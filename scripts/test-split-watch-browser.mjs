// Real-browser checks for Split Watch track build Phase 1 (2026-11-12,
// docs/SPLIT_WATCH_TRACK_HANDOFF.md). Needs a built site (npm.cmd run
// build) and Google Chrome; serves dist/ locally and fakes every
// /api/ answer, so nothing reaches production. All data below is
// obviously fake test data and stays in this file.
//
//   node scripts/test-split-watch-browser.mjs
//
// 1. Stalled network: every Split Watch screen reaches a Try again state
//    (or, for buttons, the button comes back) within 16 seconds.
// 2. Server unreachable mid-race: a phone that loaded a live race reloads,
//    reopens it from the copy saved on the phone with the Working offline
//    banner, records taps, warns before leaving with taps unsent, and
//    after reconnecting sends each tap -- a resend after a failed push
//    reuses the same tap ID, so nothing is duplicated.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const root = process.cwd();
const dist = path.join(root, "dist");
if (!fs.existsSync(path.join(dist, "split-watch", "live", "index.html"))) {
  console.error("Build the site first: npm.cmd run build");
  process.exit(1);
}
const { chromium } = createRequire(path.join(root, "package.json"))("playwright-core");
const LIMIT_MS = 16000;

const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".ico": "image/x-icon" };
const server = http.createServer((req, res) => {
  let file = path.join(dist, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: "chrome", headless: true });

// Fake ids (not real teams or races).
const TEAM = "00000000-test-team-0000-000000000000";
const RACE = "00000000-test-race-0000-000000000000";
const MEET = "00000000-test-meet-0000-000000000000";

async function newPage({ stallAll = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.errors = [];
  page.on("pageerror", (error) => page.errors.push(error.message));
  // Anything off this machine (the account library CDN, fonts, analytics)
  // stalls in the stall test, and is answered empty otherwise.
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.host === new URL(base).host) return route.fallback();
    if (stallAll) return; // never answered
    return route.fulfill({ status: 204, body: "" });
  });
  return { context, page };
}

// Button screens: time it inside the page, from the click to the moment
// the button is usable again (Playwright's own click and polling overhead
// is not the app's).
const timeButton = (page, selector) => page.evaluate((sel) => new Promise((resolve) => {
  const button = document.querySelector(sel);
  let clickedAt = null;
  button.addEventListener("click", () => { clickedAt = performance.now(); }, { capture: true, once: true });
  new MutationObserver((list, observer) => {
    if (clickedAt !== null && !button.disabled) { observer.disconnect(); resolve(performance.now() - clickedAt); }
  }).observe(button, { attributes: true, attributeFilter: ["disabled"] });
  setTimeout(() => resolve(null), 20000);
}), selector);

// ---- 1. Stalled network ----------------------------------------------------
const results = [];
const stallScreens = [
  { name: "Hub", url: `/split-watch/?id=${TEAM}` },
  { name: "Helper race list", url: `/split-watch/races/?id=${TEAM}` },
  { name: "Plan", url: `/split-watch/plan/?id=${TEAM}&race=${RACE}` },
  { name: "Live", url: `/split-watch/live/?id=${TEAM}&race=${RACE}` },
  { name: "Review", url: `/split-watch/review/?id=${TEAM}&race=${RACE}` },
  { name: "Public race page", url: `/race/?race=${RACE}` },
  { name: "Meet center", url: `/team-meet-center/?id=${TEAM}&meet=${MEET}` },
  { name: "Guardian page", url: "/guardian-home/" }
];
// One at a time: a phone shows one screen, and Chrome slows timers in
// background tabs (the race poller also pauses while its page is hidden).
for (const screen of stallScreens) {
  const { context, page } = await newPage({ stallAll: true });
  await context.route("**/api/**", () => {}); // every API request stalls
  const started = Date.now();
  await page.goto(base + screen.url, { waitUntil: "commit" });
  await page.locator("[data-sw-retry]").first().waitFor({ state: "visible", timeout: LIMIT_MS + 2000 }).catch(() => {});
  const ms = Date.now() - started;
  const visible = await page.locator("[data-sw-retry]").first().isVisible().catch(() => false);
  results.push({ screen: screen.name, ms, ok: visible && ms <= LIMIT_MS, errors: page.errors.join("; ") });
  await context.close();
}

{
  // Code entry: the Join button must come back with a message.
  const { context, page } = await newPage({ stallAll: true });
  await context.route("**/api/**", () => {});
  await page.goto(`${base}/split-watch/join/`, { waitUntil: "commit" });
  await page.locator("[data-swj-code-input]").fill("1234");
  const timing = timeButton(page, "[data-swj-submit]");
  await page.locator("[data-swj-submit]").click();
  const measured = await timing;
  const ms = measured === null ? Infinity : Math.round(measured);
  const state = await page.evaluate(() => ({ enabled: !document.querySelector("[data-swj-submit]").disabled, label: document.querySelector("[data-swj-submit]").textContent, message: document.querySelector("[data-swj-message]").textContent }));
  results.push({ screen: "Code entry (Join button)", ms, ok: state.enabled && state.label === "Join" && /try again/i.test(state.message) && ms <= LIMIT_MS, errors: page.errors.join("; ") });
  await context.close();
}
{
  // Position confirmation: race list loads (faked), then the confirm stalls.
  const { context, page } = await newPage({ stallAll: true });
  await context.route("**/api/split-watch/join/**", () => {});
  await context.route("**/api/split-watch/sessions/**", (route) => route.fulfill({ json: { team: { school_name: "Test School" }, liveRaces: [], upcomingToday: [], singleRelevantRace: { id: RACE, name: "Test race", status: "scheduled" } } }));
  await context.route("**/api/split-watch/crew/**", (route) => route.fulfill({ json: { positions: [{ id: "test-position", label: "Test position" }] } }));
  await page.goto(`${base}/split-watch/races/?id=${TEAM}`, { waitUntil: "commit" });
  await page.locator("[data-swr-join-name]").waitFor({ state: "visible", timeout: 30000 });
  await page.locator("[data-swr-join-name]").fill("Test Helper");
  const timing = timeButton(page, "[data-swr-join-confirm]");
  await page.locator("[data-swr-join-confirm]").click();
  const measured = await timing;
  const ms = measured === null ? Infinity : Math.round(measured);
  const state = await page.evaluate(() => ({ enabled: !document.querySelector("[data-swr-join-confirm]").disabled, message: document.querySelector("[data-swr-join-message]").textContent }));
  results.push({ screen: "Position confirmation", ms, ok: state.enabled && /try again/i.test(state.message) && ms <= LIMIT_MS, errors: page.errors.join("; ") });
  await context.close();
}

// ---- 2. Server unreachable mid-race -----------------------------------------
const offline = {};
{
  const startedAt = new Date(Date.now() - 90_000).toISOString(); // started 90 s ago
  const fakeRace = {
    team: { id: TEAM, school_name: "Test School" },
    session: { id: RACE, team_id: TEAM, name: "Test race (fake)", status: "live", sport: "cross_country", distance_meters: 5000, distance_unit_display: "km", race_date: "2026-11-12", race_started_at: startedAt, race_start_adjustment_seconds: 0, is_rehearsal: false },
    checkpoints: [{ id: "test-cp-1", label: "Test 1K", distance_meters: 1000, sort_order: 1, is_finish: false }, { id: "test-cp-2", label: "Test finish", distance_meters: 5000, sort_order: 2, is_finish: true }],
    participants: [{ id: "test-p-1", manual_name: "Test Runner A", display_name: "Test Runner A", status: "started", sort_order: 1 }, { id: "test-p-2", manual_name: "Test Runner B", display_name: "Test Runner B", status: "started", sort_order: 2 }],
    goals: [],
    targets: [],
    splits: []
  };
  let mode = "online"; // "online" | "unreachable" | "flaky-once"
  const received = []; // every client_split_id the fake server was sent
  const stored = new Map(); // what the fake server kept (keyed like the real one)
  const { context, page } = await newPage();
  await context.route("**/api/**", async (route) => {
    if (mode === "unreachable") return route.abort("internetdisconnected");
    const url = route.request().url();
    const body = JSON.parse(route.request().postData() || "{}");
    if (url.includes("/api/split-watch/sync/") && body.action === "push_splits") {
      for (const s of body.splits || []) received.push(s.client_split_id);
      if (mode === "flaky-once") { mode = "online"; return route.fulfill({ status: 500, json: { error: "Test failure" } }); }
      const out = (body.splits || []).map((s) => { stored.set(s.client_split_id, s); return { client_split_id: s.client_split_id, split: s, revision_written: true }; });
      return route.fulfill({ json: { results: out, server_now: new Date().toISOString(), viewer: { type: "team_user" } } });
    }
    if (url.includes("/api/split-watch/sync/")) {
      return route.fulfill({ json: { ...fakeRace, splits: [...stored.values()], server_now: new Date().toISOString(), viewer: { type: "team_user", position: null } } });
    }
    if (url.includes("/api/split-watch/sessions/")) return route.fulfill({ json: { sessions: [] } });
    return route.fulfill({ json: {} });
  });

  // Online first load: the race is saved on the phone.
  await page.goto(`${base}/split-watch/live/?id=${TEAM}&race=${RACE}`, { waitUntil: "load" });
  await page.locator("[data-sw-live-screen]").waitFor({ state: "visible", timeout: 20000 });
  await page.waitForTimeout(800);
  offline.bannerHiddenOnline = await page.locator("[data-sw-offline-banner]").isHidden();

  // The server becomes unreachable; the phone reloads.
  mode = "unreachable";
  await page.reload({ waitUntil: "load" });
  await page.locator("[data-sw-live-screen]").waitFor({ state: "visible", timeout: 20000 });
  offline.bannerShownOffline = await page.locator("[data-sw-offline-banner]").isVisible();
  offline.clockNote = await page.locator("[data-sw-clock-note]").textContent().catch(() => "");

  // Tap both runners while offline.
  for (const id of ["test-p-1", "test-p-2"]) {
    await page.locator(`[data-tap="${id}"]`).first().click();
    await page.waitForTimeout(300);
  }
  offline.tapsSavedLocally = await page.evaluate(() => new Promise((resolve) => {
    const open = indexedDB.open("podium_race_command_center");
    open.onsuccess = () => { const tx = open.result.transaction("race_splits_local", "readonly"); const req = tx.objectStore("race_splits_local").getAll(); req.onsuccess = () => resolve(req.result.filter((s) => !s.synced).length); };
    open.onerror = () => resolve(-1);
  }));

  // Leaving with taps unsent shows the browser's leave-page warning.
  let warned = false;
  page.once("dialog", async (dialog) => { warned = dialog.type() === "beforeunload"; await dialog.dismiss(); });
  await page.close({ runBeforeUnload: true });
  await new Promise((resolve) => setTimeout(resolve, 800));
  offline.leaveWarning = warned;

  // Reconnect; the first push fails once (a lost reply), then succeeds.
  mode = "flaky-once";
  const page2 = await context.newPage();
  page2.errors = [];
  page2.on("pageerror", (error) => page2.errors.push(error.message));
  await page2.goto(`${base}/split-watch/live/?id=${TEAM}&race=${RACE}`, { waitUntil: "load" });
  await page2.locator("[data-sw-live-screen]").waitFor({ state: "visible", timeout: 20000 });
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline && stored.size < 2) await page2.waitForTimeout(500);
  await page2.waitForTimeout(1500);
  offline.sentIds = received.length;
  offline.uniqueSent = new Set(received).size;
  offline.storedOnServer = stored.size;
  offline.storedRunners = [...stored.values()].map((s) => s.race_participant_id).sort().join(",");
  offline.bannerAfterReconnect = await page2.locator("[data-sw-offline-banner]").isHidden();
  offline.pendingAfter = await page2.evaluate(() => new Promise((resolve) => {
    const open = indexedDB.open("podium_race_command_center");
    open.onsuccess = () => { const tx = open.result.transaction("race_splits_local", "readonly"); const req = tx.objectStore("race_splits_local").getAll(); req.onsuccess = () => resolve(req.result.filter((s) => !s.synced).length); };
  }));
  offline.errors = [...page.errors, ...page2.errors].join("; ");
  await context.close();
}

// ---- 3. Race clock accuracy (added to Phase 1, 2026-11-12) -------------------
// The fake server's clock runs 15 s AHEAD of this computer's. The coach
// taps Start, takes 2 s to answer the confirm box, and the start request
// then takes 8 s to reach the server. The recorded start must be the tap,
// in server time, within 0.3 s. Then two phones (the starter and a second
// one) tap runners, the starter reloads and taps again: every tap's
// elapsed time must be within 0.3 s of true elapsed time.
const clock = {};
{
  const SERVER_AHEAD_MS = 15_000;
  const serverNow = () => Date.now() + SERVER_AHEAD_MS;
  let session = { id: RACE, team_id: TEAM, name: "Test race (fake)", status: "scheduled", sport: "cross_country", distance_meters: 5000, distance_unit_display: "km", race_date: "2026-11-12", race_started_at: null, race_start_adjustment_seconds: 0, is_rehearsal: false };
  const race = {
    team: { id: TEAM, school_name: "Test School" },
    checkpoints: [{ id: "test-cp-1", label: "Test 1K", distance_meters: 1000, sort_order: 1, is_finish: false }, { id: "test-cp-2", label: "Test finish", distance_meters: 5000, sort_order: 2, is_finish: true }],
    participants: [{ id: "test-p-1", manual_name: "Test Runner A", display_name: "Test Runner A", status: "started", sort_order: 1 }, { id: "test-p-2", manual_name: "Test Runner B", display_name: "Test Runner B", status: "started", sort_order: 2 }],
    goals: [], targets: [], splits: []
  };
  let startRequestBody = null;
  async function wire(context) {
    await context.route("**/api/**", async (route) => {
      const received = serverNow();
      const url = route.request().url();
      const body = JSON.parse(route.request().postData() || "{}");
      const stamp = (extra) => ({ ...extra, server_now: new Date(serverNow()).toISOString(), server_received_ms: received, server_sent_ms: serverNow(), viewer: { type: "team_user", position: null } });
      if (url.includes("/api/split-watch/clock/")) return route.fulfill({ json: { server_received_ms: received, server_sent_ms: serverNow() } });
      if (url.includes("/api/split-watch/sessions/") && body.action === "start_race") {
        startRequestBody = body;
        await new Promise((resolve) => setTimeout(resolve, 8000)); // the delayed start request
        session = { ...session, status: "live", race_started_at: body.race_started_at };
        return route.fulfill({ json: stamp({ session, started_by_this_request: true }) });
      }
      if (url.includes("/api/split-watch/sessions/")) return route.fulfill({ json: stamp({ sessions: [] }) });
      if (url.includes("/api/split-watch/sync/") && body.action === "push_splits") return route.fulfill({ json: stamp({ results: (body.splits || []).map((x) => ({ client_split_id: x.client_split_id, split: x, revision_written: true })) }) });
      if (url.includes("/api/split-watch/sync/")) return route.fulfill({ json: stamp({ ...race, session }) });
      return route.fulfill({ json: {} });
    });
  }
  const localSplit = (page, participantId) => page.evaluate((pid) => new Promise((resolve) => {
    const open = indexedDB.open("podium_race_command_center");
    open.onsuccess = () => { const req = open.result.transaction("race_splits_local", "readonly").objectStore("race_splits_local").getAll(); req.onsuccess = () => resolve(req.result.filter((x) => x.race_participant_id === pid).sort((x, y) => y.wall_clock_captured_at_ms - x.wall_clock_captured_at_ms)[0] || null); };
  }), participantId);

  const one = await newPage();
  await wire(one.context);
  await one.page.goto(base + "/split-watch/live/?id=" + TEAM + "&race=" + RACE, { waitUntil: "load" });
  await one.page.locator("[data-sw-start-button]").waitFor({ state: "visible", timeout: 20000 });
  await one.page.waitForTimeout(2500); // first clock samples
  one.page.once("dialog", (dialog) => setTimeout(() => dialog.accept(), 2000)); // 2 s to answer the confirm box
  const tapLocalMs = Date.now();
  await one.page.locator("[data-sw-start-button]").click();
  await one.page.locator("[data-sw-live-screen]").waitFor({ state: "visible", timeout: 30000 });
  const trueStartMs = tapLocalMs + SERVER_AHEAD_MS;
  clock.startOffBy = (Date.parse(startRequestBody.race_started_at) - trueStartMs) / 1000;
  const trueElapsedAt = (localMs) => (localMs + SERVER_AHEAD_MS - trueStartMs) / 1000;

  // Phone two joins the live race.
  const two = await newPage();
  await wire(two.context);
  await two.page.goto(base + "/split-watch/live/?id=" + TEAM + "&race=" + RACE, { waitUntil: "load" });
  await two.page.locator("[data-sw-live-screen]").waitFor({ state: "visible", timeout: 20000 });
  await two.page.waitForTimeout(2500);

  // Both tap a runner; compare with true elapsed at each tap.
  const tapOne = Date.now(); await one.page.locator('[data-tap="test-p-1"]').first().click();
  const tapTwo = Date.now(); await two.page.locator('[data-tap="test-p-2"]').first().click();
  await one.page.waitForTimeout(500);
  const s1 = await localSplit(one.page, "test-p-1");
  const s2 = await localSplit(two.page, "test-p-2");
  clock.starterOffBy = s1.elapsed_seconds - trueElapsedAt(tapOne);
  clock.secondPhoneOffBy = s2.elapsed_seconds - trueElapsedAt(tapTwo);
  clock.starterTapStoresCorrection = s1.clock_offset_ms;
  clock.statusLine = await one.page.locator("[data-sw-clock-note]").textContent();

  // The starter reloads, then taps the other runner.
  await one.page.reload({ waitUntil: "load" });
  await one.page.locator("[data-sw-live-screen]").waitFor({ state: "visible", timeout: 20000 });
  await one.page.waitForTimeout(2500);
  const tapReload = Date.now(); await one.page.locator('[data-tap="test-p-2"]').first().click();
  await one.page.waitForTimeout(500);
  const s3 = await localSplit(one.page, "test-p-2");
  clock.afterReloadOffBy = s3.elapsed_seconds - trueElapsedAt(tapReload);
  clock.errors = [...one.page.errors, ...two.page.errors].join("; ");
  await one.context.close();
  await two.context.close();
}

// ---- 4. Lap mode on the live page (track build Phase 2) ------------------------
// A fake 1600 already running: one big button per entry; a tap records
// that entry's lap 1; an immediate second tap is ignored (same lap); Undo
// clears it again.
const lap = {};
{
  const startedAt = new Date(Date.now() - 75_000).toISOString();
  const lapRace = {
    team: { id: TEAM, school_name: "Test School" },
    session: { id: RACE, team_id: TEAM, name: "Test 1600 (fake)", status: "live", sport: "track", tap_mode: "lap", event_key: "1600", lap_length_meters: 400, distance_meters: 1600, distance_unit_display: "meters", race_date: "2026-11-12", race_started_at: startedAt, race_start_adjustment_seconds: 0, is_rehearsal: false },
    checkpoints: [1, 2, 3, 4].map((n) => ({ id: "test-lap-" + n, label: n === 4 ? "Finish (1600)" : "Lap " + n + " (" + n * 400 + ")", distance_meters: n * 400, sort_order: n, is_finish: n === 4, location: "finish_line", is_exchange: false })),
    participants: [{ id: "test-p-1", manual_name: "Test Runner A", display_name: "Test Runner A", status: "started", sort_order: 1, disqualified: false }, { id: "test-p-2", manual_name: "Test Runner B", display_name: "Test Runner B", status: "started", sort_order: 2, disqualified: false }],
    goals: [], targets: [], splits: []
  };
  const pushed = [];
  const { context, page } = await newPage();
  await context.route("**/api/**", async (route) => {
    const url = route.request().url();
    const body = JSON.parse(route.request().postData() || "{}");
    const now = Date.now();
    const stamp = (extra) => ({ ...extra, server_received_ms: now, server_sent_ms: Date.now(), viewer: { type: "team_user", position: null } });
    if (url.includes("/api/split-watch/clock/")) return route.fulfill({ json: { server_received_ms: now, server_sent_ms: Date.now() } });
    if (url.includes("/api/split-watch/sync/") && body.action === "push_splits") {
      pushed.push(...(body.splits || []));
      return route.fulfill({ json: stamp({ results: (body.splits || []).map((x) => ({ client_split_id: x.client_split_id, split: { ...x, wall_clock_captured_at: x.wall_clock_captured_at }, revision_written: true })) }) });
    }
    if (url.includes("/api/split-watch/sync/")) return route.fulfill({ json: stamp(lapRace) });
    return route.fulfill({ json: stamp({ sessions: [] }) });
  });
  await page.goto(base + "/split-watch/live/?id=" + TEAM + "&race=" + RACE, { waitUntil: "load" });
  await page.locator('[data-lap-tap="test-p-1"]').waitFor({ state: "visible", timeout: 20000 });
  lap.buttons = await page.locator("[data-lap-tap]").count();
  lap.tabsHidden = await page.locator("[data-sw-checkpoint-indicator]").isHidden();
  await page.locator('[data-lap-tap="test-p-1"]').click();
  await page.waitForTimeout(300);
  lap.afterTap = (await page.locator('[data-lap-tap="test-p-1"]').innerText()).replace(/\s+/g, " ");
  await page.locator('[data-lap-tap="test-p-1"]').click(); // a nervous second tap
  await page.waitForTimeout(300);
  lap.message = await page.locator("[data-sw-message]").textContent();
  lap.afterDouble = (await page.locator('[data-lap-tap="test-p-1"]').innerText()).replace(/\s+/g, " ");
  await page.locator('[data-lap-undo="test-p-1"]').click();
  await page.waitForTimeout(300);
  lap.afterUndo = (await page.locator('[data-lap-tap="test-p-1"]').innerText()).replace(/\s+/g, " ");
  await page.waitForTimeout(9000); // let the 8 s sync push
  lap.pushedLapTaps = pushed.filter((x) => x.lap_tap === true).length;
  lap.pushedCheckpoint = (pushed.find((x) => x.lap_tap === true) || {}).race_checkpoint_id;
  lap.errors = page.errors.join("; ");
  await context.close();
}

await browser.close();
server.close();

console.log("Stalled network (limit 16 s):");
for (const r of results.sort((a, b) => a.screen.localeCompare(b.screen))) console.log(`  ${r.ok ? "ok  " : "FAIL"} ${r.screen}: ${(r.ms / 1000).toFixed(1)} s${r.errors ? ` | page errors: ${r.errors}` : ""}`);
console.log("Server unreachable mid-race:", JSON.stringify(offline));

for (const r of results) assert.ok(r.ok, `${r.screen} must reach a Try again state within 16 s (took ${(r.ms / 1000).toFixed(1)} s)`);
assert.equal(offline.bannerHiddenOnline, true, "no offline banner while the server answers");
assert.equal(offline.bannerShownOffline, true, "reload with the server unreachable reopens the race with the Working offline banner");
assert.equal(offline.tapsSavedLocally, 2, "both offline taps are saved on the phone");
assert.equal(offline.leaveWarning, true, "leaving with taps unsent shows the leave-page warning");
assert.equal(offline.storedOnServer, 2, "both taps reach the server after reconnecting");
assert.equal(offline.storedRunners, "test-p-1,test-p-2");
assert.ok(offline.sentIds > offline.uniqueSent, "the failed push was resent (so the no-duplicate check is real)");
assert.equal(offline.uniqueSent, 2, "a resend reuses the same tap IDs, so the server keeps exactly one row per tap");
assert.equal(offline.pendingAfter, 0, "nothing left waiting after the sync");
assert.equal(offline.bannerAfterReconnect, true, "the banner clears once the server answers");
console.log("Race clock (server 15 s ahead, 2 s confirm, 8 s start request):", JSON.stringify(clock));
assert.ok(Math.abs(clock.startOffBy) <= 0.3, "the recorded start matches the tap within 0.3 s (off by " + clock.startOffBy + ")");
assert.ok(Math.abs(clock.starterOffBy) <= 0.3, "starting phone's tap within 0.3 s of true elapsed (off by " + clock.starterOffBy + ")");
assert.ok(Math.abs(clock.secondPhoneOffBy) <= 0.3, "second phone's tap within 0.3 s (off by " + clock.secondPhoneOffBy + ")");
assert.ok(Math.abs(clock.afterReloadOffBy) <= 0.3, "after a reload, within 0.3 s (off by " + clock.afterReloadOffBy + ")");
assert.ok(Math.abs(clock.starterTapStoresCorrection - 15000) < 300, "each tap stores the correction it used");
assert.match(clock.statusLine, /^Clock synced/, "the clock status line shows the clock is synced");
assert.equal(clock.errors, "", "no page errors");
console.log("Lap mode:", JSON.stringify(lap));
assert.equal(lap.buttons, 2, "one big button per entry");
assert.equal(lap.tabsHidden, true, "no checkpoint tabs in lap mode");
assert.match(lap.afterTap, /Lap 1 of 4/, "a tap records that entry's lap 1");
assert.match(lap.message, /ignored/i, "an immediate second tap is ignored");
assert.match(lap.afterDouble, /Lap 1 of 4/, "still lap 1 after the double tap");
assert.match(lap.afterUndo, /Lap 0 of 4/, "Undo clears the lap");
assert.equal(lap.pushedLapTaps, 1, "one lap tap sent to the server, flagged for placement by time");
assert.equal(lap.pushedCheckpoint, "test-lap-1");
assert.equal(lap.errors, "", "no page errors in lap mode");
console.log("Split Watch browser checks passed.");
