import { createHmac } from "node:crypto";
import { supabaseAdmin } from "../../lib/supabase-admin.mjs";

const COOLDOWN_SECONDS = 45;

function cleanText(value, maximumLength) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maximumLength);
}

function readBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      return {};
    }
  }

  return request.body ?? {};
}

function createVoterHash(voterToken) {
  const voteHashSecret = process.env.VOTE_HASH_SECRET;

  if (!voteHashSecret || voteHashSecret.length < 32) {
    throw new Error(
      "VOTE_HASH_SECRET is missing or is not long enough."
    );
  }

  return createHmac("sha256", voteHashSecret)
    .update(`aotw-browser:${voterToken}`)
    .digest("hex");
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");

    return response.status(405).json({
      error: "Method not allowed."
    });
  }

  try {
    const body = readBody(request);

    /*
      Hidden field used to catch simple automated submissions.
      Real users should leave this empty.
    */
    if (cleanText(body.website, 200)) {
      return response.status(200).json({
        success: true,
        message: "Your vote has been recorded.",
        retry_after_seconds: COOLDOWN_SECONDS
      });
    }

    const finalistId = cleanText(body.finalist_id, 100);
    const voterToken = cleanText(body.voter_token, 200);

    if (!finalistId) {
      return response.status(400).json({
        error: "Please choose an athlete."
      });
    }

    if (
      !voterToken ||
      voterToken.length < 20 ||
      !/^[a-zA-Z0-9._-]+$/.test(voterToken)
    ) {
      return response.status(400).json({
        error: "Your browser could not be verified. Refresh the page and try again."
      });
    }

    const { data: week, error: weekError } = await supabaseAdmin
      .from("aotw_weeks")
      .select(`
        id,
        status,
        voting_opens,
        voting_closes
      `)
      .order("voting_opens", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (weekError) {
      throw weekError;
    }

    if (!week) {
      return response.status(400).json({
        error: "There is not an active voting period."
      });
    }

    const { data: finalist, error: finalistError } =
      await supabaseAdmin
        .from("aotw_finalists")
        .select(`
          id,
          athlete_name,
          week_id
        `)
        .eq("id", finalistId)
        .eq("week_id", week.id)
        .maybeSingle();

    if (finalistError) {
      throw finalistError;
    }

    if (!finalist) {
      return response.status(400).json({
        error: "That athlete is not a finalist for the current week."
      });
    }

    const voterHash = createVoterHash(voterToken);

    const { data: voteResults, error: voteError } =
      await supabaseAdmin.rpc("cast_aotw_vote", {
        p_finalist_id: finalist.id,
        p_voter_hash: voterHash,
        p_cooldown_seconds: COOLDOWN_SECONDS
      });

    if (voteError) {
      throw voteError;
    }

    const voteResult = Array.isArray(voteResults)
      ? voteResults[0]
      : voteResults;

    if (!voteResult) {
      throw new Error("The voting function returned no result.");
    }

    const retryAfterSeconds = Math.max(
      1,
      Number(voteResult.retry_after_seconds) ||
        COOLDOWN_SECONDS
    );

    if (!voteResult.accepted) {
      if (voteResult.reason === "cooldown") {
        response.setHeader(
          "Retry-After",
          String(retryAfterSeconds)
        );

        return response.status(429).json({
          error: `Please wait ${retryAfterSeconds} seconds before voting again.`,
          retry_after_seconds: retryAfterSeconds
        });
      }

      if (voteResult.reason === "voting_closed") {
        return response.status(400).json({
          error: "Voting is currently closed."
        });
      }

      if (voteResult.reason === "finalist_not_found") {
        return response.status(400).json({
          error: "That athlete is not a finalist for the current week."
        });
      }

      return response.status(400).json({
        error: "Your vote could not be accepted."
      });
    }

    return response.status(201).json({
      success: true,
      message: `Your vote for ${finalist.athlete_name} has been recorded. You can vote again in ${COOLDOWN_SECONDS} seconds.`,
      retry_after_seconds: COOLDOWN_SECONDS
    });
  } catch (error) {
    console.error(
      "Athlete of the Week voting error:",
      error
    );

    return response.status(500).json({
      error: "Unable to record your vote right now."
    });
  }
}