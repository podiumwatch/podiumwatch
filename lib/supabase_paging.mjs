// Reads more than 1,000 rows from Supabase correctly.
//
// PostgREST returns at most "Max rows" per request (1,000 by default), no
// matter what .limit() asks for. Before 2026-11-09, 46 queries in api/ and
// lib/ asked for .limit(2000) up to .limit(20000) and silently got 1,000:
// the athlete directory showed exactly 1,000 athletes, State Leaders built
// its list from an arbitrary 1,000 performances, and admin totals
// disagreed. (WO-02 in docs/MASTER_HANDOFF; scripts/check-row-caps.mjs
// now fails `npm run check` if a .limit() over 1,000 comes back.)
//
// selectAll() pages through with .range() until a short page, so the
// result never depends on the project's Max rows setting.
//
//   const { data, error } = await selectAll(
//     () => supabaseAdmin.from("athlete_profiles").select("id, slug").eq("public_visible", true),
//     { maxRows: 20000 }
//   );
//
// buildQuery must return a NEW query builder each call (a builder can only
// be awaited once). Pages are ordered by `orderColumn` (default "id") as a
// tiebreaker after any order the caller already set, so rows can't shift
// between pages. Pass orderColumn: null for a table with no id column when
// the caller's own order is already unique.
export const SUPABASE_PAGE_SIZE = 1000;

export async function selectAll(buildQuery, { pageSize = SUPABASE_PAGE_SIZE, maxRows = 200000, orderColumn = "id" } = {}) {
  if (typeof buildQuery !== "function") throw new TypeError("selectAll needs a function that builds the query.");
  const size = Math.max(1, Math.min(Number(pageSize) || SUPABASE_PAGE_SIZE, SUPABASE_PAGE_SIZE));
  const cap = Math.max(0, Number(maxRows) || 0);
  const rows = [];

  for (let from = 0; from < cap; from += size) {
    const to = Math.min(from + size, cap) - 1;
    let query = buildQuery();
    if (orderColumn) query = query.order(orderColumn, { ascending: true });
    const { data, error } = await query.range(from, to);
    if (error) return { data: null, error };
    const page = data || [];
    rows.push(...page);
    if (page.length < to - from + 1) break;
  }

  return { data: rows, error: null };
}
