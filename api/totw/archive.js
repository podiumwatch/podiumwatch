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

    // A week from before Team of the Week combined its boys/girls
    // categories into one (see lib/awards_service.mjs) could still have
    // two winner:true rows -- team keeps just the first for that case
    // rather than erroring, since every week going forward will only
    // ever have exactly one.
    const winners = weeks
      .map((week) => {
        const team =
          finalists.find(
            (finalist) => finalist.week_id === week.id
          ) ?? null;

        if (!team) {
          return null;
        }

        return {
          week_slug: week.week_slug,
          title: week.title,
          voting_closes: week.voting_closes,
          team
        };
      })
      .filter(Boolean);

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