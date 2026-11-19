// OATCCC team verification (Part B groundwork): server-side rules, email
// templates, API switch and pages. The database rules themselves are
// tested against install/99_OATCCC_VERIFICATION.sql by
// scripts/test-oatccc-verification-sql.mjs (needs PGlite, see that file).
import test from "node:test";
import assert from "node:assert/strict";
import { cleanAnswers, cleanComment, cleanPhone, cleanEmail, cleanSignature, SIGNATURE_MAX, FORM_TEXT_SHA256, friendlyDbError, seasonForSchool, isUuid, ADMIN_ROLES, canWorkIndoor } from "../lib/oatccc_verification.mjs";
import { submittedEmail, returnedEmail, approvedEmail } from "../lib/oatccc_email_templates.mjs";
import { oatcccFlags } from "../src/oatccc/config.mjs";
import { oatcccOutputs } from "../src/oatccc/build.mjs";
import { site } from "../src/config/site.mjs";

const person = (who) => ({ first_name: "TEST", last_name: who, cell_phone: "614-555-0100", email: `${who.toLowerCase()}@example.com` });
const full = { has_boys: true, has_girls: true, boys_coach: person("Boys"), girls_coach: person("Girls"), ad: person("AD") };

test("answers: both teams, phones and emails normalized, unknown keys dropped", () => {
  const answers = cleanAnswers({ ...full, extra: "drop me", ad: { ...person("AD"), first_name: "  Pat  ", email: " PAT@Example.COM " } });
  assert.equal("extra" in answers, false);
  assert.equal(answers.ad.first_name, "Pat");
  assert.equal(answers.ad.email, "pat@example.com");
  assert.equal(answers.boys_coach.cell_phone, "(614) 555-0100");
  assert.deepEqual(Object.keys(answers).sort(), ["ad", "boys_coach", "girls_coach", "has_boys", "has_girls"]);
});

test("answers: a coach is required only for a team the school has", () => {
  const girlsOnly = cleanAnswers({ ...full, has_boys: false, boys_coach: { first_name: "" } });
  assert.equal(girlsOnly.boys_coach, null);
  assert.ok(girlsOnly.girls_coach);
  assert.throws(() => cleanAnswers({ ...full, has_boys: false, has_girls: false }), /at least one team/);
  assert.throws(() => cleanAnswers({ ...full, girls_coach: { ...person("Girls"), last_name: " " } }), /Please complete: Girls' head coach: last name/);
});

test("answers: the athletic director is always required", () => {
  assert.throws(() => cleanAnswers({ ...full, ad: null }), /Please complete: Athletic director: first name/);
  assert.throws(() => cleanAnswers(null), /Fill in the form/);
});

test("phones and emails are checked", () => {
  assert.equal(cleanPhone("(614) 555-0100"), "(614) 555-0100");
  assert.equal(cleanPhone("+1 614.555.0100"), "(614) 555-0100");
  for (const bad of ["555-0100", "614555010", "114-555-0100", "614-155-0100", "61455501001"]) assert.equal(cleanPhone(bad), null, bad);
  assert.equal(cleanEmail("Coach@School.k12.oh.us"), "coach@school.k12.oh.us");
  for (const bad of ["coach", "coach@", "@school.org", "coach@school", "co ach@school.org", "coach@school..org"]) assert.equal(cleanEmail(bad), null, bad);
  assert.throws(() => cleanAnswers({ ...full, ad: { ...person("AD"), cell_phone: "555-0100" } }), /10-digit/);
  assert.throws(() => cleanAnswers({ ...full, boys_coach: { ...person("Boys"), email: "nope" } }), /valid email/);
});

test("signature: typed name and a real PNG from the pad", () => {
  const png = "data:image/png;base64," + Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), Buffer.alloc(80)]).toString("base64");
  assert.deepEqual(cleanSignature({ typed_name: "  TEST   AD ", png }), { typedName: "TEST AD", png });
  assert.throws(() => cleanSignature({ typed_name: "T", png }), /Type your name/);
  assert.throws(() => cleanSignature({ typed_name: "TEST AD", png: "" }), /signature box/);
  assert.throws(() => cleanSignature({ typed_name: "TEST AD", png: "data:image/png;base64," + Buffer.from("not a png at all, just text that is long enough to pass").toString("base64") }), /signature box/);
  assert.throws(() => cleanSignature({ typed_name: "TEST AD", png: "data:image/png;base64," + "A".repeat(SIGNATURE_MAX) }), /signature box/);
});

test("the signed form text has a fixed fingerprint per version", () => {
  assert.match(FORM_TEXT_SHA256, /^[0-9a-f]{64}$/);
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

test("only president, indoor chair and site admin get the verification queue", () => {
  assert.deepEqual(ADMIN_ROLES.filter(canWorkIndoor), ["president", "indoor_chair", "site_admin"]);
  assert.equal(canWorkIndoor(null), false);
  assert.equal(canWorkIndoor("admin"), false);
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

test("AD page carries the agreement word for word and an email-link sign-in", () => {
  const pages = oatcccOutputs(site, oatcccFlags({ OATCCC_LIVE: "1", OATCCC_VERIFICATION_LIVE: "1" })).pages;
  const ad = pages.find((p) => p.pathname === "/oatccc/verify/").html;
  const admin = pages.find((p) => p.pathname === "/oatccc/admin/").html;
  assert.match(ad, /hereby releases, waives and covenants not to sue/);
  assert.match(ad, /2027 Indoor State Track &amp; Field Meet Verification Form/);
  assert.match(ad, /data-ox-signin-form="link"/);
  assert.match(admin, /data-ox-signin-form="password"/);
});
