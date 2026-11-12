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
  const started = Date.now();
  await page.locator("[data-swj-submit]").click();
  await page.waitForFunction(() => { const b = document.querySelector("[data-swj-submit]"); return b && !b.disabled; }, null, { timeout: LIMIT_MS + 2000 }).catch(() => {});
  const ms = Date.now() - started;
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
  const started = Date.now();
  await page.locator("[data-swr-join-confirm]").click();
  await page.waitForFunction(() => { const b = document.querySelector("[data-swr-join-confirm]"); return b && !b.disabled; }, null, { timeout: LIMIT_MS + 2000 }).catch(() => {});
  const ms = Date.now() - started;
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
console.log("Split Watch browser checks passed.");
