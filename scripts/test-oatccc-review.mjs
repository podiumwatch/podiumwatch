// OATCCC private review link: the real handler behind a real HTTP server,
// with a FAKE draft (never the real file, which is not in this repo).
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import handler, { deps } from "../api/review/oatccc-indoor.js";
import {
  REVIEW_PATH,
  REVIEW_PAGES,
  COOKIE_NAME,
  makeCookieValue,
  cookieValueIsValid,
  reviewConfig,
  passwordMatches,
  resetWrongAttemptsForTests
} from "../lib/oatccc_review.mjs";

const FAKE_DRAFT = "<!doctype html><title>Fake draft</title><h1>Fake Eligibility page (test fixture)</h1>";
const PASSWORD = "test-password-not-real";
const SECRET = "test-secret-not-real-0123456789abcdef";
let draftLoads = 0;
const FAKE_PAGES = {
  "OATCCC-Verification-DEMO.html": "<!doctype html><title>Fake verify</title><h1>Fake Verification demo (test fixture)</h1>",
  "OATCCC-Partnership-CONCEPT.html": "<!doctype html><title>Fake concept</title><h1>Fake Partnership concept (test fixture)</h1>",
  "OATCCC-Partnership-Section.html": "<!doctype html><title>Fake section</title><h1>Fake OATCCC section (test fixture)</h1>"
};
deps.loadDraft = async (object) => {
  draftLoads += 1;
  if (object === "OATCCC-Indoor-DRAFT-preview.html") return FAKE_DRAFT;
  if (FAKE_PAGES[object]) return FAKE_PAGES[object];
  throw new Error("unexpected object " + object);
};
deps.wrongDelayMs = 0;
deps.env = { OATCCC_REVIEW_PASSWORD: PASSWORD, OATCCC_REVIEW_COOKIE_SECRET: SECRET };

const server = http.createServer((req, res) => {
  res.status = (code) => { res.statusCode = code; return res; };
  res.send = (body) => res.end(body);
  // Stands in for the vercel.json rewrites: sub-page address -> ?page=name.
  const pathname = new URL(req.url, "http://x").pathname;
  const name = Object.keys(REVIEW_PAGES).find((key) => REVIEW_PATH + REVIEW_PAGES[key].subpath === pathname);
  if (!name) { res.statusCode = 404; return res.end(); }
  req.query = name === "draft" ? {} : { page: name };
  handler(req, res).catch((error) => { res.statusCode = 500; res.end(String(error)); });
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const get = (cookie, query = "") => fetch(base + REVIEW_PATH + query, { headers: cookie ? { cookie } : {}, redirect: "manual" });
const post = (password, query = "") => fetch(base + REVIEW_PATH + query, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: password == null ? "" : new URLSearchParams({ password }).toString(),
  redirect: "manual"
});
const checkHeaders = (response, label) => {
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow, noarchive", label);
  assert.equal(response.headers.get("cache-control"), "private, no-store", label);
  assert.equal(response.headers.get("referrer-policy"), "no-referrer", label);
};

// No cookie: sign-in page only.
let response = await get();
let text = await response.text();
assert.equal(response.status, 200);
assert.match(text, /<h1>OATCCC draft review<\/h1>/);
assert.match(text, /type="password"/);
assert.match(text, />View the draft</);
assert.ok(!text.includes("Eligibility"), "no draft text without a cookie");
assert.ok(!/nav|podium watch/i.test(text), "no site navigation on the sign-in page");
checkHeaders(response, "sign-in page");
assert.equal(draftLoads, 0, "the draft is not even loaded without a cookie");

// Wrong password.
response = await post("wrong");
text = await response.text();
assert.equal(response.status, 401);
assert.ok(text.includes("That password did not work. Try again."));
assert.ok(!text.includes("Eligibility"));
assert.equal(response.headers.get("set-cookie"), null);
checkHeaders(response, "wrong password");

// Blank password.
response = await post("");
assert.equal(response.status, 401);
assert.equal(response.headers.get("set-cookie"), null);

// Password in the address is ignored (GET and POST).
response = await get(null, "?password=" + encodeURIComponent(PASSWORD));
assert.ok(!(await response.text()).includes("Eligibility"));
response = await post(null, "?password=" + encodeURIComponent(PASSWORD));
assert.equal(response.status, 401);

// Right password: signed cookie, scoped and flagged, then the draft.
resetWrongAttemptsForTests();
response = await post(PASSWORD);
assert.equal(response.status, 303);
assert.equal(response.headers.get("location"), REVIEW_PATH);
checkHeaders(response, "sign-in success");
const setCookie = response.headers.get("set-cookie");
assert.match(setCookie, new RegExp(`^${COOKIE_NAME}=v1\\.`));
for (const flag of ["HttpOnly", "Secure", "SameSite=Lax", `Path=${REVIEW_PATH}`, `Max-Age=${14 * 24 * 3600}`]) assert.ok(setCookie.includes(flag), flag);
assert.ok(!setCookie.includes(PASSWORD), "the password is not in the cookie");
const cookie = setCookie.split(";")[0];
response = await get(cookie);
text = await response.text();
assert.equal(text, FAKE_DRAFT);
checkHeaders(response, "draft");

// Every sub-page: sign-in only without a cookie (posting back to itself),
// its own file with the cookie, and signing in there returns there.
const SUBPAGES = { verify: "Verification demo", partnership: "Partnership concept", "partnership-oatccc": "OATCCC section" };
for (const [name, marker] of Object.entries(SUBPAGES)) {
  const path = REVIEW_PATH + REVIEW_PAGES[name].subpath;
  const loadsBefore = draftLoads;
  let page = await fetch(base + path, { redirect: "manual" });
  let body = await page.text();
  assert.equal(page.status, 200, name);
  assert.match(body, /type="password"/, name);
  assert.ok(body.includes(`action="${path}"`), name + " sign-in posts back to its own address");
  for (const text of [...Object.values(SUBPAGES), "Eligibility"]) assert.ok(!body.includes(text), name + " leaks " + text);
  checkHeaders(page, name + " sign-in");
  assert.equal(draftLoads, loadsBefore, name + " file not loaded without a cookie");
  page = await fetch(base + path, { headers: { cookie }, redirect: "manual" });
  body = await page.text();
  assert.equal(page.status, 200);
  assert.ok(body.includes(marker), name + " serves its own file");
  checkHeaders(page, name);
  resetWrongAttemptsForTests();
  page = await fetch(base + path, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ password: PASSWORD }).toString(), redirect: "manual" });
  assert.equal(page.status, 303);
  assert.equal(page.headers.get("location"), path, name + " sign-in returns to the same page");
}
assert.equal((await fetch(base + REVIEW_PATH + "nope/", { headers: { cookie } })).status, 404, "unknown sub-address");

// Tampered or expired cookies do not work.
const config = reviewConfig(deps.env);
const value = cookie.split("=")[1];
assert.ok(!(await (await get(cookie.slice(0, -2) + "xx")).text()).includes("Eligibility"), "tampered signature");
const [, expires, sig] = value.split(".");
assert.ok(!(await (await get(`${COOKIE_NAME}=v1.${Number(expires) + 1000}.${sig}`)).text()).includes("Eligibility"), "edited expiry");
assert.equal(cookieValueIsValid(config, makeCookieValue(config, Date.now() - 15 * 24 * 3600 * 1000)), false, "expired after 14 days");

// Changing the password signs everyone out.
deps.env = { OATCCC_REVIEW_PASSWORD: "a-new-test-password", OATCCC_REVIEW_COOKIE_SECRET: SECRET };
assert.ok(!(await (await get(cookie)).text()).includes("Eligibility"), "old cookie after a password change");
deps.env = { OATCCC_REVIEW_PASSWORD: PASSWORD, OATCCC_REVIEW_COOKIE_SECRET: SECRET };
assert.ok((await (await get(cookie)).text()).includes("Eligibility"));

// Fail closed: missing, blank or short settings refuse everything.
for (const env of [
  {},
  { OATCCC_REVIEW_COOKIE_SECRET: SECRET },
  { OATCCC_REVIEW_PASSWORD: "", OATCCC_REVIEW_COOKIE_SECRET: SECRET },
  { OATCCC_REVIEW_PASSWORD: "   ", OATCCC_REVIEW_COOKIE_SECRET: SECRET },
  { OATCCC_REVIEW_PASSWORD: PASSWORD },
  { OATCCC_REVIEW_PASSWORD: PASSWORD, OATCCC_REVIEW_COOKIE_SECRET: "short" }
]) {
  deps.env = env;
  resetWrongAttemptsForTests();
  for (const attempt of ["", " ", PASSWORD]) {
    response = await post(attempt);
    assert.equal(response.status, 401, `refused with ${JSON.stringify(Object.keys(env))}`);
    assert.equal(response.headers.get("set-cookie"), null);
  }
  assert.ok(!(await (await get(cookie)).text()).includes("Eligibility"), "an existing cookie is refused too");
}
assert.equal(passwordMatches(null, ""), false);
deps.env = { OATCCC_REVIEW_PASSWORD: PASSWORD, OATCCC_REVIEW_COOKIE_SECRET: SECRET };

// Repeated wrong attempts: after 10, even the right password is refused for a while.
resetWrongAttemptsForTests();
for (let i = 0; i < 10; i += 1) await post("wrong-" + i);
response = await post(PASSWORD);
assert.equal(response.status, 401, "rate limited");
resetWrongAttemptsForTests();
assert.equal((await post(PASSWORD)).status, 303);

// The route is wired, hidden and kept out of git.
const vercel = JSON.parse(fs.readFileSync("vercel.json", "utf8"));
assert.ok(vercel.rewrites.some((r) => r.source === REVIEW_PATH && r.destination === "/api/review/oatccc-indoor"));
for (const name of Object.keys(SUBPAGES)) {
  assert.ok(vercel.rewrites.some((r) => r.source === REVIEW_PATH + REVIEW_PAGES[name].subpath && r.destination === "/api/review/oatccc-indoor?page=" + name), name + " rewrite");
}
assert.equal(vercel.trailingSlash, true, "addresses without the trailing slash redirect to it");
const reviewHeaders = vercel.headers.find((h) => h.source === "/review/(.*)");
assert.ok(reviewHeaders && reviewHeaders.headers.some((h) => h.key === "Referrer-Policy" && h.value === "no-referrer"));
assert.ok(vercel.headers.indexOf(reviewHeaders) > vercel.headers.findIndex((h) => h.source === "/(.*)"), "the review headers come after the sitewide ones");
const ignored = fs.readFileSync(".gitignore", "utf8").split(String.fromCharCode(10)).map((line) => line.trim());
for (const page of Object.values(REVIEW_PAGES)) assert.ok(ignored.includes(page.object), page.object + " is gitignored");
// No page, menu, footer, sitemap, robots.txt or feed source mentions it.
const sourceFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? sourceFiles(dir + "/" + e.name) : [dir + "/" + e.name]);
for (const file of [...sourceFiles("src"), ...sourceFiles("public"), "scripts/build.mjs"]) {
  if (!/.(mjs|js|html|xml|txt|json)$/.test(file)) continue;
  assert.ok(!/oatccc-indoor|nqn1HonMrnWA8gu1i54AUGqRa0XZFfFg/i.test(fs.readFileSync(file, "utf8")), file + " mentions the review link");
}
assert.equal(REVIEW_PATH.length >= "/review/oatccc-indoor-".length + 24 + 1, true, "token is at least 24 characters");

server.close();
console.log("OATCCC review link tests passed.");
