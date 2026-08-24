import { createHmac } from "node:crypto";
import { supabaseAdmin } from "./supabase-admin.mjs";
import { findPollOption, loadClassificationBySlug } from "./preseason_data.mjs";

// Podium Watch "Reader Predictions" -- real, shared-results voting on the
// three fixed-choice polls embedded in each 2026 preseason cross country
// article. See install/22_ARTICLE_POLLS.sql for the full schema reasoning
// and why this is deliberately not built on top of fan_poll_service.mjs.

function error(message, status = 400, code = "ARTICLE_POLL_ERROR") {
  const value = new Error(message);
  value.status = status;
  value.code = code;
  return value;
}

function clean(value, max = 200) {
  return String(value ?? "").trim().slice(0, max);
}

function requireVoteHashSecret() {
  const secret = process.env.VOTE_HASH_SECRET;

  if (!secret || secret.length < 32) {
    throw error(
      "VOTE_HASH_SECRET is missing or is not long enough.",
      500,
      "VOTE_HASH_SECRET_MISSING"
    );
  }

  return secret;
}

// The raw browser token (a client-generated crypto.randomUUID(), kept in
// localStorage) is only ever hashed here, in the same HMAC-SHA256-plus-
// prefix shape as fan_poll_service.mjs's createVoterEmailHash -- it never
// reaches article_poll_votes in raw form.
export function hashVoterToken(rawToken) {
  const cleaned = clean(rawToken, 200);
  if (cleaned.length < 16) {
    throw error("A valid browser vote token is required.", 400, "INVALID_VOTER_TOKEN");
  }
  return createHmac("sha256", requireVoteHashSecret())
    .update(`article-poll:${cleaned}`)
    .digest("hex");
}

// Pure reducer, pulled out so it can be unit tested without a live
// database -- matches the computeMovement/countBallotsByWeekId pattern
// already established in lib/fan_poll_service.mjs. Takes one poll
// definition (question + options, from the bundled JSON) and the raw vote
// rows for that poll, returns every option with its vote count and share
// of the total, plus the total vote count.
export function tallyPoll(poll, voteRows) {
  const counts = new Map((poll.options || []).map((option) => [option.id, 0]));

  for (const row of voteRows || []) {
    if (counts.has(row.option_id)) {
      counts.set(row.option_id, counts.get(row.option_id) + 1);
    }
  }

  const totalVotes = [...counts.values()].reduce((sum, count) => sum + count, 0);

  const options = (poll.options || []).map((option) => {
    const votes = counts.get(option.id) || 0;
    return {
      id: option.id,
      label: option.label,
      context: option.context || "",
      votes,
      percent: totalVotes > 0 ? Math.round((votes / totalVotes) * 1000) / 10 : 0
    };
  });

  return { pollId: poll.id, question: poll.question, totalVotes, options };
}

async function getVoteRowsForArticle(articleSlug) {
  const { data, error: queryError } = await supabaseAdmin
    .from("article_poll_votes")
    .select("poll_id, option_id, voter_token_hash")
    .eq("article_slug", articleSlug);

  if (queryError) {
    throw queryError;
  }

  return data || [];
}

// Full results for every poll on one article, plus (when a voter token is
// supplied) which of those polls this exact browser has already voted in
// and which option it picked -- lets a returning visitor see their own
// past vote reflected instead of the still-open ballot form.
export async function getArticleResults({ articleSlug, voterToken } = {}) {
  const cleanSlug = clean(articleSlug, 200);
  if (!cleanSlug) {
    throw error("A real article is required.", 400, "MISSING_ARTICLE");
  }

  const match = await loadClassificationBySlug(cleanSlug);
  if (!match) {
    throw error("That article could not be found.", 404, "ARTICLE_NOT_FOUND");
  }

  const rows = await getVoteRowsForArticle(cleanSlug);
  const rowsByPoll = new Map();
  for (const row of rows) {
    if (!rowsByPoll.has(row.poll_id)) rowsByPoll.set(row.poll_id, []);
    rowsByPoll.get(row.poll_id).push(row);
  }

  const voterHash = voterToken ? hashVoterToken(voterToken) : null;

  const polls = (match.classification.polls || []).map((poll) => {
    const pollRows = rowsByPoll.get(poll.id) || [];
    const tally = tallyPoll(poll, pollRows);
    const myVote = voterHash ? pollRows.find((row) => row.voter_token_hash === voterHash) : null;
    return { ...tally, hasVoted: Boolean(myVote), myOptionId: myVote?.option_id || null };
  });

  return { articleSlug: cleanSlug, polls };
}

// Casts one vote: validates the poll/option are real for this article
// (never trusts the client past "which option did you pick"), then relies
// on the database's own unique(article_slug, poll_id, voter_token_hash)
// constraint to atomically reject a repeat vote from the same browser --
// a race-prone check-then-insert is never the actual guarantee, exactly
// like cast_fan_poll_ballot_v1's approach to the same problem. A repeat
// vote is not treated as an error: it resolves the same way a first vote
// does, just without writing a second row, so a duplicate click never
// surfaces as a scary failure to the reader.
export async function castVote({ articleSlug, pollId, optionId, voterToken, voterIpHash }) {
  const cleanSlug = clean(articleSlug, 200);
  const cleanPollId = clean(pollId, 100);
  const cleanOptionId = clean(optionId, 100);

  if (!cleanSlug || !cleanPollId || !cleanOptionId) {
    throw error("A poll, an option, and an article are all required to vote.", 400, "MISSING_FIELDS");
  }

  const match = await loadClassificationBySlug(cleanSlug);
  if (!match) {
    throw error("That article could not be found.", 404, "ARTICLE_NOT_FOUND");
  }

  const found = findPollOption(match.classification, cleanPollId, cleanOptionId);
  if (!found) {
    throw error("That poll or option is not valid for this article.", 400, "INVALID_POLL_OPTION");
  }

  const voterHash = hashVoterToken(voterToken);

  const { error: insertError } = await supabaseAdmin
    .from("article_poll_votes")
    .insert({
      article_slug: cleanSlug,
      poll_id: cleanPollId,
      option_id: cleanOptionId,
      voter_token_hash: voterHash,
      voter_ip_hash: clean(voterIpHash, 200) || null
    });

  // 23505 = unique_violation -- this exact browser already voted in this
  // exact poll on this exact article. Not an error: fall through and
  // return the current results the same as a fresh vote would.
  if (insertError && insertError.code !== "23505") {
    throw insertError;
  }

  const rows = await getVoteRowsForArticle(cleanSlug);
  const pollRows = rows.filter((row) => row.poll_id === cleanPollId);
  const tally = tallyPoll(found.poll, pollRows);

  return {
    articleSlug: cleanSlug,
    poll: { ...tally, hasVoted: true, myOptionId: cleanOptionId },
    alreadyVoted: Boolean(insertError)
  };
}
