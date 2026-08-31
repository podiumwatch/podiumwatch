import { getLeaders, getLeadersFilters } from "../../lib/athlete_leaders_service.mjs";

// Public, read-only State Leaders endpoint -- one request returns both
// the available filter choices (real distinct years, the 4 Ohio XC
// divisions) and the ranked list for whatever filters were supplied,
// so the page's first load and every filter change use the same call
// shape. Matches this project's existing POST-for-reads public API
// convention (api/fan-poll/index.js, api/athletes/index.js).

function parseBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error("The request is invalid.");
      error.status = 400;
      throw error;
    }
  }

  return request.body || {};
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const body = parseBody(request);
    const filters = await getLeadersFilters();

    const gender = String(body.gender || "boys");
    const seasonYear = Number(body.season_year) || filters.years[0] || new Date().getFullYear();

    const { entries, total_before_limit } = await getLeaders({
      gender,
      seasonYear,
      grade: body.grade,
      divisionNumber: body.division_number,
      limit: 100
    });

    return response.status(200).json({
      filters,
      gender,
      season_year: seasonYear,
      entries,
      total_before_limit
    });
  } catch (error) {
    const status = Number(error?.status) || 500;

    if (status >= 500) {
      console.error("State Leaders error:", error);
    }

    return response.status(status).json({
      error: status < 500 ? error.message : "State Leaders could not be loaded right now."
    });
  }
}
