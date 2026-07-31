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
    const {
      data: weeks,
      error: weeksError
    } = await supabaseAdmin
      .from("totw_weeks")
      .select(`
        id,
        week_slug,
        title,
        voting_closes
      `)
      .eq("status", "winner_announced")
      .order("voting_closes", {
        ascending: false
      })
      .limit(50);

    if (weeksError) {
      throw weeksError;
    }

    if (!weeks || weeks.length === 0) {
      return response.status(200).json({
        winners: []
      });
    }

    const weekIds = weeks.map((week) => week.id);

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
        winner
      `)
      .in("week_id", weekIds)
      .eq("winner", true);

    if (finalistsError) {
      throw finalistsError;
    }

    const finalists = finalistRows ?? [];

    const winners = weeks.map((week) => {
      const boysWinner =
        finalists.find(
          (finalist) =>
            finalist.week_id === week.id &&
            finalist.category === "boys"
        ) ?? null;

      const girlsWinner =
        finalists.find(
          (finalist) =>
            finalist.week_id === week.id &&
            finalist.category === "girls"
        ) ?? null;

      return {
        id: week.id,
        week_slug: week.week_slug,
        title: week.title,
        voting_closes: week.voting_closes,
        boys_winner: boysWinner,
        girls_winner: girlsWinner
      };
    });

    return response.status(200).json({
      winners
    });
  } catch (error) {
    console.error(
      "Team of the Week archive error:",
      error
    );

    return response.status(500).json({
      error:
        "Unable to load past Team of the Week winners right now."
    });
  }
}