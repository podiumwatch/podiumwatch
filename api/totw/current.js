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
    const { data: week, error: weekError } = await supabaseAdmin
      .from("totw_weeks")
      .select(`
        id,
        week_slug,
        title,
        nomination_opens,
        nomination_closes,
        voting_opens,
        voting_closes,
        status,
        created_at
      `)
      .order("nomination_opens", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (weekError) {
      throw weekError;
    }

    if (!week) {
      return response.status(200).json({
        week: null,
        boys_finalists: [],
        girls_finalists: [],
        boys_winner: null,
        girls_winner: null
      });
    }

    const finalistStatuses = [
      "voting_open",
      "voting_closed",
      "winner_announced"
    ];

    let finalists = [];

    if (finalistStatuses.includes(week.status)) {
      const {
        data: finalistRows,
        error: finalistsError
      } = await supabaseAdmin
        .from("totw_finalists")
        .select(`
          id,
          week_id,
          category,
          team_name,
          school,
          sport,
          division,
          image_url,
          achievement,
          description,
          sort_order,
          winner
        `)
        .eq("week_id", week.id)
        .order("category", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("team_name", { ascending: true });

      if (finalistsError) {
        throw finalistsError;
      }

      finalists = finalistRows ?? [];
    }

    const boysFinalists = finalists.filter(
      (finalist) => finalist.category === "boys"
    );

    const girlsFinalists = finalists.filter(
      (finalist) => finalist.category === "girls"
    );

    const boysWinner =
      week.status === "winner_announced"
        ? boysFinalists.find(
            (finalist) => finalist.winner === true
          ) ?? null
        : null;

    const girlsWinner =
      week.status === "winner_announced"
        ? girlsFinalists.find(
            (finalist) => finalist.winner === true
          ) ?? null
        : null;

    return response.status(200).json({
      week,
      boys_finalists: boysFinalists,
      girls_finalists: girlsFinalists,
      boys_winner: boysWinner,
      girls_winner: girlsWinner
    });
  } catch (error) {
    console.error(
      "Team of the Week current week error:",
      error
    );

    return response.status(500).json({
      error: "Unable to load Team of the Week right now."
    });
  }
}