import { supabaseAdmin } from "../../lib/supabase-admin.mjs";

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
        message: "Your vote has been recorded."
      });
    }

    const finalistId = cleanText(body.finalist_id, 100);

    if (!finalistId) {
      return response.status(400).json({
        error: "Please choose an athlete."
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

    const currentTime = new Date();
    const votingOpens = new Date(week.voting_opens);
    const votingCloses = new Date(week.voting_closes);

    const votingIsOpen =
      week.status === "voting_open" &&
      currentTime >= votingOpens &&
      currentTime <= votingCloses;

    if (!votingIsOpen) {
      return response.status(400).json({
        error: "Voting is currently closed."
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

    const { error: voteError } = await supabaseAdmin
      .from("aotw_votes")
      .insert({
        week_id: week.id,
        finalist_id: finalist.id,
        email_hash: null
      });

    if (voteError) {
      throw voteError;
    }

    return response.status(201).json({
      success: true,
      message: `Your vote for ${finalist.athlete_name} has been recorded. You may vote again.`
    });
  } catch (error) {
    console.error("Athlete of the Week voting error:", error);

    return response.status(500).json({
      error: "Unable to record your vote right now."
    });
  }
}