import { loadSpectatorDay } from "../../lib/race_viewer_service.mjs";

function cleanText(value) {
  return String(value ?? "").trim();
}

function parseBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error("The submitted request is invalid.");
      error.status = 400;
      throw error;
    }
  }
  return request.body || {};
}

// Fully anonymous, no account required -- the entire point of the
// spectator tier. Returns lib/race_viewer_service.mjs's spectator
// projection only: checkpoints, real participant names, and times.
// Never goals, targets, coach notes, or any internal/device column, and
// nothing at all unless the coach explicitly turned
// race_sessions.spectator_visible on for at least one race that day
// (see install/13_GUARDIAN_AND_SPECTATOR_ACCESS.sql). Accepts EITHER
// session_id (a specific race, or a per-race link copied before the
// team-day link existed) or team_id (the team-wide link) -- either way
// returns the whole day's spectator-visible races for the switcher, plus
// full detail for whichever one is selected (see loadSpectatorDay()'s
// own header comment for the exact selection rule). POST + no-store,
// kept consistent with this project's universal API convention rather
// than a GET+CDN-cached route -- public/scripts/race-poll.js's polling
// interval, tab-visibility pause, and backoff already bound load
// adequately at this site's scale.
export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const body = parseBody(request);
    const sessionId = cleanText(body.session_id);
    const teamId = cleanText(body.team_id);

    if (!sessionId && !teamId) {
      const error = new Error("A race or team ID is required.");
      error.status = 400;
      throw error;
    }

    const data = await loadSpectatorDay({ teamId, sessionId });
    return response.status(200).json(data);
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) {
      console.error("The public race request could not be completed.", error);
    }
    return response.status(status).json({
      error: status < 500 ? error.message : "This race could not be loaded."
    });
  }
}
