// OATCCC review link, site preview folder (/site-preview/...): the real
// handler behind a real HTTP server, with FAKE files (never the real copy,
// which lives only in the private bucket).
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import handler, { deps } from "../api/review/oatccc-indoor.js";
import {
  REVIEW_PATH,
  SITE_PATH,
  SITE_TYPES,
  sitePreviewFile,
  resetWrongAttemptsForTests
} from "../lib/oatccc_review.mjs";

const PASSWORD = "test-password-not-real";
const SECRET = "test-secret-not-real-0123456789abcdef";

// Path mapping: folders get index.html, files keep their name, everything
// else is refused before any lookup.
assert.deepEqual(sitePreviewFile(""), { object: "site-preview/index.html", type: SITE_TYPES.html });
assert.deepEqual(sitePreviewFile("about/"), { object: "site-preview/about/index.html", type: SITE_TYPES.html });
assert.deepEqual(sitePreviewFile("pages/people/test-person/"), { object: "site-preview/pages/people/test-person/index.html", type: SITE_TYPES.html });
assert.deepEqual(sitePreviewFile("pages/people"), { object: "site-preview/pages/people/index.html", type: SITE_TYPES.html }, "no extension: a folder");
assert.deepEqual(sitePreviewFile(["pages", "one"]), { object: "site-preview/pages/one/index.html", type: SITE_TYPES.html }, "array from the rewrite");
assert.deepEqual(sitePreviewFile("styles/main.css"), { object: "site-preview/styles/main.css", type: "text/css; charset=utf-8" });
assert.deepEqual(sitePreviewFile("images/a.PNG"), { object: "site-preview/images/a.PNG", type: "image/png" });
for (const [file, type] of [["a.js", "text/javascript; charset=utf-8"], ["a.json", "application/json; charset=utf-8"], ["a.jpg", "image/jpeg"], ["a.webp", "image/webp"], ["a.svg", "image/svg+xml"], ["a.woff2", "font/woff2"], ["a.pdf", "application/pdf"]]) {
  assert.equal(sitePreviewFile("x/" + file).type, type, file);
}
for (const bad of [
  "..", "../", "../index.html", "a/../b/", "a/..", "./a.css", "a/./b.css", "..%2Findex.html", "%2e%2e/", "a\\b.css",
  "/etc/passwd", "a//b.css", ".env", "a/.git/config", ".hidden/", "a..b/c.css", "a/b.exe", "a/b.html.php", "a/b.sh",
  "a/b c.css", "a/\u0000.css", "a/b.css?x", "a/b.css#x", "x".repeat(600), null, undefined, 42, {}
]) {
  assert.equal(sitePreviewFile(bad), null, "refused: " + JSON.stringify(bad));
}
for (const ok of ["", "a/", "a/b.css"]) assert.ok(sitePreviewFile(ok).object.startsWith("site-preview/"), "stays inside site-preview/");

// Fake bucket: only these objects exist.
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff, 0xfe, 0x80, 0x01]);
const FILES = {
  "site-preview/index.html": Buffer.from("<!doctype html><title>Fake site home</title><h1>Fake site preview home (test fixture)</h1>"),
  "site-preview/pages/one/index.html": Buffer.from("<!doctype html><title>Fake sub</title><h1>Fake sub page (test fixture)</h1>"),
  "site-preview/styles/main.css": Buffer.from("body{color:#123}"),
  "site-preview/images/logo.png": PNG
};
const looked = [];
deps.loadSiteFile = async (object) => {
  looked.push(object);
  assert.ok(object.startsWith("site-preview/"), "only site-preview/ is ever read: " + object);
  return Object.hasOwn(FILES, object) ? FILES[object] : null;
};
deps.loadDraft = async () => { throw new Error("the site preview never loads the draft pages"); };
deps.wrongDelayMs = 0;
deps.env = { OATCCC_REVIEW_PASSWORD: PASSWORD, OATCCC_REVIEW_COOKIE_SECRET: SECRET };

// Stands in for the two vercel.json rewrites (page=site, path=the rest).
// Like Vercel, request.url keeps the original address.
const server = http.createServer((req, res) => {
  res.status = (code) => { res.statusCode = code; return res; };
  res.send = (body) => res.end(body);
  const pathname = new URL(req.url, "http://x").pathname;
  if (!pathname.startsWith(SITE_PATH)) { res.statusCode = 404; return res.end(); }
  req.query = { page: "site", path: pathname.slice(SITE_PATH.length).replace(/\/$/, "") };
  handler(req, res).catch((error) => { res.statusCode = 500; res.end(String(error)); });
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const get = (rest, cookie) => fetch(base + SITE_PATH + rest, { headers: cookie ? { cookie } : {}, redirect: "manual" });
const checkHeaders = (response, label) => {
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow, noarchive", label);
  assert.equal(response.headers.get("cache-control"), "private, no-store", label);
  assert.equal(response.headers.get("referrer-policy"), "no-referrer", label);
};

// Without the cookie (a private window): the password page, nothing loaded.
let response = await get("");
let text = await response.text();
assert.equal(response.status, 200);
assert.match(text, /type="password"/);
assert.ok(text.includes(`action="${SITE_PATH}"`), "posts back to the folder");
assert.ok(!text.includes("Fake site"), "no copy text without the cookie");
checkHeaders(response, "site sign-in");
response = await get("pages/one/");
text = await response.text();
assert.match(text, /type="password"/);
assert.ok(text.includes(`action="${SITE_PATH}pages/one/"`));
for (const asset of ["styles/main.css", "images/logo.png"]) {
  response = await get(asset);
  assert.equal(response.status, 401, asset + " without the cookie");
  assert.ok(!(await response.text()).includes("color"), asset);
  checkHeaders(response, asset + " refused");
}
assert.equal(looked.length, 0, "no file is even downloaded without the cookie");

// Wrong password on a sub-page.
response = await fetch(base + SITE_PATH + "pages/one/", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "password=wrong", redirect: "manual" });
assert.equal(response.status, 401);
assert.equal(response.headers.get("set-cookie"), null);
assert.ok((await response.text()).includes("That password did not work."));

// Right password on a sub-page: back to that page, cookie covers the folder.
resetWrongAttemptsForTests();
response = await fetch(base + SITE_PATH + "pages/one/", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ password: PASSWORD }).toString(), redirect: "manual" });
assert.equal(response.status, 303);
assert.equal(response.headers.get("location"), SITE_PATH + "pages/one/");
const setCookie = response.headers.get("set-cookie");
assert.ok(setCookie.includes(`Path=${REVIEW_PATH}`), "same cookie path as the other review pages");
assert.ok(SITE_PATH.startsWith(REVIEW_PATH), "so the browser sends it to the site preview too");
const cookie = setCookie.split(";")[0];

// With the cookie: each file, its own type, exact bytes, same headers.
for (const [rest, object, type] of [
  ["", "site-preview/index.html", "text/html; charset=utf-8"],
  ["pages/one/", "site-preview/pages/one/index.html", "text/html; charset=utf-8"],
  ["styles/main.css", "site-preview/styles/main.css", "text/css; charset=utf-8"],
  ["images/logo.png", "site-preview/images/logo.png", "image/png"]
]) {
  response = await get(rest, cookie);
  assert.equal(response.status, 200, rest);
  assert.equal(response.headers.get("content-type"), type, rest);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff", rest);
  checkHeaders(response, rest);
  assert.ok(Buffer.from(await response.arrayBuffer()).equals(FILES[object]), rest + " byte for byte");
}

// Missing file: 404. Refused paths: 404 without any lookup.
response = await get("nope/", cookie);
assert.equal(response.status, 404);
checkHeaders(response, "missing");
const lookedBefore = looked.length;
// ("%2e%2e/" is resolved by the URL parser before sending; covered by direct() below.)
for (const bad of ["a/b.exe", ".env", "a/.git/config", "a%2F..%2F..%2Fx.css", "a/%2e%2e%2fx.css"]) {
  response = await get(bad, cookie);
  assert.equal(response.status, 404, "refused " + bad);
  checkHeaders(response, "refused " + bad);
}
// A raw ".." in the query path (someone calling the API address directly).
const direct = (path) => {
  const req = { method: "GET", url: "/api/review/oatccc-indoor?page=site&path=" + encodeURIComponent(path), headers: { cookie }, query: { page: "site", path } };
  const res = { headers: {}, statusCode: 0, body: null, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.statusCode = code; return this; }, send(b) { this.body = b; return this; } };
  return handler(req, res).then(() => res);
};
for (const bad of ["%2e%2e/index.html", "../OATCCC-Indoor-DRAFT-preview.html", "../../etc/passwd", "a/../../x.css", ["..", "x.css"]]) {
  const res = await direct(bad);
  assert.equal(res.statusCode, 404, "direct " + JSON.stringify(bad));
}
assert.equal((await direct("pages/one")).statusCode, 200, "query path without the trailing slash still finds the folder page");
assert.equal(looked.length, lookedBefore + 1, "refused paths are never looked up");

// Methods.
response = await fetch(base + SITE_PATH + "styles/main.css", { method: "POST", headers: { cookie }, body: "password=x" });
assert.equal(response.status, 405);
response = await fetch(base + SITE_PATH, { method: "PUT", headers: { cookie } });
assert.equal(response.status, 405);

// Storage error: 503, not the file and not a crash.
deps.loadSiteFile = async () => { throw new Error("storage down"); };
const quiet = console.error; console.error = () => {};
response = await get("", cookie);
console.error = quiet;
assert.equal(response.status, 503);

// Fail closed: no settings, no files.
deps.env = {};
deps.loadSiteFile = async () => { throw new Error("must not load"); };
response = await get("styles/main.css", cookie);
assert.equal(response.status, 401);
response = await get("", cookie);
assert.match(await response.text(), /type="password"/);
deps.env = { OATCCC_REVIEW_PASSWORD: PASSWORD, OATCCC_REVIEW_COOKIE_SECRET: SECRET };

// vercel.json: both rewrites, ahead of everything else under /review.
const vercel = JSON.parse(fs.readFileSync("vercel.json", "utf8"));
const root = vercel.rewrites.findIndex((r) => r.source === SITE_PATH && r.destination === "/api/review/oatccc-indoor?page=site&path=");
const rest = vercel.rewrites.findIndex((r) => r.source === SITE_PATH + ":path*" && r.destination === "/api/review/oatccc-indoor?page=site&path=:path*");
assert.ok(root >= 0 && rest >= 0, "site preview rewrites");
assert.ok(vercel.headers.some((h) => h.source === "/review/(.*)"), "review headers block still covers it");

server.close();
console.log("OATCCC review site preview tests passed.");
