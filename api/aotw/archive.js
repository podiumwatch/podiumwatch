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
    const { data: weeks, error: weeksError } = await supabaseAdmin
      .from("aotw_weeks")
      .select(`
        id,
        week_slug,
        title,
        voting_closes
      `)
      .eq("status", "winner_announced")
      .order("voting_closes", { ascending: false })
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

    const { data: finalists, error: finalistsError } =
      await supabaseAdmin
        .from("aotw_finalists")
        .select(`
          id,
          week_id,
          athlete_name,
          school,
          grade,
          image_url,
          achievement,
          description
        `)
        .eq("winner", true)
        .in("week_id", weekIds);

    if (finalistsError) {
      throw finalistsError;
    }

    const winners = weeks
      .map((week) => {
        const athlete = finalists?.find(
          (finalist) => finalist.week_id === week.id
        );

        if (!athlete) {
          return null;
        }

        return {
          week_slug: week.week_slug,
          title: week.title,
          voting_closes: week.voting_closes,
          athlete
        };
      })
      .filter(Boolean);

    return response.status(200).json({
      winners
    });
  } catch (error) {
    console.error("Athlete of the Week archive error:", error);

    return response.status(500).json({
      error: "Unable to load past winners right now."
    });
  }
}