import test from "node:test";
import assert from "node:assert/strict";
import { SHORT_PATH_PATTERN, cleanDestination, cleanShortPath, deviceClass, referrerHost } from "../lib/short_links_service.mjs";

test("short paths: lowercase letters, numbers and dashes, 1 to 40", () => {
  assert.equal(cleanShortPath(" /State/ "), "state");
  for (const ok of ["state", "d3boys", "banquet-2026", "a"]) assert.ok(SHORT_PATH_PATTERN.test(ok), ok);
  for (const bad of ["", "-state", "state!", "a".repeat(41), "two/parts"]) assert.ok(!SHORT_PATH_PATTERN.test(bad), bad);
});

test("destinations: site paths or https only", () => {
  assert.equal(cleanDestination("/state/2026/"), "/state/2026/");
  assert.equal(cleanDestination("https://www.podiumwatch.org/state/"), "https://www.podiumwatch.org/state/");
  assert.equal(cleanDestination("//evil.example/"), null);
  assert.equal(cleanDestination("http://example.com/"), null);
  assert.equal(cleanDestination("javascript:alert(1)"), null);
});

test("hits store a device class and a referrer host, never the full URL", () => {
  assert.equal(deviceClass("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Instagram 330.0"), "phone");
  assert.equal(deviceClass("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)"), "tablet");
  assert.equal(deviceClass("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130"), "desktop");
  assert.equal(deviceClass("facebookexternalhit/1.1"), "bot");
  assert.equal(deviceClass(""), "unknown");
  assert.equal(referrerHost("https://l.instagram.com/?u=https%3A%2F%2Fpodiumwatch.org%2Fstate&e=abc"), "l.instagram.com");
  assert.equal(referrerHost("not a url"), null);
});
