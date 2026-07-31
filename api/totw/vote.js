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
    .update(`totw-browser:${voterToken}`)
    .digest("hex");
}

function categoryLabel(category) {
  return category === "girls" ? "girls" : "boys";
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

    const finalistId = cleanText(
      body.finalist_id,
      100
    );

    const voterToken = cleanText(
      body.voter_token,
      200
    );

    if (!finalistId) {
      return response.status(400).json({
        error: "Please choose a team."
      });
    }

    if (
      !voterToken ||
      voterToken.length < 20 ||
      !/^[a-zA-Z0-9._-]+$/.test(voterToken)
    ) {
      return response.status(400).json({
        error:
          "Your browser could not be verified. Refresh the page and try again."
      });
    }

    const {
      data: finalist,
      error: finalistError
    } = await supabaseAdmin
      .from("totw_finalists")
      .select(`
        id,
        week_id,
        category,
        team_name,
        school
      `)
      .eq("id", finalistId)
      .maybeSingle();

    if (finalistError) {
      throw finalistError;
    }

    if (!finalist) {
      return response.status(400).json({
        error:
          "That team is not a current Team of the Week finalist."
      });
    }

    const {
      data: week,
      error: weekError
    } = await supabaseAdmin
      .from("totw_weeks")
      .select(`
        id,
        status,
        voting_opens,
        voting_closes
      `)
      .eq("id", finalist.week_id)
      .maybeSingle();

    if (weekError) {
      throw weekError;
    }

    if (!week) {
      return response.status(400).json({
        error:
          "The Team of the Week voting period could not be found."
      });
    }

    const currentTime = new Date();
    const votingOpens = new Date(
      week.voting_opens
    );
    const votingCloses = new Date(
      week.voting_closes
    );

    const votingIsOpen =
      week.status === "voting_open" &&
      currentTime >= votingOpens &&
      currentTime <= votingCloses;

    if (!votingIsOpen) {
      return response.status(400).json({
        error: "Team of the Week voting is currently closed."
      });
    }

    const voterHash = createVoterHash(
      voterToken
    );

    const {
      data: voteResults,
      error: voteError
    } = await supabaseAdmin.rpc(
      "cast_totw_vote",
      {
        p_finalist_id: finalist.id,
        p_voter_hash: voterHash,
        p_cooldown_seconds: COOLDOWN_SECONDS
      }
    );

    if (voteError) {
      throw voteError;
    }

    const voteResult = Array.isArray(
      voteResults
    )
      ? voteResults[0]
      : voteResults;

    if (!voteResult) {
      throw new Error(
        "The Team of the Week voting function returned no result."
      );
    }

    const retryAfterSeconds = Math.max(
      1,
      Number(
        voteResult.retry_after_seconds
      ) || COOLDOWN_SECONDS
    );

    const voteCategory =
      voteResult.vote_category ||
      finalist.category;

    if (!voteResult.accepted) {
      if (voteResult.reason === "cooldown") {
        response.setHeader(
          "Retry-After",
          String(retryAfterSeconds)
        );

        return response.status(429).json({
          error:
            `Please wait ${retryAfterSeconds} seconds before voting for another ${categoryLabel(voteCategory)} team.`,
          retry_after_seconds: retryAfterSeconds,
          category: voteCategory
        });
      }

      if (voteResult.reason === "voting_closed") {
        return response.status(400).json({
          error:
            "Team of the Week voting is currently closed."
        });
      }

      if (
        voteResult.reason === "finalist_not_found"
      ) {
        return response.status(400).json({
          error:
            "That team is not a current Team of the Week finalist."
        });
      }

      if (voteResult.reason === "invalid_voter") {
        return response.status(400).json({
          error:
            "Your browser could not be verified. Refresh the page and try again."
        });
      }

      return response.status(400).json({
        error: "Your vote could not be accepted."
      });
    }

    return response.status(201).json({
      success: true,
      message:
        `Your vote for ${finalist.team_name} has been recorded. ` +
        `You can vote for another ${categoryLabel(finalist.category)} team in ${COOLDOWN_SECONDS} seconds.`,
      retry_after_seconds: COOLDOWN_SECONDS,
      category: finalist.category,
      team_name: finalist.team_name
    });
  } catch (error) {
    console.error(
      "Team of the Week voting error:",
      error
    );

    return response.status(500).json({
      error:
        "Unable to record your Team of the Week vote right now."
    });
  }
}