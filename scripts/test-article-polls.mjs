import assert from "node:assert/strict";
import process from "node:process";

process.env.SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_SECRET_KEY ||= "test-service-role-key";
process.env.VOTE_HASH_SECRET ||= "test-vote-hash-secret-at-least-32-characters-long";

const { hashVoterToken, tallyPoll } = await import("../lib/article_poll_service.mjs");
const { findPollOption, loadPreseasonDataset, loadClassificationBySlug } = await import("../lib/preseason_data.mjs");

// --- hashVoterToken ----------------------------------------------------------
// Never trust a token that isn't at least a real random-looking value, and
// never let the same raw token hash differently between calls (both would
// make the "one vote per browser" guarantee meaningless).

assert.equal(hashVoterToken("a-believable-random-token-value"), hashVoterToken("a-believable-random-token-value"), "The same raw token must always hash to the same value.");
assert.notEqual(hashVoterToken("token-one-abcdefghijklmno"), hashVoterToken("token-two-abcdefghijklmno"), "Different tokens must hash differently.");
assert.throws(() => hashVoterToken("short"), /valid browser vote token/i, "A too-short token must be rejected rather than silently hashed.");
assert.throws(() => hashVoterToken(""), /valid browser vote token/i);

// --- tallyPoll -----------------------------------------------------------------
// Pure reducer: given a poll definition and raw vote rows, every option
// gets a count and a percentage of the total, and unknown option ids in
// the vote rows (which should never happen once castVote's validation is
// in place, but a tally must never silently misreport if it somehow did)
// are ignored rather than counted.

const samplePoll = {
  id: "champion-pick",
  question: "Who finishes first?",
  options: [
    { id: "mason", label: "Mason", context: "Simulated score 151" },
    { id: "springboro", label: "Springboro", context: "Simulated score 214" },
    { id: "thom-worthington", label: "Thom. Worthington", context: "Simulated score 222" }
  ]
};

const emptyTally = tallyPoll(samplePoll, []);
assert.equal(emptyTally.totalVotes, 0, "No votes yet must report zero total votes, not a fake or missing number.");
assert.deepEqual(emptyTally.options.map((option) => option.votes), [0, 0, 0]);
assert.deepEqual(emptyTally.options.map((option) => option.percent), [0, 0, 0], "Zero votes must never divide into a percentage.");

const rows = [
  { option_id: "mason" },
  { option_id: "mason" },
  { option_id: "mason" },
  { option_id: "springboro" },
  { option_id: "does-not-exist" }
];
const tally = tallyPoll(samplePoll, rows);
assert.equal(tally.totalVotes, 4, "An unknown option id in the raw rows must not inflate the total.");
const byId = Object.fromEntries(tally.options.map((option) => [option.id, option]));
assert.equal(byId.mason.votes, 3);
assert.equal(byId.springboro.votes, 1);
assert.equal(byId["thom-worthington"].votes, 0);
assert.equal(byId.mason.percent, 75, "3 of 4 votes must report as 75 percent.");
assert.equal(byId.springboro.percent, 25);

// --- findPollOption --------------------------------------------------------------
// This is the actual server-side defense against a forged vote: an option
// id that is not really one of this poll's options for this classification
// must be rejected, not silently accepted.

const fakeClassification = {
  polls: [samplePoll]
};
assert.ok(findPollOption(fakeClassification, "champion-pick", "mason"), "A real poll/option pair must be found.");
assert.equal(findPollOption(fakeClassification, "champion-pick", "not-a-real-team"), null, "A forged option id must be rejected.");
assert.equal(findPollOption(fakeClassification, "not-a-real-poll", "mason"), null, "A forged poll id must be rejected.");

// --- the real bundled dataset -----------------------------------------------
// Confirms the actual shipped JSON (not a stand-in) has exactly the shape
// every other part of this feature assumes: 8 classifications, each with a
// real articleSlug, 20 ranked + 5 honorable-mention Race Board rows, and
// exactly 3 Reader Predictions polls with at least 2 options apiece.

const dataset = await loadPreseasonDataset();
const classificationKeys = Object.keys(dataset.classifications || {});
assert.equal(classificationKeys.length, 8, "All eight classifications must be present in the bundled dataset.");

for (const key of classificationKeys) {
  const classification = dataset.classifications[key];
  assert.equal(classification.raceBoard.length, 25, `${key}: Race Board must carry all 20 ranked plus 5 honorable-mention rows.`);
  const rankedCount = classification.raceBoard.filter((row) => row.status === "ranked").length;
  const honorableCount = classification.raceBoard.filter((row) => row.status === "honorableMention").length;
  assert.equal(rankedCount, 20, `${key}: expected exactly 20 rows marked "ranked".`);
  assert.equal(honorableCount, 5, `${key}: expected exactly 5 rows marked "honorableMention".`);
  assert.equal(classification.polls.length, 3, `${key}: expected exactly 3 Reader Predictions polls.`);
  for (const poll of classification.polls) {
    assert.ok(poll.options.length >= 2, `${key}/${poll.id}: a poll needs at least 2 options.`);
  }

  // Score progression's final column must equal the Race Board score for
  // each of the same top-5 teams -- the two views are supposed to be the
  // same underlying numbers presented two different ways, and a mismatch
  // here would mean the animated chart tells a different story than the
  // official standings on the same page.
  const scoreByTeam = new Map(classification.raceBoard.map((row) => [row.team, row.score]));
  for (const teamProgress of classification.scoreProgression) {
    assert.equal(
      teamProgress.finalScore,
      scoreByTeam.get(teamProgress.team),
      `${key}: ${teamProgress.team}'s score progression final total must equal its Race Board score.`
    );
    assert.equal(
      teamProgress.cumulativeScores.at(-1),
      teamProgress.finalScore,
      `${key}: ${teamProgress.team}'s last cumulative score must equal its own final score.`
    );
  }
}

// --- loadClassificationBySlug ------------------------------------------------

const boysD1 = await loadClassificationBySlug("2026-preseason-boys-d1-top-20");
assert.ok(boysD1, "The real boys D1 article slug must resolve to a classification.");
assert.equal(boysD1.key, "boys-d1");
assert.equal(await loadClassificationBySlug("not-a-real-article-slug"), null, "An unknown article slug must resolve to null, not throw.");

console.log("Article polls: all checks passed.");
