import test from "node:test";
import assert from "node:assert/strict";
import { selectAll } from "../lib/supabase_paging.mjs";

// A fake PostgREST query builder over an in-memory table that, like the
// real one, never returns more than 1,000 rows per request.
function fakeTable(rowCount, { failOnPage = null } = {}) {
  const table = Array.from({ length: rowCount }, (_, index) => ({ id: index + 1 }));
  const calls = [];
  const build = () => {
    const state = { orders: [] };
    const builder = {
      order(column, options) { state.orders.push([column, options]); return builder; },
      async range(from, to) {
        calls.push({ from, to, orders: state.orders.slice() });
        if (failOnPage !== null && calls.length - 1 === failOnPage) return { data: null, error: new Error("boom") };
        const end = Math.min(to, from + 999);
        return { data: table.slice(from, end + 1), error: null };
      }
    };
    return builder;
  };
  return { build, calls };
}

test("2,500 rows come back as 2,500, not 1,000", async () => {
  const { build, calls } = fakeTable(2500);
  const { data, error } = await selectAll(build);
  assert.equal(error, null);
  assert.equal(data.length, 2500);
  assert.equal(data[2499].id, 2500);
  assert.equal(calls.length, 3);
  assert.deepEqual(calls.map((call) => [call.from, call.to]), [[0, 999], [1000, 1999], [2000, 2999]]);
  assert.deepEqual(calls[0].orders, [["id", { ascending: true }]]);
});

test("an exact multiple of the page size stops after one empty page", async () => {
  const { build, calls } = fakeTable(2000);
  const { data } = await selectAll(build);
  assert.equal(data.length, 2000);
  assert.equal(calls.length, 3);
});

test("maxRows caps the result and the last request", async () => {
  const { build, calls } = fakeTable(5000);
  const { data } = await selectAll(build, { maxRows: 1500 });
  assert.equal(data.length, 1500);
  assert.deepEqual(calls.map((call) => [call.from, call.to]), [[0, 999], [1000, 1499]]);
});

test("orderColumn: null adds no tiebreak order", async () => {
  const { build, calls } = fakeTable(10);
  await selectAll(build, { orderColumn: null });
  assert.deepEqual(calls[0].orders, []);
});

test("an error on any page is returned, never a partial list", async () => {
  const { build } = fakeTable(2500, { failOnPage: 1 });
  const { data, error } = await selectAll(build);
  assert.equal(data, null);
  assert.match(error.message, /boom/);
});

test("the row-cap checker flags .limit() over 1,000 but not comments or small limits", async () => {
  const { findRowCapViolations } = await import("../scripts/check-row-caps.mjs");
  const source = [
    "const a = await supabaseAdmin.from(\"x\").select(\"id\").limit(5000);",
    "const b = await supabaseAdmin.from(\"x\").select(\"id\").limit(1000);",
    "// a single .limit(5000) silently truncates",
    "   * .limit(20000) in a block comment",
    "query.limit(25); // fine"
  ].join("\n");
  assert.deepEqual(findRowCapViolations(source), [{ line: 1, limit: 5000 }]);
});
