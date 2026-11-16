// OATCCC team verification (Part B groundwork): server-side rules, email
// templates, API switch and pages. The database rules themselves are
// tested against install/99_OATCCC_VERIFICATION.sql by
// scripts/test-oatccc-verification-sql.mjs (needs PGlite, see that file).
import test from "node:test";
import assert from "node:assert/strict";
import { cleanAnswers, cleanComment, friendlyDbError, seasonForSchool, FORM_FIELDS, isUuid } from "../lib/oatccc_verification.mjs";
import { submittedEmail, returnedEmail, approvedEmail } from "../lib/oatccc_email_templates.mjs";
import { oatcccFlags } from "../src/oatccc/config.mjs";
import { oatcccOutputs } from "../src/oatccc/build.mjs";
import { site } from "../src/config/site.mjs";

const full = Object.fromEntries(FORM_FIELDS.map((f) => [f.key, f.type === "checkbox" ? true : "Sample"]));

test("answers: every required field, trimmed, unknown keys dropped", () => {
  const answers = cleanAnswers({ ...full, ad_name: "  Pat  ", extra: "drop me" });
  assert.equal(answers.ad_name, "Pat");
  assert.equal("extra" in answers, false);
  assert.deepEqual(Object.keys(answers).sort(), FORM_FIELDS.map((f) => f.key).sort());
});

test("answers: missing or unchecked required fields are refused", () => {
  assert.throws(() => cleanAnswers({ ...full, ad_name: " " }), /Please complete/);
  assert.throws(() => cleanAnswers({ ...full, agree_terms: false }), /Please complete/);
  assert.throws(() => cleanAnswers(null), /Fill in the form/);
  assert.throws(() => cleanAnswers({ ...full, ad_name: "x".repeat(500) }), /too long/);
});

test("comments: required to return, optional to approve, capped", () => {
  assert.throws(() => cleanComment("   "), /Write a comment/);
  assert.equal(cleanComment("", { required: false }), "");
  assert.throws(() => cleanComment("x".repeat(5001)), /5,000/);
});

test("database rule messages reach the person; permission errors are 403", () => {
  const e = friendlyDbError({ code: "42501", message: "OATCCC verification: only this school's athletic director can submit" });
  assert.equal(e.status, 403);
  assert.equal(e.message, "Only this school's athletic director can submit.");
  const late = friendlyDbError({ code: "P0001", message: "OATCCC verification: the late window has closed; no forms are accepted" });
  assert.equal(late.status, 400);
  const other = friendlyDbError({ code: "XX000", message: "connection reset" });
  assert.equal(other.status, 500);
  assert.doesNotMatch(other.message, /connection/);
});

test("TEST schools only ever get TEST seasons", () => {
  const seasons = [
    { id: "r27", meet_year: 2027, is_test: false },
    { id: "t27", meet_year: 2027, is_test: true },
    { id: "t26", meet_year: 2026, is_test: true }
  ];
  assert.equal(seasonForSchool({ is_test: true }, seasons).id, "t27");
  assert.equal(seasonForSchool({ is_test: false }, seasons).id, "r27");
  assert.equal(seasonForSchool({ is_test: false }, seasons.filter((s) => s.is_test)), null);
});

test("ids are checked before reaching the database", () => {
  assert.equal(isUuid("7e570000-0000-4000-8000-00000000000a"), true);
  assert.equal(isUuid("1 or 1=1"), false);
});

test("email templates: three kinds, no em dashes, signed Podium Watch", () => {
  const base = { schoolName: "TEST Alpha High School", seasonName: "TEST 2027 Indoor State Meet", link: "https://www.podiumwatch.org/oatccc/verify/" };
  const emails = [
    submittedEmail(base),
    submittedEmail({ ...base, isLate: true, resubmitted: true }),
    returnedEmail({ ...base, comment: "Please add your second coach." }),
    approvedEmail(base)
  ];
  for (const email of emails) {
    assert.ok(email.subject && email.text);
    assert.doesNotMatch(email.subject + email.text, /—/, "no em dash");
    assert.match(email.text, /Podium Watch, powered by the OATCCC/);
  }
  assert.match(emails[1].text, /marked late/);
  assert.match(emails[1].subject, /resubmitted/);
  assert.match(emails[2].text, /Please add your second coach\./);
  assert.throws(() => returnedEmail({ ...base, comment: "" }), /comment is required/);
});

test("API answers 404 while verification is switched off", async () => {
  delete process.env.OATCCC_LIVE;
  delete process.env.OATCCC_VERIFICATION_LIVE;
  const { default: handler } = await import("../api/oatccc/verification.js");
  let status = 0;
  let body = null;
  const response = { setHeader() {}, status(code) { status = code; return this; }, json(value) { body = value; return this; } };
  await handler({ method: "GET", query: { view: "me" }, headers: { authorization: "Bearer x" } }, response);
  assert.equal(status, 404);
  assert.deepEqual(body, { error: "Not found." });
});

test("verification pages: only with both switches, always noindex, no sign-in button before", () => {
  const paths = (env) => oatcccOutputs(site, oatcccFlags(env)).pages.map((page) => page.pathname);
  assert.equal(paths({ OATCCC_VERIFICATION_LIVE: "1" }).length, 0);
  assert.ok(!paths({ OATCCC_LIVE: "1" }).includes("/oatccc/verify/"));
  const pages = oatcccOutputs(site, oatcccFlags({ OATCCC_LIVE: "1", OATCCC_VERIFICATION_LIVE: "1", VERCEL_ENV: "production" })).pages;
  for (const path of ["/oatccc/admin/", "/oatccc/verify/"]) {
    const page = pages.find((p) => p.pathname === path);
    assert.ok(page, path);
    assert.match(page.html, /<meta name="robots" content="noindex, nofollow">/, path);
  }
});
