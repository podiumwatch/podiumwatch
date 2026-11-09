import test from "node:test";
import assert from "node:assert/strict";
import { buildHealthEmail, evaluateHealth } from "../lib/health_check_service.mjs";

const now = new Date("2026-11-10T13:00:00Z");
const healthy = {
  finishTiming: { active: true, last_scan_status: "ok" },
  failedNotifications: 0,
  failedImports: 0,
  stuckJobs: 0,
  buildGeneratedAt: "2026-11-10T09:00:00Z",
  sitemapUrls: 180
};

test("all green when nothing is wrong", () => {
  const result = evaluateHealth(healthy, { now });
  assert.equal(result.ok, true);
  assert.equal(result.checks.length, 6);
});

test("each problem turns its check red", () => {
  const result = evaluateHealth({
    ...healthy,
    finishTiming: { active: false, paused_by: "Finish Timing automation", pause_reason: "HTTP 401", last_scan_status: "failed" },
    failedNotifications: 7,
    failedImports: 4,
    stuckJobs: 2,
    buildGeneratedAt: "2026-11-01T00:00:00Z",
    sitemapUrls: 12
  }, { now });
  assert.equal(result.ok, false);
  assert.deepEqual(result.checks.filter((check) => !check.ok).map((check) => check.key), ["finish_timing", "failed_notifications", "failed_imports", "stuck_jobs", "build_age", "sitemap"]);
  assert.match(result.checks[0].detail, /HTTP 401/);
});

test("unreadable build date or sitemap counts as a problem, not a pass", () => {
  const result = evaluateHealth({ ...healthy, buildGeneratedAt: null, sitemapUrls: NaN }, { now });
  assert.equal(result.ok, false);
});

test("a forced test failure produces one email naming it", () => {
  const result = evaluateHealth({ ...healthy, forceFailure: true }, { now });
  assert.equal(result.ok, false);
  const email = buildHealthEmail(result, { siteUrl: "https://www.podiumwatch.org", now });
  assert.match(email.subject, /1 problem/);
  assert.match(email.text, /PROBLEM - Test alert/);
  assert.ok(!/—/.test(email.text + email.html), "no em dashes");
});

test("an admin pausing Finish Timing on purpose is not a problem", () => {
  const result = evaluateHealth({ ...healthy, finishTiming: { active: false, paused_by: "Podium Watch Admin", last_scan_status: "failed" } }, { now });
  assert.equal(result.checks[0].ok, true);
});
