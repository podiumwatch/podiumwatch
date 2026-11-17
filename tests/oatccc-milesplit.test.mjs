// The private MileSplit CSV link (api/oatccc/milesplit.js). TEST rows only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import handler, { toCsv, csvCell, tokenMatches, CSV_COLUMNS } from "../api/oatccc/milesplit.js";

const TOKEN = "TEST-token-0123456789abcdef0123456789abcdef";

function call(query) {
  const res = { code: 0, headers: {}, body: "" };
  const response = {
    setHeader(k, v) { res.headers[k.toLowerCase()] = v; },
    status(c) { res.code = c; return this; },
    send(b) { res.body = b; return this; }
  };
  return handler({ method: "GET", query }, response).then(() => res);
}

test("404 while verification is off, even with the right token", async () => {
  delete process.env.OATCCC_LIVE;
  delete process.env.OATCCC_VERIFICATION_LIVE;
  process.env.OATCCC_MILESPLIT_CSV_TOKEN = TOKEN;
  const res = await call({ token: TOKEN });
  assert.equal(res.code, 404);
  assert.equal(res.headers["x-robots-tag"], "noindex, nofollow");
});

test("404 for a wrong, short or missing token when on", async () => {
  process.env.OATCCC_LIVE = "1";
  process.env.OATCCC_VERIFICATION_LIVE = "1";
  for (const token of ["", "x", TOKEN.slice(0, -1), TOKEN + "x", TOKEN.toUpperCase()]) {
    assert.equal((await call({ token })).code, 404, JSON.stringify(token));
  }
  process.env.OATCCC_MILESPLIT_CSV_TOKEN = "too-short";
  assert.equal((await call({ token: "too-short" })).code, 404);
  delete process.env.OATCCC_MILESPLIT_CSV_TOKEN;
  assert.equal((await call({ token: "" })).code, 404);
  delete process.env.OATCCC_LIVE;
  delete process.env.OATCCC_VERIFICATION_LIVE;
});

test("token check needs 32+ characters and an exact match", () => {
  assert.equal(tokenMatches(TOKEN, TOKEN), true);
  assert.equal(tokenMatches("a".repeat(31), "a".repeat(31)), false);
  assert.equal(tokenMatches(undefined, TOKEN), false);
});

test("CSV: header, rows, quoting and no spreadsheet formulas", () => {
  const csv = toCsv([
    { tournament_name: "TEST ALPHA", hytek_code: "TALP", boys_division: "D-1", girls_division: "D-2", has_boys_team: true, has_girls_team: false, verified_at: "2026-12-02T03:30:00Z" },
    { tournament_name: "TEST \"BRAVO\", ACAD.", hytek_code: null, boys_division: null, girls_division: "D-4", has_boys_team: false, has_girls_team: true, verified_at: null }
  ]);
  const lines = csv.split("\r\n");
  assert.equal(lines[0], CSV_COLUMNS.join(","));
  assert.equal(lines[1], "TEST ALPHA,TALP,D-1,D-2,Yes,No,2026-12-01");
  assert.equal(lines[2], '"TEST ""BRAVO"", ACAD.",,,D-4,No,Yes,');
  assert.equal(csvCell("=HYPERLINK(1)"), "'=HYPERLINK(1)");
  assert.equal(csvCell("-1"), "'-1");
});

test("the link's address is rewritten to the API and kept out of search", () => {
  const vercel = JSON.parse(fs.readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.ok(vercel.rewrites.some((r) => r.source === "/oatccc/milesplit/:token/verified-schools.csv" && r.destination === "/api/oatccc/milesplit?token=:token"));
});
