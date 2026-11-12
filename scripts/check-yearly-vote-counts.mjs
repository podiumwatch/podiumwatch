// Read-only: for every 2026 award category, the public counter
// (yoty2026:count:<slug>, what the voting pages show) must equal the
// counted ballots (yoty2026:ballots:<slug>, what decides the winner), for
// every finalist. Prints one line per category and exits 1 on any
// difference. Changes nothing.
//
//   node --env-file=.env.local scripts/check-yearly-vote-counts.mjs
//
// Added 2026-11-12 after the Nov. 10 morning gaps (votes cast before the
// counter existed, and one vote left in the older one-vote list) were
// reconciled; see docs/DECISIONS.md.
import { supabaseAdmin as db } from "../lib/supabase-admin.mjs";
import { yearlyVoteTally, publicVoteCounts } from "../lib/yearly_awards_2026_votes.mjs";

const { data: categories, error } = await db.from("yearly_award_categories").select("slug, label").eq("season", 2026).order("slug");
if (error) throw error;
let bad = 0;
for (const category of categories) {
  const [tally, live] = await Promise.all([yearlyVoteTally(category.slug), publicVoteCounts(category.slug)]);
  const diffs = [...new Set([...Object.keys(tally.counts), ...Object.keys(live.counts)])]
    .filter((key) => (tally.counts[key] || 0) !== (live.counts[key] || 0))
    .map((key) => `${key}: counted ${tally.counts[key] || 0}, public ${live.counts[key] || 0}`);
  if (diffs.length) bad += 1;
  console.log(`${diffs.length ? "DIFF" : "ok  "} ${category.label}: counted ${tally.total}, public ${live.total}${diffs.length ? ` | ${diffs.join("; ")}` : ""}`);
}
console.log(bad ? `${bad} categories differ.` : `All ${categories.length} categories match.`);
process.exit(bad ? 1 : 0);
