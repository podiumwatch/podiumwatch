import { supabaseAdmin } from "../../lib/supabase-admin.mjs";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");

    return response.status(405).json({
      error: "Method not allowed."
    });
  }

  try {
    const currentTime = new Date().toISOString();

    const { data: week, error: weekError } = await supabaseAdmin
      .from("aotw_weeks")
      .select(`
        id,
        week_slug,
        title,
        nomination_opens,
        nomination_closes,
        voting_opens,
        voting_closes,
        status
      `)
      .lte("nomination_opens", currentTime)
      .order("nomination_opens", {
        ascending: false
      })
      .limit(1)
      .maybeSingle();

    if (weekError) {
      throw weekError;
    }

    if (!week) {
      return response.status(200).json({
        week: null,
        finalists: [],
        winner: null
      });
    }

    let finalists = [];

    const shouldShowFinalists = [
      "voting_open",
      "voting_closed",
      "winner_announced"
    ].includes(week.status);

    if (shouldShowFinalists) {
      const {
        data: finalistData,
        error: finalistError
      } = await supabaseAdmin
        .from("aotw_finalists")
        .select(`
          id,
          athlete_name,
          school,
          grade,
          image_url,
          achievement,
          description,
          sort_order,
          winner
        `)
        .eq("week_id", week.id)
        .order("sort_order", {
          ascending: true
        })
        .order("athlete_name", {
          ascending: true
        });

      if (finalistError) {
        throw finalistError;
      }

      finalists = finalistData ?? [];

      if (finalists.length) {
        const { data: voteRows, error: votesError } =
          await supabaseAdmin
            .from("aotw_votes")
            .select("finalist_id")
            .in(
              "finalist_id",
              finalists.map((finalist) => finalist.id)
            );

        if (votesError) {
          throw votesError;
        }

        const voteCounts = new Map();

        for (const row of voteRows ?? []) {
          voteCounts.set(
            row.finalist_id,
            (voteCounts.get(row.finalist_id) || 0) + 1
          );
        }

        finalists = finalists.map((finalist) => ({
          ...finalist,
          vote_count: voteCounts.get(finalist.id) || 0
        }));
      }
    }

    const winner =
      finalists.find(
        (finalist) => finalist.winner === true
      ) ?? null;

    return response.status(200).json({
      week,
      finalists,
      winner
    });
  } catch (error) {
    console.error(
      "Athlete of the Week current route error:",
      error
    );

    return response.status(500).json({
      error:
        "Unable to load Athlete of the Week right now."
    });
  }
}